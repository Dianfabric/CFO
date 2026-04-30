'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FileText, Plus, TrendingUp, TrendingDown, CalendarOff, Wallet, ListChecks, Search, Receipt, ExternalLink, Tag, Copy, Check, Eye, Image as ImageIcon } from 'lucide-react'
import DocumentPreviewDialog, { DocFull } from '@/components/documents/DocumentPreviewDialog'
import SavedDocumentRender, { CompanyProfileLite } from '@/components/documents/SavedDocumentRender'
import { downloadJPG, copyImageToClipboard } from '@/lib/document-export'

interface DocRow {
  id: string
  documentNumber: string
  type: string
  title: string
  recipientName: string
  ccLine: string | null
  senderLine: string
  bodyText: string
  tableJson: string | null
  metaJson: string | null
  createdAt: string
}

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  PRICE_CHANGE: { label: '단가 변경', icon: TrendingUp, color: 'text-rose-600' },
  HOLIDAY: { label: '휴무 안내', icon: CalendarOff, color: 'text-amber-600' },
  PAYMENT_REQUEST: { label: '결제 요청', icon: Wallet, color: 'text-blue-600' },
  PRICE_INFO: { label: '단가 안내', icon: ListChecks, color: 'text-emerald-600' },
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [previewDoc, setPreviewDoc] = useState<DocFull | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [profile, setProfile] = useState<CompanyProfileLite | null>(null)
  const [downloadingDoc, setDownloadingDoc] = useState<DocRow | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [copyingDoc, setCopyingDoc] = useState<DocRow | null>(null)
  const [copyingId, setCopyingId] = useState<string | null>(null)

  // 회사 프로필 1회 로드 (다운로드 시 footer에 사용)
  useEffect(() => {
    fetch('/api/company-profile')
      .then((r) => r.json())
      .then(setProfile)
      .catch(() => {})
  }, [])

  // downloadingDoc이 set되면 hidden 영역에 렌더 → 다음 프레임에 캡처/다운로드
  useEffect(() => {
    if (!downloadingDoc) return
    let cancelled = false
    ;(async () => {
      // 2 프레임 + 짧은 지연 (이미지 로드 대기)
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      await new Promise((r) => setTimeout(r, 50))
      if (cancelled) return
      try {
        const filename = `${downloadingDoc.documentNumber}_${downloadingDoc.title || '공문'}`
          .replace(/[\/\\?%*:|"<>]/g, '_')
          .replace(/\s+/g, '')
        await downloadJPG(filename)
      } catch (e) {
        console.error('JPG 다운로드 실패:', e)
        alert('JPG 다운로드 실패: ' + (e instanceof Error ? e.message : String(e)))
      } finally {
        if (!cancelled) {
          setDownloadingDoc(null)
          setDownloadingId(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [downloadingDoc])

  const handleRowDownload = (d: DocRow) => {
    if (downloadingId || copyingId) return
    setDownloadingId(d.id)
    setDownloadingDoc(d)
  }

  const handleRowCopy = (d: DocRow) => {
    if (copyingId || downloadingId) return
    setCopyingId(d.id)
    setCopyingDoc(d)
  }

  // copyingDoc set되면 hidden 영역에 렌더 → 다음 프레임에 캡처/클립보드 복사
  useEffect(() => {
    if (!copyingDoc) return
    let cancelled = false
    ;(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      await new Promise((r) => setTimeout(r, 50))
      if (cancelled) return
      try {
        const result = await copyImageToClipboard('document-print-area')
        if (!cancelled) {
          if (result.ok) {
            setCopiedId(copyingDoc.id)
            setTimeout(() => setCopiedId(null), 1800)
          } else {
            const msg =
              result.reason === 'unsupported' ? '이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다.' :
              result.reason === 'permission' ? '복사 권한이 거부되었습니다. 페이지를 클릭한 후 다시 시도해주세요.' :
              '이미지 복사 실패' + (result.error ? '\n' + result.error : '')
            alert(msg)
          }
        }
      } catch (e) {
        console.error('이미지 복사 실패:', e)
        if (!cancelled) alert('이미지 복사 실패: ' + (e instanceof Error ? e.message : String(e)))
      } finally {
        if (!cancelled) {
          setCopyingDoc(null)
          setCopyingId(null)
        }
      }
    })()
    return () => { cancelled = true }
  }, [copyingDoc])

  const load = async (q?: string) => {
    setLoading(true)
    try {
      const url = q ? `/api/documents?search=${encodeURIComponent(q)}` : '/api/documents'
      const res = await fetch(url)
      const data = await res.json()
      setDocs(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6" /> 공문 작성
          </h1>
          <p className="text-sm text-slate-500">거래처 대상 공식 서한을 작성하고 PDF/JPG로 발행합니다</p>
        </div>
      </div>

      {/* 새 공문 작성 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" /> 새 공문 작성
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Link href="/documents/new/price-change?direction=UP" className="group">
              <div className="border rounded-lg p-4 bg-white hover:border-rose-400 hover:shadow-sm transition">
                <TrendingUp className="w-5 h-5 text-rose-600 mb-2" />
                <div className="font-semibold text-sm">단가 인상</div>
                <div className="text-xs text-slate-500 mt-1">% 또는 정액으로 인상</div>
              </div>
            </Link>
            <Link href="/documents/new/price-change?direction=DOWN" className="group">
              <div className="border rounded-lg p-4 bg-white hover:border-emerald-400 hover:shadow-sm transition">
                <TrendingDown className="w-5 h-5 text-emerald-600 mb-2" />
                <div className="font-semibold text-sm">단가 인하</div>
                <div className="text-xs text-slate-500 mt-1">% 또는 정액으로 인하</div>
              </div>
            </Link>
            <Link href="/documents/new/price-info">
              <div className="border rounded-lg p-4 bg-white hover:border-emerald-400 hover:shadow-sm transition">
                <ListChecks className="w-5 h-5 text-emerald-600 mb-2" />
                <div className="font-semibold text-sm">단가 안내</div>
                <div className="text-xs text-slate-500 mt-1">품목별 현행 단가 안내</div>
              </div>
            </Link>
            <div className="border rounded-lg p-4 bg-slate-50 opacity-60 cursor-not-allowed">
              <Wallet className="w-5 h-5 text-blue-600 mb-2" />
              <div className="font-semibold text-sm">결제 요청</div>
              <div className="text-xs text-slate-500 mt-1">곧 추가 예정</div>
            </div>
            <a href="https://dianfabric.github.io/dian-quote/" target="_blank" rel="noopener noreferrer">
              <div className="border rounded-lg p-4 bg-white hover:border-indigo-400 hover:shadow-sm transition">
                <div className="flex items-center justify-between mb-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="font-semibold text-sm">견적서 작성</div>
                <div className="text-xs text-slate-500 mt-1">DiAN 견적서 생성기 (새 탭)</div>
              </div>
            </a>
            <a href="https://dian-fabric-search.vercel.app/" target="_blank" rel="noopener noreferrer">
              <div className="border rounded-lg p-4 bg-white hover:border-purple-400 hover:shadow-sm transition">
                <div className="flex items-center justify-between mb-2">
                  <Tag className="w-5 h-5 text-purple-600" />
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="font-semibold text-sm">단가 검색</div>
                <div className="text-xs text-slate-500 mt-1">원단 단가 조회 (새 탭)</div>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* 발행 이력 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>발행 이력</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-7 h-8 w-56 text-sm"
                  placeholder="문서번호 / 수신 / 제목"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && load(search)}
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => load(search)}>검색</Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-slate-400 py-8">불러오는 중...</p>
          ) : docs.length === 0 ? (
            <p className="text-center text-slate-400 py-8">아직 발행된 공문이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-2 font-medium">문서번호</th>
                    <th className="pb-2 font-medium">유형</th>
                    <th className="pb-2 font-medium">제목</th>
                    <th className="pb-2 font-medium">수신</th>
                    <th className="pb-2 font-medium">발행일</th>
                    <th className="pb-2 font-medium text-right pr-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map(d => {
                    const meta = TYPE_META[d.type] || { label: d.type, icon: FileText, color: 'text-slate-600' }
                    const Icon = meta.icon
                    const isCopied = copiedId === d.id
                    return (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="py-2.5">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(d as unknown as DocFull)}
                            title="클릭하여 미리보기"
                            className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            {d.documentNumber}
                          </button>
                        </td>
                        <td>
                          <Badge variant="secondary" className="gap-1">
                            <Icon className={`w-3 h-3 ${meta.color}`} />
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="text-slate-700 max-w-xs truncate">{d.title}</td>
                        <td className="text-slate-600">{d.recipientName}</td>
                        <td className="text-slate-500 text-xs">{new Date(d.createdAt).toLocaleString('ko-KR')}</td>
                        <td className="text-right pr-2">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRowCopy(d)}
                              disabled={!!copyingId || !!downloadingId}
                              title="이 공문을 이미지로 클립보드에 복사 (메신저 등에 붙여넣기 가능)"
                              className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition whitespace-nowrap ${
                                isCopied
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                  : copyingId === d.id
                                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed'
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  복사됨
                                </>
                              ) : copyingId === d.id ? (
                                <>
                                  <Copy className="w-3 h-3" />
                                  복사 중...
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  복사
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRowDownload(d)}
                              disabled={!!downloadingId}
                              title="JPG 파일로 다운로드"
                              className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition whitespace-nowrap ${
                                downloadingId === d.id
                                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed'
                              }`}
                            >
                              <ImageIcon className="w-3 h-3" />
                              {downloadingId === d.id ? '생성 중...' : '다운'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <DocumentPreviewDialog
        open={!!previewDoc}
        onOpenChange={(o) => !o && setPreviewDoc(null)}
        doc={previewDoc}
      />

      {/* 다운로드/복사용 화면 밖 렌더 — downloadingDoc 또는 copyingDoc set되면 일시적으로 마운트 */}
      {(downloadingDoc || copyingDoc) && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: 0,
            left: '-99999px',
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          <SavedDocumentRender doc={(downloadingDoc || copyingDoc)!} profile={profile} />
        </div>
      )}
    </div>
  )
}
