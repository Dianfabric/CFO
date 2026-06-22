'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ArrowLeft, CheckCircle, UserPlus } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface UnassignedTx {
  id: string; date: string; clientId: string | null; clientName: string
  totalAmount: number; itemCount: number; firstProduct: string; description: string | null
  items: { productName: string; quantity: number; unitPrice: number; amount: number }[]
}

const DEFAULT_PERSONS = ['한태원', '한태종', '최현진', '유대현', '전새로미']

export default function UnassignedTransactionsPage() {
  const [data, setData] = useState<{ total: number; totalAmount: number; items: UnassignedTx[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [groupByClient, setGroupByClient] = useState(false)
  const [search, setSearch] = useState('')
  const [bulkPerson, setBulkPerson] = useState('')
  const [bulkCustom, setBulkCustom] = useState('')
  const [working, setWorking] = useState(false)
  const [sortDesc, setSortDesc] = useState(true)  // 기본: 최신순
  const [expandedTx, setExpandedTx] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/transactions/unassigned')
      setData(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    let list = q ? data.items.filter(t =>
      t.clientName.toLowerCase().includes(q) ||
      t.firstProduct.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q),
    ) : data.items
    // 날짜 정렬
    list = [...list].sort((a, b) => sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
    return list
  }, [data, search, sortDesc])

  const grouped = useMemo(() => {
    if (!groupByClient) return null
    const g = new Map<string, UnassignedTx[]>()
    for (const t of filtered) {
      const k = t.clientName
      if (!g.has(k)) g.set(k, [])
      g.get(k)!.push(t)
    }
    return Array.from(g.entries()).sort((a, b) =>
      b[1].reduce((s, t) => s + t.totalAmount, 0) - a[1].reduce((s, t) => s + t.totalAmount, 0)
    )
  }, [filtered, groupByClient])

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(t => t.id)))
  }

  const toggleClient = (txs: UnassignedTx[]) => {
    const allSelected = txs.every(t => selected.has(t.id))
    const next = new Set(selected)
    if (allSelected) txs.forEach(t => next.delete(t.id))
    else txs.forEach(t => next.add(t.id))
    setSelected(next)
  }

  const handleBulk = async () => {
    const person = bulkPerson === '__custom__' ? bulkCustom.trim() : bulkPerson
    if (!person) { alert('담당자를 선택하세요'); return }
    if (selected.size === 0) { alert('거래를 선택하세요'); return }
    if (!confirm(`${selected.size}건에 '${person}' 담당자를 지정합니다.`)) return
    setWorking(true)
    try {
      await fetch('/api/transactions/sales-person/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: Array.from(selected), salesPerson: person }),
      })
      setSelected(new Set()); setBulkPerson(''); setBulkCustom('')
      await fetchData()
    } finally { setWorking(false) }
  }

  const handleAssignOne = async (txId: string, person: string) => {
    await fetch(`/api/transactions/${txId}/sales-person`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salesPerson: person }),
    })
    await fetchData()
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/transactions" className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> 거래 관리
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            담당자 미지정 매출
          </h1>
          <p className="text-sm text-slate-500 mt-1">담당자가 채워지지 않은 매출 거래 목록 — 수동 지정 또는 일괄 지정</p>
        </div>
      </div>

      {/* 요약 */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div>
            <p className="text-xs text-slate-500">미지정 거래</p>
            <p className="text-2xl font-bold text-amber-600">{data?.total ?? 0}건</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">총 금액</p>
            <p className="text-2xl font-bold">{formatKRW(data?.totalAmount ?? 0)}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Input className="w-56" placeholder="거래처/품명 검색" value={search} onChange={e => setSearch(e.target.value)} />
            <Button variant="outline" size="sm" onClick={() => setGroupByClient(g => !g)}>
              {groupByClient ? '리스트로' : '거래처별로'} 보기
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 일괄 지정 바 */}
      {selected.size > 0 && (
        <Card className="sticky top-2 z-10 border-blue-300 shadow-md">
          <CardContent className="p-3 flex items-center gap-2 flex-wrap bg-blue-50">
            <UserPlus className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">선택 {selected.size}건</span>
            <select className="text-sm border rounded px-2 py-1.5" value={bulkPerson} onChange={e => setBulkPerson(e.target.value)}>
              <option value="">담당자 선택…</option>
              {DEFAULT_PERSONS.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__custom__">기타 (직접 입력)</option>
            </select>
            {bulkPerson === '__custom__' && (
              <Input className="w-32 h-9" placeholder="이름" value={bulkCustom} onChange={e => setBulkCustom(e.target.value)} />
            )}
            <Button size="sm" onClick={handleBulk} disabled={working}>일괄 지정</Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>선택 해제</Button>
          </CardContent>
        </Card>
      )}

      {/* 목록 */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-slate-500">{search ? '검색 결과 없음' : '미지정 거래가 없습니다 🎉'}</p>
        </CardContent></Card>
      ) : groupByClient && grouped ? (
        <div className="space-y-3">
          {grouped.map(([client, txs]) => (
            <Card key={client}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={txs.every(t => selected.has(t.id))} onChange={() => toggleClient(txs)} />
                    <strong>{client}</strong>
                    <Badge variant="outline">{txs.length}건</Badge>
                  </div>
                  <p className="text-sm font-bold text-slate-700">{formatKRW(txs.reduce((s, t) => s + t.totalAmount, 0))}</p>
                </div>
                <div className="space-y-1 ml-6">
                  {txs.map(tx => (
                    <TxRow
                      key={tx.id}
                      tx={tx}
                      selected={selected.has(tx.id)}
                      expanded={expandedTx === tx.id}
                      onToggle={() => {
                        const next = new Set(selected)
                        if (next.has(tx.id)) next.delete(tx.id); else next.add(tx.id)
                        setSelected(next)
                      }}
                      onExpand={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                      onAssign={handleAssignOne}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-slate-500 bg-slate-50">
              <tr>
                <th className="p-2 w-10"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                <th
                  className="p-2 font-medium cursor-pointer select-none hover:text-slate-700"
                  onClick={() => setSortDesc(s => !s)}
                  title="클릭해서 정렬 전환"
                >
                  날짜 {sortDesc ? '↓ 최신순' : '↑ 오래된순'}
                </th>
                <th className="p-2 font-medium">거래처</th>
                <th className="p-2 font-medium">품목 (대표)</th>
                <th className="p-2 font-medium text-right">금액</th>
                <th className="p-2 font-medium">담당자 지정</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  selected={selected.has(tx.id)}
                  expanded={expandedTx === tx.id}
                  onToggle={() => {
                    const next = new Set(selected)
                    if (next.has(tx.id)) next.delete(tx.id); else next.add(tx.id)
                    setSelected(next)
                  }}
                  onExpand={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                  onAssign={handleAssignOne}
                  tableMode
                />
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  )
}

function TxRow({
  tx, selected, expanded, onToggle, onExpand, onAssign, tableMode = false,
}: {
  tx: UnassignedTx; selected: boolean; expanded: boolean
  onToggle: () => void; onExpand: () => void
  onAssign: (id: string, person: string) => void; tableMode?: boolean
}) {
  if (tableMode) {
    return (
      <>
        <tr
          className={`border-b last:border-0 hover:bg-slate-50 cursor-pointer ${expanded ? 'bg-blue-50/50' : ''}`}
          onClick={e => {
            // 체크박스/셀렉트 클릭은 펼침 방지
            const tag = (e.target as HTMLElement).tagName
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'OPTION') return
            onExpand()
          }}
        >
          <td className="p-2"><input type="checkbox" checked={selected} onChange={onToggle} onClick={e => e.stopPropagation()} /></td>
          <td className="p-2 text-slate-500 text-xs">{tx.date}</td>
          <td className="p-2 font-medium">
            <span className="text-slate-400 mr-1">{expanded ? '▼' : '▶'}</span>
            {tx.clientName}
          </td>
          <td className="p-2 text-slate-600">{tx.firstProduct}{tx.itemCount > 1 ? ` +${tx.itemCount - 1}` : ''}</td>
          <td className="p-2 text-right font-bold">{formatKRW(tx.totalAmount)}</td>
          <td className="p-2"><PersonSelect onSelect={p => onAssign(tx.id, p)} /></td>
        </tr>
        {expanded && (
          <tr className="bg-slate-50/60">
            <td colSpan={6} className="px-4 py-3">
              <p className="text-xs text-slate-500 font-medium mb-2">📋 매출 품목 ({tx.itemCount}건)</p>
              {tx.items.length === 0 ? (
                <p className="text-xs text-slate-400">품목 정보 없음</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-1 font-normal">품목</th>
                      <th className="text-right py-1 font-normal w-20">수량</th>
                      <th className="text-right py-1 font-normal w-24">단가</th>
                      <th className="text-right py-1 font-normal w-28">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tx.items.map((it, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-1 text-slate-700">{it.productName}</td>
                        <td className="py-1 text-right text-slate-600">{it.quantity.toLocaleString()}</td>
                        <td className="py-1 text-right text-slate-600">{formatKRW(it.unitPrice)}</td>
                        <td className="py-1 text-right font-medium text-slate-800">{formatKRW(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tx.description && (
                <p className="text-[11px] text-slate-500 mt-2">📝 {tx.description}</p>
              )}
            </td>
          </tr>
        )}
      </>
    )
  }
  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-slate-50 px-2 rounded ${expanded ? 'bg-blue-50/50' : ''}`}
        onClick={e => {
          const tag = (e.target as HTMLElement).tagName
          if (tag === 'INPUT' || tag === 'SELECT' || tag === 'OPTION') return
          onExpand()
        }}
      >
        <input type="checkbox" checked={selected} onChange={onToggle} onClick={e => e.stopPropagation()} />
        <span className="text-slate-400">{expanded ? '▼' : '▶'}</span>
        <span className="text-xs text-slate-500 w-24">{tx.date}</span>
        <span className="flex-1">{tx.firstProduct}{tx.itemCount > 1 ? ` +${tx.itemCount - 1}` : ''}</span>
        <span className="font-bold w-32 text-right">{formatKRW(tx.totalAmount)}</span>
        <PersonSelect onSelect={p => onAssign(tx.id, p)} />
      </div>
      {expanded && tx.items.length > 0 && (
        <div className="ml-12 my-2 bg-slate-50 rounded p-2">
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-1 font-normal">품목</th>
                <th className="text-right py-1 font-normal w-20">수량</th>
                <th className="text-right py-1 font-normal w-24">단가</th>
                <th className="text-right py-1 font-normal w-28">금액</th>
              </tr>
            </thead>
            <tbody>
              {tx.items.map((it, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 text-slate-700">{it.productName}</td>
                  <td className="py-1 text-right text-slate-600">{it.quantity.toLocaleString()}</td>
                  <td className="py-1 text-right text-slate-600">{formatKRW(it.unitPrice)}</td>
                  <td className="py-1 text-right font-medium text-slate-800">{formatKRW(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PersonSelect({ onSelect }: { onSelect: (p: string) => void }) {
  return (
    <select
      className="text-xs border rounded px-1.5 py-0.5 bg-amber-50 border-amber-300 text-amber-700"
      defaultValue=""
      onChange={e => {
        const v = e.target.value
        if (v === '__custom__') {
          const name = prompt('담당자 이름:')
          if (name?.trim()) onSelect(name.trim())
          e.target.value = ''
        } else if (v) {
          onSelect(v)
          e.target.value = ''
        }
      }}
    >
      <option value="">선택…</option>
      {DEFAULT_PERSONS.map(p => <option key={p} value={p}>{p}</option>)}
      <option value="__custom__">기타</option>
    </select>
  )
}
