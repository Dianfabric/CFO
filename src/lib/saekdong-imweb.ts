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

// 토큰 짧은 캐싱 (요청마다 재발급 방지 — 호출 제한 5건/초 보호)
let cachedToken: { token: string; expires: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.token
  const key = process.env.IMWEB_API_KEY
  const secret = process.env.IMWEB_SECRET_KEY
  if (!key || !secret) {
    throw new Error('IMWEB_API_KEY / IMWEB_SECRET_KEY 가 .env 에 없습니다.')
  }
  const r = await fetch(`${BASE}/auth?key=${key}&secret=${secret}`)
  const j = (await r.json()) as { access_token?: string; msg?: string }
  if (!j.access_token) throw new Error(`아임웹 인증 실패: ${j.msg ?? 'unknown'}`)
  // 토큰 수명 보수적으로 20분 캐싱
  cachedToken = { token: j.access_token, expires: Date.now() + 20 * 60 * 1000 }
  return j.access_token
}

async function api<T>(path: string): Promise<T> {
  const token = await getToken()
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'access-token': token },
  })
  const j = (await r.json()) as { code?: number; msg?: string; data?: T }
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

export interface SalesPoint {
  date: string // YYYY-MM-DD (KST)
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
  daily: SalesPoint[] // 최근 N일 일별
  products: ProductSales[] // 기간 내 제품별
  orderCount: number
  fetchedAt: string
  error?: string
}

// KST 기준 YYYY-MM-DD
function kstDate(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) // sv-SE = YYYY-MM-DD
}

function ymd(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

// 기간 내 모든 주문 (페이지네이션)
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

/**
 * 색동 매출 집계 — 최근 dayRange 일 (기본 30).
 * 일/주/월 합계 + 일별 추이 + 제품별.
 */
export async function getSaekdongSales(dayRange = 30): Promise<SaekdongSales> {
  const now = new Date()
  const todayStr = ymd(now)
  const fromDate = new Date(now)
  fromDate.setDate(fromDate.getDate() - dayRange + 1)
  const fromStr = ymd(fromDate)
  // order_date_to 는 exclusive(그날 00:00까지)라 오늘 주문 포함 위해 +1일
  const toDate = new Date(now)
  toDate.setDate(toDate.getDate() + 1)
  const toStr = ymd(toDate)

  // 이번 주 월요일 (KST)
  const monday = new Date(now)
  const jsDow = monday.getDay() // 0=일
  const offsetToMon = jsDow === 0 ? -6 : 1 - jsDow
  monday.setDate(monday.getDate() + offsetToMon)
  const mondayStr = ymd(monday)

  // 이번 달 1일
  const monthStart = ymd(new Date(now.getFullYear(), now.getMonth(), 1))

  try {
    const orders = await fetchOrders(fromStr, toStr)

    // 일별 집계
    const byDay = new Map<string, { revenue: number; orders: number }>()
    let today = 0
    let thisWeek = 0
    let thisMonth = 0
    for (const o of orders) {
      const amt = o.payment?.payment_amount ?? 0
      const day = kstDate(o.order_time)
      const cur = byDay.get(day) ?? { revenue: 0, orders: 0 }
      cur.revenue += amt
      cur.orders += 1
      byDay.set(day, cur)
      if (day === todayStr) today += amt
      if (day >= mondayStr) thisWeek += amt
      if (day >= monthStart) thisMonth += amt
    }

    // 최근 dayRange 일 연속 배열 (빈 날 0)
    const daily: SalesPoint[] = []
    for (let i = dayRange - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = ymd(d)
      const v = byDay.get(key) ?? { revenue: 0, orders: 0 }
      daily.push({ date: key, revenue: v.revenue, orders: v.orders })
    }

    // 제품별 집계 — 각 주문의 prod-orders (호출 제한 5/초 → 순차 + 약간의 텀)
    const prodMap = new Map<string, { revenue: number; qty: number }>()
    // 최근 주문 위주로 제한 (최대 60건까지만 제품 상세 — 과도한 호출 방지)
    const targetOrders = orders.slice(0, 60)
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
      daily,
      products,
      orderCount: orders.length,
      fetchedAt: new Date().toISOString(),
    }
  } catch (e) {
    return {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      daily: [],
      products: [],
      orderCount: 0,
      fetchedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : '아임웹 매출 조회 실패',
    }
  }
}
