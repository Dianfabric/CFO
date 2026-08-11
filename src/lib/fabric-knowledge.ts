/**
 * public.fabric_knowledge_master (Supabase) 읽기 전용 조회 헬퍼
 *
 * ⚠️ 이 테이블은 v1.1 Supabase 쪽 원단 지식/단가 마스터로, Prisma 스키마에는
 * 매핑돼 있지 않습니다. 그래서 컬럼을 코드에 하드코딩하지 않고 런타임에
 * information_schema 로 실제 존재하는 컬럼을 발견(discover)한 뒤,
 * 화이트리스트와 교집합만 SELECT/WHERE/ORDER 에 사용합니다.
 *
 * 보안:
 *  - 식별자(컬럼명)는 절대 사용자 입력에서 오지 않습니다. 고정 화이트리스트에서만 옵니다.
 *  - 사용자 입력(검색어·브랜드 등)은 전부 $1,$2 파라미터로 바인딩합니다 (SQL injection 방지).
 *  - 읽기 전용. INSERT/UPDATE/DELETE 없음.
 */
import { prisma } from '@/lib/prisma'

const TABLE = 'public.fabric_knowledge_master'

/** 이 화면에서 쓸 수 있는 안전한 컬럼 화이트리스트. 실제 존재 여부는 런타임에 교집합. */
export const COLUMN_WHITELIST = [
  'id',
  'product_name',
  'product_name_ko',
  'search_alias',
  'brand',
  'brand_code',
  'cost_usd',
  'cost_usd_override',
  'sell_price',
  'dealer_price',
  'material',
  'width_mm',
  'weight_gsm',
  'moq_or_roll',
  'match_status',
  'operation_note',
  'representative_image_url',
  'representative_image_path',
  'linked_fabric_ids',
  'linked_image_paths',
  'linked_image_urls',
  'is_active',
  'created_at',
  'updated_at',
] as const

export type FabricColumn = (typeof COLUMN_WHITELIST)[number]

/** 식별자 방어 — 화이트리스트 통과 + 안전한 문자만 */
const IDENT_RE = /^[a-z_][a-z0-9_]*$/
function ident(name: string): string {
  if (!IDENT_RE.test(name)) throw new Error(`unsafe identifier: ${name}`)
  return `"${name}"`
}

let columnCache: Set<string> | null = null

/** 테이블에 실제 존재하는 컬럼 집합 (프로세스 캐시) */
export async function getExistingColumns(): Promise<Set<string>> {
  if (columnCache) return columnCache
  const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'fabric_knowledge_master'`,
  )
  columnCache = new Set(rows.map((r) => r.column_name))
  return columnCache
}

/** 화이트리스트 ∩ 실제 컬럼 */
export async function availableColumns(): Promise<Set<string>> {
  const existing = await getExistingColumns()
  return new Set(COLUMN_WHITELIST.filter((c) => existing.has(c)))
}

export type FabricRow = Record<string, unknown> & {
  id?: string | number | null
  product_name?: string | null
  brand?: string | null
}

export interface FabricSummary {
  total: number
  ricky: number
  rickyNew: number
  missingCost: number
  missingSell: number
}

export interface FabricListResult {
  summary: FabricSummary
  brands: string[]
  brandCounts: { brand: string; count: number }[]
  matchStatuses: string[]
  rows: FabricRow[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export interface FabricPriceTier {
  basisUsd: number
  sellPrice: number
  dealerPrice: number
  rowCount: number
}

export interface FabricListParams {
  query?: string
  brand?: string
  /** '' | 'missing_cost' | 'missing_sell' | 'complete' */
  priceStatus?: string
  matchStatus?: string
  /** 'active'(default) | 'inactive' | 'all' */
  active?: string
  page?: number
  pageSize?: number
}

export interface CreateFabricInput {
  brand: string
  productName: string
  brandCode?: string
  productNameKo?: string
  searchAlias?: string
  material?: string
  widthMm?: number | null
  weightGsm?: number | null
  costUsd?: number | null
  costUsdOverride?: number | null
  sellPrice?: number | null
  dealerPrice?: number | null
  moqOrRoll?: string
  operationNote?: string
}

function cleanText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text.slice(0, maxLength) : null
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** CFO 관리 화면에서 직접 추가한 대표 품목 1건을 등록한다. */
export async function updateFabricPrice(id: string, input: CreateFabricInput): Promise<FabricRow> {
  const cols = await availableColumns()
  const productName = cleanText(input.productName, 200)
  const brand = cleanText(input.brand, 120)
  if (!productName || !brand) throw new Error('브랜드와 원단명은 필수입니다.')

  const current = await prisma.$queryRawUnsafe<{ raw: unknown }[]>(
    `SELECT "raw" FROM ${TABLE} WHERE "id"::text = $1 LIMIT 1`, id,
  )
  if (!current.length) throw new Error('원단을 찾을 수 없습니다.')

  const existingRaw = current[0].raw && typeof current[0].raw === 'object' && !Array.isArray(current[0].raw)
    ? current[0].raw as Record<string, unknown> : {}
  const sellPrice = cleanNumber(input.sellPrice)
  const dealerPrice = cleanNumber(input.dealerPrice)
  const values: Record<string, unknown> = {
    brand,
    product_name: productName,
    brand_code: cleanText(input.brandCode, 50),
    product_name_ko: cleanText(input.productNameKo, 200),
    search_alias: cleanText(input.searchAlias, 200),
    material: cleanText(input.material, 300),
    width_mm: cleanNumber(input.widthMm),
    weight_gsm: cleanNumber(input.weightGsm),
    cost_usd: cleanNumber(input.costUsd),
    cost_usd_override: cleanNumber(input.costUsdOverride),
    sell_price: sellPrice,
    dealer_price: dealerPrice,
    moq_or_roll: cleanText(input.moqOrRoll, 200),
    operation_note: cleanText(input.operationNote, 2000),
    raw: { ...existingRaw, '원단명': productName, '원단단가/Y': sellPrice, '대리점 단가': dealerPrice, updated_by: 'cfo_price_manager', updated_at: new Date().toISOString() },
  }
  const updateCols = Object.keys(values).filter((column) => cols.has(column))
  const assignments = updateCols.map((column, index) => `${ident(column)} = $${index + 1}`)
  if (cols.has('updated_at')) assignments.push(`"updated_at" = NOW()`)
  const selectCols = COLUMN_WHITELIST.filter((column) => cols.has(column)).map(ident).join(', ')
  const rows = await prisma.$queryRawUnsafe<FabricRow[]>(
    `UPDATE ${TABLE} SET ${assignments.join(', ')} WHERE "id"::text = $${updateCols.length + 1} RETURNING ${selectCols || '*'}`,
    ...updateCols.map((column) => column === 'raw' ? JSON.stringify(values[column]) : values[column]), id,
  )
  return rows[0]
}

/** CFO 관리 화면에서 직접 추가한 대표 품목 1건을 등록한다. */
export async function createManualFabric(input: CreateFabricInput): Promise<FabricRow> {
  const cols = await availableColumns()
  const brand = cleanText(input.brand, 120)
  const productName = cleanText(input.productName, 200)
  if (!brand || !productName) throw new Error('브랜드와 원단명은 필수입니다.')

  const duplicate = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM ${TABLE}
     WHERE lower(coalesce("brand", '')) = lower($1)
       AND lower(coalesce("product_name", '')) = lower($2)
       AND (NOT $3 OR "is_active" = TRUE)
     LIMIT 1`,
    brand,
    productName,
    cols.has('is_active'),
  )
  if (duplicate.length) throw new Error('같은 브랜드·원단명이 이미 등록되어 있습니다.')

  const values: Record<string, unknown> = {
    brand,
    product_name: productName,
    brand_code: cleanText(input.brandCode, 50),
    product_name_ko: cleanText(input.productNameKo, 200),
    search_alias: cleanText(input.searchAlias, 200),
    material: cleanText(input.material, 300),
    width_mm: cleanNumber(input.widthMm),
    weight_gsm: cleanNumber(input.weightGsm),
    cost_usd: cleanNumber(input.costUsd),
    cost_usd_override: cleanNumber(input.costUsdOverride),
    sell_price: cleanNumber(input.sellPrice),
    dealer_price: cleanNumber(input.dealerPrice),
    moq_or_roll: cleanText(input.moqOrRoll, 200),
    operation_note: cleanText(input.operationNote, 2000),
    match_status: 'manual',
    is_active: true,
    source_sheet_id: 'CFO_MANUAL',
    source_tab: '원단 단가 관리',
    raw: {
      source: 'cfo_manual_entry',
      entered_at: new Date().toISOString(),
      brand,
      product_name: productName,
    },
  }
  const insertCols = Object.keys(values).filter((column) => cols.has(column))
  const bind = insertCols.map((_, i) => `$${i + 1}`)
  const selectCols = COLUMN_WHITELIST.filter((column) => cols.has(column)).map(ident).join(', ')
  const rows = await prisma.$queryRawUnsafe<FabricRow[]>(
    `INSERT INTO ${TABLE} (${insertCols.map(ident).join(', ')})
     VALUES (${bind.join(', ')})
     RETURNING ${selectCols || '*'}`,
    ...insertCols.map((column) => (column === 'raw' ? JSON.stringify(values[column]) : values[column])),
  )
  return rows[0]
}

/**
 * 현재 마스터에서 기준 단가별 가장 많이 쓰인 판매/대리점가 조합을 읽는다.
 * 새 원단 입력 화면의 자동 단가와 단가표가 같은 기준을 보게 한다.
 */
export async function queryFabricPriceTiers(): Promise<FabricPriceTier[]> {
  const cols = await availableColumns()
  if (!cols.has('cost_usd_override') || !cols.has('sell_price') || !cols.has('dealer_price')) return []
  const activeWhere = cols.has('is_active') ? 'AND "is_active" = TRUE' : ''
  const candidates = await prisma.$queryRawUnsafe<
    { basisUsd: string | number; sellPrice: string | number; dealerPrice: string | number; rowCount: number }[]
  >(
    `SELECT "cost_usd_override" AS "basisUsd", "sell_price" AS "sellPrice", "dealer_price" AS "dealerPrice", count(*)::int AS "rowCount"
     FROM ${TABLE}
     WHERE "cost_usd_override" IS NOT NULL
       AND "sell_price" IS NOT NULL
       AND "dealer_price" IS NOT NULL
       ${activeWhere}
     GROUP BY "cost_usd_override", "sell_price", "dealer_price"
     ORDER BY "cost_usd_override", "rowCount" DESC`,
  )
  const seen = new Set<number>()
  return candidates.flatMap((row) => {
    const basisUsd = Number(row.basisUsd)
    const sellPrice = Number(row.sellPrice)
    const dealerPrice = Number(row.dealerPrice)
    if (!Number.isFinite(basisUsd) || !Number.isFinite(sellPrice) || !Number.isFinite(dealerPrice) || seen.has(basisUsd)) return []
    seen.add(basisUsd)
    return [{ basisUsd, sellPrice, dealerPrice, rowCount: Number(row.rowCount) || 0 }]
  })
}

/** brand='RICKY' AND (신규) 판별식 — 있는 컬럼에 맞춰 최선의 표현 선택 */
function rickyNewExpr(cols: Set<string>): string | null {
  if (!cols.has('brand')) return null
  if (cols.has('match_status')) {
    return `upper(brand) = 'RICKY' AND "match_status" IN ('new_from_ricky_price', 'new', 'NEW', '신규')`
  }
  return null
}

/** 원가 누락 판별식 — cost_usd 없고 override 도 없음 */
function missingCostExpr(cols: Set<string>): string | null {
  if (!cols.has('cost_usd')) return null
  return cols.has('cost_usd_override')
    ? `"cost_usd" IS NULL AND "cost_usd_override" IS NULL`
    : `"cost_usd" IS NULL`
}

/** 검색어가 걸리는 컬럼들 (존재하는 것만) */
function searchColumns(cols: Set<string>): string[] {
  return ['product_name', 'search_alias', 'product_name_ko', 'brand', 'brand_code'].filter((c) => cols.has(c))
}

/**
 * 목록 + 요약 + 브랜드 목록 + 페이지네이션.
 * 요약(summary)/브랜드/매치상태는 활성 범위(active scope) 기준 전체이며 검색·브랜드 필터로 좁히지 않는다.
 */
export async function queryFabricList(params: FabricListParams): Promise<FabricListResult> {
  const cols = await availableColumns()

  const page = Math.max(1, Math.floor(params.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 50)))
  const offset = (page - 1) * pageSize

  // ---- 활성 범위 (요약·목록 공통 베이스) ----
  const baseConds: string[] = []
  const baseParams: unknown[] = []
  const activeMode = params.active ?? 'active'
  if (cols.has('is_active') && activeMode !== 'all') {
    baseConds.push(`"is_active" = ${activeMode === 'inactive' ? 'FALSE' : 'TRUE'}`)
  }

  // ---- 요약 ----
  const summarySelects: string[] = [`count(*)::int AS total`]
  const rickyNew = rickyNewExpr(cols)
  const missingCost = missingCostExpr(cols)
  summarySelects.push(
    cols.has('brand')
      ? `count(*) FILTER (WHERE upper(brand) = 'RICKY')::int AS ricky`
      : `0::int AS ricky`,
  )
  summarySelects.push(
    rickyNew ? `count(*) FILTER (WHERE ${rickyNew})::int AS "rickyNew"` : `0::int AS "rickyNew"`,
  )
  summarySelects.push(
    missingCost
      ? `count(*) FILTER (WHERE ${missingCost})::int AS "missingCost"`
      : `0::int AS "missingCost"`,
  )
  summarySelects.push(
    cols.has('sell_price')
      ? `count(*) FILTER (WHERE "sell_price" IS NULL)::int AS "missingSell"`
      : `0::int AS "missingSell"`,
  )
  const baseWhere = baseConds.length ? `WHERE ${baseConds.join(' AND ')}` : ''
  const summaryRows = await prisma.$queryRawUnsafe<FabricSummary[]>(
    `SELECT ${summarySelects.join(', ')} FROM ${TABLE} ${baseWhere}`,
    ...baseParams,
  )
  const summary: FabricSummary = summaryRows[0] ?? {
    total: 0,
    ricky: 0,
    rickyNew: 0,
    missingCost: 0,
    missingSell: 0,
  }

  // ---- 브랜드 목록 ----
  let brands: string[] = []
  if (cols.has('brand')) {
    const brandRows = await prisma.$queryRawUnsafe<{ brand: string | null }[]>(
      `SELECT DISTINCT brand FROM ${TABLE} ${baseWhere} ORDER BY brand`,
      ...baseParams,
    )
    brands = brandRows.map((r) => r.brand).filter((b): b is string => !!b)
  }

  // ---- 브랜드별 건수 (브랜드별 현황 뷰) ----
  let brandCounts: { brand: string; count: number }[] = []
  if (cols.has('brand')) {
    const bcRows = await prisma.$queryRawUnsafe<{ brand: string | null; count: number }[]>(
      `SELECT brand, count(*)::int AS count FROM ${TABLE} ${baseWhere}
       GROUP BY brand ORDER BY count DESC, brand`,
      ...baseParams,
    )
    brandCounts = bcRows
      .filter((r): r is { brand: string; count: number } => !!r.brand)
      .map((r) => ({ brand: r.brand, count: r.count }))
  }

  // ---- 매치 상태 목록 ----
  let matchStatuses: string[] = []
  if (cols.has('match_status')) {
    const msRows = await prisma.$queryRawUnsafe<{ match_status: string | null }[]>(
      `SELECT DISTINCT "match_status" FROM ${TABLE} ${baseWhere} ORDER BY "match_status"`,
      ...baseParams,
    )
    matchStatuses = msRows.map((r) => r.match_status).filter((s): s is string => !!s)
  }

  // ---- 목록 조건 (베이스 + 검색/브랜드/가격상태/매치상태) ----
  const conds = [...baseConds]
  const values: unknown[] = [...baseParams]
  let hasQuery = false

  if (params.query && params.query.trim()) {
    const q = params.query.trim()
    const searchCols = searchColumns(cols)
    if (searchCols.length) {
      hasQuery = true
      const likeIdx = values.push(`%${q}%`) // $n for ILIKE
      const parts = searchCols.map((c) => `${ident(c)} ILIKE $${likeIdx}`)
      conds.push(`(${parts.join(' OR ')})`)
    }
  }

  if (params.brand && cols.has('brand')) {
    const idx = values.push(params.brand)
    conds.push(`brand = $${idx}`)
  }

  if (params.matchStatus && cols.has('match_status')) {
    const idx = values.push(params.matchStatus)
    conds.push(`"match_status" = $${idx}`)
  }

  if (params.priceStatus) {
    if (params.priceStatus === 'missing_cost' && missingCost) {
      conds.push(`(${missingCost})`)
    } else if (params.priceStatus === 'missing_sell' && cols.has('sell_price')) {
      conds.push(`"sell_price" IS NULL`)
    } else if (params.priceStatus === 'complete' && missingCost && cols.has('sell_price')) {
      conds.push(`NOT (${missingCost}) AND "sell_price" IS NOT NULL`)
    }
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

  // ---- ORDER BY ----
  const orderParts: string[] = []
  if (hasQuery && cols.has('product_name')) {
    // 정확 일치 우선 — 검색어와 동일한 product_name 을 맨 위로
    const qIdx = values.push(params.query!.trim())
    orderParts.push(`(lower("product_name") = lower($${qIdx})) DESC`)
  }
  if (cols.has('brand_code')) orderParts.push(`"brand_code" NULLS LAST`)
  if (cols.has('product_name')) orderParts.push(`"product_name"`)
  const orderBy = orderParts.length ? `ORDER BY ${orderParts.join(', ')}` : ''

  // ---- count (페이지네이션) ----
  const countRows = await prisma.$queryRawUnsafe<{ total: number }[]>(
    `SELECT count(*)::int AS total FROM ${TABLE} ${where}`,
    ...values,
  )
  const total = countRows[0]?.total ?? 0

  // ---- rows ----
  const selectCols = COLUMN_WHITELIST.filter((c) => cols.has(c)).map(ident).join(', ')
  const limitIdx = values.push(pageSize)
  const offsetIdx = values.push(offset)
  const rows = await prisma.$queryRawUnsafe<FabricRow[]>(
    `SELECT ${selectCols || '*'} FROM ${TABLE} ${where} ${orderBy} LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    ...values,
  )

  return {
    summary,
    brands,
    brandCounts,
    matchStatuses,
    rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

/** 단일 원단 상세 — 안전 컬럼 + 전체 원본(raw jsonb). id 컬럼이 있을 때만 조회 가능. */
export async function queryFabricDetail(
  id: string,
): Promise<{ row: FabricRow; raw: Record<string, unknown> } | null> {
  const cols = await availableColumns()
  if (!(await getExistingColumns()).has('id')) return null

  const selectCols = COLUMN_WHITELIST.filter((c) => cols.has(c)).map(ident).join(', ')
  const rows = await prisma.$queryRawUnsafe<
    ({ _raw: Record<string, unknown> } & FabricRow)[]
  >(
    `SELECT ${selectCols || '*'}, to_jsonb(t) AS _raw
     FROM ${TABLE} t
     WHERE t."id"::text = $1
     LIMIT 1`,
    id,
  )
  const found = rows[0]
  if (!found) return null
  const { _raw, ...row } = found
  return { row, raw: _raw ?? {} }
}
