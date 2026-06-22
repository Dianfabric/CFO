// 6/4 보정 over-correction 검토
// "[수동 보정] 2026-06-04" 또는 "이월 매출 보정" 들어간 거래처 중
// 그 보정만 빼면 거래처잔액 파일과 일치하는 케이스 찾기
import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { PrismaClient } from '@prisma/client'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const prisma = new PrismaClient()

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

// 파일 잔액 맵
const wb = XLSX.read(readFileSync('D:/Dropbox/[디안]직원별_업무공유/[업무]유대현/거래처잔액.xls'), { type: 'buffer' })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
const fileBalanceMap = new Map()
for (let i = 3; i < rows.length; i++) {
  const name = String(rows[i][0] ?? '').trim()
  if (!name || /^(소계|총계|합계|합 계)/.test(name) || /^소계:/.test(name) || /^총계\(/.test(name)) continue
  fileBalanceMap.set(normalize(name), parseNum(rows[i][7]))
}

// 모든 거래처 + AR + Payment
const clients = await prisma.client.findMany({
  include: {
    accountsReceivable: { include: { payments: true, transaction: { select: { description: true } } } },
  },
})

const overCorrections = []
const underCorrections = []
const matched = []
const fileBalanceNotZero = []  // 파일에 잔액 있는데 DB와 불일치

for (const c of clients) {
  let totalOrig = 0, totalPaid = 0
  let correctionImpact = 0  // 6/4 보정 효과 (보정 자체의 net)
  let hasCorrection = false

  // SALE 보정: "이월 매출 보정" 또는 "이월 매출 -" — 모두 보정
  for (const ar of c.accountsReceivable) {
    totalOrig += ar.originalAmount
    const desc = ar.transaction.description ?? ''
    const isCorrection = desc.startsWith('이월 매출 보정') || desc.startsWith('이월 매출 -')
    if (isCorrection) {
      correctionImpact += ar.originalAmount
      hasCorrection = true
    }
    for (const p of ar.payments) {
      totalPaid += p.amount
      const isCorrPay = (p.notes ?? '').startsWith('[수동 보정]') || (p.notes ?? '').startsWith('[이월]')
      if (isCorrPay) {
        correctionImpact -= p.amount
        hasCorrection = true
      }
    }
  }

  const dbBalance = totalOrig - totalPaid
  const naturalBalance = dbBalance - correctionImpact  // 보정 제외한 자연 잔액
  const fileBalance = fileBalanceMap.get(normalize(c.name)) ?? null

  if (fileBalance === null) {
    // 파일에 없음 = 잔액 0이라고 가정
    if (dbBalance !== 0 && hasCorrection) {
      // 보정 빼면 0이 되는지?
      if (Math.abs(naturalBalance) < 1) {
        // 보정만 빼면 정확히 0 → over-correction
        overCorrections.push({
          clientName: c.name,
          dbBalance,
          naturalBalance,
          correctionImpact,
          fileBalance: 0,
          fixAmount: -correctionImpact,  // 보정만큼 반대 방향으로 정정 필요
        })
      } else {
        // 자연 잔액도 0이 아님 — 다른 원인
      }
    }
  } else {
    // 파일에 있음
    const diff = fileBalance - dbBalance
    if (Math.abs(diff) < 1) {
      matched.push(c.name)
    } else if (hasCorrection) {
      // 보정 빼면 파일과 일치하는지?
      const naturalDiff = fileBalance - naturalBalance
      if (Math.abs(naturalDiff) < 1) {
        // 자연 잔액이 파일과 일치 → 보정이 통째로 잘못됨
        overCorrections.push({
          clientName: c.name,
          dbBalance,
          naturalBalance,
          correctionImpact,
          fileBalance,
          fixAmount: diff,  // 현재 DB → 파일 잔액으로 가려면 이만큼 필요
        })
      }
    }
  }
}

console.log(`=== over-correction 검토 결과 ===`)
console.log(`총 over-correction 의심: ${overCorrections.length}건`)
console.log()
console.log('거래처'.padEnd(30) + 'DB잔액'.padStart(15) + '파일잔액'.padStart(15) + '자연잔액'.padStart(15) + '보정효과'.padStart(15) + '필요수정'.padStart(15))
console.log('─'.repeat(110))

let totalFix = 0
for (const o of overCorrections.sort((a, b) => Math.abs(b.fixAmount) - Math.abs(a.fixAmount))) {
  console.log(
    (o.clientName.length > 28 ? o.clientName.slice(0, 27) + '…' : o.clientName).padEnd(30) +
    o.dbBalance.toLocaleString().padStart(15) +
    o.fileBalance.toLocaleString().padStart(15) +
    o.naturalBalance.toLocaleString().padStart(15) +
    o.correctionImpact.toLocaleString().padStart(15) +
    o.fixAmount.toLocaleString().padStart(15)
  )
  totalFix += o.fixAmount
}
console.log('─'.repeat(110))
console.log(`필요한 수정 합계: ${totalFix.toLocaleString()}`)

writeFileSync(
  'D:/CFO/scripts/backup/over-corrections.json',
  JSON.stringify(overCorrections, null, 2),
)
console.log(`\n💾 백업: scripts/backup/over-corrections.json`)

await prisma.$disconnect()
