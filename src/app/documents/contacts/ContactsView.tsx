'use client'

/**
 * 잠재 거래처 등록 — 입력 + 리스트 + Sheets 동기화 + CSV
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  X,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Phone,
  Mail,
  MapPin,
  Building2,
  Briefcase,
  Download,
  RefreshCw,
  ExternalLink,
  FileSpreadsheet,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGoogleDrive, DRIVE_AND_SHEETS_SCOPE } from '@/hooks/useGoogleDrive'
import { getOrCreateFolder } from '@/lib/google-drive'
import {
  getOrCreateSpreadsheet,
  appendRow,
  updateRow,
} from '@/lib/google-sheets'
import {
  OCCUPATION_OPTIONS,
  PRODUCT_OPTIONS,
  INQUIRY_SOURCE_OPTIONS,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_COLOR,
  occupationLabel,
  productLabel,
  inquirySourceLabel,
  formatPhone,
  leadToCsvRow,
  leadToRowValues,
  CSV_HEADER,
  SHEET_HEADER_COLUMNS,
  type ContactLead,
  type LeadStatus,
} from '@/lib/contact-leads'
import { cn } from '@/lib/utils'

const ROOT_FOLDER_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID ?? ''
const LEAD_FOLDER_NAME = '디안 거래처 풀'
const LEAD_SHEET_NAME = '잠재거래처_마스터'
const SHEET_LINK_LS_KEY = 'dian.contactLeadSheet'

interface SheetInfo {
  spreadsheetId: string
  webViewLink: string
}

export default function ContactsView() {
  const { getToken } = useGoogleDrive(DRIVE_AND_SHEETS_SCOPE)

  // 데이터
  const [leads, setLeads] = useState<ContactLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 필터
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [occuFilter, setOccuFilter] = useState<string | 'all'>('all')
  const [productFilter, setProductFilter] = useState<string | 'all'>('all')

  // 폼
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Sheets — localhost 환경은 OAuth origin 미등록일 가능성 높아 default OFF
  // hydration mismatch 피하려고 mount 후 useEffect 로 set
  const [isLocalhost, setIsLocalhost] = useState(false)
  const [sheetInfo, setSheetInfo] = useState<SheetInfo | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [autoSync, setAutoSync] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)

  // mount: localhost 감지 + autoSync default 조정
  useEffect(() => {
    const local =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    setIsLocalhost(local)
    if (local) setAutoSync(false)
  }, [])

  // 초기 sheet info from localStorage — 이미 연결 이력이 있으면 표시
  // (단, 실제 토큰은 세션마다 새로 받아야 하므로 googleConnected 는 false 유지)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHEET_LINK_LS_KEY)
      if (raw) setSheetInfo(JSON.parse(raw))
    } catch {}
  }, [])

  const saveSheetInfo = (info: SheetInfo | null) => {
    setSheetInfo(info)
    try {
      if (info) localStorage.setItem(SHEET_LINK_LS_KEY, JSON.stringify(info))
      else localStorage.removeItem(SHEET_LINK_LS_KEY)
    } catch {}
  }

  // ──────── 데이터 로드 ────────
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (occuFilter !== 'all') params.set('occupation', occuFilter)
      if (productFilter !== 'all') params.set('product', productFilter)
      const r = await fetch(`/api/contacts?${params}`)
      if (!r.ok) throw new Error(`${r.status}`)
      const j = await r.json()
      setLeads(j.leads ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, occuFilter, productFilter])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // ──────── 통계 ────────
  const stats = useMemo(() => {
    const total = leads.length
    const byStatus = leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1
      return acc
    }, {})
    const thisWeek = leads.filter((l) => {
      const d = new Date(l.created_at)
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
      return diff <= 7
    }).length
    return { total, byStatus, thisWeek }
  }, [leads])

  // ──────── Sheets 동기화 ────────
  const ensureSheet = useCallback(async (): Promise<SheetInfo> => {
    if (sheetInfo) return sheetInfo
    if (!ROOT_FOLDER_ID) {
      throw new Error('환경변수 NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID 미설정')
    }
    const token = await getToken()
    const folderId = await getOrCreateFolder(LEAD_FOLDER_NAME, ROOT_FOLDER_ID, token)
    const sheet = await getOrCreateSpreadsheet(
      LEAD_SHEET_NAME,
      folderId,
      token,
      SHEET_HEADER_COLUMNS,
    )
    const info = {
      spreadsheetId: sheet.spreadsheetId,
      webViewLink: sheet.webViewLink,
    }
    saveSheetInfo(info)
    return info
  }, [sheetInfo, getToken])

  /** 새 lead 등록 시 Sheets append → row 번호를 DB 에 기록 */
  const syncNewLeadToSheet = useCallback(
    async (lead: ContactLead) => {
      try {
        const info = await ensureSheet()
        const token = await getToken()
        const rowIdx = await appendRow(
          info.spreadsheetId,
          leadToRowValues(lead),
          token,
        )
        // DB 업데이트
        await fetch(`/api/contacts/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet_synced_at: new Date().toISOString(),
            sheet_row_index: rowIdx,
          }),
        })
      } catch (e) {
        // 동기화 실패해도 lead 자체는 살아있음 — 경고만
        console.error('Sheets sync failed', e)
        setError(
          `Lead 는 저장됐지만 Sheets 동기화 실패: ${e instanceof Error ? e.message : '오류'}`,
        )
      }
    },
    [ensureSheet, getToken],
  )

  /** 전체 leads 시트에 일괄 백필 (수동 동기화) */
  const handleFullSync = async () => {
    setSyncing(true)
    setError(null)
    try {
      const info = await ensureSheet()
      const token = await getToken()
      // 미동기화 leads append
      const unsynced = leads.filter((l) => !l.sheet_row_index)
      for (const l of unsynced) {
        const rowIdx = await appendRow(
          info.spreadsheetId,
          leadToRowValues(l),
          token,
        )
        await fetch(`/api/contacts/${l.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet_synced_at: new Date().toISOString(),
            sheet_row_index: rowIdx,
          }),
        })
      }
      await fetchLeads()
    } catch (e) {
      setError(e instanceof Error ? e.message : '동기화 실패')
    } finally {
      setSyncing(false)
    }
  }

  /** lead 업데이트 시 시트 row 도 업데이트 */
  const syncUpdatedLeadToSheet = useCallback(
    async (lead: ContactLead) => {
      if (!autoSync) return
      if (!sheetInfo || !lead.sheet_row_index) return
      try {
        const token = await getToken()
        await updateRow(
          sheetInfo.spreadsheetId,
          lead.sheet_row_index,
          leadToRowValues(lead),
          token,
        )
      } catch (e) {
        console.error('Sheet update failed', e)
      }
    },
    [autoSync, sheetInfo, getToken],
  )

  // ──────── Google 연결 (user gesture 안에서 명시적 호출) ────────
  const handleGoogleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      // user gesture 컨텍스트에서 직접 popup 띄움 → blocker 회피
      await getToken()
      await ensureSheet()
      setGoogleConnected(true)
    } catch (e) {
      setError(
        `Google 연결 실패: ${e instanceof Error ? e.message : '오류'}. 브라우저 팝업 차단을 확인하세요.`,
      )
    } finally {
      setConnecting(false)
    }
  }

  // ──────── CRUD ────────
  const handleCreate = async (form: LeadFormData) => {
    // ★ 자동 동기화 ON 인데 아직 토큰이 없으면, fetch 전에 user gesture 안에서 미리 토큰 확보
    if (autoSync && !googleConnected) {
      try {
        await getToken()
        // 토큰 받으면 시트도 미리 보장
        await ensureSheet()
        setGoogleConnected(true)
      } catch (e) {
        // 실패해도 lead 저장은 진행. 동기화만 스킵.
        setError(
          `Google 로그인 실패 (${e instanceof Error ? e.message : '오류'}) — Sheets 동기화는 건너뛰고 Supabase 에만 저장됩니다. 우측 상단 '일괄 동기화'로 추후 보충 가능.`,
        )
      }
    }

    const r = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => null)
      throw new Error(j?.error ?? `${r.status}`)
    }
    const j = await r.json()
    const newLead: ContactLead = j.lead
    await fetchLeads()
    if (autoSync && googleConnected) syncNewLeadToSheet(newLead) // fire-and-forget
  }

  const handleUpdate = async (id: string, form: Partial<LeadFormData>) => {
    const r = await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => null)
      throw new Error(j?.error ?? `${r.status}`)
    }
    const j = await r.json()
    const updated: ContactLead = j.lead
    await fetchLeads()
    if (googleConnected) syncUpdatedLeadToSheet(updated)
  }

  const handleDelete = async (lead: ContactLead) => {
    if (!confirm(`"${lead.name}" lead 를 삭제할까요?\n(Sheets 행은 수동 정리 필요)`)) return
    const r = await fetch(`/api/contacts/${lead.id}`, { method: 'DELETE' })
    if (!r.ok) {
      setError(`삭제 실패: ${r.status}`)
      return
    }
    await fetchLeads()
  }

  // ──────── CSV 다운로드 ────────
  const handleCsvDownload = () => {
    const lines = [CSV_HEADER, ...leads.map(leadToCsvRow)]
    const csv = '﻿' + lines.join('\n') // BOM (엑셀 한글)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `잠재거래처_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="space-y-5">
      {/* 통계 + 액션 */}
      <div
        className="border border-[#e5e5e5] bg-white p-4"
        style={{ borderRadius: '2px' }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#666]">
              전체 lead
            </p>
            <p className="text-[24px] font-bold tabular-nums text-[#000]">{stats.total}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#666]">
              최근 7일
            </p>
            <p
              className="text-[24px] font-bold tabular-nums"
              style={{ color: 'var(--nv-primary)' }}
            >
              +{stats.thisWeek}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#666]">
              상태
            </p>
            <p className="text-[12px] text-[#000]">
              신규 {stats.byStatus.new ?? 0} · 연락 {stats.byStatus.contacted ?? 0} · 전환{' '}
              {stats.byStatus.converted ?? 0}
            </p>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 flex-wrap">
            {/* Google 연결 상태 — autoSync 가 켜져있을 때만 노출 */}
            {autoSync && !googleConnected && (
              <button
                onClick={handleGoogleConnect}
                disabled={connecting}
                className="h-8 px-3 text-[11px] font-bold inline-flex items-center gap-1.5 bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a] border border-[#fcd34d]"
                style={{ borderRadius: '2px' }}
                title="등록 전 한 번 클릭해 Google Sheets 와 연결하세요"
              >
                {connecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                {connecting ? '연결 중...' : 'Google 연결'}
              </button>
            )}
            {/* 시트 링크 */}
            {sheetInfo && (
              <a
                href={sheetInfo.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 text-[11px] font-bold inline-flex items-center gap-1.5 bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]"
                style={{ borderRadius: '2px' }}
                title="구글 시트에서 열기"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                시트 열기
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {autoSync && (
              <button
                onClick={handleFullSync}
                disabled={syncing}
                className="h-8 px-2.5 text-[11px] font-bold inline-flex items-center gap-1 bg-[#f9fafb] hover:bg-[#f3f4f6] border border-[#cccccc]"
                style={{ borderRadius: '2px' }}
                title="미동기화 lead 일괄 추가"
              >
                {syncing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                {syncing ? '동기화 중' : '일괄 동기화'}
              </button>
            )}
            <button
              onClick={handleCsvDownload}
              className="h-8 px-2.5 text-[11px] font-bold inline-flex items-center gap-1 bg-[#f9fafb] hover:bg-[#f3f4f6] border border-[#cccccc]"
              style={{ borderRadius: '2px' }}
              title="CSV 다운로드 (엑셀)"
            >
              <Download className="w-3 h-3" />
              CSV
            </button>
            <Button
              onClick={() => {
                setShowForm(true)
                setEditingId(null)
              }}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              신규 등록
            </Button>
          </div>
        </div>

        {/* 자동 동기화 토글 */}
        <label className="flex items-center gap-2 mt-3 text-[11px] text-[#666]">
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => setAutoSync(e.target.checked)}
            className="w-3.5 h-3.5 accent-[#76b900]"
          />
          <Sparkles className="w-3 h-3 text-[#76b900]" />
          신규 등록·수정 시 Google Sheets 자동 동기화
        </label>
      </div>

      {/* localhost 안내 */}
      {isLocalhost && (
        <div
          className="border border-[#fcd34d] bg-[#fffbeb] p-3 text-[12px] text-[#78350f]"
          style={{ borderRadius: '2px' }}
        >
          <p className="font-bold mb-0.5">💡 로컬 개발 모드</p>
          <p>
            Google Sheets 자동 동기화가 <strong>꺼져 있습니다</strong>{' '}
            (OAuth origin 미등록 가능성). 등록은 Supabase 에 정상 저장되며,
            언제든 <strong>CSV 다운로드</strong>로 엑셀 활용 가능합니다.
            Sheets 자동 동기화는{' '}
            <a
              href="https://dian-cfo.vercel.app/documents/contacts"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold"
            >
              production 사이트
            </a>
            에서 사용하세요.
          </p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div
          className="border border-[#e52020] bg-[#fef2f2] p-3 text-[13px] text-[#991b1b]"
          style={{ borderRadius: '2px' }}
        >
          <div className="flex items-start justify-between gap-3">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)} className="shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 신규 등록 폼 */}
      {showForm && (
        <LeadForm
          mode="create"
          onCancel={() => setShowForm(false)}
          onSubmit={async (data) => {
            await handleCreate(data)
            setShowForm(false)
          }}
          onError={setError}
        />
      )}

      {/* 검색·필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#757575]" strokeWidth={1.8} />
          <Input
            placeholder="이름·회사·전화·이메일·메모 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
          className="h-9 px-2 text-[12px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
          style={{ borderRadius: '2px' }}
        >
          <option value="all">상태 전체</option>
          {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={occuFilter}
          onChange={(e) => setOccuFilter(e.target.value)}
          className="h-9 px-2 text-[12px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
          style={{ borderRadius: '2px' }}
        >
          <option value="all">직군 전체</option>
          {OCCUPATION_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.emoji} {o.label}
            </option>
          ))}
        </select>
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="h-9 px-2 text-[12px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
          style={{ borderRadius: '2px' }}
        >
          <option value="all">제품 전체</option>
          {PRODUCT_OPTIONS.map((p) => (
            <option key={p.code} value={p.code}>
              {p.emoji} {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* 리스트 */}
      {loading ? (
        <div className="text-center py-10 text-[#757575]">불러오는 중...</div>
      ) : leads.length === 0 ? (
        <div
          className="border border-dashed border-[#cccccc] bg-white py-16 text-center"
          style={{ borderRadius: '2px' }}
        >
          <UserPlusIcon />
          <p className="text-[14px] font-bold text-[#000] mt-3 mb-1">
            {search || statusFilter !== 'all' || occuFilter !== 'all' || productFilter !== 'all'
              ? '조건에 맞는 lead 가 없습니다.'
              : '아직 등록된 lead 가 없습니다.'}
          </p>
          <p className="text-[12px] text-[#757575]">
            위 <strong>신규 등록</strong> 버튼으로 첫 lead 를 추가해보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              expanded={expandedId === lead.id}
              editing={editingId === lead.id}
              onToggle={() =>
                setExpandedId(expandedId === lead.id ? null : lead.id)
              }
              onStartEdit={() => {
                setEditingId(lead.id)
                setExpandedId(lead.id)
              }}
              onCancelEdit={() => setEditingId(null)}
              onSubmit={async (form) => {
                await handleUpdate(lead.id, form)
                setEditingId(null)
              }}
              onDelete={() => handleDelete(lead)}
              onError={setError}
            />
          ))}
        </div>
      )}

      {/* 사용 팁 */}
      <div
        className="border border-[#cccccc] bg-[#f9fafb] p-4 text-[12px] text-[#666]"
        style={{ borderRadius: '2px' }}
      >
        <p className="font-bold text-[#000] mb-1">📌 사용 팁</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            세션마다 처음 한 번 우측 상단 <strong>Google 연결</strong> 버튼을 눌러 Drive + Sheets 권한을 받으세요. 그 다음 등록부터 자동 동기화가 작동합니다.
          </li>
          <li>
            Drive 안 <code className="bg-white px-1">{LEAD_FOLDER_NAME}</code> 폴더에 <code className="bg-white px-1">{LEAD_SHEET_NAME}</code> 시트가 자동 생성됩니다.
          </li>
          <li>
            팝업이 차단되면 브라우저 주소창 우측의 차단 아이콘 → 허용. (Chrome / Edge / Safari)
          </li>
          <li>
            상태를 <strong>거래처 전환</strong>으로 바꾸면 추후 정식{' '}
            <Link href="/clients" className="underline">
              거래처 관리
            </Link>
            {' '}로 promote 할 수 있습니다.
          </li>
          <li>
            Sheets 동기화 실패 시 <strong>일괄 동기화</strong> 버튼으로 미동기화 lead 만 보충.
          </li>
        </ul>
      </div>
    </div>
  )
}

// ============================================================
// Lead 폼 데이터
// ============================================================
interface LeadFormData {
  name: string
  position: string | null
  phone: string | null
  email: string | null
  company_name: string | null
  address: string | null
  occupations: string[]
  product_interests: string[]
  inquiry_source: string | null
  inquiry_summary: string | null
  notes: string | null
  status: LeadStatus
  next_action: string | null
  next_action_date: string | null
}

const EMPTY_FORM: LeadFormData = {
  name: '',
  position: null,
  phone: null,
  email: null,
  company_name: null,
  address: null,
  occupations: [],
  product_interests: [],
  inquiry_source: null,
  inquiry_summary: null,
  notes: null,
  status: 'new',
  next_action: null,
  next_action_date: null,
}

function leadToForm(l: ContactLead): LeadFormData {
  return {
    name: l.name,
    position: l.position,
    phone: l.phone,
    email: l.email,
    company_name: l.company_name,
    address: l.address,
    occupations: l.occupations ?? [],
    product_interests: l.product_interests ?? [],
    inquiry_source: l.inquiry_source,
    inquiry_summary: l.inquiry_summary,
    notes: l.notes,
    status: l.status,
    next_action: l.next_action,
    next_action_date: l.next_action_date,
  }
}

// ============================================================
// 리스트 행
// ============================================================
function LeadRow({
  lead,
  expanded,
  editing,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSubmit,
  onDelete,
  onError,
}: {
  lead: ContactLead
  expanded: boolean
  editing: boolean
  onToggle: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSubmit: (form: LeadFormData) => Promise<void>
  onDelete: () => void
  onError: (msg: string) => void
}) {
  const statusColor = LEAD_STATUS_COLOR[lead.status]
  return (
    <div
      className="border border-[#e5e5e5] bg-white hover:border-[#000] transition-colors overflow-hidden"
      style={{ borderRadius: '2px' }}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 shrink-0 text-[#757575]" strokeWidth={2} />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0 text-[#757575]" strokeWidth={2} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[14px] font-bold tracking-tight text-[#000]">
                {lead.name}
              </span>
              {lead.position && (
                <span className="text-[11px] text-[#666]">{lead.position}</span>
              )}
              {lead.company_name && (
                <>
                  <span className="text-[#cccccc]">·</span>
                  <span className="text-[12px] text-[#000] font-bold">
                    {lead.company_name}
                  </span>
                </>
              )}
              <span
                className="px-1.5 py-0.5 text-[9px] font-bold"
                style={{
                  backgroundColor: statusColor.bg,
                  color: statusColor.text,
                  borderRadius: '2px',
                }}
              >
                {LEAD_STATUS_LABEL[lead.status]}
              </span>
              {lead.sheet_row_index && (
                <span title="Sheets 동기화됨">
                  <FileSpreadsheet className="w-3 h-3 text-[#16a34a]" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#666] flex-wrap">
              {lead.phone && (
                <span className="inline-flex items-center gap-0.5">
                  <Phone className="w-2.5 h-2.5" />
                  {formatPhone(lead.phone)}
                </span>
              )}
              {lead.email && (
                <span className="inline-flex items-center gap-0.5">
                  <Mail className="w-2.5 h-2.5" />
                  {lead.email}
                </span>
              )}
              {lead.occupations.length > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Briefcase className="w-2.5 h-2.5" />
                  {lead.occupations.map(occupationLabel).join(', ')}
                </span>
              )}
              {lead.product_interests.length > 0 && (
                <span className="text-[#76b900] font-bold">
                  {lead.product_interests.map(productLabel).join(' / ')}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-[#999] tabular-nums">
            {lead.created_at.slice(0, 10)}
          </span>
          <button
            onClick={onStartEdit}
            className="h-7 w-7 inline-flex items-center justify-center hover:bg-[#f7f7f7]"
            style={{ borderRadius: '2px' }}
            title="수정"
          >
            <Pencil className="w-3.5 h-3.5 text-[#666]" strokeWidth={2} />
          </button>
          <button
            onClick={onDelete}
            className="h-7 w-7 inline-flex items-center justify-center hover:bg-[#fef2f2] text-[#991b1b]"
            style={{ borderRadius: '2px' }}
            title="삭제"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#e5e5e5] p-4 bg-[#fafafa]">
          {editing ? (
            <LeadForm
              mode="edit"
              initial={leadToForm(lead)}
              onCancel={onCancelEdit}
              onSubmit={onSubmit}
              onError={onError}
            />
          ) : (
            <LeadDetails lead={lead} />
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 상세 보기
// ============================================================
function LeadDetails({ lead }: { lead: ContactLead }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
      {lead.address && (
        <DetailRow
          icon={<MapPin className="w-3 h-3 text-[#666]" />}
          label="주소"
          value={lead.address}
        />
      )}
      {lead.inquiry_source && (
        <DetailRow
          icon={<Sparkles className="w-3 h-3 text-[#666]" />}
          label="문의 경로"
          value={inquirySourceLabel(lead.inquiry_source)}
        />
      )}
      {lead.inquiry_summary && (
        <div className="sm:col-span-2">
          <DetailRow
            icon={<Building2 className="w-3 h-3 text-[#666]" />}
            label="문의 요지"
            value={lead.inquiry_summary}
          />
        </div>
      )}
      {lead.next_action && (
        <DetailRow
          icon={<Sparkles className="w-3 h-3 text-[#76b900]" />}
          label="다음 액션"
          value={`${lead.next_action}${lead.next_action_date ? ` (${lead.next_action_date})` : ''}`}
        />
      )}
      {lead.notes && (
        <div className="sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#666] mb-0.5">
            메모
          </p>
          <p className="text-[12px] text-[#000] whitespace-pre-wrap leading-relaxed">
            {lead.notes}
          </p>
        </div>
      )}
      {lead.sheet_synced_at && (
        <div className="sm:col-span-2 text-[10px] text-[#999]">
          ✓ Sheets 동기화: {new Date(lead.sheet_synced_at).toLocaleString('ko-KR')}
          {lead.sheet_row_index && ` (행 ${lead.sheet_row_index})`}
        </div>
      )}
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#666] mb-0.5 inline-flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-[12px] text-[#000]">{value}</p>
    </div>
  )
}

// ============================================================
// Lead 폼 (등록/수정)
// ============================================================
function LeadForm({
  mode,
  initial,
  onCancel,
  onSubmit,
  onError,
}: {
  mode: 'create' | 'edit'
  initial?: LeadFormData
  onCancel: () => void
  onSubmit: (form: LeadFormData) => Promise<void>
  onError: (msg: string) => void
}) {
  const [form, setForm] = useState<LeadFormData>(initial ?? EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const set = <K extends keyof LeadFormData>(k: K, v: LeadFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const toggleArray = (k: 'occupations' | 'product_interests', code: string) => {
    const current = form[k]
    if (current.includes(code)) {
      set(k, current.filter((c) => c !== code))
    } else {
      set(k, [...current, code])
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      onError('이름은 필수입니다.')
      return
    }
    setSaving(true)
    try {
      const cleaned = {
        ...form,
        name: form.name.trim(),
        position: form.position?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        company_name: form.company_name?.trim() || null,
        address: form.address?.trim() || null,
        inquiry_summary: form.inquiry_summary?.trim() || null,
        notes: form.notes?.trim() || null,
        next_action: form.next_action?.trim() || null,
      }
      await onSubmit(cleaned)
    } catch (e) {
      onError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="border border-[var(--nv-primary)] bg-white p-4 space-y-3"
      style={{ borderRadius: '2px' }}
    >
      <p className="text-[13px] font-bold tracking-tight text-[#000]">
        {mode === 'create' ? '새 lead 등록' : 'Lead 수정'}
      </p>

      {/* 기본 인적 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="이름 *" required>
          <Input
            ref={nameRef}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="홍길동"
          />
        </Field>
        <Field label="직책">
          <Input
            value={form.position ?? ''}
            onChange={(e) => set('position', e.target.value)}
            placeholder="대표 · 디자이너 · 매니저 등"
          />
        </Field>
        <Field label="회사명">
          <Input
            value={form.company_name ?? ''}
            onChange={(e) => set('company_name', e.target.value)}
            placeholder="ABC 인테리어"
          />
        </Field>
        <Field label="문의 경로">
          <select
            value={form.inquiry_source ?? ''}
            onChange={(e) => set('inquiry_source', e.target.value || null)}
            className="h-9 w-full px-2 text-[13px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
            style={{ borderRadius: '2px' }}
          >
            <option value="">선택 안 함</option>
            {INQUIRY_SOURCE_OPTIONS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="전화번호">
          <Input
            value={form.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="010-1234-5678"
            inputMode="tel"
          />
        </Field>
        <Field label="이메일">
          <Input
            type="email"
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            placeholder="name@company.com"
          />
        </Field>
        <Field label="주소" full>
          <Input
            value={form.address ?? ''}
            onChange={(e) => set('address', e.target.value)}
            placeholder="서울시 강남구 ..."
          />
        </Field>
      </div>

      {/* 직군 (다중) */}
      <Field label="직군 (다중 선택 가능)">
        <div className="flex flex-wrap gap-1.5">
          {OCCUPATION_OPTIONS.map((o) => {
            const active = form.occupations.includes(o.code)
            return (
              <button
                key={o.code}
                type="button"
                onClick={() => toggleArray('occupations', o.code)}
                className={cn(
                  'h-7 px-2 text-[11px] font-bold inline-flex items-center gap-1 transition-colors',
                  active
                    ? 'bg-black text-white'
                    : 'bg-white text-[#1a1a1a] border border-[#cccccc] hover:border-[#000]',
                )}
                style={{ borderRadius: '2px' }}
              >
                <span>{o.emoji}</span>
                {o.label}
              </button>
            )
          })}
        </div>
      </Field>

      {/* 관심 제품 (다중) */}
      <Field label="관심 제품 (다중 선택 가능)">
        <div className="flex flex-wrap gap-1.5">
          {PRODUCT_OPTIONS.map((p) => {
            const active = form.product_interests.includes(p.code)
            return (
              <button
                key={p.code}
                type="button"
                onClick={() => toggleArray('product_interests', p.code)}
                className={cn(
                  'h-7 px-2 text-[11px] font-bold inline-flex items-center gap-1 transition-colors',
                  active
                    ? 'bg-[#76b900] text-white'
                    : 'bg-white text-[#1a1a1a] border border-[#cccccc] hover:border-[#76b900]',
                )}
                style={{ borderRadius: '2px' }}
              >
                <span>{p.emoji}</span>
                {p.label}
              </button>
            )
          })}
        </div>
      </Field>

      {/* 문의 요지 + 메모 + 다음 액션 */}
      <Field label="문의 요지 (한 줄)">
        <Input
          value={form.inquiry_summary ?? ''}
          onChange={(e) => set('inquiry_summary', e.target.value)}
          placeholder="ex) 거실 소파 원단 가격 문의 - 5m 정도 필요"
        />
      </Field>
      <Field label="메모 (자유)">
        <textarea
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 text-[13px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900] resize-none"
          style={{ borderRadius: '2px' }}
          placeholder="대화 내용·취향·예산·일정 등"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="상태">
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value as LeadStatus)}
            className="h-9 w-full px-2 text-[13px] border border-[#cccccc] bg-white outline-none focus:border-[#76b900]"
            style={{ borderRadius: '2px' }}
          >
            {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="다음 액션">
          <Input
            value={form.next_action ?? ''}
            onChange={(e) => set('next_action', e.target.value)}
            placeholder="ex) 견적서 발송"
          />
        </Field>
        <Field label="다음 액션 날짜">
          <Input
            type="date"
            value={form.next_action_date ?? ''}
            onChange={(e) => set('next_action_date', e.target.value || null)}
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          <X className="w-3.5 h-3.5 mr-1" />
          취소
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={saving} className="gap-1.5">
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {mode === 'create' ? '등록' : '저장'}
        </Button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  required,
  full,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
  full?: boolean
}) {
  return (
    <div className={cn('space-y-1', full && 'sm:col-span-2')}>
      <label className="text-[11px] font-bold tracking-tight text-[#666]">
        {label}
        {required && <span className="text-[#ef4444] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function UserPlusIcon() {
  return (
    <svg
      className="w-10 h-10 mx-auto text-[#cccccc]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="16" y1="11" x2="22" y2="11" />
    </svg>
  )
}
