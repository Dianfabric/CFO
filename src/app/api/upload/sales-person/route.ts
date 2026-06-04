import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'

// 디안 마감 엑셀 업로드 — 일계표 SALE 거래에 담당자/직군/제품/가공/재료 채우기
// 매칭 기준: 거래처 부분일치 + 품명 + 색상 + 수량 (점수 ≥ 50)
// 소급 기간: 30일

export const runtime = 'nodejs'

const PERSON_MAP: Record<string, string> = {
  HTW: '한태원', HTJ: '한태종', CHJ: '최현진', YDH: '유대현', SR: '전새로미',
}

function mapPerson(code: string): string {
  const u = String(code ?? '').trim().toUpperCase()
  return u ? (PERSON_MAP[u] ?? u) : ''
}

function normClient(name: string): string {
  return String(name ?? '')
    .replace(/주식회사|\(주\)|㈜|유한회사/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
}

function normItem(s: string): string {
  return String(s ?? '')
    .replace(/[\[\]()]/g, ' ')
    .replace(/[-_#\s]+/g, '')
    .trim()
    .toUpperCase()
}

function fuzzy(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length >= 2 && b.includes(a)) return true
  if (b.length >= 2 && a.includes(b)) return true
  return false
}

interface MagamRow {
  date: string
  company: string
  cKey: string
  product: string
  pKey: string
  color: string
  colorKey: string
  qty: number
  person: string
  industry: string
  productCategory: string
  processFunction: string
  material: string
}

function parseDateFromFilename(name: string): Date | null {
  // "디안_마감_2026.04.01.xlsx" → 2026-04-01
  const m = name.match(/(\d{4})[.\-_](\d{1,2})[.\-_](\d{1,2})/)
  if (!m) return null
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 12, 0, 0)
}

function parseDateCell(val: unknown): Date | null {
  if (val instanceof Date) return val
  const s = String(val ?? '').trim()
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return null
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 12, 0, 0)
}

function scoreMatch(
  saleClient: string, saleProduct: string, saleSpec: string, saleQty: number,
  magam: MagamRow,
): { score: number; reasons: string[] } {
  const cKey = normClient(saleClient)
  if (!fuzzy(cKey, magam.cKey)) return { score: 0, reasons: [] }
  let score = 30
  const reasons = ['거래처']
  if (fuzzy(normItem(saleProduct), magam.pKey)) { score += 40; reasons.push('품명') }
  if (fuzzy(normItem(saleSpec), magam.colorKey)) { score += 20; reasons.push('색상') }
  if (Math.abs(Math.abs(saleQty) - Math.abs(magam.qty)) < 0.1) { score += 10; reasons.push('수량') }
  return { score, reasons }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

    // 파일명 또는 첫 데이터행 날짜로 기준일 결정
    const fileDate = parseDateFromFilename(file.name) || parseDateCell(rows[1]?.[0])
    if (!fileDate) return NextResponse.json({ error: '마감 파일 날짜를 인식할 수 없습니다 (파일명 또는 A열)' }, { status: 400 })

    // 마감 엑셀 파싱
    const magamRows: MagamRow[] = []
    let lastCompany = ''
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      let company = String(r[2] ?? '').trim()
      if (company === '"' || company === '') company = lastCompany
      else lastCompany = company
      if (!company) continue

      magamRows.push({
        date: String(r[0] ?? ''),
        company,
        cKey: normClient(company),
        product: String(r[3] ?? '').trim(),
        pKey: normItem(String(r[3] ?? '')),
        color: String(r[4] ?? '').trim(),
        colorKey: normItem(String(r[4] ?? '')),
        qty: parseFloat(String(r[5] ?? '').replace(/,/g, '')) || 0,
        person: mapPerson(String(r[13] ?? '')),
        industry: String(r[14] ?? '').trim(),          // O열: 직군
        productCategory: String(r[15] ?? '').trim(),   // P열: 제품
        processFunction: String(r[16] ?? '').trim(),   // Q열: 가공·기능
        material: String(r[17] ?? '').trim(),          // R열: 재료
      })
    }

    if (magamRows.length === 0) return NextResponse.json({ error: '마감 엑셀에 데이터 행이 없습니다' }, { status: 400 })

    // 30일 소급: [fileDate - 30, fileDate] 기간의 SALE 거래 가져오기
    const start = new Date(fileDate); start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0)
    const end = new Date(fileDate); end.setHours(23, 59, 59, 999)

    const sales = await prisma.transaction.findMany({
      where: { type: 'SALE', date: { gte: start, lte: end } },
      include: { items: true, client: { select: { name: true } } },
    })

    // 거래처 정규화 키 → 마감 행 그룹
    const magamByClient = new Map<string, MagamRow[]>()
    for (const m of magamRows) {
      if (!magamByClient.has(m.cKey)) magamByClient.set(m.cKey, [])
      magamByClient.get(m.cKey)!.push(m)
    }

    let personUpdated = 0  // 담당자 채워진 거래 수
    let itemTagged = 0      // 메타 채워진 아이템 수
    const unmatchedMagam: { company: string; product: string; reason: string }[] = []
    const usedMagam = new Set<number>()

    for (const tx of sales) {
      const cKey = normClient(tx.client?.name ?? '')
      if (!cKey) continue

      // 동일/부분일치 거래처의 마감 행
      const candidates: MagamRow[] = []
      for (const [k, list] of magamByClient) if (fuzzy(cKey, k)) candidates.push(...list)
      if (candidates.length === 0) continue

      let bestPersonScore = 0
      let bestPerson = ''

      for (const item of tx.items) {
        let best: { score: number; row: MagamRow | null } = { score: 0, row: null }
        for (const m of candidates) {
          const s = scoreMatch(tx.client?.name ?? '', item.productName, '', item.quantity, m)
          // item.productName에 [규격]이 포함되어 있을 수 있어 productName 그대로 + extractSpec 추가 시도
          // 일계표에서는 productName = "원단명 [규격]" 형태로 저장됨
          if (s.score > best.score) best = { score: s.score, row: m }
        }
        if (best.score >= 50 && best.row) {
          // 아이템에 메타 채우기
          const tags: any = {}
          if (best.row.industry) tags.industry = best.row.industry
          if (best.row.productCategory) tags.productCategory = best.row.productCategory
          if (best.row.processFunction) tags.processFunction = best.row.processFunction
          if (best.row.material) tags.material = best.row.material
          if (Object.keys(tags).length > 0) {
            await prisma.transactionItem.update({ where: { id: item.id }, data: tags })
            itemTagged++
          }
          // 담당자 (이 아이템에서 가장 점수 높은 것 채택)
          if (best.row.person && best.score > bestPersonScore) {
            bestPersonScore = best.score
            bestPerson = best.row.person
          }
          // 마감 행 사용 표시
          const idx = magamRows.indexOf(best.row)
          if (idx >= 0) usedMagam.add(idx)
        }
      }

      if (bestPerson) {
        // 마감 엑셀이 최우선 — 무조건 덮어쓰기
        await prisma.transaction.update({ where: { id: tx.id }, data: { salesPerson: bestPerson } })
        personUpdated++
      }
    }

    // 사용 안 된 마감 행 (= 매칭 안 된 마감 행, 추후 다시 시도되거나 주문현황으로 처리)
    magamRows.forEach((m, i) => {
      if (!usedMagam.has(i)) {
        unmatchedMagam.push({
          company: m.company,
          product: m.product + (m.color ? ` [${m.color}]` : ''),
          reason: '일계표에서 매칭 거래 없음',
        })
      }
    })

    return NextResponse.json({
      success: true,
      type: 'sales_person',
      fileDate: fileDate.toISOString().slice(0, 10),
      totalMagamRows: magamRows.length,
      personUpdated,
      itemTagged,
      unmatchedMagamCount: unmatchedMagam.length,
      unmatchedMagam: unmatchedMagam.slice(0, 20),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Sales person upload error:', msg)
    return NextResponse.json({ error: '파일 처리 중 오류', detail: msg.slice(0, 300) }, { status: 500 })
  }
}
