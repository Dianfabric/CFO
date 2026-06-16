// 일계표 sync API 호출 — preview 먼저, apply는 별도 인자 받음
import { readFileSync } from 'fs'

const FILE = 'D:/일계표(리스트)_260611_093450.xls'
const API = 'https://dian-cfo.vercel.app/api/upload/sales/sync'
const mode = process.argv[2] || 'preview'  // 'preview' or 'apply'

const fileBuf = readFileSync(FILE)
const form = new FormData()
form.append('file', new Blob([fileBuf]), '일계표(리스트)_260611_093450.xls')
form.append('mode', mode)

console.log(`Sync mode: ${mode}`)
console.log(`API: ${API}`)
console.log('전송 중... (시트 77개 처리하므로 1~2분 걸릴 수 있음)\n')

const res = await fetch(API, { method: 'POST', body: form })
const json = await res.json()

if (!res.ok) {
  console.error('❌ 오류:', json)
  process.exit(1)
}

console.log('=== 응답 요약 ===')
console.log(`기간: ${json.summary.dateRange?.from} ~ ${json.summary.dateRange?.to} (${json.summary.sheetCount}개 시트)`)
console.log()
console.log('매출 (양방향 sync):')
console.log(`  🆕 추가: ${json.summary.sales.add}건 / ₩${(json.summary.sales.addAmount ?? 0).toLocaleString()}`)
console.log(`  🗑 삭제: ${json.summary.sales.delete}건 / ₩${(json.summary.sales.deleteAmount ?? 0).toLocaleString()}`)
console.log(`  ✓ 유지: ${json.summary.sales.keep}건`)
console.log()
console.log('입금 (양방향 sync):')
console.log(`  🆕 추가: ${json.summary.deposits.add}건 / ₩${(json.summary.deposits.addAmount ?? 0).toLocaleString()}`)
console.log(`  🗑 삭제: ${json.summary.deposits.delete}건 / ₩${(json.summary.deposits.deleteAmount ?? 0).toLocaleString()}`)
console.log(`  ✓ 유지: ${json.summary.deposits.keep}건`)
console.log()
console.log('경비 (추가만):')
console.log(`  🆕 추가: ${json.summary.expenses.add}건 / 유지 ${json.summary.expenses.keep}건`)
console.log('매입 (추가만):')
console.log(`  🆕 추가: ${json.summary.purchases.add}건 / 유지 ${json.summary.purchases.keep}건`)

if (mode === 'preview' && json.detail) {
  console.log('\n=== 상세 (앞 30건씩) ===')
  if (json.detail.salesAdd?.length) {
    console.log(`\n🆕 추가될 매출 (${json.detail.salesAdd.length}건):`)
    for (const x of json.detail.salesAdd.slice(0, 30)) {
      console.log(`  ${x.date} | ${x.client} | ₩${x.amount.toLocaleString()}`)
    }
    if (json.detail.salesAdd.length > 30) console.log(`  ... +${json.detail.salesAdd.length - 30}건`)
  }
  if (json.detail.salesDelete?.length) {
    console.log(`\n🗑 삭제될 매출 (${json.detail.salesDelete.length}건):`)
    for (const x of json.detail.salesDelete.slice(0, 30)) {
      console.log(`  ${x.date} | ${x.client} | ₩${x.amount.toLocaleString()}`)
    }
    if (json.detail.salesDelete.length > 30) console.log(`  ... +${json.detail.salesDelete.length - 30}건`)
  }
  if (json.detail.depositsAdd?.length) {
    console.log(`\n🆕 추가될 입금 (${json.detail.depositsAdd.length}건):`)
    for (const x of json.detail.depositsAdd.slice(0, 30)) {
      console.log(`  ${x.date} | ${x.client} | ₩${x.amount.toLocaleString()}`)
    }
    if (json.detail.depositsAdd.length > 30) console.log(`  ... +${json.detail.depositsAdd.length - 30}건`)
  }
  if (json.detail.depositsDelete?.length) {
    console.log(`\n🗑 삭제될 입금 (${json.detail.depositsDelete.length}건):`)
    for (const x of json.detail.depositsDelete.slice(0, 30)) {
      console.log(`  ${x.date} | ${x.client} | ₩${x.amount.toLocaleString()}`)
    }
    if (json.detail.depositsDelete.length > 30) console.log(`  ... +${json.detail.depositsDelete.length - 30}건`)
  }
}

if (mode === 'apply' && json.result) {
  console.log('\n=== 적용 결과 ===')
  console.log(`추가: ${json.result.added}건`)
  console.log(`삭제: ${json.result.deleted}건`)
  if (json.result.errors?.length) {
    console.log(`\n⚠ 실패 ${json.result.errors.length}건:`)
    for (const e of json.result.errors.slice(0, 20)) console.log(`  - ${e}`)
  }
}
