import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

const buf = readFileSync('D:/4월/배통관4.pdf')
const data = await pdfParse(buf)
const text = data.text

console.log('=== TEXT LENGTH ===', text.length)
console.log('\n=== CONTAINS CHECKS ===')
console.log('GLOGITECH:', text.includes('GLOGITECH'))
console.log('Ocean Inbound:', text.includes('Ocean Inbound'))
console.log('TOTAL AMOUNT:', text.includes('TOTAL AMOUNT'))
console.log('수입신고필증:', text.includes('수입신고필증'))
console.log('수 입 신 고 필 증:', text.includes('수 입 신 고 필 증'))
console.log('수입세금계산서:', text.includes('수입세금계산서'))
console.log('수 입 세 금 계 산 서:', text.includes('수 입 세 금 계 산 서'))

console.log('\n=== TOTAL AMOUNT 매칭 시도 ===')
const m1 = text.match(/TOTAL AMOUNT[:\s]+KRW[\s]*([\d,]+)/)
console.log('Match:', m1)

console.log('\n=== 청구일자 매칭 시도 ===')
const m2 = text.match(/청구일자\s*:\s*(\d{4}-\d{2}-\d{2})/)
console.log('Match:', m2)

console.log('\n=== H.B/L No. 매칭 시도 ===')
const m3 = text.match(/H\.B\/L No\.\s*:\s*(\S+)/)
console.log('Match:', m3)

console.log('\n=== TOTAL AMOUNT 주변 텍스트 (100자) ===')
const idx = text.indexOf('TOTAL AMOUNT')
if (idx >= 0) console.log(JSON.stringify(text.slice(idx, idx + 100)))

console.log('\n=== 첫 1500자 ===')
console.log(text.slice(0, 1500))

console.log('\n=== 4887417 검색 ===')
const idx2 = text.indexOf('4,887,417')
const idx3 = text.indexOf('4887417')
console.log('"4,887,417" 위치:', idx2)
console.log('"4887417" 위치:', idx3)
if (idx2 >= 0) console.log('주변:', JSON.stringify(text.slice(Math.max(0, idx2-50), idx2 + 100)))
