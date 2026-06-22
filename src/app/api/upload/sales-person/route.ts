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
const ALLOWED_PERSONS = new Set(Object.values(PERSON_MAP))

function mapPerson(code: string): string {
  const raw = String(code ?? '').trim()
  if (!raw) return ''
  // 영문 코드 → 한글 이름
  const mapped = PERSON_MAP[raw.toUpperCase()]
  if (mapped) return mapped
  // 이미 한글 이름이면 화이트리스트 검증
  if (ALLOWED_PERSONS.has(raw)) return raw
  // 그 외 (숫자, 계산식, 따옴표 등) — 무시
  return ''
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
  date: Date | null     // ← 행 자체 날짜
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

// 일계표 productName ("원단명 [규격]") → product + spec 분리
function splitItemName(productName: string): { product: string; spec: string } {
  // 마지막 [...] 를 spec 으로 추출
  const m = productName.match(/^(.*?)\s*\[([^\]]+)\]\s*$/)
  if (m) return { product: m[1].trim(), spec: m[2].trim() }
  return { product: productName.trim(), spec: '' }
}

function parseDateFromFilename(name: string): Date | null {
  // "디안_마감_2026.04.01.xlsx" → 2026-04-01
  const m = name.match(/(\d{4})[.\-_](\d{1,2})[.\-_](\d{1,2})/)
  if (!m) return null
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 12, 0, 0)
}

function parseDateCell(val: unknown): Date | null {
  if (val instanceof Date) return val
  // 엑셀 시리얼 숫자 (예: 46177 = 2026-06-04)
  if (typeof val === 'number' && val > 1000 && val < 100000) {
    // 엑셀 epoch: 1899-12-30 (윤년 버그 포함)
    const ms = (val - 25569) * 86400 * 1000
    const d = new Date(ms)
    d.setHours(12, 0, 0, 0)
    return isNaN(d.getTime()) ? null : d
  }
  const s = String(val ?? '').trim()
  // 숫자 문자열도 시리얼로 시도
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const n = parseFloat(s)
    if (n > 1000 && n < 100000) {
      const ms = (n - 25569) * 86400 * 1000
      const d = new Date(ms); d.setHours(12, 0, 0, 0)
      return isNaN(d.getTime()) ? null : d
    }
  }
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

    // 헤더 기반 컬럼 인덱스 동적 감지 — 마감 엑셀 양식 변경에 대응
    // 헤더에 찾을 텍스트와 fallback 인덱스 (헤더 못 찾을 때)
    const headerRow = (rows[0] ?? []).map(h => String(h ?? '').trim())
    const findCol = (...names: string[]) => {
      for (const n of names) {
        const idx = headerRow.findIndex(h => h === n)
        if (idx >= 0) return idx
      }
      return -1
    }
    const COL = {
      date:            findCol('날짜'),
      company:         findCol('업체명'),
      product:         findCol('원단명'),
      spec:            findCol('색상'),
      qty:             findCol('수량(Y)', '수량'),
      person:          findCol('담당자'),
      industry:        findCol('직군'),
      productCategory: findCol('제품'),
      processFunction: findCol('가공·기능', '가공기능', '가공'),
      material:        findCol('재료'),
    }
    // fallback (헤더 못 찾으면 기존 위치)
    const fb = { date: 0, company: 2, product: 3, spec: 4, qty: 5, person: 13, industry: 15, productCategory: 16, processFunction: 17, material: 18 }
    for (const k of Object.keys(COL)) {
      if ((COL as Record<string, number>)[k] < 0) (COL as Record<string, number>)[k] = (fb as Record<string, number>)[k]
    }
    console.log('마감 엑셀 컬럼 인덱스:', COL)

    // 마감 엑셀 파싱 — 행별 A열 날짜를 그대로 보관 (범위 파일 지원)
    const magamRows: MagamRow[] = []
    let lastCompany = ''
    let lastDate: Date | null = null
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      // 날짜 (보통 A열) — 빈 셀이면 위 행 날짜 유지
      const cellDate = parseDateCell(r[COL.date])
      if (cellDate) lastDate = cellDate

      // 업체명 — " 또는 빈값이면 위 행 업체 유지
      let company = String(r[COL.company] ?? '').trim()
      if (company === '"' || company === '') company = lastCompany
      else lastCompany = company
      if (!company) continue

      magamRows.push({
        date: lastDate,
        company,
        cKey: normClient(company),
        product: String(r[COL.product] ?? '').trim(),
        pKey: normItem(String(r[COL.product] ?? '')),
        color: String(r[COL.spec] ?? '').trim(),
        colorKey: normItem(String(r[COL.spec] ?? '')),
        qty: parseFloat(String(r[COL.qty] ?? '').replace(/,/g, '')) || 0,
        person: mapPerson(String(r[COL.person] ?? '')),
        industry: String(r[COL.industry] ?? '').trim(),
        productCategory: String(r[COL.productCategory] ?? '').trim(),
        processFunction: String(r[COL.processFunction] ?? '').trim(),
        material: String(r[COL.material] ?? '').trim(),
      })
    }

    if (magamRows.length === 0) return NextResponse.json({ error: '마감 엑셀에 데이터 행이 없습니다' }, { status: 400 })

    // 행 날짜 범위 추출 — 한 파일에 여러 날짜 들어있어도 OK
    const dates = magamRows.map(m => m.date).filter(Boolean) as Date[]
    if (dates.length === 0) return NextResponse.json({ error: '날짜를 추출할 수 없습니다 (A열 또는 파일명)' }, { status: 400 })
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))

    // 거래 조회 범위: [최소 행 날짜 -30일, 최대 행 날짜]
    const start = new Date(minDate); start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0)
    const end = new Date(maxDate); end.setHours(23, 59, 59, 999)

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

    // 거래처별 단일 담당자 추출 — 점수 부족해도 거래처가 단일 담당자면 그대로 적용
    const personByClient = new Map<string, string>()
    for (const [cKey, list] of magamByClient) {
      const persons = new Set(list.map(m => m.person).filter(Boolean))
      if (persons.size === 1) personByClient.set(cKey, [...persons][0])
    }

    let personUpdated = 0  // 담당자 채워진 거래 수
    let personFromFallback = 0  // 거래처 단위 단일 담당자로 채워진 거래 수
    let itemTagged = 0      // 메타 채워진 아이템 수
    const unmatchedMagam: { company: string; product: string; reason: string }[] = []
    const usedMagam = new Set<number>()

    for (const tx of sales) {
      const cKey = normClient(tx.client?.name ?? '')
      if (!cKey) continue

      // 동일/부분일치 거래처의 마감 행 — 단, 거래 날짜와 마감행 날짜 차이가 30일 이내인 것만
      const candidates: MagamRow[] = []
      for (const [k, list] of magamByClient) {
        if (!fuzzy(cKey, k)) continue
        for (const m of list) {
          if (!m.date) continue
          const diffDays = (m.date.getTime() - tx.date.getTime()) / 86400000
          // 마감 행 날짜 >= 거래일 (출고가 매출보다 늦거나 같음) and within 30 days
          if (diffDays >= -1 && diffDays <= 30) candidates.push(m)
        }
      }
      if (candidates.length === 0) continue

      let bestPersonScore = 0
      let bestPerson = ''

      for (const item of tx.items) {
        // 일계표 productName 은 "원단명 [규격]" 형태 → 분리해서 매칭
        const { product: itemProduct, spec: itemSpec } = splitItemName(item.productName)

        let best: { score: number; row: MagamRow | null } = { score: 0, row: null }
        for (const m of candidates) {
          const s = scoreMatch(tx.client?.name ?? '', itemProduct, itemSpec, item.quantity, m)
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
      } else {
        // 점수 부족이지만 거래처가 마감 엑셀에서 단일 담당자라면 적용 (fuzzy 매칭 보강)
        // 거래처 정규화 매칭 + 마감 엑셀에 그 거래처가 한 명의 담당자만 갖는 경우
        let fallbackPerson: string | null = null
        for (const [k, person] of personByClient) {
          if (fuzzy(cKey, k)) { fallbackPerson = person; break }
        }
        if (fallbackPerson) {
          await prisma.transaction.update({ where: { id: tx.id }, data: { salesPerson: fallbackPerson } })
          personUpdated++
          personFromFallback++
        }
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
      fileDate: `${minDate.toISOString().slice(0, 10)} ~ ${maxDate.toISOString().slice(0, 10)}`,
      totalMagamRows: magamRows.length,
      personUpdated,
      personFromFallback,
      columnsDetected: COL,
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
