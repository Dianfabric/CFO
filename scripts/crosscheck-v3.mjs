import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

function pad(s, n, align = 'left') {
  s = String(s ?? '')
  const w = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)
  const fill = ' '.repeat(Math.max(0, n - w))
  return align === 'right' ? fill + s : s + fill
}

function normClient(name) {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
}

function normItem(s) {
  return String(s ?? '')
    .replace(/[\[\]()]/g, ' ')
    .replace(/[-_#\s]+/g, '')
    .trim()
    .toUpperCase()
}

function fuzzy(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length >= 2 && b.includes(a)) return true
  if (b.length >= 2 && a.includes(b)) return true
  return false
}

const PERSON_MAP = {
  HTW: '한태원', HTJ: '한태종', CHJ: '최현진', YDH: '유대현', SR: '전새로미',
}
function mapPerson(code) {
  const u = String(code ?? '').trim().toUpperCase()
  return u ? (PERSON_MAP[u] ?? u) : ''
}

// ── 일계표 ──
const ilWB = XLSX.read(readFileSync('D:/Dropbox/일계표 06.02.xls'), { type: 'buffer' })
const ilRows = XLSX.utils.sheet_to_json(ilWB.Sheets[ilWB.SheetNames[0]], { header: 1, defval: '' })

const saleRows = []
for (const r of ilRows) {
  const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
  if (!Number.isFinite(no) || no <= 0) continue
  if (String(r[1] ?? '').trim() !== '외출') continue
  saleRows.push({
    no, client: String(r[2] ?? '').trim(),
    productName: String(r[3] ?? '').trim(),
    spec: String(r[4] ?? '').trim(),
    qty: parseFloat(String(r[6] ?? '').replace(/,/g, '')) || 0,
    unitPrice: parseFloat(String(r[7] ?? '').replace(/,/g, '')) || 0,
    amount: parseFloat(String(r[8] ?? '').replace(/,/g, '')) || 0,
    voucherNo: String(r[11] ?? '').trim(),
  })
}

// ── 마감 ──
const mgWB = XLSX.read(readFileSync('D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.06/디안_마감_2026.06.02.xlsx'), { type: 'buffer' })
const mgRows = XLSX.utils.sheet_to_json(mgWB.Sheets[mgWB.SheetNames[0]], { header: 1, defval: '' })

const magamRows = []
let lastCompany = ''
for (let i = 1; i < mgRows.length; i++) {
  const r = mgRows[i]
  let company = String(r[2] ?? '').trim()
  if (company === '"' || company === '') company = lastCompany
  else lastCompany = company
  if (!company) continue
  magamRows.push({
    company, cKey: normClient(company),
    product: String(r[3] ?? '').trim(), pKey: normItem(r[3]),
    color: String(r[4] ?? '').trim(), colorKey: normItem(r[4]),
    qty: parseFloat(String(r[5] ?? '').replace(/,/g, '')) || 0,
    person: mapPerson(r[13]),
  })
}

// ── 점수 기반 매칭 ──
// 거래처 부분일치 필수 (30점). 그 위에서 품명(40)/색상(20)/수량(10) 가산.
// 임계 50점 이상이면 매칭으로 인정.
function scoreItem(saleItem, magamRow) {
  const cKey = normClient(saleItem.client)
  if (!fuzzy(cKey, magamRow.cKey)) return { score: 0, reasons: [] }
  let score = 30
  const reasons = ['거래처']
  if (fuzzy(normItem(saleItem.productName), magamRow.pKey)) { score += 40; reasons.push('품명') }
  if (fuzzy(normItem(saleItem.spec), magamRow.colorKey)) { score += 20; reasons.push('색상') }
  if (Math.abs(Math.abs(saleItem.qty) - Math.abs(magamRow.qty)) < 0.1) { score += 10; reasons.push('수량') }
  return { score, reasons }
}

function matchVoucher(items) {
  // 같은 거래처의 마감 행
  const cKey = normClient(items[0].client)
  const sameClient = magamRows.filter(m => fuzzy(cKey, m.cKey))
  if (sameClient.length === 0) return { person: '', matchType: '마감엑셀에 거래처 없음', score: 0, matchedRow: null }

  // 전표 안의 모든 아이템에 대해 best magam row 찾기
  const itemMatches = []
  for (const it of items) {
    let best = { score: 0, row: null, reasons: [] }
    for (const m of sameClient) {
      const s = scoreItem(it, m)
      if (s.score > best.score) best = { score: s.score, row: m, reasons: s.reasons }
    }
    if (best.score >= 50 && best.row) itemMatches.push({ item: it, ...best })
  }

  if (itemMatches.length === 0) {
    // fallback: 거래처가 마감에 단 1행이고 담당자 있으면 그걸 사용
    if (sameClient.length === 1 && sameClient[0].person) {
      return { person: sameClient[0].person, matchType: '거래처(단일행)', score: 30, matchedRow: sameClient[0] }
    }
    return { person: '', matchType: '품명/색상/수량 매칭 실패', score: 0, matchedRow: null }
  }

  // 점수 가장 높은 매칭 → 그 담당자 채택
  itemMatches.sort((a, b) => b.score - a.score)
  const top = itemMatches[0]
  return {
    person: top.row.person,
    matchType: top.reasons.join('+'),
    score: top.score,
    matchedRow: top.row,
  }
}

// ── 전표 그룹핑 ──
const groups = new Map()
for (const r of saleRows) {
  const key = `${r.voucherNo}__${r.client}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(r)
}

const result = []
for (const [, items] of groups) {
  const m = matchVoucher(items)
  const total = items.reduce((s, i) => s + i.amount, 0)
  result.push({
    voucherNo: items[0].voucherNo, client: items[0].client,
    items, total, ...m,
  })
}

// ── 출력: 표 ──
console.log('═'.repeat(110))
console.log('  📊 일계표 06.02 × 디안마감 06.02 — 점수기반 종합매칭')
console.log('═'.repeat(110))

console.log(`\n┌${'─'.repeat(108)}┐`)
console.log(`│ ${pad('전표', 5)}${pad('거래처', 26)}${pad('주 품목', 28)}${pad('수량', 6, 'right')}${pad('금액', 13, 'right')}${pad('담당자', 12)}${pad('근거', 16)} │`)
console.log(`├${'─'.repeat(108)}┤`)

for (const r of result) {
  const it = r.items[0]
  const cnt = r.items.length
  const itemLabel = `${it.productName}${it.spec ? ' ['+it.spec+']' : ''}${cnt > 1 ? ` +${cnt-1}` : ''}`
  const personLabel = r.person ? `${r.person}${r.score ? ` (${r.score}점)` : ''}` : '⚠ 미매칭'
  console.log(`│ ${pad(r.voucherNo, 5)}${pad(r.client, 26)}${pad(itemLabel.slice(0, 14), 28)}${pad(String(it.qty), 6, 'right')}${pad('₩'+r.total.toLocaleString(), 13, 'right')}${pad(personLabel, 12)}${pad(r.matchType.slice(0, 14), 16)} │`)
}
console.log(`└${'─'.repeat(108)}┘`)

const total = result.reduce((s, r) => s + r.total, 0)
const matched = result.filter(r => r.person).length
console.log(`\n  거래 ${result.length}건 · 매출 ₩${total.toLocaleString()} · ✓매칭 ${matched} · ✗미매칭 ${result.length - matched}`)

// 담당자별 집계
const byPerson = {}
for (const r of result) {
  const k = r.person || '⚠ 미매칭'
  if (!byPerson[k]) byPerson[k] = { count: 0, total: 0 }
  byPerson[k].count++
  byPerson[k].total += r.total
}
console.log('\n┌─── 담당자별 매출 ────────────────────────────┐')
const sorted = Object.entries(byPerson).sort((a, b) => b[1].total - a[1].total)
for (const [p, v] of sorted) {
  const bar = '█'.repeat(Math.round((v.total / total) * 25))
  console.log(`│  ${pad(p, 12)}${pad(`${v.count}건`, 6, 'right')}  ${pad('₩'+v.total.toLocaleString(), 15, 'right')}  ${bar.padEnd(25)} │`)
}
console.log('└────────────────────────────────────────────────────────┘')

// 미매칭 상세
const unm = result.filter(r => !r.person)
if (unm.length > 0) {
  console.log('\n⚠️  미매칭 거래 상세')
  for (const r of unm) {
    console.log(`   [${r.voucherNo}] ${r.client} ₩${r.total.toLocaleString()} — 사유: ${r.matchType}`)
    for (const it of r.items) {
      console.log(`        · ${it.productName}${it.spec ? ' ['+it.spec+']' : ''}  ${it.qty}개`)
    }
  }
}

// ── Excel 저장 ──────────────────────────
import('fs').then(({ writeFileSync }) => {
  const outWB = XLSX.utils.book_new()

  // 시트1: 거래 매칭 결과
  const sheet1Data = [['전표No', '거래처', '품명', '규격/색상', '수량', '단가', '금액', '담당자', '매칭점수', '매칭근거', '마감 업체명', '마감 원단명', '마감 색상', '마감 수량']]
  for (const r of result) {
    for (let i = 0; i < r.items.length; i++) {
      const it = r.items[i]
      sheet1Data.push([
        i === 0 ? r.voucherNo : '',
        i === 0 ? r.client : '',
        it.productName, it.spec, it.qty, it.unitPrice, it.amount,
        i === 0 ? (r.person || '⚠ 미매칭') : '',
        i === 0 ? (r.score || '') : '',
        i === 0 ? r.matchType : '',
        i === 0 ? (r.matchedRow?.company ?? '') : '',
        i === 0 ? (r.matchedRow?.product ?? '') : '',
        i === 0 ? (r.matchedRow?.color ?? '') : '',
        i === 0 ? (r.matchedRow?.qty ?? '') : '',
      ])
    }
  }
  // 합계 행
  sheet1Data.push([])
  sheet1Data.push(['', '합계', '', '', '', '', result.reduce((s, r) => s + r.total, 0), '', '', '', '', '', '', ''])
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data)
  // 컬럼 너비
  ws1['!cols'] = [
    { wch: 8 }, { wch: 25 }, { wch: 22 }, { wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 13 },
    { wch: 12 }, { wch: 9 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 8 },
  ]
  XLSX.utils.book_append_sheet(outWB, ws1, '거래 매칭 결과')

  // 시트2: 담당자별 매출
  const sheet2Data = [['담당자', '거래건수', '매출합계', '비중(%)']]
  for (const [p, v] of sorted) {
    sheet2Data.push([p, v.count, v.total, +(v.total / total * 100).toFixed(1)])
  }
  sheet2Data.push([])
  sheet2Data.push(['합계', result.length, total, 100])
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data)
  ws2['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(outWB, ws2, '담당자별 매출')

  // 시트3: 미매칭 거래
  const sheet3Data = [['전표No', '거래처', '품명', '규격/색상', '수량', '단가', '금액', '사유']]
  for (const r of result.filter(x => !x.person)) {
    for (let i = 0; i < r.items.length; i++) {
      const it = r.items[i]
      sheet3Data.push([
        i === 0 ? r.voucherNo : '',
        i === 0 ? r.client : '',
        it.productName, it.spec, it.qty, it.unitPrice, it.amount,
        i === 0 ? r.matchType : '',
      ])
    }
  }
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data)
  ws3['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 22 }, { wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 13 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(outWB, ws3, '미매칭')

  // 날짜 추출 (일계표 시트명에서)
  const sheetName = ilWB.SheetNames[0]  // "26.06.02"
  const dateStr = sheetName.replace(/\./g, '-').replace(/^/, '20')
  const outPath = `D:/Dropbox/[디안]내부문서/마감자료/2026년/2026.06/일계표_담당자_매칭_${dateStr}.xlsx`
  const buf = XLSX.write(outWB, { type: 'buffer', bookType: 'xlsx' })
  writeFileSync(outPath, buf)
  console.log(`\n📁 엑셀 파일 저장: ${outPath}`)
})
