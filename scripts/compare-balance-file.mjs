// 거래처잔액.xls vs DB 잔액 비교
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const prisma = new PrismaClient()

const FILE = 'D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/거래처잔액.xls'

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = parseFloat(String(v).replace(/,/g, '').trim())
  return isNaN(n) ? 0 : n
}
function normalize(name) {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s\-_·.&/]/g, '')
    .trim()
    .toUpperCase()
}

// 파일 구조 먼저 보기
const wb = XLSX.read(readFileSync(FILE), { type: 'buffer' })
console.log('시트:', wb.SheetNames)
for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  console.log(`\n=== "${sn}" (${rows.length}행) ===`)
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    console.log(`행${i}:`, rows[i].slice(0, 12))
  }
}
