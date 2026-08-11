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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, Package, AlertTriangle, Layers, Plus, Table2 } from 'lucide-react'

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

interface PriceTier {
  basisUsd: number
  sellPrice: number
  dealerPrice: number
  rowCount: number
}

const PAGE_SIZE = 100

const EMPTY_NEW_FABRIC = {
  brand: '',
  productName: '',
  brandCode: '',
  productNameKo: '',
  searchAlias: '',
  material: '',
  widthMm: '',
  weightGsm: '',
  costUsd: '',
  costUsdOverride: '',
  sellPrice: '',
  dealerPrice: '',
  moqOrRoll: '',
  operationNote: '',
}
type NewFabricForm = typeof EMPTY_NEW_FABRIC

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

  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newForm, setNewForm] = useState<NewFabricForm>(EMPTY_NEW_FABRIC)
  const [newSaving, setNewSaving] = useState(false)
  const [newError, setNewError] = useState<string | null>(null)
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([])
  const [priceTiersLoading, setPriceTiersLoading] = useState(false)
  const [priceTableOpen, setPriceTableOpen] = useState(false)
  const [brandCodeLoading, setBrandCodeLoading] = useState(false)

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

  useEffect(() => {
    if (!newDialogOpen) return
    const basisValue = newForm.costUsdOverride.trim() || newForm.costUsd.trim()
    const tier = priceTierFor(basisValue)
    if (tier && (newForm.sellPrice !== String(tier.sellPrice) || newForm.dealerPrice !== String(tier.dealerPrice))) {
      setNewForm((previous) => ({ ...previous, sellPrice: String(tier.sellPrice), dealerPrice: String(tier.dealerPrice) }))
    }
  }, [newDialogOpen, newForm.costUsd, newForm.costUsdOverride, newForm.sellPrice, newForm.dealerPrice, priceTiers])

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

  const priceTierFor = (value: string) => {
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount < 0) return null
    const bracket = Math.floor(amount * 2 + 1e-8) / 2
    return priceTiers.find((tier) => Math.abs(tier.basisUsd - bracket) < 0.001) ?? null
  }

  const appliedBasis = (() => {
    const value = newForm.costUsdOverride.trim() || newForm.costUsd.trim()
    if (!value) return null
    const amount = Number(value)
    return Number.isFinite(amount) && amount >= 0 ? Math.floor(amount * 2 + 1e-8) / 2 : null
  })()

  const updateNewForm = (field: keyof NewFabricForm, value: string) => {
    setNewForm((previous) => ({ ...previous, [field]: value }))
  }

  const updatePriceBasis = (field: 'costUsd' | 'costUsdOverride', value: string) => {
    setNewForm((previous) => {
      const next = { ...previous, [field]: value }
      const basisValue = next.costUsdOverride.trim() || next.costUsd.trim()
      const tier = priceTierFor(basisValue)
      return tier
        ? { ...next, sellPrice: String(tier.sellPrice), dealerPrice: String(tier.dealerPrice) }
        : next
    })
  }

  const loadBrandCode = async () => {
    const inputBrand = newForm.brand.trim()
    if (!inputBrand) return
    setBrandCodeLoading(true)
    try {
      const params = new URLSearchParams({ brand: inputBrand, active: 'active', page: '1', pageSize: '1' })
      const response = await fetch(`/api/fabric-prices?${params}`)
      const data = (await response.json()) as ListResponse
      const code = str(data.rows?.[0]?.brand_code)
      if (response.ok && code) updateNewForm('brandCode', code)
    } finally {
      setBrandCodeLoading(false)
    }
  }

  const loadPriceTiers = async () => {
    setPriceTiersLoading(true)
    try {
      const response = await fetch('/api/fabric-prices/tiers')
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || '단가표 조회 실패')
      setPriceTiers(data.tiers as PriceTier[])
    } catch (e) {
      setNewError(e instanceof Error ? e.message : '단가표를 불러오지 못했습니다.')
    } finally {
      setPriceTiersLoading(false)
    }
  }

  const createFabric = async () => {
    if (!newForm.brand.trim() || !newForm.productName.trim() || !newForm.costUsd.trim()) {
      setNewError('브랜드, 원단명, 실원가 USD는 필수입니다.')
      return
    }
    if (!newForm.sellPrice || !newForm.dealerPrice) {
      setNewError('적용 기준 단가의 단가표를 찾지 못했습니다. 단가표를 확인해 주세요.')
      return
    }
    setNewSaving(true)
    setNewError(null)
    try {
      const toNumber = (value: string) => (value.trim() === '' ? null : Number(value))
      const payload = {
        ...newForm,
        widthMm: toNumber(newForm.widthMm),
        weightGsm: toNumber(newForm.weightGsm),
        costUsd: toNumber(newForm.costUsd),
        costUsdOverride: toNumber(newForm.costUsdOverride),
        sellPrice: toNumber(newForm.sellPrice),
        dealerPrice: toNumber(newForm.dealerPrice),
      }
      if (Object.values(payload).some((value) => typeof value === 'number' && !Number.isFinite(value))) {
        throw new Error('숫자 항목은 0 이상의 숫자로 입력하세요.')
      }
      const res = await fetch('/api/fabric-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || '원단을 등록하지 못했습니다.')
      setNewDialogOpen(false)
      setNewForm(EMPTY_NEW_FABRIC)
      setQuery(newForm.productName.trim())
    } catch (e) {
      setNewError(e instanceof Error ? e.message : '원단을 등록하지 못했습니다.')
    } finally {
      setNewSaving(false)
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">원단 단가 관리</h2>
          <p className="mt-1 text-sm text-slate-500">
            Supabase <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">public.fabric_knowledge_master</code>{' '}
            원단 지식·단가 마스터를 조회하고 직접 원단을 추가합니다.
          </p>
        </div>
        <Button
          className="gap-1.5"
          onClick={() => {
            setNewError(null)
            setNewForm(EMPTY_NEW_FABRIC)
            setNewDialogOpen(true)
            void loadPriceTiers()
          }}
        >
          <Plus className="h-4 w-4" />
          원단 추가
        </Button>
      </div>

      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>원단 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p>
                <b>실원가 USD만 입력</b>하면 0.5달러 단위로 내림한 구간의 판매·대리점가가 자동으로 채워집니다.
                필요할 때만 <b>기준 단가(Override)</b>를 넣어 다른 구간을 적용합니다.
              </p>
              <Button type="button" variant="outline" size="sm" className="shrink-0 bg-white" onClick={() => setPriceTableOpen(true)}>
                <Table2 className="mr-1 h-4 w-4" /> 단가표
              </Button>
            </div>
            {newError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{newError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="new-brand">브랜드 *</Label>
                <Input id="new-brand" list="fabric-brands" value={newForm.brand} onChange={(e) => updateNewForm('brand', e.target.value)} onBlur={() => void loadBrandCode()} placeholder="예: EK" />
                <datalist id="fabric-brands">{brands.map((brandName) => <option key={brandName} value={brandName} />)}</datalist>
              </div>
              <div><Label htmlFor="new-product">원단명 *</Label><Input id="new-product" value={newForm.productName} onChange={(e) => updateNewForm('productName', e.target.value)} placeholder="예: LE AURORA" /></div>
              <div><Label htmlFor="new-brand-code">브랜드 코드 {brandCodeLoading && '불러오는 중...'}</Label><Input id="new-brand-code" value={newForm.brandCode} readOnly placeholder="브랜드 입력 시 자동" className="bg-slate-50" /></div>
              <div><Label htmlFor="new-alias">보조 검색명 / Alias</Label><Input id="new-alias" value={newForm.searchAlias} onChange={(e) => updateNewForm('searchAlias', e.target.value)} placeholder="예: Woodstock" /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="new-cost">실원가 USD *</Label><Input id="new-cost" inputMode="decimal" value={newForm.costUsd} onChange={(e) => updatePriceBasis('costUsd', e.target.value)} placeholder="예: 8.77" /></div>
              <div><Label htmlFor="new-override">기준 단가 USD (Override, 선택)</Label><Input id="new-override" inputMode="decimal" value={newForm.costUsdOverride} onChange={(e) => updatePriceBasis('costUsdOverride', e.target.value)} placeholder="비우면 실원가 적용" /></div>
              <div><Label htmlFor="new-sell">판매단가 /Y (자동)</Label><Input id="new-sell" value={newForm.sellPrice ? fmtKrw(newForm.sellPrice) : ''} readOnly placeholder="실원가 입력 시 자동" className="bg-slate-50" /></div>
              <div><Label htmlFor="new-dealer">대리점단가 /Y (자동)</Label><Input id="new-dealer" value={newForm.dealerPrice ? fmtKrw(newForm.dealerPrice) : ''} readOnly placeholder="실원가 입력 시 자동" className="bg-slate-50" /></div>
            </div>
            {appliedBasis !== null && (
              <p className="text-xs text-slate-500">
                적용 기준: <b className="text-slate-800">${appliedBasis.toFixed(2)}</b>
                {newForm.costUsdOverride.trim() ? ' (Override)' : ' (실원가 자동 내림)'}
                {priceTiersLoading && ' · 단가표 불러오는 중...'}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label htmlFor="new-material">소재</Label><Input id="new-material" value={newForm.material} onChange={(e) => updateNewForm('material', e.target.value)} placeholder="예: 100% PL" /></div>
              <div><Label htmlFor="new-width">폭 (mm)</Label><Input id="new-width" inputMode="numeric" value={newForm.widthMm} onChange={(e) => updateNewForm('widthMm', e.target.value)} /></div>
              <div><Label htmlFor="new-weight">무게 (gsm)</Label><Input id="new-weight" inputMode="numeric" value={newForm.weightGsm} onChange={(e) => updateNewForm('weightGsm', e.target.value)} /></div>
            </div>
            <div><Label htmlFor="new-moq">MOQ / Roll</Label><Input id="new-moq" value={newForm.moqOrRoll} onChange={(e) => updateNewForm('moqOrRoll', e.target.value)} /></div>
            <div><Label htmlFor="new-note">운영 메모</Label><Textarea id="new-note" value={newForm.operationNote} onChange={(e) => updateNewForm('operationNote', e.target.value)} placeholder="단가 적용 근거·특이사항" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setNewDialogOpen(false)}>취소</Button>
              <Button onClick={createFabric} disabled={newSaving}>{newSaving ? '등록 중...' : '원단 등록'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={priceTableOpen} onOpenChange={setPriceTableOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>기준 단가표</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">실원가 또는 Override를 0.5달러 단위로 내림해 아래 기준 단가를 적용합니다.</p>
          {priceTiersLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">단가표를 불러오는 중...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500"><tr><th className="py-2">기준 단가 USD</th><th className="py-2 text-right">판매단가 /Y</th><th className="py-2 text-right">대리점단가 /Y</th></tr></thead>
              <tbody>{priceTiers.map((tier) => (
                <tr key={tier.basisUsd} className="border-b border-slate-100 last:border-0"><td className="py-2 font-medium">${tier.basisUsd.toFixed(2)}</td><td className="py-2 text-right">{fmtKrw(tier.sellPrice)}</td><td className="py-2 text-right">{fmtKrw(tier.dealerPrice)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>

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
                          <th className="min-w-[110px] px-3 pb-2 font-medium">브랜드</th>
                          <th className="min-w-[140px] px-3 pb-2 font-medium">원단명</th>
                          <th className="min-w-[180px] px-3 pb-2 font-medium">성분</th>
                          <th className="min-w-[90px] px-3 pb-2 text-right font-medium">폭</th>
                          <th className="min-w-[90px] px-3 pb-2 text-right font-medium">무게</th>
                          <th className="min-w-[110px] px-3 pb-2 text-right font-medium">기준단가 USD</th>
                          <th className="min-w-[120px] px-3 pb-2 text-right font-medium">판매단가</th>
                          <th className="min-w-[130px] px-3 pb-2 text-right font-medium">대리점단가</th>
                          <th className="min-w-[160px] px-3 pb-2 font-medium">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => {
                          const missingCost = num(row.cost_usd) === null && num(row.cost_usd_override) === null
                          const missingSell = num(row.sell_price) === null
                          return (
                            <tr
                              key={str(row.id) || i}
                              className="cursor-pointer border-b last:border-0 hover:bg-slate-50"
                              onClick={() => openRow(row)}
                            >
                              <td className="px-3 py-2.5">
                                {str(row.brand) ? <Badge variant="secondary">{str(row.brand)}</Badge> : '—'}
                              </td>
                              <td className="px-3 font-medium text-slate-900">
                                {dash(row.product_name)}
                                {str(row.search_alias) && (
                                  <span className="ml-2 text-xs font-normal text-slate-400">{str(row.search_alias)}</span>
                                )}
                                {isRickyNew(row) && (
                                  <Badge variant="outline" className="ml-1.5">
                                    신규
                                  </Badge>
                                )}
                              </td>
                              <td className="px-3 text-slate-600">{dash(row.material)}</td>
                              <td className="px-3 text-right tabular-nums text-slate-600">
                                {num(row.width_mm) !== null ? `${num(row.width_mm)}mm` : '—'}
                              </td>
                              <td className="px-3 text-right tabular-nums text-slate-600">
                                {num(row.weight_gsm) !== null ? `${num(row.weight_gsm)}gsm` : '—'}
                              </td>
                              <td className="px-3 text-right tabular-nums">{fmtUsd(row.cost_usd_override ?? row.cost_usd)}</td>
                              <td className="px-3 text-right font-medium tabular-nums">{fmtKrw(row.sell_price)}</td>
                              <td className="px-3 text-right tabular-nums text-slate-600">{fmtKrw(row.dealer_price)}</td>
                              <td className="px-3">
                                <div className="flex flex-wrap gap-1">
                                  {missingCost && <Badge variant="destructive">원가없음</Badge>}
                                  {missingSell && <Badge variant="destructive">판매가없음</Badge>}
                                  {str(row.match_status) && <Badge variant="outline">{str(row.match_status)}</Badge>}
                                </div>
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
                <Field label="실원가 USD (보존)">{fmtUsd(selected.cost_usd)}</Field>
                <Field label="기준 단가 USD (Override)">{fmtUsd(selected.cost_usd_override)}</Field>
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
