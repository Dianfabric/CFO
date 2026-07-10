/** 파일명 → 업로드 종류 감지 — UploadSection 라우팅·업로드 당번판이 공유 */
export type UploadKind =
  | '일계표' | '미수금현황' | '통장' | '세금계산서' | '마감'
  | '운임관세' | '관리회계' | '간이영수증' | '대출이자' | '기타'

export function detectUploadKind(name: string): UploadKind {
  // '2월.xls' 같은 ERP 거래처별 잔액 명세서 월별 export도 미수금현황으로 (2026-07-10 양식 추가)
  if (/미수\s*(금)?\s*현황|잔액\s*명세서/.test(name) || /^\s*\d{1,2}월\.xlsx?$/i.test(name.trim())) return '미수금현황'
  if (/대출.*(상환|이자)|이자상환/.test(name)) return '대출이자'
  if (/관리\s*회계/.test(name)) return '관리회계'
  if (/세금계산서/.test(name)) return '세금계산서'
  if (/통장|거래내역조회/.test(name)) return '통장'
  if (/디안[_ ]?마감|디안마감/i.test(name)) return '마감'
  if (/로드썬|글로지텍|운임|관세|통관|운송/.test(name)) return '운임관세'
  if (/영수증/.test(name)) return '간이영수증'
  if (/\.xlsx?$/i.test(name)) return '일계표'
  return '기타'
}
