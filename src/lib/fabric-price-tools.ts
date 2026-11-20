// Shared pure helpers; no database or cost fields are needed for copy output.
export type CopyFabricRow = Record<string, unknown> & { id?: string | number | null; product_name?: string | null; brand?: string | null }

function copyPrice(value: unknown, dual: boolean): string {
  const price = value === null || value === undefined || String(value).trim() === '' ? null : Number(value)
  return price === null || !Number.isFinite(price) ? '단가 미등록' : `${Math.round(price).toLocaleString('ko-KR')}${dual ? '' : '원'}/Y`
}

export function formatPriceCopy(rows: CopyFabricRow[], dealer: boolean, dual = false): string {
  return rows.map(row => {
    const name = String(row.copy_name ?? row.product_name ?? '').replace(/[\r\n\t]+/g, ' ')
    return dual ? `${name} ${copyPrice(row.sell_price, true)} ${copyPrice(row.dealer_price, true)}`
      : `${name} — ${copyPrice(dealer ? row.dealer_price : row.sell_price, false)}`
  }).join('\n')
}

export function fabricRowKey(row: CopyFabricRow): string {
  return row.input_term == null ? String(row.id) : JSON.stringify([row.input_term, String(row.id)])
}

export function toggleFabricSelection(selected: Map<string, CopyFabricRow>, row: CopyFabricRow): Map<string, CopyFabricRow> {
  const next = new Map(selected)
  if (row.id === null || row.id === undefined) return next
  const id = fabricRowKey(row)
  if (next.has(id)) next.delete(id)
  else next.set(id, row)
  return next
}

export function buildMultiSearchSQL(cols: Set<string>, terms: string[], values: unknown[]) {
  const names = ['product_name', 'search_alias', 'product_name_ko'].filter(c => cols.has(c))
  const predicates = terms.map(term => {
    const index = values.push(`%${term.replace(/[\\%_]/g, '\\$&')}%`)
    return names.length ? `(${names.map(c => `"${c}" ILIKE $${index}`).join(' OR ')})` : 'FALSE'
  })
  return { predicates, order: predicates.length ? `CASE ${predicates.map((p, i) => `WHEN ${p} THEN ${i}`).join(' ')} ELSE ${terms.length} END` : '' }
}

export function mergeFabricRows(previous: CopyFabricRow[], incoming: CopyFabricRow[]): CopyFabricRow[] {
  const byId = new Map<string, CopyFabricRow>()
  for (const row of [...previous, ...incoming]) {
    if (row.id === null || row.id === undefined) throw new Error('원단 ID 누락: 다시 조회해 주세요.')
    byId.set(fabricRowKey(row), row)
  }
  return [...byId.values()]
}

export async function collectFabricPages(
  fetchPage: (page: number) => Promise<{rows: CopyFabricRow[]; pagination: {total: number; totalPages: number}}>,
  signal: AbortSignal,
): Promise<CopyFabricRow[]> {
  let result: CopyFabricRow[] = []
  let total = -1
  let pages = 1
  for (let page = 1; page <= pages; page++) {
    signal.throwIfAborted()
    const data = await fetchPage(page)
    signal.throwIfAborted()
    if (page === 1) { total = data.pagination.total; pages = data.pagination.totalPages }
    if (total !== data.pagination.total || pages !== data.pagination.totalPages) throw new Error('조회 중 결과가 변경되었습니다. 다시 시도해 주세요.')
    result = mergeFabricRows(result, data.rows)
  }
  if (result.length !== total) throw new Error('조회 결과 변경 또는 누락: 다시 시도해 주세요.')
  return result
}

// Only a final numeric color token is inferred. Hyphenated words are never split.
export function fabricColorBase(term: string): string | null {
  const match = term.match(/^(.+)[#-](\d+)$/)
  return match?.[1].trim() || null
}

export function resolveFabricTerm(term: string, exactNames: Set<string>) {
  const base = fabricColorBase(term)
  const exact = exactNames.has(term.toLowerCase())
  return { search: exact ? term : base ?? term, copy: base ? term : null, exact }
}

export function parseFabricTerms(input: string): string[] {
  const seen = new Set<string>()
  return input.split(/[,\r\n\t]+/).map(s => s.trim()).filter(s => {
    const key = s.toLocaleLowerCase()
    if (!s || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
