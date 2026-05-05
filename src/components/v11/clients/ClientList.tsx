'use client'
/**
 * 거래처 목록 (Client Component, 검색·필터·편집 다이얼로그 호스팅)
 */
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Pencil, Filter, X } from 'lucide-react'
import {
  OCCUPATION_LABEL,
  OCCUPATION_VALUES,
  DIVISION_LABEL,
  DIVISION_VALUES,
  CLIENT_TIER_LABEL,
  CLIENT_TIER_COLOR,
  segmentLabel,
} from '@/lib/v11-labels'
import ClientEditDialog, { type ClientRow } from './ClientEditDialog'
import { formatKRW } from '@/lib/formatters'

export interface ClientWithStats extends ClientRow {
  transaction_count: number
  total_revenue: number
}

const ALL = '__all__'
const UNMAPPED = '__unmapped__'

export default function ClientList({ clients }: { clients: ClientWithStats[] }) {
  const [search, setSearch] = useState('')
  const [occupationFilter, setOccupationFilter] = useState<string>(ALL)
  const [divisionFilter, setDivisionFilter] = useState<string>(ALL)
  const [editing, setEditing] = useState<ClientRow | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false
      if (occupationFilter === UNMAPPED && c.occupation) return false
      if (occupationFilter !== ALL && occupationFilter !== UNMAPPED && c.occupation !== occupationFilter) return false
      if (divisionFilter === UNMAPPED && c.primary_division) return false
      if (divisionFilter !== ALL && divisionFilter !== UNMAPPED && c.primary_division !== divisionFilter) return false
      return true
    })
  }, [clients, search, occupationFilter, divisionFilter])

  const unmappedCount = clients.filter((c) => !c.occupation || !c.primary_division).length
  const filtersActive = search || occupationFilter !== ALL || divisionFilter !== ALL

  return (
    <>
      {/* 필터 바 */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="거래처명 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={occupationFilter} onValueChange={(v) => setOccupationFilter(v ?? ALL)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-1 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>전체 직업군</SelectItem>
                <SelectItem value={UNMAPPED}>미매핑만</SelectItem>
                {OCCUPATION_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {OCCUPATION_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={divisionFilter} onValueChange={(v) => setDivisionFilter(v ?? ALL)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>전체 제품군</SelectItem>
                <SelectItem value={UNMAPPED}>미매핑만</SelectItem>
                {DIVISION_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {DIVISION_LABEL[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setOccupationFilter(ALL)
                  setDivisionFilter(ALL)
                }}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                필터 초기화
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              표시 <strong className="text-slate-700">{filtered.length}</strong>건 / 전체{' '}
              <strong className="text-slate-700">{clients.length}</strong>건
            </span>
            {unmappedCount > 0 && (
              <span className="text-amber-600">
                ⚠ 24셀 미매핑 거래처{' '}
                <strong>{unmappedCount}</strong>건 — 분석 정확도를 위해 매핑 필요
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 테이블 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="px-4 py-2.5 text-left font-medium">거래처명</th>
                  <th className="px-4 py-2.5 text-left font-medium">24셀 매핑</th>
                  <th className="px-4 py-2.5 text-left font-medium">등급</th>
                  <th className="px-4 py-2.5 text-right font-medium">거래 건수</th>
                  <th className="px-4 py-2.5 text-right font-medium">매출</th>
                  <th className="px-4 py-2.5 text-right font-medium">결제(일)</th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      {clients.length === 0
                        ? '아직 거래처가 없습니다. 일계표 업로드 시 자동 등록됩니다.'
                        : '필터 조건에 맞는 거래처가 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const mapped = !!(c.occupation && c.primary_division)
                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-800">{c.name}</td>
                        <td className="px-4 py-2 text-xs">
                          {mapped ? (
                            <span className="text-slate-700">
                              {segmentLabel(c.occupation, c.primary_division)}
                            </span>
                          ) : (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                              미매핑
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {c.tier ? (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                CLIENT_TIER_COLOR[c.tier] ?? 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {CLIENT_TIER_LABEL[c.tier] ?? c.tier}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                          {c.transaction_count > 0 ? c.transaction_count : '—'}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                          {c.total_revenue > 0 ? formatKRW(c.total_revenue) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-slate-500 tabular-nums">
                          {c.payment_terms_days ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditing(c)}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            편집
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ClientEditDialog
        client={editing}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      />
    </>
  )
}
