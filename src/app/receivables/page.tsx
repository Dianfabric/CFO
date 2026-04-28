'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertTriangle, CheckCircle, Clock, Phone } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface ARItem {
  id: string; remainingAmount: number; originalAmount: number; status: string; createdAt: string
  transaction: { date: string }
}

interface ClientAR {
  clientId: string; clientName: string; phone: string | null
  totalAmount: number; count: number; oldestDays: number
  items: ARItem[]
}

export default function ReceivablesPage() {
  const [data, setData] = useState<{ summary: ClientAR[]; totalAR: number; overdueTotal: number; totalCount: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [payDialog, setPayDialog] = useState<{ arId: string; clientName: string; remaining: number } | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/receivables')
      setData(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
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

  const agingColor = (days: number) =>
    days <= 30 ? 'text-green-600' : days <= 60 ? 'text-yellow-600' : days <= 90 ? 'text-orange-600' : 'text-red-600'

  const agingBadge = (days: number) =>
    days <= 30 ? 'secondary' as const : days <= 60 ? 'outline' as const : 'destructive' as const

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

      {/* 거래처별 미수금 목록 */}
      {!data?.summary.length ? (
        <Card><CardContent className="py-16 text-center"><CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" /><p className="text-slate-500">미수금이 없습니다</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.summary.map(client => (
            <Card key={client.clientId} className={client.oldestDays > 60 ? 'border-red-200' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedClient(expandedClient === client.clientId ? null : client.clientId)}>
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{client.clientName}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
                        <span>{client.count}건</span>
                        <Badge variant={agingBadge(client.oldestDays)}>최장 {client.oldestDays}일</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${agingColor(client.oldestDays)}`}>{formatKRW(client.totalAmount)}</p>
                  </div>
                </div>

                {expandedClient === client.clientId && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    {client.items.map(ar => (
                      <div key={ar.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm">원 금액: {formatKRW(ar.originalAmount)}</p>
                          <p className="text-xs text-slate-500">{new Date(ar.createdAt).toLocaleDateString('ko-KR')}</p>
                        </div>
                        <div className="flex items-center gap-2">
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

      {/* 회수 입력 다이얼로그 */}
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
    </div>
  )
}
