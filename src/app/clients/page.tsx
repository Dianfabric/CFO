'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Search, Users, Pencil, Phone, Mail } from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface Client {
  id: string; name: string; businessNumber: string | null; contactName: string | null;
  phone: string | null; email: string | null; address: string | null; type: string; notes: string | null
}

const CLIENT_TYPES = [
  { value: 'CUSTOMER', label: '고객' },
  { value: 'SUPPLIER', label: '공급사' },
  { value: 'BOTH', label: '고객+공급' },
]

const emptyForm = { name: '', businessNumber: '', contactName: '', phone: '', email: '', address: '', type: 'CUSTOMER', notes: '' }

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [detail, setDetail] = useState<{ clientId: string; stats: { totalSales: number; salesCount: number; totalReceivable: number } } | null>(null)

  const fetchClients = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterType) params.set('type', filterType)
    try {
      const res = await fetch(`/api/clients?${params}`)
      setClients(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchClients() }, [filterType])

  const handleSave = async () => {
    if (!form.name) return
    const url = editingId ? `/api/clients/${editingId}` : '/api/clients'
    const method = editingId ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setDialogOpen(false); setEditingId(null); setForm(emptyForm); fetchClients()
  }

  const openEdit = (c: Client) => {
    setEditingId(c.id)
    setForm({ name: c.name, businessNumber: c.businessNumber || '', contactName: c.contactName || '', phone: c.phone || '', email: c.email || '', address: c.address || '', type: c.type, notes: c.notes || '' })
    setDialogOpen(true)
  }

  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true) }

  const viewDetail = async (clientId: string) => {
    const res = await fetch(`/api/clients/${clientId}`)
    const data = await res.json()
    setDetail({ clientId, stats: data.stats })
  }

  const filtered = clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
  const typeBadge = (t: string) => t === 'CUSTOMER' ? 'default' as const : t === 'SUPPLIER' ? 'secondary' as const : 'outline' as const
  const typeLabel = (t: string) => CLIENT_TYPES.find(ct => ct.value === t)?.label || t

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">거래처 관리</h1>
          <p className="text-sm text-slate-500">B2B 고객사 및 원자재 공급사를 관리합니다</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-1"><Plus className="w-4 h-4" />거래처 등록</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingId ? '거래처 수정' : '새 거래처 등록'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>거래처명 *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="예: (주)하나인테리어" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>사업자번호</Label><Input value={form.businessNumber} onChange={e => setForm({ ...form, businessNumber: e.target.value })} placeholder="000-00-00000" /></div>
                <div>
                  <Label>유형</Label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    {CLIENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>담당자</Label><Input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></div>
                <div><Label>전화번호</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>이메일</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>주소</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>메모</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={handleSave} className="w-full">{editingId ? '수정 완료' : '등록'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="거래처명 검색..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchClients()} />
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">전체</option>
          {CLIENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div className="text-sm text-slate-500 flex items-center">{filtered.length}개</div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center"><Users className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">거래처가 없습니다</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => viewDetail(c.id)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{c.name}</h3>
                    {c.businessNumber && <p className="text-xs text-slate-400">{c.businessNumber}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={typeBadge(c.type)}>{typeLabel(c.type)}</Badge>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); openEdit(c) }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {c.contactName && <p className="text-sm text-slate-600 mb-1">{c.contactName}</p>}
                <div className="flex gap-3 text-xs text-slate-500">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                </div>
                {detail?.clientId === c.id && (
                  <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-xs text-slate-400">총매출</p><p className="text-sm font-bold">{formatKRW(detail.stats.totalSales)}</p></div>
                    <div><p className="text-xs text-slate-400">거래수</p><p className="text-sm font-bold">{detail.stats.salesCount}건</p></div>
                    <div><p className="text-xs text-slate-400">미수금</p><p className="text-sm font-bold text-red-600">{formatKRW(detail.stats.totalReceivable)}</p></div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
