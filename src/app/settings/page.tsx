'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Settings, Building, Key, Database, Download } from 'lucide-react'

export default function SettingsPage() {
  const [companyInfo, setCompanyInfo] = useState({
    name: '인테리어 원단 회사',
    businessNumber: '',
    representative: '',
    phone: '',
    address: '',
    email: '',
  })
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSaveCompany = () => {
    localStorage.setItem('companyInfo', JSON.stringify(companyInfo))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExport = async (type: string) => {
    try {
      let data
      if (type === 'transactions') {
        const res = await fetch('/api/transactions?limit=9999')
        data = await res.json()
      } else if (type === 'products') {
        const res = await fetch('/api/products')
        data = await res.json()
      } else if (type === 'clients') {
        const res = await fetch('/api/clients')
        data = await res.json()
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6" /> 설정
        </h1>
        <p className="text-sm text-slate-500">회사 정보, API 키, 데이터 관리를 설정합니다</p>
      </div>

      {/* 회사 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Building className="w-4 h-4" />회사 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>회사명</Label><Input value={companyInfo.name} onChange={e => setCompanyInfo({ ...companyInfo, name: e.target.value })} /></div>
            <div><Label>사업자번호</Label><Input value={companyInfo.businessNumber} onChange={e => setCompanyInfo({ ...companyInfo, businessNumber: e.target.value })} placeholder="000-00-00000" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>대표자명</Label><Input value={companyInfo.representative} onChange={e => setCompanyInfo({ ...companyInfo, representative: e.target.value })} /></div>
            <div><Label>전화번호</Label><Input value={companyInfo.phone} onChange={e => setCompanyInfo({ ...companyInfo, phone: e.target.value })} /></div>
          </div>
          <div><Label>주소</Label><Input value={companyInfo.address} onChange={e => setCompanyInfo({ ...companyInfo, address: e.target.value })} /></div>
          <div><Label>이메일</Label><Input value={companyInfo.email} onChange={e => setCompanyInfo({ ...companyInfo, email: e.target.value })} /></div>
          <Button onClick={handleSaveCompany}>
            {saved ? '저장 완료!' : '저장'}
          </Button>
        </CardContent>
      </Card>

      {/* API 키 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Key className="w-4 h-4" />AI CFO 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-500">
            AI CFO 자문 기능을 사용하려면 Anthropic API 키가 필요합니다.
            <code className="mx-1 px-1 bg-slate-100 rounded text-xs">.env</code> 파일의
            <code className="mx-1 px-1 bg-slate-100 rounded text-xs">ANTHROPIC_API_KEY</code>를 설정하세요.
          </p>
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <p className="font-medium mb-1">설정 방법:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>프로젝트 루트의 <code>.env</code> 파일을 엽니다</li>
              <li><code>ANTHROPIC_API_KEY=&quot;sk-ant-...&quot;</code> 에 API 키를 입력합니다</li>
              <li>서버를 재시작합니다</li>
            </ol>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">현재 상태</Badge>
            <span className="text-sm text-slate-600">서버 환경변수에서 관리됨</span>
          </div>
        </CardContent>
      </Card>

      {/* 데이터 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4" />데이터 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-500">데이터를 JSON 형식으로 내보낼 수 있습니다.</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleExport('transactions')} className="gap-1">
              <Download className="w-3.5 h-3.5" />거래 내역
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('products')} className="gap-1">
              <Download className="w-3.5 h-3.5" />제품 목록
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('clients')} className="gap-1">
              <Download className="w-3.5 h-3.5" />거래처 목록
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 시스템 정보 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>인테리어 원단 CFO v1.0</span>
            <span>Next.js 15 + Prisma + SQLite + Claude API</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
