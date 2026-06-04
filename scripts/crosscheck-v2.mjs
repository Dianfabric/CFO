import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

// 한글 = 2폭, 영문 = 1폭으로 계산해 정렬
function pad(s, n, align = 'left') {
  s = String(s ?? '')
  const w = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)
  const fill = ' '.repeat(Math.max(0, n - w))
  if (align === 'right') return fill + s
  return s + fill
}

// 거래처명 정규화
function normClient(name) {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
}

// 품명·색상 정규화: 괄호/공백/하이픈 제거, 영문대문자
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
  if (!u) return ''
  return PERSON_MAP[u] ?? u
}

// ── 1) 일계표 ──────────────────────────
const ilWB = XLSX.read(readFileSync('D:/Dropbox/일계표 06.02.xls'), { type: 'buffer' })
const ilSheet = ilWB.SheetNames[0]
const ilRows = XLSX.utils.sheet_to_json(ilWB.Sheets[ilSheet], { header: 1, defval: '' })

const saleRows = []
for (const r of ilRows) {
  const no = parseFloat(String(r[0] ?? '').replace(/,/g, ''))
  if (!Number.isFinite(no) || no <= 0) continue
  const account = String(r[1] ?? '').trim()
  if (account !== '외출') continue
  saleRows.push({
    no,
    client: String(r[2] ?? '').trim(),
    productName: String(r[3] ?? '').trim(),
    spec: String(r[4] ?? '').trim(),
    qty: parseFloat(String(r[6] ?? '').replace(/,/g, '')) || 0,
    unitPrice: parseFloat(String(r[7] ?? '').replace(/,/g, '')) || 0,
    amount: parseFloat(String(r[8] ?? '').replace(/,/g, '')) || 0,
    voucherNo: String(r[11] ?? '').trim(),
  })
}

// ── 2) 디안 마감 ─────────────────────────
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
    company,
    cKey: normClient(company),
    product: String(r[3] ?? '').trim(),
    pKey: normItem(r[3]),
    color: String(r[4] ?? '').trim(),
    colorKey: normItem(r[4]),
    qty: parseFloat(String(r[5] ?? '').replace(/,/g, '')) || 0,
    person: mapPerson(r[13]),
    raw: r[13],
  })
}

// ── 3) 매칭 함수 ──────────────────────────
// 1순위: 거래처+품명+색상  2순위: 거래처+품명  3순위: 거래처만 (행 1개일 때)
function matchPerson(sale) {
  const cKey = normClient(sale.client)
  const pKey = normItem(sale.productName)
  const colorKey = normItem(sale.spec)

  // 같은 거래처 행
  const sameClient = magamRows.filter(m => fuzzy(m.cKey, cKey))
  if (sameClient.length === 0) return { person: '', matchType: '거래처없음' }

  // 1순위: 거래처+품명+색상
  const exact = sameClient.find(m => fuzzy(m.pKey, pKey) && fuzzy(m.colorKey, colorKey))
  if (exact) return { person: exact.person, matchType: '거래처+품명+색상', source: exact }

  // 2순위: 거래처+품명
  const byProduct = sameClient.find(m => fuzzy(m.pKey, pKey))
  if (byProduct) return { person: byProduct.person, matchType: '거래처+품명', source: byProduct }

  // 3순위: 거래처에 행 1개면 그걸로
  if (sameClient.length === 1) return { person: sameClient[0].person, matchType: '거래처(단일)', source: sameClient[0] }

  return { person: '', matchType: '품명미매칭' }
}

// ── 4) 전표 그룹핑 + 매칭 ─────────────────
const groups = new Map()
for (const r of saleRows) {
  const key = `${r.voucherNo}__${r.client}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(r)
}

const result = []
for (const [key, items] of groups) {
  const client = items[0].client
  // 거래에 여러 아이템이 있을 때 — 첫 번째 매칭되는 담당자 채택 (대부분 같음)
  let person = '', matchType = ''
  for (const it of items) {
    const m = matchPerson(it)
    if (m.person) {
      person = m.person
      matchType = m.matchType
      break
    }
    if (!matchType) matchType = m.matchType
  }
  const total = items.reduce((s, i) => s + i.amount, 0)
  result.push({ voucherNo: items[0].voucherNo, client, total, items, person, matchType })
}

// ── 5) 표 출력 ──────────────────────────
console.log('═'.repeat(100))
console.log('  📊 일계표 06.02 × 디안마감 06.02 교차검증')
console.log('═'.repeat(100))

console.log('\n┌' + '─'.repeat(98) + '┐')
console.log('│ ' + pad('전표', 5) + pad('거래처', 28) + pad('품명/규격', 32) + pad('수량', 6, 'right') + pad('금액', 13, 'right') + pad('담당자', 11) + ' │')
console.log('├' + '─'.repeat(98) + '┤')

for (const r of result) {
  const headerItem = r.items[0]
  const item1 = `${headerItem.productName}${headerItem.spec ? ' ['+headerItem.spec+']' : ''}`
  const cnt = r.items.length
  console.log('│ ' + pad(r.voucherNo, 5) + pad(r.client, 28) + pad(item1.slice(0, 16) + (cnt > 1 ? ` +${cnt-1}건` : ''), 32) + pad(String(headerItem.qty), 6, 'right') + pad('₩'+r.total.toLocaleString(), 13, 'right') + pad(r.person || '(미매칭)', 11) + ' │')
  // 추가 아이템 같이 보여주기
  for (let i = 1; i < r.items.length; i++) {
    const it = r.items[i]
    const sub = `   └ ${it.productName}${it.spec ? ' ['+it.spec+']' : ''}`
    console.log('│ ' + pad('', 5) + pad('', 28) + pad(sub.slice(0, 32), 32) + pad(String(it.qty), 6, 'right') + pad('₩'+it.amount.toLocaleString(), 13, 'right') + pad('', 11) + ' │')
  }
}

console.log('└' + '─'.repeat(98) + '┘')

const total = result.reduce((s, r) => s + r.total, 0)
const matched = result.filter(r => r.person).length
const unmatched = result.length - matched

console.log(`\n  거래 ${result.length}건  매출합계 ₩${total.toLocaleString()}`)
console.log(`  ✓ 매칭 ${matched}건 / ✗ 미매칭 ${unmatched}건`)

// ── 담당자별 집계 ──
const byPerson = {}
for (const r of result) {
  const k = r.person || '(미매칭)'
  if (!byPerson[k]) byPerson[k] = { count: 0, total: 0 }
  byPerson[k].count++
  byPerson[k].total += r.total
}
console.log('\n┌─── 담당자별 매출 ──────────────────────────┐')
const sorted = Object.entries(byPerson).sort((a, b) => b[1].total - a[1].total)
for (const [p, v] of sorted) {
  console.log('│  ' + pad(p, 12) + pad(`${v.count}건`, 8, 'right') + pad('₩'+v.total.toLocaleString(), 18, 'right') + '  │')
}
console.log('└────────────────────────────────────────────┘')

// ── 미매칭 디테일 ──
const unmatchedRes = result.filter(r => !r.person)
if (unmatchedRes.length > 0) {
  console.log('\n⚠️  미매칭 거래')
  for (const r of unmatchedRes) {
    console.log(`   • [${r.voucherNo}] ${r.client} / ₩${r.total.toLocaleString()}  (사유: ${r.matchType})`)
    for (const it of r.items) {
      console.log(`       - ${it.productName}${it.spec ? ' ['+it.spec+']' : ''} ${it.qty} × ${it.unitPrice.toLocaleString()}`)
    }
  }
}
