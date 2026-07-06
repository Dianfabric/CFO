// 통장 매칭용 거래처명 정규화 — upload/bank + recon 공용
// ClientAlias에 저장할 alias 는 항상 이 함수로 정규화해야 다음 파일 자동 매칭이 동작.
export function normBankName(name: string): string {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[　\s]+/g, '')
    .trim()
    .toUpperCase()
}
