'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface Suspect {
  id: string
  paymentDate: string
  clientId: string
  clientName: string
  amount: number
  notes: string | null
  createdAt: string
}

interface Group {
  clientId: string
  clientName: string
  total: number
  count: number
  items: Suspect[]
}

interface AuditResponse {
  totals: { ledgerPayments: number; bankInPayments: number; suspectCount: number; suspectAmount: number }
  groups: Group[]
  suspects: Suspect[]
}

export default function AuditPaymentsPage() {
  const [data, setData] = useState<AuditResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/audit/payments')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchData() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('이 입금을 삭제하시겠습니까? (되돌릴 수 없음)')) return
    setDeleting(id)
    try {
      await fetch('/api/audit/payments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: id }),
      })
      // 로컬 state 업데이트 (refetch 없이 빠르게)
      if (data) {
        const newGroups = data.groups
          .map(g => ({ ...g, items: g.items.filter(s => s.id !== id) }))
          .map(g => ({ ...g, count: g.items.length, total: g.items.reduce((s, x) => s + x.amount, 0) }))
          .filter(g => g.count > 0)
        const newSuspects = data.suspects.filter(s => s.id !== id)
        setData({
          ...data,
          groups: newGroups,
          suspects: newSuspects,
          totals: {
            ...data.totals,
            suspectCount: newSuspects.length,
            suspectAmount: newSuspects.reduce((s, x) => s + x.amount, 0),
          },
        })
      }
    } catch (err) {
      console.error(err)
      alert('삭제 실패')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  if (!data) return <div className="text-slate-500 py-20 text-center">데이터를 불러올 수 없습니다</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">일계표 입금 검증</h1>
        <p className="text-sm text-slate-500">통장 매칭이 안 된 일계표 입금 — 잘못 들어간 데이터를 직접 검토하고 삭제하세요</p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">일계표 입금</p>
            <p className="text-2xl font-bold">{data.totals.ledgerPayments.toLocaleString()}건</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">통장 입금</p>
            <p className="text-2xl font-bold">{data.totals.bankInPayments.toLocaleString()}건</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <p className="text-xs text-slate-500">통장 매칭 없는 일계표 입금</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{data.totals.suspectCount.toLocaleString()}건</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">의심 금액</p>
            <p className="text-2xl font-bold text-orange-600">{formatKRW(data.totals.suspectAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* 가이드 */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 text-xs text-amber-800 space-y-1">
          <p><strong>📋 검토 안내</strong></p>
          <p>• 통장에 매칭되는 입금이 없는 일계표 입금만 표시됨</p>
          <p>• <strong>다 잘못된 데이터는 아닙니다</strong> — 현금 입금, 통장명 매칭 실패, 통장 미업로드 기간 등이 포함될 수 있음</p>
          <p>• 일계표 원본 + 통장 둘 다 확인 후 잘못된 데이터만 [삭제]</p>
        </CardContent>
      </Card>

      {/* 거래처별 그룹 */}
      {!data.groups.length ? (
        <Card><CardContent className="py-16 text-center"><p className="text-slate-500">의심 입금이 없습니다 ✨</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {data.groups.map(g => {
            const isExpanded = expandedClient === g.clientId
            return (
              <Card key={g.clientId} className="border-slate-200">
                <CardContent className="p-0">
                  <div
                    onClick={() => setExpandedClient(isExpanded ? null : g.clientId)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <span className="font-medium">{g.clientName}</span>
                      <span className="text-xs text-slate-500">({g.count}건)</span>
                    </div>
                    <span className="text-base font-bold text-orange-600">{formatKRW(g.total)}</span>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/30">
                      <table className="w-full text-sm">
                        <thead className="text-slate-500 text-xs">
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 px-4 font-normal w-32">입금일</th>
                            <th className="text-right py-2 px-4 font-normal w-32">금액</th>
                            <th className="text-left py-2 px-4 font-normal">메모</th>
                            <th className="text-right py-2 px-4 font-normal w-24">DB 등록일</th>
                            <th className="text-right py-2 px-4 font-normal w-32">작업</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.items.map(s => (
                            <tr key={s.id} className="border-b border-slate-100 hover:bg-white">
                              <td className="py-2 px-4 text-slate-700">{s.paymentDate}</td>
                              <td className="py-2 px-4 text-right font-bold text-orange-600">{formatKRW(s.amount)}</td>
                              <td className="py-2 px-4 text-slate-500 text-xs">{s.notes ?? ''}</td>
                              <td className="py-2 px-4 text-right text-slate-400 text-xs">{s.createdAt}</td>
                              <td className="py-2 px-4 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={deleting === s.id}
                                  onClick={() => handleDelete(s.id)}
                                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                >
                                  {deleting === s.id ? '삭제 중…' : '🗑 삭제'}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
