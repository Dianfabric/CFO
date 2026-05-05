/**
 * 일계표 Excel 파싱 유틸리티 (v1.1 업로드용)
 *
 * 기존 src/app/api/upload/sales/route.ts 의 파싱 로직을 추출 +
 * v1.1 dual-write(Prisma + Supabase) 에서 재사용.
 */
import * as XLSX from 'xlsx'

/** 시트명에서 날짜 추출: "26.04.30" → Date */
export function parseSheetDate(sheetName: string): Date | null {
  const m = sheetName.match(/^(\d{2})\.(\d{2})\.(\d{2})$/)
  if (!m) return null
  const [, yy, mm, dd] = m
  return new Date(2000 + parseInt(yy), parseInt(mm) - 1, parseInt(dd), 12, 0, 0)
}

export function parseSigned(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

export function parseNum(val: unknown): number {
  return Math.abs(parseSigned(val))
}

export interface TxRow {
  no: number
  account: string // 외출 / 현비 / 외입 / 입금 / 출금
  client: string
  productName: string
  spec: string
  memo: string
  qty: number
  unitPrice: number
  amount: number
  vat: number
  voucherNo: string
}

export function extractTxRows(rows: unknown[][]): TxRow[] {
  const result: TxRow[] = []
  for (const r of rows) {
    const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
    if (!Number.isFinite(no) || no <= 0) continue
    result.push({
      no,
      account: String(r[1] ?? '').trim(),
      client: String(r[2] ?? '').trim(),
      productName: String(r[3] ?? '').trim(),
      spec: String(r[4] ?? '').trim(),
      memo: String(r[5] ?? '').trim(),
      qty: parseSigned(r[6]),
      unitPrice: parseNum(r[7]),
      amount: parseSigned(r[8]),
      vat: parseNum(r[9]),
      voucherNo: String(r[11] ?? '').trim(),
    })
  }
  return result
}

export interface DaySheet {
  date: Date
  dateStr: string // YYYY-MM-DD
  sheetName: string
  rows: TxRow[]
}

/** 워크북에서 날짜 시트들만 추출 (타이틀이 "일계표"인지 확인 후 호출) */
export function extractDaySheets(workbook: XLSX.WorkBook): DaySheet[] {
  const out: DaySheet[] = []
  for (const sheetName of workbook.SheetNames) {
    const date = parseSheetDate(sheetName)
    if (!date) continue
    const ws = workbook.Sheets[sheetName]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
    out.push({
      date,
      dateStr: date.toISOString().split('T')[0],
      sheetName,
      rows: extractTxRows(raw),
    })
  }
  return out
}

/** 일계표 파일 형식 확인 */
export function isDailyLedgerFormat(workbook: XLSX.WorkBook): boolean {
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const firstRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as unknown[][]
  const titleText = String(firstRows[0]?.[0] ?? '')
  return titleText.includes('일계표')
}

/** 외출(SALE) 그룹핑: voucherNo + client 기준 */
export function groupSales(rows: TxRow[]): Map<string, TxRow[]> {
  const map = new Map<string, TxRow[]>()
  rows.filter((r) => r.account === '외출').forEach((r) => {
    const key = `${r.voucherNo}__${r.client}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  })
  return map
}

/** 외입(PURCHASE) 그룹핑 */
export function groupPurchases(rows: TxRow[]): Map<string, TxRow[]> {
  const map = new Map<string, TxRow[]>()
  rows.filter((r) => r.account === '외입').forEach((r) => {
    const key = `${r.voucherNo}__${r.client}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  })
  return map
}

/** 현비(EXPENSE) 추출 */
export function getExpenseRows(rows: TxRow[]): TxRow[] {
  return rows.filter((r) => r.account === '현비')
}

/** 원가 계산에서 제외할 비제품 키워드 */
export const SKIP_COST_ITEMS = ['할인', '화물', '택배', '방염', '배송', '운송', '해외운송']
