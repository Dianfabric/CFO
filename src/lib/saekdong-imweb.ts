/**
 * 색동 아임웹(imweb) 쇼핑몰 REST API v2 연동 — 매출 집계.
 *
 * 서버 전용 (API 키 사용). 개인정보(주문자 이름/주소/전화)는 다루지 않고
 * 금액·날짜·상품명만 집계한다.
 *
 * 인증: GET /v2/auth?key=&secret= → access_token
 * 주문: GET /v2/shop/orders?order_date_from=&order_date_to=&limit=&offset=
 * 상품: GET /v2/shop/orders/{order_no}/prod-orders → items[].prod_name
 */

const BASE = 'https://api.imweb.me/v2'

// 호출 제한 5건/초 → 모든 아임웹 호출 사이 최소 간격 보장 (버스트 방지 위해 넉넉히 500ms)
let lastCall = 0
async function throttle() {
  const gap = 500
  const wait = lastCall + gap - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
}

// 토큰 짧은 캐싱 (요청마다 재발급 방지 — 호출 제한 5건/초 보호)
let cachedToken: { token: string; expires: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.token
  const key = process.env.IMWEB_API_KEY
  const secret = process.env.IMWEB_SECRET_KEY
  if (!key || !secret) {
    throw new Error('IMWEB_API_KEY / IMWEB_SECRET_KEY 가 .env 에 없습니다.')
  }
  await throttle()
  const r = await fetch(`${BASE}/auth?key=${key}&secret=${secret}`)
  const j = (await r.json()) as { access_token?: string; msg?: string }
  if (!j.access_token) throw new Error(`아임웹 인증 실패: ${j.msg ?? 'unknown'}`)
  // 토큰 수명 보수적으로 20분 캐싱
  cachedToken = { token: j.access_token, expires: Date.now() + 20 * 60 * 1000 }
  return j.access_token
}

async function api<T>(path: string, retry = 2): Promise<T> {
  const token = await getToken()
  await throttle()
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'access-token': token },
  })
  const j = (await r.json()) as { code?: number; msg?: string; data?: T }
  // 호출 폭주(TOO MANY REQUEST) 시 잠시 대기 후 재시도
  if (j.msg === 'TOO MANY REQUEST' && retry > 0) {
    await new Promise((res) => setTimeout(res, 1500))
    return api(path, retry - 1)
  }
  if (j.code !== 200) throw new Error(`아임웹 API 오류: ${j.msg ?? j.code}`)
  return j.data as T
}

// ── 타입 ──
interface OrderRow {
  order_no: string
  order_time: number // Unix seconds
  order_type: string
  payment: { payment_amount: number; price_currency: string } | null
}

interface ProdItem {
  prod_no: number
  prod_name: string
  // payment.price = 그 상품 항목 결제 총액(원), payment.count = 수량
  payment?: { price?: number; count?: number }
}

interface ProdOrderRow {
  order_no: string
  items?: ProdItem[]
}

export interface MonthlyPoint {
  month: string // YYYY-MM (KST)
  revenue: number
  orders: number
}

export interface ProductSales {
  prodName: string
  revenue: number
  qty: number
}

export interface SaekdongSales {
  today: number
  thisWeek: number
  thisMonth: number
  monthly: MonthlyPoint[] // 최근 N개월 월별 매출 추이
  products: ProductSales[] // 올해(연초~오늘) 제품별
  productYear: string // 제품 집계 기준 연도 (예: '2026')
  orderCount: number
  fetchedAt: string
  error?: string
}

// KST 기준 YYYY-MM-DD
function kstDate(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) // sv-SE = YYYY-MM-DD
}

// KST 기준 YYYY-MM
function kstMonth(unixSec: number): string {
  return kstDate(unixSec).slice(0, 7)
}

function ymd(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

// 기간 내 모든 주문 (페이지네이션) — 한 번의 from~to
async function fetchOrders(from: string, to: string): Promise<OrderRow[]> {
  const all: OrderRow[] = []
  let offset = 0
  const limit = 50
  for (let page = 0; page < 40; page++) {
    // 최대 2000건 안전장치
    const data = await api<{ list: OrderRow[] }>(
      `/shop/orders?order_date_from=${from}&order_date_to=${to}&limit=${limit}&offset=${offset}`,
    )
    const list = data?.list ?? []
    all.push(...list)
    if (list.length < limit) break
    offset += limit
  }
  return all
}

// 아임웹은 검색 기간 최대 3개월 제약 → 3개월 청크로 나눠 조회
async function fetchOrdersLong(fromDate: Date, toDate: Date): Promise<OrderRow[]> {
  const all: OrderRow[] = []
  let chunkStart = new Date(fromDate)
  for (let i = 0; i < 8 && chunkStart < toDate; i++) {
    // 안전장치 8청크(=24개월)
    const chunkEnd = new Date(chunkStart)
    chunkEnd.setMonth(chunkEnd.getMonth() + 3)
    const end = chunkEnd > toDate ? toDate : chunkEnd
    const chunk = await fetchOrders(ymd(chunkStart), ymd(end)) // to exclusive → 경계 중복 없음
    all.push(...chunk)
    chunkStart = end
  }
  return all
}

/**
 * 색동 매출 집계 — 최근 monthRange 개월 (기본 12).
 * 오늘/이번주/이번달 합계 + 월별 추이 + 이번 달 제품별.
 */
export async function getSaekdongSales(monthRange = 12): Promise<SaekdongSales> {
  const now = new Date()
  const todayStr = ymd(now)
  // monthRange 개월 전 1일부터
  const fromDate = new Date(now.getFullYear(), now.getMonth() - (monthRange - 1), 1)
  // order_date_to 는 exclusive(그날 00:00까지)라 오늘 주문 포함 위해 +1일
  const toDate = new Date(now)
  toDate.setDate(toDate.getDate() + 1)

  // 이번 주 월요일 (KST)
  const monday = new Date(now)
  const jsDow = monday.getDay() // 0=일
  const offsetToMon = jsDow === 0 ? -6 : 1 - jsDow
  monday.setDate(monday.getDate() + offsetToMon)
  const mondayStr = ymd(monday)

  // 이번 달 1일 / YYYY-MM
  const monthStart = ymd(new Date(now.getFullYear(), now.getMonth(), 1))
  // 제품별은 올해(연초~오늘) 집계
  const thisYear = String(now.getFullYear())

  try {
    const orders = await fetchOrdersLong(fromDate, toDate)

    // 월별 집계 + 오늘/이번주/이번달 합계
    const byMonth = new Map<string, { revenue: number; orders: number }>()
    let today = 0
    let thisWeek = 0
    let thisMonth = 0
    for (const o of orders) {
      const amt = o.payment?.payment_amount ?? 0
      const day = kstDate(o.order_time)
      const month = kstMonth(o.order_time)
      const cur = byMonth.get(month) ?? { revenue: 0, orders: 0 }
      cur.revenue += amt
      cur.orders += 1
      byMonth.set(month, cur)
      if (day === todayStr) today += amt
      if (day >= mondayStr) thisWeek += amt
      if (day >= monthStart) thisMonth += amt
    }

    // 최근 monthRange 개월 연속 배열 (빈 달 0)
    const monthly: MonthlyPoint[] = []
    for (let i = monthRange - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = ymd(d).slice(0, 7)
      const v = byMonth.get(key) ?? { revenue: 0, orders: 0 }
      monthly.push({ month: key, revenue: v.revenue, orders: v.orders })
    }

    // 올해 제품별 집계 — 올해(연초~오늘) 주문의 prod-orders (호출 제한 보호 위해 상한)
    const thisYearOrders = orders.filter(
      (o) => kstDate(o.order_time).slice(0, 4) === thisYear,
    )
    const prodMap = new Map<string, { revenue: number; qty: number }>()
    const targetOrders = thisYearOrders.slice(0, 300) // 올해 주문 상한 300건
    for (const o of targetOrders) {
      try {
        const rows = await api<ProdOrderRow[]>(
          `/shop/orders/${o.order_no}/prod-orders`,
        )
        for (const row of rows ?? []) {
          for (const it of row.items ?? []) {
            const name = it.prod_name || `상품#${it.prod_no}`
            const price = it.payment?.price ?? 0 // 항목 결제 총액
            const qty = it.payment?.count ?? 1
            const cur = prodMap.get(name) ?? { revenue: 0, qty: 0 }
            cur.revenue += price
            cur.qty += qty
            prodMap.set(name, cur)
          }
        }
      } catch {
        // 개별 주문 상세 실패는 건너뜀
      }
    }
    const products: ProductSales[] = Array.from(prodMap.entries())
      .map(([prodName, v]) => ({ prodName, revenue: v.revenue, qty: v.qty }))
      .sort((a, b) => b.revenue - a.revenue)

    return {
      today,
      thisWeek,
      thisMonth,
      monthly,
      products,
      productYear: thisYear,
      orderCount: orders.length,
      fetchedAt: new Date().toISOString(),
    }
  } catch (e) {
    return {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      monthly: [],
      products: [],
      productYear: String(now.getFullYear()),
      orderCount: 0,
      fetchedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : '아임웹 매출 조회 실패',
    }
  }
}
