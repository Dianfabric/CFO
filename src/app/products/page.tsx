'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, Search, Package } from 'lucide-react'
import { formatKRW, formatPercent, calcMarginRate, getCategoryName, getUnitName } from '@/lib/formatters'

interface Product {
  id: string
  name: string
  category: string
  unit: string
  purchasePrice: number
  sellingPrice: number
  description: string | null
  isActive: boolean
}

const CATEGORIES = [
  { value: 'SOFA_FABRIC', label: '소파원단' },
  { value: 'CURTAIN_FABRIC', label: '커튼원단' },
  { value: 'WALL_FABRIC', label: '벽원단' },
  { value: 'CURTAIN', label: '커튼(완제품)' },
  { value: 'SOFA', label: '소파(완제품)' },
  { value: 'OTHER', label: '기타' },
]

const UNITS = [
  { value: 'METER', label: '미터' },
  { value: 'YARD', label: '야드' },
  { value: 'PIECE', label: '개' },
  { value: 'ROLL', label: '롤' },
]

const emptyForm = {
  name: '', category: 'SOFA_FABRIC', unit: 'METER',
  purchasePrice: 0, sellingPrice: 0, description: '',
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/products')
      setProducts(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProducts() }, [])

  const handleSave = async () => {
    const url = editingId ? `/api/products/${editingId}` : '/api/products'
    const method = editingId ? 'PUT' : 'POST'
    try {
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setDialogOpen(false)
        setEditingId(null)
        setForm(emptyForm)
        fetchProducts()
      }
    } catch (err) { console.error(err) }
  }

  const openEdit = (p: Product) => {
    setEditingId(p.id)
    setForm({
      name: p.name, category: p.category, unit: p.unit,
      purchasePrice: p.purchasePrice, sellingPrice: p.sellingPrice,
      description: p.description || '',
    })
    setDialogOpen(true)
  }

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCategory && p.category !== filterCategory) return false
    return true
  })

  const marginColor = (rate: number) =>
    rate >= 40 ? 'text-green-600' : rate >= 20 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">제품 관리</h1>
          <p className="text-sm text-slate-500">원단·완제품의 원가, 판매가, 마진율을 관리합니다</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-1"><Plus className="w-4 h-4" />제품 등록</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? '제품 수정' : '새 제품 등록'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>제품명 *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="예: 벨벳 소파원단 A" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>카테고리 *</Label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>단위 *</Label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                    {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>매입가 (원)</Label>
                  <Input type="number" value={form.purchasePrice}
                    onChange={e => setForm({ ...form, purchasePrice: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>판매가 (원)</Label>
                  <Input type="number" value={form.sellingPrice}
                    onChange={e => setForm({ ...form, sellingPrice: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              {form.sellingPrice > 0 && (
                <div className="p-3 bg-slate-50 rounded-lg text-sm">
                  마진: <span className={`font-bold ${marginColor(calcMarginRate(form.sellingPrice, form.purchasePrice))}`}>
                    {formatPercent(calcMarginRate(form.sellingPrice, form.purchasePrice))}
                  </span>
                  <span className="text-slate-500 ml-2">
                    ({formatKRW(form.sellingPrice - form.purchasePrice)}/단위)
                  </span>
                </div>
              )}
              <div>
                <Label>설명 (선택)</Label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="색상, 소재 등 메모" />
              </div>
              <Button onClick={handleSave} className="w-full">{editingId ? '수정 완료' : '등록'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 필터 */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="제품명 검색..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">전체 카테고리</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* 제품 목록 */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">등록된 제품이 없습니다</p>
            <Button variant="outline" className="mt-3" onClick={openNew}>첫 제품 등록하기</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">제품 목록 ({filtered.length}개)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-2 font-medium">제품명</th>
                    <th className="pb-2 font-medium">카테고리</th>
                    <th className="pb-2 font-medium">단위</th>
                    <th className="pb-2 font-medium text-right">매입가</th>
                    <th className="pb-2 font-medium text-right">판매가</th>
                    <th className="pb-2 font-medium text-right">마진율</th>
                    <th className="pb-2 font-medium text-right">마진액</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const margin = calcMarginRate(p.sellingPrice, p.purchasePrice)
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="py-2.5 font-medium text-slate-900">{p.name}</td>
                        <td><Badge variant="secondary">{getCategoryName(p.category)}</Badge></td>
                        <td className="text-slate-600">{getUnitName(p.unit)}</td>
                        <td className="text-right text-slate-600">{formatKRW(p.purchasePrice)}</td>
                        <td className="text-right font-medium">{formatKRW(p.sellingPrice)}</td>
                        <td className={`text-right font-bold ${marginColor(margin)}`}>{formatPercent(margin)}</td>
                        <td className="text-right text-slate-600">{formatKRW(p.sellingPrice - p.purchasePrice)}</td>
                        <td className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
