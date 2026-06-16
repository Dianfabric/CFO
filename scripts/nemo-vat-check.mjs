// 네모팽이 1-2월 거래의 부가세 vs 차이 ₩230,800 검증
import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = parseFloat(String(v).replace(/,/g, '').trim())
  return isNaN(n) ? 0 : n
}

const wb = XLSX.read(readFileSync('D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/경영박사 - 엑셀/네모팽이.xls'), { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

console.log('=== 네모팽이 1-2월 모든 행 ===')
let totalSalesBefore = 0
let totalVatBefore = 0
let totalDepBefore = 0
let totalSalesAfter = 0
let totalVatAfter = 0
let totalDepAfter = 0

for (let i = 3; i < rows.length; i++) {
  const r = rows[i]
  const date = String(r[0] ?? '').trim()
  const account = String(r[1] ?? '').trim()
  if (!date || date.startsWith('일계') || date.startsWith('월계') || date.startsWith('누계')) continue
  if (date === '< 전 기 이 월 >') continue

  const m = date.match(/^(\d{2})\.(\d{2})\.(\d{2})$/)
  if (!m) continue
  const month = parseInt(m[2])
  const day = parseInt(m[3])
  const before = month <= 2

  const product = String(r[2] ?? '').trim()
  const sales = parseNum(r[6])
  const vat = parseNum(r[7])
  const deposit = parseNum(r[8])
  const balance = parseNum(r[9])
  const note = String(r[10] ?? '').trim()

  if (before) {
    if (account === '외출') {
      console.log(`  ${date} 외출 | ${product} | 별도 ${sales.toLocaleString()} + 부가세 ${vat.toLocaleString()} = ${(sales+vat).toLocaleString()} | 잔액 ${balance.toLocaleString()}`)
      totalSalesBefore += sales
      totalVatBefore += vat
    } else if (account === '입금') {
      console.log(`  ${date} 입금 | ${deposit.toLocaleString()} | ${note} | 잔액 ${balance.toLocaleString()}`)
      totalDepBefore += deposit
    }
  } else {
    if (account === '외출') {
      totalSalesAfter += sales
      totalVatAfter += vat
    } else if (account === '입금') {
      totalDepAfter += deposit
    }
  }
}

console.log(`\n=== 1-2월 합계 ===`)
console.log(`매출 별도: ${totalSalesBefore.toLocaleString()}`)
console.log(`부가세:    ${totalVatBefore.toLocaleString()}`)
console.log(`매출 포함: ${(totalSalesBefore + totalVatBefore).toLocaleString()}`)
console.log(`입금:      ${totalDepBefore.toLocaleString()}`)
console.log(`1-2월 net (입금초과): ${((totalSalesBefore + totalVatBefore) - totalDepBefore).toLocaleString()}`)

console.log(`\n=== 3월~ 합계 (참고) ===`)
console.log(`매출 별도: ${totalSalesAfter.toLocaleString()}`)
console.log(`부가세:    ${totalVatAfter.toLocaleString()}`)
console.log(`매출 포함: ${(totalSalesAfter + totalVatAfter).toLocaleString()}`)
console.log(`입금:      ${totalDepAfter.toLocaleString()}`)

console.log(`\n=== 비교 ===`)
console.log(`DB 잔액: 3,978,020`)
console.log(`경영박사 잔액: 4,208,820`)
console.log(`차이: 230,800`)
console.log(`\n부가세 검증:`)
console.log(`  1-2월 부가세 합: ${totalVatBefore.toLocaleString()}`)
console.log(`  3월~ 부가세 합: ${totalVatAfter.toLocaleString()}`)
console.log(`  3월~ 부가세 / 11 (일정 비율): ${Math.round(totalVatAfter / 11).toLocaleString()}`)
console.log(`  DB 2/27 보정값 2,735,900 vs 1-2월 net: ${((totalSalesBefore + totalVatBefore) - totalDepBefore).toLocaleString()}`)
