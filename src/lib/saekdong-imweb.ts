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

async function getToken(retry = 2): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.token
  const key = process.env.IMWEB_API_KEY
  const secret = process.env.IMWEB_SECRET_KEY
  if (!key || !secret) {
    throw new Error('IMWEB_API_KEY / IMWEB_SECRET_KEY 가 .env 에 없습니다.')
  }
  await throttle()
  const r = await fetch(`${BASE}/auth?key=${key}&secret=${secret}`)
  const j = (await r.json()) as { access_token?: string; msg?: string }
  if (!j.access_token) {
    // 호출 제한으로 인증 자체가 튕기는 경우 대기 후 재시도
    if (/TOO MANY/i.test(j.msg ?? '') && retry > 0) {
      await new Promise((res) => setTimeout(res, 2500))
      return getToken(retry - 1)
    }
    throw new Error(`아임웹 인증 실패: ${j.msg ?? 'unknown'}`)
  }
  // 토큰 수명 보수적으로 20분 캐싱
  cachedToken = { token: j.access_token, expires: Date.now() + 20 * 60 * 1000 }
  return j.access_token
}

const API_RETRY = 4

async function api<T>(path: string, retry = API_RETRY): Promise<T> {
  const token = await getToken()
  await throttle()
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'access-token': token },
  })
  const j = (await r.json()) as { code?: number; msg?: string; data?: T }
  // 호출 폭주(TOO MANY REQUEST) 시 점증 대기 후 재시도
  // (Vercel 서버리스는 라우트마다 별도 인스턴스라 동시 호출이 생길 수 있음)
  if (j.msg === 'TOO MANY REQUEST' && retry > 0) {
    const wait = 1500 * (API_RETRY - retry + 1) // 1.5s → 3s → 4.5s → 6s
    await new Promise((res) => setTimeout(res, wait))
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
  payment: {
    payment_amount: number
    price_currency: string
    pay_type?: string
    payment_time?: number // 결제(입금) 완료 시각 — 없으면 입금대기
  } | null
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

// 매출 카테고리별 분리 (예: saekdong / Luck items / Limited)
export interface CategorySales {
  code: string
  name: string
  thisYearTotal: number // 올해 이 카테고리 매출(상품 결제액 기준)
  monthly: MonthlyPoint[] // 올해 월별 (2026-01 ~ 이번 달)
  products: ProductSales[] // 올해 제품별
}

export interface SaekdongSales {
  today: number
  thisWeek: number
  thisMonth: number
  thisYear: number // 올해(연초~오늘) 총 매출
  monthly: MonthlyPoint[] // 최근 N개월 월별 매출 추이 (전체, 주문단위)
  products: ProductSales[] // 올해(연초~오늘) 제품별 (전체)
  productYear: string // 제품 집계 기준 연도 (예: '2026')
  categories: CategorySales[] // 카테고리별 (올해, 상품단위) — 매출순
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

    // 월별 집계 + 오늘/이번주/이번달/올해 합계
    const byMonth = new Map<string, { revenue: number; orders: number }>()
    let today = 0
    let thisWeek = 0
    let thisMonth = 0
    let thisYearTotal = 0
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
      if (day.slice(0, 4) === thisYear) thisYearTotal += amt
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
    // 카테고리별 분리를 위해 상품→카테고리, 카테고리→이름 맵도 조회
    const thisYearOrders = orders.filter(
      (o) => kstDate(o.order_time).slice(0, 4) === thisYear,
    )
    const [prodCat, catNames] = await Promise.all([
      getProdCategoryMap(),
      getCategoryNames(),
    ])
    const prodMap = new Map<string, { revenue: number; qty: number }>()
    // 카테고리별: code → { products, monthly }
    const catAgg = new Map<
      string,
      { products: Map<string, { revenue: number; qty: number }>; monthly: Map<string, number> }
    >()
    const targetOrders = thisYearOrders.slice(0, 300) // 올해 주문 상한 300건
    for (const o of targetOrders) {
      const oMonth = kstMonth(o.order_time)
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

            // 카테고리별 누적
            const code = (it.prod_no != null && prodCat[it.prod_no]) || '__uncat__'
            let agg = catAgg.get(code)
            if (!agg) {
              agg = { products: new Map(), monthly: new Map() }
              catAgg.set(code, agg)
            }
            const cp = agg.products.get(name) ?? { revenue: 0, qty: 0 }
            cp.revenue += price
            cp.qty += qty
            agg.products.set(name, cp)
            agg.monthly.set(oMonth, (agg.monthly.get(oMonth) ?? 0) + price)
          }
        }
      } catch {
        // 개별 주문 상세 실패는 건너뜀
      }
    }
    const products: ProductSales[] = Array.from(prodMap.entries())
      .map(([prodName, v]) => ({ prodName, revenue: v.revenue, qty: v.qty }))
      .sort((a, b) => b.revenue - a.revenue)

    // 올해 월 목록 (2026-01 ~ 이번 달)
    const thisYearMonths: string[] = []
    for (let m = 1; m <= Number(todayStr.slice(5, 7)); m++) {
      thisYearMonths.push(`${thisYear}-${String(m).padStart(2, '0')}`)
    }
    // 카테고리별 결과 (매출순)
    const categories: CategorySales[] = Array.from(catAgg.entries())
      .map(([code, agg]) => {
        const catProducts: ProductSales[] = Array.from(agg.products.entries())
          .map(([prodName, v]) => ({ prodName, revenue: v.revenue, qty: v.qty }))
          .sort((a, b) => b.revenue - a.revenue)
        const catMonthly: MonthlyPoint[] = thisYearMonths.map((mo) => ({
          month: mo,
          revenue: agg.monthly.get(mo) ?? 0,
          orders: 0,
        }))
        const thisYearTot = catProducts.reduce((s, p) => s + p.revenue, 0)
        return {
          code,
          name: code === '__uncat__' ? '미분류' : catNames[code] || code,
          thisYearTotal: thisYearTot,
          monthly: catMonthly,
          products: catProducts,
        }
      })
      .filter((c) => c.thisYearTotal > 0)
      .sort((a, b) => b.thisYearTotal - a.thisYearTotal)

    return {
      today,
      thisWeek,
      thisMonth,
      thisYear: thisYearTotal,
      monthly,
      products,
      productYear: thisYear,
      categories,
      orderCount: orders.length,
      fetchedAt: new Date().toISOString(),
    }
  } catch (e) {
    return {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      thisYear: 0,
      monthly: [],
      products: [],
      productYear: String(now.getFullYear()),
      categories: [],
      orderCount: 0,
      fetchedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : '아임웹 매출 조회 실패',
    }
  }
}

// ── 알림 (최근 N일 신규 주문·후기) ──

interface ReviewRow {
  idx: number
  prod_no: number
  nick: string
  body: string
  rating: number
  is_hide?: boolean
  is_secret?: boolean
  wtime: number // Unix seconds
}

export interface SaekdongNotice {
  id: string // 안정적 식별자 (order:xxx / review:xxx)
  kind: 'order' | 'review'
  time: number // Unix seconds (KST 환산은 표시단에서)
  amount?: number // 주문 금액
  rating?: number // 후기 별점
  text: string // 후기 본문 요약 (주문은 '')
}

/** 리뷰 본문에서 HTML 태그·과잉 공백 제거 후 요약 */
function cleanReviewBody(body: string, max = 40): string {
  const t = (body || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

/**
 * 최근 dayRange 일(기본 3일) 내 신규 주문 + 신규 상품후기 알림.
 * 3일 윈도우를 매번 라이브로 계산 → 저장/크론 없이 자연 만료(자동 삭제).
 * 개인정보 없이 금액·별점·후기요약·시각만.
 */
export async function getSaekdongNotices(dayRange = 3): Promise<{
  notices: SaekdongNotice[]
  fetchedAt: string
  error?: string
}> {
  const now = Date.now()
  const cutoff = Math.floor(now / 1000) - dayRange * 86400
  const from = ymd(new Date(now - dayRange * 86400 * 1000))
  const to = ymd(new Date(now + 86400 * 1000)) // exclusive → 오늘 포함

  try {
    const notices: SaekdongNotice[] = []

    // 신규 주문
    const orders = await fetchOrders(from, to)
    // 주문 품목 요약 포함 — 알림만 보고 바로 준비 가능하도록 (호출 보호 상한 10건)
    const recentOrders = orders.filter((o) => o.order_time >= cutoff)
    const DETAIL_CAP = 10
    for (let i = 0; i < recentOrders.length; i++) {
      const o = recentOrders[i]
      let itemsText = ''
      if (i < DETAIL_CAP) {
        try {
          const rows = await api<ProdOrderRow[]>(`/shop/orders/${o.order_no}/prod-orders`)
          const parts: string[] = []
          for (const row of rows ?? []) {
            for (const it of row.items ?? []) {
              const name = it.prod_name || `상품#${it.prod_no}`
              parts.push(`${name} ${it.payment?.count ?? 1}개`)
            }
          }
          itemsText = parts.join(' · ')
        } catch {
          // 품목 조회 실패해도 주문 알림 자체는 유지
        }
      }
      notices.push({
        id: `order:${o.order_no}`,
        kind: 'order',
        time: o.order_time,
        amount: o.payment?.payment_amount ?? 0,
        text: itemsText,
      })
    }

    // 신규 후기 (최신순 반환 → 상위 50건에서 3일 필터)
    try {
      const rev = await api<{ list: ReviewRow[] }>('/shop/reviews?limit=50')
      for (const r of rev?.list ?? []) {
        if (r.wtime < cutoff || r.is_hide) continue
        notices.push({
          id: `review:${r.idx}`,
          kind: 'review',
          time: r.wtime,
          rating: r.rating,
          text: r.is_secret ? '비밀 후기' : cleanReviewBody(r.body),
        })
      }
    } catch {
      // 후기 조회 실패는 주문 알림에 영향 없이 무시
    }

    notices.sort((a, b) => b.time - a.time)
    return { notices, fetchedAt: new Date().toISOString() }
  } catch (e) {
    return {
      notices: [],
      fetchedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : '아임웹 알림 조회 실패',
    }
  }
}

// ── 색동 상품명 카탈로그 (오프라인 매출 매칭용) ──

interface ProductRow {
  no?: number
  prod_no?: number
  name?: string
  prod_name?: string
  categories?: string[]
}

// 아임웹 조회 실패 시 폴백 — 알려진 색동 대표 상품명
const SAEKDONG_FALLBACK_NAMES = [
  '금빛단', '은빛단', '청빛단', '보석단', '까치동', '금까치',
  '팔색', '아동팔색', '신고속', '고속 27mm', '소골 2mm',
  '중골 3mm', '중골 3mm (은사)', '중골 7mm',
  '색동스툴', '색동 스툴', '오방색 복주머니', '색동 잔 받침',
]

let cachedCatalog: { names: string[]; expires: number } | null = null

/**
 * 색동 쇼핑몰 상품명 목록 (오프라인 일계표 품목 매칭 기준).
 * 6시간 캐싱, 아임웹 실패 시 폴백 목록 사용. 나눔/결제성 항목은 제외.
 */
export async function getSaekdongProductNames(): Promise<string[]> {
  if (cachedCatalog && cachedCatalog.expires > Date.now()) return cachedCatalog.names
  try {
    const names: string[] = []
    let offset = 0
    for (let i = 0; i < 5; i++) {
      const data = await api<{ list: ProductRow[] }>(
        `/shop/products?limit=100&offset=${offset}`,
      )
      const list = data?.list ?? []
      for (const p of list) {
        const nm = (p.name || p.prod_name || '').trim()
        if (nm) names.push(nm)
      }
      if (list.length < 100) break
      offset += 100
    }
    // 실제 상품이 아닌 항목 제외 (나눔/신청/개인결제/여분/실콘 나눔 등)
    const filtered = names.filter(
      (n) => !/나눔|신청|개인결제|여분|추가나눔/.test(n),
    )
    const uniq = [...new Set(filtered.length > 0 ? filtered : SAEKDONG_FALLBACK_NAMES)]
    cachedCatalog = { names: uniq, expires: Date.now() + 6 * 60 * 60 * 1000 }
    return uniq
  } catch {
    return [...SAEKDONG_FALLBACK_NAMES]
  }
}

// ── 매출 카테고리 (카테고리별 매출 분리용) ──

interface CategoryRow {
  code: string
  name: string
  list?: CategoryRow[]
}

let cachedCatNames: { map: Record<string, string>; expires: number } | null = null

/** 카테고리 코드 → 이름 맵 (하위 카테고리 포함). 6시간 캐싱. */
export async function getCategoryNames(): Promise<Record<string, string>> {
  if (cachedCatNames && cachedCatNames.expires > Date.now()) return cachedCatNames.map
  const map: Record<string, string> = {}
  try {
    const data = await api<CategoryRow[]>('/shop/categories')
    const walk = (rows: CategoryRow[]) => {
      for (const c of rows ?? []) {
        if (c.code) map[c.code] = c.name
        if (c.list) walk(c.list)
      }
    }
    walk(data ?? [])
  } catch {
    // 실패 시 빈 맵 — 코드가 이름으로 표시됨
  }
  cachedCatNames = { map, expires: Date.now() + 6 * 60 * 60 * 1000 }
  return map
}

let cachedProdCat: { map: Record<number, string>; expires: number } | null = null

/** 상품번호(prod_no) → 대표 카테고리 코드 맵. 6시간 캐싱. */
export async function getProdCategoryMap(): Promise<Record<number, string>> {
  if (cachedProdCat && cachedProdCat.expires > Date.now()) return cachedProdCat.map
  const map: Record<number, string> = {}
  try {
    let offset = 0
    for (let i = 0; i < 5; i++) {
      const data = await api<{ list: ProductRow[] }>(
        `/shop/products?limit=100&offset=${offset}`,
      )
      const list = data?.list ?? []
      for (const p of list) {
        const no = p.no ?? p.prod_no
        const cat = p.categories?.[0]
        if (no != null && cat) map[no] = cat
      }
      if (list.length < 100) break
      offset += 100
    }
  } catch {
    // 실패 시 빈 맵 — 카테고리 미분류 처리
  }
  cachedProdCat = { map, expires: Date.now() + 6 * 60 * 60 * 1000 }
  return map
}

// ── 입금 대사용 주문 목록 ──

export interface SimpleOrder {
  orderNo: string
  time: number // Unix seconds
  date: string // YYYY-MM-DD (KST)
  amount: number // 결제 총액
  payType: string // npay / card / trans 등
  payTime: number // 아임웹 결제(입금) 완료 시각 — 0 이면 입금대기
}

/**
 * fromDate(YYYY-MM-DD, KST) 이후 결제 주문 목록 — 통장 입금 대사용.
 * 개인정보 없이 주문번호·시각·금액·결제수단·결제시각만.
 */
export async function getSaekdongOrdersFrom(fromDate: string): Promise<SimpleOrder[]> {
  const to = new Date()
  to.setDate(to.getDate() + 1) // order_date_to exclusive → 오늘 포함
  const orders = await fetchOrdersLong(new Date(fromDate), to)
  return orders
    .filter((o) => (o.payment?.payment_amount ?? 0) > 0)
    .map((o) => ({
      orderNo: o.order_no,
      time: o.order_time,
      date: kstDate(o.order_time),
      amount: o.payment?.payment_amount ?? 0,
      payType: o.payment?.pay_type ?? '',
      payTime: o.payment?.payment_time ?? 0,
    }))
    .filter((o) => o.date >= fromDate)
}
