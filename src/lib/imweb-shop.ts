/**
 * 범용 아임웹 쇼핑몰 클라이언트 — 2호점(디안 원단 쇼핑몰) 등.
 * 색동(saekdong-imweb.ts)과 동일 로직의 파라미터화 버전.
 * 개인정보 없이 금액·날짜·상품명만 다룬다.
 */

const BASE = 'https://api.imweb.me/v2'

export interface ShopConfig {
  id: string // 캐시 키 (예: 'dianshop')
  apiKeyEnv: string
  secretEnv: string
}

export const DIAN_SHOP: ShopConfig = {
  id: 'dianshop',
  apiKeyEnv: 'DIAN_IMWEB_API_KEY',
  secretEnv: 'DIAN_IMWEB_SECRET_KEY',
}

// 호출 간격 (모든 아임웹 호출 공유 — 색동과 별개 프로세스 캐시)
let lastCall = 0
async function throttle() {
  const wait = lastCall + 500 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
}

const tokens = new Map<string, { token: string; expires: number }>()

async function getToken(cfg: ShopConfig): Promise<string> {
  const cached = tokens.get(cfg.id)
  if (cached && cached.expires > Date.now()) return cached.token
  const key = process.env[cfg.apiKeyEnv]
  const secret = process.env[cfg.secretEnv]
  if (!key || !secret) throw new Error(`${cfg.apiKeyEnv} / ${cfg.secretEnv} 가 .env 에 없습니다.`)
  await throttle()
  const r = await fetch(`${BASE}/auth?key=${key}&secret=${secret}`)
  const j = (await r.json()) as { access_token?: string; msg?: string }
  if (!j.access_token) throw new Error(`아임웹 인증 실패: ${j.msg ?? 'unknown'}`)
  tokens.set(cfg.id, { token: j.access_token, expires: Date.now() + 20 * 60 * 1000 })
  return j.access_token
}

async function api<T>(cfg: ShopConfig, path: string, retry = 4): Promise<T> {
  const token = await getToken(cfg)
  await throttle()
  const r = await fetch(`${BASE}${path}`, { headers: { 'access-token': token } })
  const j = (await r.json()) as { code?: number; msg?: string; data?: T }
  if (j.msg === 'TOO MANY REQUEST' && retry > 0) {
    await new Promise((res) => setTimeout(res, 1500 * (5 - retry)))
    return api(cfg, path, retry - 1)
  }
  if (j.code !== 200) throw new Error(`아임웹 API 오류: ${j.msg ?? j.code}`)
  return j.data as T
}

interface OrderRow {
  order_no: string
  order_time: number
  payment: { payment_amount: number; pay_type?: string; payment_time?: number } | null
}
interface ProdOrderRow {
  order_no: string
  items?: { prod_no: number; prod_name: string; payment?: { price?: number; count?: number } }[]
}
interface ReviewRow {
  idx: number
  body: string
  rating: number
  is_hide?: boolean
  is_secret?: boolean
  wtime: number
}

function kstDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}
function ymd(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

async function fetchOrders(cfg: ShopConfig, from: string, to: string): Promise<OrderRow[]> {
  const all: OrderRow[] = []
  let offset = 0
  for (let page = 0; page < 40; page++) {
    const data = await api<{ list: OrderRow[] }>(
      cfg,
      `/shop/orders?order_date_from=${from}&order_date_to=${to}&limit=50&offset=${offset}`,
    )
    const list = data?.list ?? []
    all.push(...list)
    if (list.length < 50) break
    offset += 50
  }
  return all
}

async function fetchOrdersLong(cfg: ShopConfig, fromDate: Date, toDate: Date): Promise<OrderRow[]> {
  const all: OrderRow[] = []
  let chunkStart = new Date(fromDate)
  for (let i = 0; i < 8 && chunkStart < toDate; i++) {
    const chunkEnd = new Date(chunkStart)
    chunkEnd.setMonth(chunkEnd.getMonth() + 3)
    const end = chunkEnd > toDate ? toDate : chunkEnd
    all.push(...(await fetchOrders(cfg, ymd(chunkStart), ymd(end))))
    chunkStart = end
  }
  return all
}

export interface ShopSales {
  today: number
  thisWeek: number
  thisMonth: number
  thisYear: number
  monthly: { month: string; revenue: number; orders: number }[]
  products: { prodName: string; revenue: number; qty: number }[]
  productYear: string
  orderCount: number
  fetchedAt: string
  error?: string
}

export async function getShopSales(cfg: ShopConfig, monthRange = 12): Promise<ShopSales> {
  const now = new Date()
  const todayStr = ymd(now)
  const thisYear = todayStr.slice(0, 4)
  const monthStart = todayStr.slice(0, 7) + '-01'
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const dow = kstNow.getDay()
  const monday = new Date(kstNow)
  monday.setDate(kstNow.getDate() - (dow === 0 ? 6 : dow - 1))
  const mondayStr = ymd(monday)
  const fromDate = new Date(now.getFullYear(), now.getMonth() - (monthRange - 1), 1)
  const toDate = new Date(now)
  toDate.setDate(toDate.getDate() + 1)

  try {
    const orders = await fetchOrdersLong(cfg, fromDate, toDate)
    const byMonth = new Map<string, { revenue: number; orders: number }>()
    let today = 0, thisWeek = 0, thisMonth = 0, thisYearTotal = 0
    for (const o of orders) {
      const amt = o.payment?.payment_amount ?? 0
      const day = kstDate(o.order_time)
      const mo = day.slice(0, 7)
      const cur = byMonth.get(mo) ?? { revenue: 0, orders: 0 }
      cur.revenue += amt
      cur.orders += 1
      byMonth.set(mo, cur)
      if (day === todayStr) today += amt
      if (day >= mondayStr) thisWeek += amt
      if (day >= monthStart) thisMonth += amt
      if (day.slice(0, 4) === thisYear) thisYearTotal += amt
    }
    const monthly = []
    for (let i = monthRange - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = ymd(d).slice(0, 7)
      const v = byMonth.get(key) ?? { revenue: 0, orders: 0 }
      monthly.push({ month: key, revenue: v.revenue, orders: v.orders })
    }
    // 올해 제품별 (상한 300건)
    const prodMap = new Map<string, { revenue: number; qty: number }>()
    const yearOrders = orders.filter((o) => kstDate(o.order_time).slice(0, 4) === thisYear).slice(0, 300)
    for (const o of yearOrders) {
      try {
        const rows = await api<ProdOrderRow[]>(cfg, `/shop/orders/${o.order_no}/prod-orders`)
        for (const row of rows ?? []) {
          for (const it of row.items ?? []) {
            const name = it.prod_name || `상품#${it.prod_no}`
            const cur = prodMap.get(name) ?? { revenue: 0, qty: 0 }
            cur.revenue += it.payment?.price ?? 0
            cur.qty += it.payment?.count ?? 1
            prodMap.set(name, cur)
          }
        }
      } catch { /* 개별 실패 무시 */ }
    }
    const products = [...prodMap.entries()]
      .map(([prodName, v]) => ({ prodName, ...v }))
      .sort((a, b) => b.revenue - a.revenue)

    return {
      today, thisWeek, thisMonth, thisYear: thisYearTotal,
      monthly, products, productYear: thisYear,
      orderCount: orders.length, fetchedAt: new Date().toISOString(),
    }
  } catch (e) {
    return {
      today: 0, thisWeek: 0, thisMonth: 0, thisYear: 0,
      monthly: [], products: [], productYear: thisYear, orderCount: 0,
      fetchedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : '아임웹 매출 조회 실패',
    }
  }
}

export interface ShopNotice {
  id: string
  kind: 'order' | 'review'
  time: number
  amount?: number
  rating?: number
  text: string
}

export async function getShopNotices(cfg: ShopConfig, dayRange = 3): Promise<{
  notices: ShopNotice[]
  fetchedAt: string
  error?: string
}> {
  const now = Date.now()
  const cutoff = Math.floor(now / 1000) - dayRange * 86400
  const from = ymd(new Date(now - dayRange * 86400 * 1000))
  const to = ymd(new Date(now + 86400 * 1000))
  try {
    const notices: ShopNotice[] = []
    const orders = (await fetchOrders(cfg, from, to)).filter((o) => o.order_time >= cutoff)
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i]
      let itemsText = ''
      if (i < 10) {
        try {
          const rows = await api<ProdOrderRow[]>(cfg, `/shop/orders/${o.order_no}/prod-orders`)
          const parts: string[] = []
          for (const row of rows ?? [])
            for (const it of row.items ?? [])
              parts.push(`${it.prod_name || '상품'} ${it.payment?.count ?? 1}개`)
          itemsText = parts.join(' · ')
        } catch { /* 무시 */ }
      }
      notices.push({
        id: `${cfg.id}-order:${o.order_no}`, kind: 'order', time: o.order_time,
        amount: o.payment?.payment_amount ?? 0, text: itemsText,
      })
    }
    try {
      const rev = await api<{ list: ReviewRow[] }>(cfg, '/shop/reviews?limit=50')
      for (const r of rev?.list ?? []) {
        if (r.wtime < cutoff || r.is_hide) continue
        const body = String(r.body ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        notices.push({
          id: `${cfg.id}-review:${r.idx}`, kind: 'review', time: r.wtime, rating: r.rating,
          text: r.is_secret ? '비밀 후기' : body.length > 40 ? body.slice(0, 40) + '…' : body,
        })
      }
    } catch { /* 후기 실패 무시 */ }
    notices.sort((a, b) => b.time - a.time)
    return { notices, fetchedAt: new Date().toISOString() }
  } catch (e) {
    return {
      notices: [], fetchedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : '아임웹 알림 조회 실패',
    }
  }
}
