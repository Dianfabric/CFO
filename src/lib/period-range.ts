/**
 * 기간 선택(과거 포함) 공용 유틸 — 손익 생키·경영 지표가 공유.
 * 디안 통합(경영 계기판)·색동 신사업에서 사용, 추후 엔에이아이디(법인)도 동일 적용.
 *
 * 주/월/분기는 올해(26년~) 안에서 지나간 기간을 선택할 수 있다:
 * 월 = 1~12 토글, 분기 = 1~4 토글, 주 = offset(0=이번 주, 1=지난 주 ...).
 */

export type Period = 'week' | 'month' | 'quarter' | 'year'

export interface PeriodRange {
  start: string
  end: string
  label: string
  /** 월 등록 비용(고정비 등) 배분용 — { ym, w(가중치) } */
  months: { ym: string; w: number }[]
  weekMode: boolean
  isCurrentWeek: boolean
  /** 주 선택 시 월별 겹침 일수 (월 시계열 일할 배분용) */
  weekOverlaps: { ym: string; days: number }[]
}

export function kstToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 기간 종류 + 과거 선택(월 1~12 / 분기 1~4 / 주 offset)을 실제 날짜 범위로 */
export function rangeFor(period: Period, selMonth: number, selQuarter: number, weekOffset: number): PeriodRange {
  const today = kstToday()
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))]
  const ymd = (d: Date) => d.toLocaleDateString('sv-SE')
  const now = new Date(today + 'T00:00:00')

  if (period === 'year') {
    const months = Array.from({ length: m }, (_, i) => ({ ym: `${y}-${pad2(i + 1)}`, w: 1 }))
    return { start: `${y}-01-01`, end: today, label: `${y}년`, months, weekMode: false, isCurrentWeek: false, weekOverlaps: [] }
  }
  if (period === 'month') {
    const mm = Math.min(Math.max(1, selMonth), m)
    const endD = mm === m ? now : new Date(y, mm, 0)
    return {
      start: `${y}-${pad2(mm)}-01`,
      end: ymd(endD),
      label: `${mm}월`,
      months: [{ ym: `${y}-${pad2(mm)}`, w: 1 }],
      weekMode: false, isCurrentWeek: false, weekOverlaps: [],
    }
  }
  if (period === 'quarter') {
    const curQ = Math.floor((m - 1) / 3) + 1
    const q = Math.min(Math.max(1, selQuarter), curQ)
    const qStart = (q - 1) * 3 + 1
    const lastM = q === curQ ? m : qStart + 2
    const endD = q === curQ ? now : new Date(y, qStart + 2, 0)
    const months = Array.from({ length: lastM - qStart + 1 }, (_, i) => ({ ym: `${y}-${pad2(qStart + i)}`, w: 1 }))
    return { start: `${y}-${pad2(qStart)}-01`, end: ymd(endD), label: `${q}분기`, months, weekMode: false, isCurrentWeek: false, weekOverlaps: [] }
  }
  // 주 — weekOffset 0 = 이번 주, 1 = 지난 주 ...
  const dow = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) - weekOffset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const endD = sunday > now ? now : sunday
  // 월별 겹침 일수 (주가 두 달에 걸칠 수 있음)
  const weekOverlaps: { ym: string; days: number }[] = []
  const cur = new Date(monday)
  while (cur <= endD) {
    const ym = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}`
    const found = weekOverlaps.find((o) => o.ym === ym)
    if (found) found.days += 1
    else weekOverlaps.push({ ym, days: 1 })
    cur.setDate(cur.getDate() + 1)
  }
  const totalDays = weekOverlaps.reduce((s, o) => s + o.days, 0) || 1
  const months = weekOverlaps.map((o) => ({ ym: o.ym, w: (o.days / totalDays) * (12 / 52) }))
  const label = `${monday.getMonth() + 1}/${monday.getDate()} ~ ${endD.getMonth() + 1}/${endD.getDate()}`
  return { start: ymd(monday), end: ymd(endD), label, months, weekMode: true, isCurrentWeek: weekOffset === 0, weekOverlaps }
}

export interface RevenueSeries {
  monthly: { month: string; revenue: number }[]
  thisWeek: number
  error?: string
}

/**
 * 시계열에서 선택 기간 매출.
 * 월/분기/년 = 월 시계열 합. 이번 주 = thisWeek(정확).
 * 과거 주 = 해당 월 매출 일할 배분 근사 (아임웹 집계가 월 단위라서).
 */
export function seriesRevenue(d: RevenueSeries | null, range: PeriodRange): number {
  if (!d || d.error) return 0
  if (range.isCurrentWeek) return d.thisWeek
  const map = new Map(d.monthly.map((x) => [x.month, x.revenue]))
  if (!range.weekMode) {
    return range.months.reduce((s, mw) => s + (map.get(mw.ym) ?? 0), 0)
  }
  const today = kstToday()
  let sum = 0
  for (const o of range.weekOverlaps) {
    const rev = map.get(o.ym) ?? 0
    // 진행 중인 달은 경과 일수 기준으로 일할
    const daysInMonth =
      o.ym === today.slice(0, 7)
        ? Number(today.slice(8, 10))
        : new Date(Number(o.ym.slice(0, 4)), Number(o.ym.slice(5, 7)), 0).getDate()
    sum += rev * (o.days / Math.max(1, daysInMonth))
  }
  return Math.round(sum)
}
