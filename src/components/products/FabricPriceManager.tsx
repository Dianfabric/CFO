'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Search, Package, AlertTriangle, ImageOff, Layers } from 'lucide-react'

// ── 타입 ──────────────────────────────────────────────────────
type FabricRow = Record<string, unknown> & {
  id?: string | number | null
  product_name?: string | null
  brand?: string | null
}

interface Summary {
  total: number
  ricky: number
  rickyNew: number
  missingCost: number
  missingSell: number
}

interface ListResponse {
  summary: Summary
  brands: string[]
  brandCounts: { brand: string; count: number }[]
  matchStatuses: string[]
  rows: FabricRow[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

const PAGE_SIZE = 100

// ── 값 포맷 헬퍼 (컬럼 값이 string|number|null 로 섞여 올 수 있어 방어적) ──
function str(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}
function fmtUsd(v: unknown): string {
  const n = num(v)
  return n === null ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtKrw(v: unknown): string {
  const n = num(v)
  return n === null ? '—' : `₩${Math.round(n).toLocaleString('ko-KR')}`
}
function dash(v: unknown): string {
  const s = str(v)
  return s || '—'
}

function imageUrlOf(row: FabricRow): string | null {
  const cand = str(row.representative_image_url)
  return cand.startsWith('http') ? cand : null
}

function arrayCount(v: unknown): number {
  return Array.isArray(v) ? v.length : 0
}

function specOf(row: FabricRow): string {
  const parts: string[] = []
  if (str(row.material)) parts.push(str(row.material))
  if (num(row.width_mm) !== null) parts.push(`${num(row.width_mm)}mm`)
  if (num(row.weight_gsm) !== null) parts.push(`${num(row.weight_gsm)}gsm`)
  return parts.join(' · ') || '—'
}

function isRickyNew(row: FabricRow): boolean {
  return str(row.brand).toUpperCase() === 'RICKY' && str(row.match_status) === 'new_from_ricky_price'
}

const PRICE_STATUS_OPTIONS = [
  { value: '', label: '전체 가격상태' },
  { value: 'missing_cost', label: '원가(USD) 없음' },
  { value: 'missing_sell', label: '판매단가 없음' },
  { value: 'complete', label: '원가·판매가 완비' },
]

// ── 요약 카드 ──────────────────────────────────────────────────
function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'accent' }) {
  const color =
    tone === 'warn' ? 'text-amber-600' : tone === 'accent' ? 'text-blue-600' : 'text-slate-900'
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value.toLocaleString('ko-KR')}</p>
      </CardContent>
    </Card>
  )
}

// ── 상세 필드 행 ──────────────────────────────────────────────
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="col-span-2 text-sm text-slate-900 break-words">{children}</dd>
    </div>
  )
}

// ── 원단 단가 관리 (읽기 전용) — /products 탭 + /products/fabric-prices 공용 ──
export default function FabricPriceManager() {
  const [meta, setMeta] = useState<Omit<ListResponse, 'rows'> | null>(null)
  const [rows, setRows] = useState<FabricRow[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true) // 초기/필터 변경 로딩
  const [loadingMore, setLoadingMore] = useState(false) // 더보기 로딩
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<'list' | 'brands'>('list')
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('')
  const [priceStatus, setPriceStatus] = useState('')
  const [matchStatus, setMatchStatus] = useState('')
  const [active, setActive] = useState('active') // 기본: 활성만

  const [selected, setSelected] = useState<FabricRow | null>(null)
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null)
  const [rawLoading, setRawLoading] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const buildParams = useCallback(
    (pageToLoad: number) => {
      const p = new URLSearchParams()
      if (query.trim()) p.set('query', query.trim())
      if (brand) p.set('brand', brand)
      if (priceStatus) p.set('priceStatus', priceStatus)
      if (matchStatus) p.set('matchStatus', matchStatus)
      p.set('active', active)
      p.set('page', String(pageToLoad))
      p.set('pageSize', String(PAGE_SIZE))
      return p
    },
    [query, brand, priceStatus, matchStatus, active],
  )

  // 필터 변경 시 1페이지부터 다시 (rows 교체)
  const fetchFirst = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/fabric-prices?${buildParams(1).toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || '조회 실패')
      const { rows: r, ...rest } = json as ListResponse
      setMeta(rest)
      setRows(r)
      setPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패')
      setMeta(null)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  // 더보기 — 다음 100건 append
  const loadMore = useCallback(async () => {
    const next = page + 1
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/fabric-prices?${buildParams(next).toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || '조회 실패')
      const { rows: r, ...rest } = json as ListResponse
      setMeta(rest)
      setRows((prev) => [...prev, ...r])
      setPage(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패')
    } finally {
      setLoadingMore(false)
    }
  }, [buildParams, page])

  // 검색어 디바운스 + 필터 즉시 → fetchFirst
  useEffect(() => {
    const t = setTimeout(fetchFirst, 300)
    return () => clearTimeout(t)
  }, [fetchFirst])

  // 행 클릭 → 드로어 열고 raw 지연 로드
  const openRow = async (row: FabricRow) => {
    setSelected(row)
    setRaw(null)
    setShowRaw(false)
    if (row.id === null || row.id === undefined) return
    setRawLoading(true)
    try {
      const res = await fetch(`/api/fabric-prices/${encodeURIComponent(String(row.id))}`)
      if (res.ok) {
        const json = await res.json()
        setRaw((json?.raw as Record<string, unknown>) ?? null)
      }
    } catch {
      /* raw 는 부가 정보 — 실패해도 무시 */
    } finally {
      setRawLoading(false)
    }
  }

  // 브랜드별 현황에서 브랜드 선택 → 목록 탭으로 이동 + 필터
  const selectBrand = (b: string) => {
    setBrand(b)
    setTab('list')
  }

  const summary = meta?.summary
  const brands = meta?.brands ?? []
  const brandCounts = meta?.brandCounts ?? []
  const matchStatuses = meta?.matchStatuses ?? []
  const total = meta?.pagination.total ?? 0
  const hasMore = rows.length < total

  const selImg = selected ? imageUrlOf(selected) : null

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">원단 단가 관리</h2>
        <p className="mt-1 text-sm text-slate-500">
          Supabase <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">public.fabric_knowledge_master</code>{' '}
          원단 지식·단가 마스터를 <b>읽기 전용</b>으로 조회합니다. (수정·삭제 불가)
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="전체 원단" value={summary?.total ?? 0} />
        <SummaryCard label="RICKY" value={summary?.ricky ?? 0} tone="accent" />
        <SummaryCard label="RICKY 신규" value={summary?.rickyNew ?? 0} tone="accent" />
        <SummaryCard label="원가(USD) 누락" value={summary?.missingCost ?? 0} tone="warn" />
        <SummaryCard label="판매단가 누락" value={summary?.missingSell ?? 0} tone="warn" />
      </div>

      <div className="inline-flex w-fit items-center rounded-lg bg-slate-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab('list')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
            tab === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Package className="h-4 w-4" />
          원단 목록
        </button>
        <button
          type="button"
          onClick={() => setTab('brands')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
            tab === 'brands' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" />
          브랜드별 현황
        </button>
      </div>

      {/* ── 원단 목록 탭 ─────────────────────────────────── */}
      {tab === 'list' && (
        <div className="space-y-6">
          {/* 필터 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1 sm:min-w-[220px] sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="원단명 / Alias / 한글명 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            >
              <option value="">전체 브랜드</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={priceStatus}
              onChange={(e) => setPriceStatus(e.target.value)}
            >
              {PRICE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={matchStatus}
              onChange={(e) => setMatchStatus(e.target.value)}
            >
              <option value="">전체 매치상태</option>
              {matchStatuses.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={active}
              onChange={(e) => setActive(e.target.value)}
            >
              <option value="active">활성만</option>
              <option value="inactive">비활성만</option>
              <option value="all">전체</option>
            </select>
          </div>

          {/* 선택된 브랜드 필터 표시 */}
          {brand && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>브랜드 필터:</span>
              <Badge variant="secondary">{brand}</Badge>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setBrand('')}
              >
                해제
              </button>
            </div>
          )}

          {/* 테이블 (전체 폭) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                원단 목록{meta ? ` (${total.toLocaleString('ko-KR')}건 중 ${rows.length}건 표시)` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                </div>
              ) : error ? (
                <div className="py-16 text-center text-sm text-red-600">{error}</div>
              ) : rows.length === 0 ? (
                <div className="py-16 text-center">
                  <Package className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                  <p className="text-slate-500">조건에 맞는 원단이 없습니다.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-slate-500">
                          <th className="pb-2 font-medium">브랜드</th>
                          <th className="pb-2 font-medium">코드</th>
                          <th className="pb-2 font-medium">원단명</th>
                          <th className="pb-2 font-medium">Alias</th>
                          <th className="pb-2 text-right font-medium">원가 USD</th>
                          <th className="pb-2 text-right font-medium">판매단가</th>
                          <th className="pb-2 text-right font-medium">대리점단가</th>
                          <th className="pb-2 font-medium">스펙</th>
                          <th className="pb-2 font-medium">상태</th>
                          <th className="pb-2 font-medium">이미지</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => {
                          const img = imageUrlOf(row)
                          const missingCost = num(row.cost_usd) === null && num(row.cost_usd_override) === null
                          const missingSell = num(row.sell_price) === null
                          return (
                            <tr
                              key={str(row.id) || i}
                              className="cursor-pointer border-b last:border-0 hover:bg-slate-50"
                              onClick={() => openRow(row)}
                            >
                              <td className="py-2.5">
                                {str(row.brand) ? <Badge variant="secondary">{str(row.brand)}</Badge> : '—'}
                              </td>
                              <td className="text-slate-600">{dash(row.brand_code)}</td>
                              <td className="font-medium text-slate-900">
                                {dash(row.product_name)}
                                {isRickyNew(row) && (
                                  <Badge variant="outline" className="ml-1.5">
                                    신규
                                  </Badge>
                                )}
                              </td>
                              <td className="text-slate-600">{dash(row.search_alias)}</td>
                              <td className="text-right tabular-nums">{fmtUsd(row.cost_usd ?? row.cost_usd_override)}</td>
                              <td className="text-right font-medium tabular-nums">{fmtKrw(row.sell_price)}</td>
                              <td className="text-right tabular-nums text-slate-600">{fmtKrw(row.dealer_price)}</td>
                              <td className="text-slate-600">{specOf(row)}</td>
                              <td>
                                <div className="flex flex-wrap gap-1">
                                  {missingCost && <Badge variant="destructive">원가없음</Badge>}
                                  {missingSell && <Badge variant="destructive">판매가없음</Badge>}
                                  {str(row.match_status) && <Badge variant="outline">{str(row.match_status)}</Badge>}
                                </div>
                              </td>
                              <td>
                                {img ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={img} alt="" className="h-9 w-9 rounded object-cover" />
                                ) : (
                                  <ImageOff className="h-4 w-4 text-slate-300" />
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 더보기 (100건씩) */}
                  {hasMore && (
                    <div className="mt-5 flex justify-center">
                      <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                        {loadingMore
                          ? '불러오는 중...'
                          : `더보기 (${rows.length.toLocaleString('ko-KR')} / ${total.toLocaleString('ko-KR')})`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 브랜드별 현황 탭 ─────────────────────────────── */}
      {tab === 'brands' && (
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                브랜드별 현황{brandCounts.length ? ` (${brandCounts.length}개 브랜드)` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                </div>
              ) : brandCounts.length === 0 ? (
                <div className="py-16 text-center">
                  <Layers className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                  <p className="text-slate-500">브랜드 데이터가 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {brandCounts.map((b) => (
                    <button
                      key={b.brand}
                      type="button"
                      onClick={() => selectBrand(b.brand)}
                      className="flex flex-col items-start rounded-lg border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <span className="truncate text-sm font-medium text-slate-900">{b.brand}</span>
                      <span className="mt-1 text-2xl font-bold tabular-nums text-blue-600">
                        {b.count.toLocaleString('ko-KR')}
                      </span>
                      <span className="mt-0.5 text-xs text-slate-400">원단 · 클릭하면 목록 필터</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 상세 드로어 */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto !max-w-[600px]">
          <SheetHeader className="border-b">
            <SheetTitle>원단 상세</SheetTitle>
            <SheetDescription>
              읽기 전용 · Supabase fabric_knowledge_master
            </SheetDescription>
          </SheetHeader>

          {selected && (
            <div className="space-y-5 p-4">
              {/* 대표 이미지 */}
              {selImg && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selImg}
                  alt={str(selected.product_name)}
                  className="h-40 w-full rounded-lg border border-slate-200 object-cover"
                />
              )}

              {/* CFO 경고 */}
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <b>cost_usd 는 CFO 기준 원가</b>입니다. 원단명(product_name)만으로는 멀티 브랜드 매칭을
                  자동 확정하지 마세요 — 같은 이름이 여러 브랜드에 존재할 수 있습니다.
                </p>
              </div>

              {/* RICKY 신규 안내 */}
              {isRickyNew(selected) && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  <b>RICKY 신규 원단:</b> cost_usd 는 <b>Price(Cut)</b> 기준만 반영돼 있습니다.
                  <b> Price(Roll)</b> 단가는 원본(raw)에만 존재합니다.
                </div>
              )}

              {/* 기본 정보 */}
              <dl>
                <Field label="원단명">{dash(selected.product_name)}</Field>
                <Field label="한글명">{dash(selected.product_name_ko)}</Field>
                <Field label="Alias">{dash(selected.search_alias)}</Field>
                <Field label="브랜드">
                  {dash(selected.brand)}
                  {str(selected.brand_code) ? ` (${str(selected.brand_code)})` : ''}
                </Field>
                <Field label="원가 USD">{fmtUsd(selected.cost_usd)}</Field>
                <Field label="원가 override">{fmtUsd(selected.cost_usd_override)}</Field>
                <Field label="판매단가">{fmtKrw(selected.sell_price)}</Field>
                <Field label="대리점단가">{fmtKrw(selected.dealer_price)}</Field>
                <Field label="소재">{dash(selected.material)}</Field>
                <Field label="폭 (mm)">{dash(selected.width_mm)}</Field>
                <Field label="중량 (gsm)">{dash(selected.weight_gsm)}</Field>
                <Field label="MOQ / Roll">{dash(selected.moq_or_roll)}</Field>
                <Field label="매치 상태">
                  {str(selected.match_status) ? (
                    <Badge variant="outline">{str(selected.match_status)}</Badge>
                  ) : (
                    '—'
                  )}
                </Field>
                <Field label="대표 이미지 경로">{dash(selected.representative_image_path)}</Field>
                <Field label="연결 이미지 수">
                  {arrayCount(selected.linked_image_urls) + arrayCount(selected.linked_image_paths)}
                </Field>
                <Field label="연결 원단 수">{arrayCount(selected.linked_fabric_ids)}</Field>
                <Field label="운영 메모">{dash(selected.operation_note)}</Field>
              </dl>

              {/* 원본(raw) 소스 — 접힘 */}
              <div className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-slate-600"
                  onClick={() => setShowRaw((v) => !v)}
                >
                  <span>원본 소스 (raw)</span>
                  <span className="text-slate-400">{showRaw ? '접기 ▲' : '펼치기 ▼'}</span>
                </button>
                {showRaw && (
                  <div className="border-t border-slate-100 p-3">
                    {rawLoading ? (
                      <p className="text-xs text-slate-400">불러오는 중...</p>
                    ) : raw ? (
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-slate-600">
                        {JSON.stringify(raw, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-xs text-slate-400">원본 데이터를 불러올 수 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
