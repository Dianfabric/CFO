'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertTriangle, CheckCircle, Clock, Phone, User, UserPlus, Filter } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface ARItem {
  id: string; remainingAmount: number; originalAmount: number; status: string; createdAt: string
  transaction: { date: string; salesPerson: string | null }
  transactionId: string
}

interface ClientAR {
  clientId: string; clientName: string; phone: string | null
  totalAmount: number; count: number; oldestDays: number
  salesPersons: { name: string; count: number; amount: number }[]
  unassignedCount: number; unassignedAmount: number
  items: ARItem[]
}

const DEFAULT_PERSONS = ['한태원', '한태종', '최현진', '유대현', '전새로미']

export default function ReceivablesPage() {
  const [data, setData] = useState<{ summary: ClientAR[]; totalAR: number; overdueTotal: number; totalCount: number; allPersons: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [payDialog, setPayDialog] = useState<{ arId: string; clientName: string; remaining: number } | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [filterPerson, setFilterPerson] = useState<string>('')   // '' = 전체, 'UNASSIGNED' = 미지정만
  const [bulkDialog, setBulkDialog] = useState<{ clientId: string; clientName: string; unassignedIds: string[] } | null>(null)
  const [bulkPerson, setBulkPerson] = useState('')
  const [bulkCustom, setBulkCustom] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/receivables')
      const json = await res.json()
      if (!res.ok || !json?.summary) {
        console.error('[receivables fetch]', json)
        setData({ summary: [], totalAR: 0, overdueTotal: 0, totalCount: 0, allPersons: [] })
      } else {
        setData(json)
      }
    } catch (err) {
      console.error(err)
      setData({ summary: [], totalAR: 0, overdueTotal: 0, totalCount: 0, allPersons: [] })
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handlePayment = async () => {
    if (!payDialog || payAmount <= 0) return
    await fetch('/api/receivables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receivableId: payDialog.arId, amount: payAmount, paymentMethod: 'TRANSFER' }),
    })
    setPayDialog(null); setPayAmount(0); fetchData()
  }

  // 행별 담당자 지정
  const handleAssignPerson = async (transactionId: string, person: string) => {
    if (!person) return
    await fetch(`/api/transactions/${transactionId}/sales-person`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salesPerson: person }),
    })
    fetchData()
  }

  // 거래처 일괄 지정
  const handleBulkAssign = async () => {
    if (!bulkDialog) return
    const person = bulkPerson === '__custom__' ? bulkCustom.trim() : bulkPerson
    if (!person) { alert('담당자를 선택하거나 입력하세요'); return }
    await fetch('/api/transactions/sales-person/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds: bulkDialog.unassignedIds, salesPerson: person }),
    })
    setBulkDialog(null); setBulkPerson(''); setBulkCustom('')
    fetchData()
  }

  const agingColor = (days: number) =>
    days <= 30 ? 'text-green-600' : days <= 60 ? 'text-yellow-600' : days <= 90 ? 'text-orange-600' : 'text-red-600'

  const agingBadge = (days: number) =>
    days <= 30 ? 'secondary' as const : days <= 60 ? 'outline' as const : 'destructive' as const

  // 필터 적용
  const filteredSummary = useMemo(() => {
    if (!data) return []
    if (!filterPerson) return data.summary
    if (filterPerson === 'UNASSIGNED') return data.summary.filter(c => c.unassignedCount > 0)
    return data.summary.filter(c => c.salesPersons.some(p => p.name === filterPerson))
  }, [data, filterPerson])

  const filteredTotal = filteredSummary.reduce((s, c) => s + c.totalAmount, 0)
  const personList = useMemo(() => {
    const set = new Set([...DEFAULT_PERSONS, ...(data?.allPersons ?? [])])
    return Array.from(set).sort()
  }, [data])

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">미수금 관리</h1>
        <p className="text-sm text-slate-500">거래처별 외상 미수금을 추적하고 회수를 기록합니다</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-xs text-slate-500">미수금 총액</span></div>
            <p className="text-2xl font-bold">{formatKRW(data?.totalAR || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-orange-500" /><span className="text-xs text-slate-500">연체 금액 (30일+)</span></div>
            <p className="text-2xl font-bold text-orange-600">{formatKRW(data?.overdueTotal || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><span className="text-xs text-slate-500">미수 건수</span></div>
            <p className="text-2xl font-bold">{data?.totalCount || 0}건 / {data?.summary.length || 0}곳</p>
          </CardContent>
        </Card>
      </div>

      {/* 담당자 필터 */}
      <Card>
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 mr-2">담당자 필터:</span>
          <Button size="sm" variant={!filterPerson ? 'default' : 'outline'} onClick={() => setFilterPerson('')}>
            전체 ({data?.summary.length ?? 0})
          </Button>
          {personList.map(p => {
            const cnt = data?.summary.filter(c => c.salesPersons.some(s => s.name === p)).length ?? 0
            return (
              <Button key={p} size="sm" variant={filterPerson === p ? 'default' : 'outline'} onClick={() => setFilterPerson(p)} disabled={cnt === 0}>
                {p} ({cnt})
              </Button>
            )
          })}
          {(data?.summary.some(c => c.unassignedCount > 0) ?? false) && (
            <Button size="sm" variant={filterPerson === 'UNASSIGNED' ? 'default' : 'outline'} onClick={() => setFilterPerson('UNASSIGNED')} className="border-amber-300">
              ⚠ 미지정 있음
            </Button>
          )}
          {filterPerson && (
            <span className="text-xs text-slate-500 ml-auto">필터 합계: <strong className="text-slate-700">{formatKRW(filteredTotal)}</strong></span>
          )}
        </CardContent>
      </Card>

      {/* 거래처별 미수금 목록 */}
      {!filteredSummary.length ? (
        <Card><CardContent className="py-16 text-center"><CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" /><p className="text-slate-500">{filterPerson ? '해당 담당자의 미수금이 없습니다' : '미수금이 없습니다'}</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredSummary.map(client => (
            <Card key={client.clientId} className={client.oldestDays > 60 ? 'border-red-200' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedClient(expandedClient === client.clientId ? null : client.clientId)}>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{client.clientName}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                      {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
                      <span>{client.count}건</span>
                      <Badge variant={agingBadge(client.oldestDays)}>최장 {client.oldestDays}일</Badge>
                    </div>
                    {/* 담당자 뱃지 */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {client.salesPersons.map(p => (
                        <Badge key={p.name} variant="outline" className="gap-1 bg-blue-50 border-blue-200 text-blue-700">
                          <User className="w-3 h-3" />{p.name} ({p.count}건)
                        </Badge>
                      ))}
                      {client.unassignedCount > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const ids = client.items.filter(ar => !ar.transaction.salesPerson).map(ar => ar.transactionId)
                            setBulkDialog({ clientId: client.clientId, clientName: client.clientName, unassignedIds: ids })
                          }}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          title="미지정 거래에 담당자 일괄 지정"
                        >
                          <UserPlus className="w-3 h-3" />미지정 {client.unassignedCount}건 일괄 지정
                        </button>
                      )}
                      {client.salesPersons.length === 0 && client.unassignedCount === 0 && (
                        <span className="text-[11px] text-slate-300">담당자 정보 없음</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <p className={`text-xl font-bold ${agingColor(client.oldestDays)}`}>{formatKRW(client.totalAmount)}</p>
                  </div>
                </div>

                {expandedClient === client.clientId && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    {client.items.map(ar => (
                      <div key={ar.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm">원 금액: {formatKRW(ar.originalAmount)}</p>
                          <p className="text-xs text-slate-500">{new Date(ar.createdAt).toLocaleDateString('ko-KR')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* 담당자 표시 / 선택 */}
                          {ar.transaction.salesPerson ? (
                            <Badge variant="outline" className="gap-1 bg-blue-50 border-blue-200 text-blue-700">
                              <User className="w-3 h-3" />{ar.transaction.salesPerson}
                            </Badge>
                          ) : (
                            <select
                              className="text-xs border rounded px-1.5 py-0.5 bg-amber-50 border-amber-300 text-amber-700"
                              defaultValue=""
                              onClick={e => e.stopPropagation()}
                              onChange={e => {
                                e.stopPropagation()
                                const v = e.target.value
                                if (v === '__custom__') {
                                  const name = prompt('담당자 이름 입력:')
                                  if (name?.trim()) handleAssignPerson(ar.transactionId, name.trim())
                                } else if (v) handleAssignPerson(ar.transactionId, v)
                              }}
                            >
                              <option value="">담당자 선택</option>
                              {personList.map(p => <option key={p} value={p}>{p}</option>)}
                              <option value="__custom__">기타 (직접 입력)</option>
                            </select>
                          )}
                          <p className="font-bold text-red-600">{formatKRW(ar.remainingAmount)}</p>
                          <Button size="sm" variant="outline" onClick={e => {
                            e.stopPropagation()
                            setPayDialog({ arId: ar.id, clientName: client.clientName, remaining: ar.remainingAmount })
                            setPayAmount(ar.remainingAmount)
                          }}>회수</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 회수 다이얼로그 */}
      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>미수금 회수</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">거래처: <strong>{payDialog?.clientName}</strong></p>
            <p className="text-sm">잔여 미수금: <strong className="text-red-600">{formatKRW(payDialog?.remaining || 0)}</strong></p>
            <div><Label>회수 금액 (원)</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(parseInt(e.target.value) || 0)} /></div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPayAmount(payDialog?.remaining || 0)}>전액</Button>
              <Button className="flex-1" onClick={handlePayment}>회수 처리</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 일괄 담당자 지정 다이얼로그 */}
      <Dialog open={!!bulkDialog} onOpenChange={() => { setBulkDialog(null); setBulkPerson(''); setBulkCustom('') }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>일괄 담당자 지정</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <strong>{bulkDialog?.clientName}</strong>의 미지정 거래 <strong>{bulkDialog?.unassignedIds.length}건</strong>에<br />
              담당자를 일괄 지정합니다.
            </p>
            <div>
              <Label>담당자</Label>
              <select className="w-full mt-1 border rounded px-2 py-2 text-sm" value={bulkPerson} onChange={e => setBulkPerson(e.target.value)}>
                <option value="">선택…</option>
                {personList.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="__custom__">기타 (직접 입력)</option>
              </select>
              {bulkPerson === '__custom__' && (
                <Input className="mt-2" placeholder="담당자 이름" value={bulkCustom} onChange={e => setBulkCustom(e.target.value)} />
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setBulkDialog(null); setBulkPerson(''); setBulkCustom('') }}>취소</Button>
              <Button className="flex-1" onClick={handleBulkAssign}>일괄 지정</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
