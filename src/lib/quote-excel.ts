/**
 * 공문 품목 엑셀 다운로드 — 납품 확인서·대금 청구서 공용 (대표 지시 2026-11-16)
 * xlsx(SheetJS)를 동적 import 해 페이지 번들을 무겁게 하지 않는다.
 */
import {
  PaymentItem,
  VatMode,
  itemAmount,
  paymentTotals,
} from '@/components/documents/PaymentRequestTable'

function toNumber(v: string): number | string {
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) && String(v).trim() !== '' ? n : v
}

export async function downloadItemsExcel(opts: {
  /** 확장자 제외 파일명 */
  filename: string
  /** 시트 이름 (31자 이하) */
  sheetName: string
  /** 상단 정보 줄 — [라벨, 값] (빈 값 줄은 건너뜀) */
  headerRows: Array<[string, string]>
  items: PaymentItem[]
  showAmounts: boolean
  vatMode: VatMode
  /** 합계 마지막 줄 라벨 (기본: 합계 (VAT 포함)) */
  totalsLabel?: string
}): Promise<void> {
  const XLSX = await import('xlsx')
  const rows = opts.items.filter((it) => it.name.trim() || it.qty.trim())

  const aoa: (string | number)[][] = []
  for (const [label, value] of opts.headerRows) {
    if (value) aoa.push([label, value])
  }
  aoa.push([])

  const head = ['NO', '품목', '색상', '규격', '수량', '단위']
  if (opts.showAmounts) head.push('단가', '금액')
  head.push('비고')
  aoa.push(head)

  rows.forEach((it, i) => {
    const row: (string | number)[] = [i + 1, it.name, it.color, it.spec, toNumber(it.qty), it.unit]
    if (opts.showAmounts) row.push(toNumber(it.price), itemAmount(it))
    row.push(it.remark)
    aoa.push(row)
  })

  if (opts.showAmounts) {
    const { supply, vat, grand } = paymentTotals(rows, opts.vatMode)
    aoa.push([])
    aoa.push(['', '', '', '', '', '', '공급가액', supply, ''])
    aoa.push(['', '', '', '', '', '', '부가세 (10%)', vat, ''])
    aoa.push(['', '', '', '', '', '', opts.totalsLabel ?? '합계 (VAT 포함)', grand, ''])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 4 },   // NO
    { wch: 26 },  // 품목
    { wch: 8 },   // 색상
    { wch: 10 },  // 규격
    { wch: 8 },   // 수량
    { wch: 6 },   // 단위
    ...(opts.showAmounts ? [{ wch: 12 }, { wch: 14 }] : []),
    { wch: 16 },  // 비고
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName.slice(0, 31))
  XLSX.writeFile(wb, `${opts.filename}.xlsx`)
}
