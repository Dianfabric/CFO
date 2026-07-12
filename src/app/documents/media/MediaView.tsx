'use client'

/**
 * 자료 보관함 클라이언트 — 드래그앤드롭 + 갤러리 + lightbox
 *
 * 저장소: Supabase Storage(media-library, 서명 URL 직접 업로드 — 2026-07-10 전환).
 *   구 Google Drive OAuth 업로드는 GIS 스크립트·토큰 의존으로 자주 깨져 대체.
 *   기존 Drive 파일(drive_file_id 가 'sb:' 아님)은 그대로 열람 가능.
 * 카테고리: 기본 5종(사진·영상·룩북·카탈로그·기타) + 사용자 생성 대카테고리(tags 의 'cat:이름')
 *   + 하위 카테고리(tags 의 'sub:이름') — DB 스키마 변경 없이 태그로 표현.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Upload,
  X,
  ExternalLink,
  Download,
  Trash2,
  Image as ImageIcon,
  Film,
  FileText,
  File as FileIcon,
  Loader2,
  Play,
  UploadCloud,
  FolderPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
  MEDIA_CATEGORY_LABEL,
  MEDIA_CATEGORY_ORDER,
  classifyMedia,
  guessCategory,
  formatFileSize,
  formatDuration,
  getDrivePreviewUrl,
  type MediaFile,
  type MediaFileCategory,
} from '@/lib/media-storage'
import { cn } from '@/lib/utils'

// ── 태그 기반 커스텀 카테고리 헬퍼 ──
const isSb = (f: MediaFile) => f.drive_file_id.startsWith('sb:')
const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i
/** 스캐너 파일 등 MIME 이 비어도 확장자로 이미지 판별 */
const looksImage = (f: MediaFile) =>
  classifyMedia(f.mime_type) === 'image' || IMG_EXT_RE.test(f.filename)
/** 확장자 기반 MIME 추론 — 브라우저가 type 을 못 주는 파일(스캐너 등) 대응 */
function inferMime(name: string, browserType: string): string {
  if (browserType) return browserType
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    pdf: 'application/pdf',
  }
  return map[ext] ?? 'application/octet-stream'
}
const catTag = (f: MediaFile) => f.tags?.find((t) => t.startsWith('cat:'))?.slice(4) ?? null
const subTag = (f: MediaFile) => f.tags?.find((t) => t.startsWith('sub:'))?.slice(4) ?? null
/** 파일의 표시 카테고리 키 — 커스텀이면 'cat:이름', 아니면 기본 enum */
const effCat = (f: MediaFile): string => (catTag(f) ? `cat:${catTag(f)}` : f.category)
const catLabel = (key: string): string =>
  key.startsWith('cat:') ? key.slice(4) : (MEDIA_CATEGORY_LABEL[key as MediaFileCategory] ?? key)

export default function MediaView() {
  // 상태
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all') // 'all' | enum | 'cat:이름'
  const [subFilter, setSubFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [preview, setPreview] = useState<MediaFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // 업로드 대상 선택 — 'auto' 면 파일 종류로 자동 분류
  const [upCat, setUpCat] = useState<string>('auto')
  const [upSub, setUpSub] = useState<string>('')
  // 아직 파일이 없는 새 카테고리도 목록에 보이도록 로컬 보관
  const [extraCats, setExtraCats] = useState<string[]>([])
  const [extraSubs, setExtraSubs] = useState<Record<string, string[]>>({})
  const dragCounter = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─────────────────────────────────────────────
  // 목록 fetch — 카테고리 필터는 클라이언트에서 (커스텀 카테고리 지원)
  // ─────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/documents/media?${params}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const json = await res.json()
      setFiles(json.files ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // 커스텀 대카테고리 목록 (데이터 + 방금 생성한 것)
  const customCats = useMemo(() => {
    const set = new Set(extraCats)
    for (const f of files) {
      const c = catTag(f)
      if (c) set.add(c)
    }
    return [...set].sort()
  }, [files, extraCats])

  // 카테고리별 하위 카테고리 목록
  const subsFor = useCallback(
    (catKey: string): string[] => {
      const set = new Set(extraSubs[catKey] ?? [])
      for (const f of files) {
        if (effCat(f) !== catKey) continue
        const s = subTag(f)
        if (s) set.add(s)
      }
      return [...set].sort()
    },
    [files, extraSubs],
  )

  // 카테고리별 개수 (표시 카테고리 기준)
  const countsByCategory = useMemo(() => {
    const map: Record<string, number> = { all: files.length }
    for (const f of files) {
      const k = effCat(f)
      map[k] = (map[k] ?? 0) + 1
    }
    return map
  }, [files])

  // 화면에 보여줄 파일 (카테고리·하위 필터)
  const visibleFiles = useMemo(() => {
    let list = files
    if (category !== 'all') list = list.filter((f) => effCat(f) === category)
    if (subFilter !== 'all') list = list.filter((f) => subTag(f) === subFilter)
    return list
  }, [files, category, subFilter])

  const currentSubs = category === 'all' ? [] : subsFor(category)

  // ─────────────────────────────────────────────
  // 새 카테고리 / 하위 카테고리 생성
  // ─────────────────────────────────────────────
  const createCategory = () => {
    const name = prompt('새 대카테고리 이름 (예: 중요 문서)')?.trim()
    if (!name) return null
    const key = `cat:${name}`
    setExtraCats((prev) => (prev.includes(name) ? prev : [...prev, name]))
    return key
  }
  const createSub = (catKey: string) => {
    const name = prompt('새 하위 카테고리 이름 (예: 전시회, 로고파일)')?.trim()
    if (!name) return null
    setExtraSubs((prev) => ({
      ...prev,
      [catKey]: [...new Set([...(prev[catKey] ?? []), name])],
    }))
    return name
  }

  // ─────────────────────────────────────────────
  // 업로드 코어 — Supabase Storage 서명 URL 직접 업로드
  // ─────────────────────────────────────────────
  const uploadFiles = useCallback(
    async (fileList: File[]) => {
      if (fileList.length === 0) return
      setError(null)
      setUploading(true)

      try {
        const supabase = createSupabaseClient()
        if (!supabase) throw new Error('Supabase 환경변수 미설정 — 업로드 불가')

        for (let i = 0; i < fileList.length; i++) {
          const f = fileList[i]
          if (f.size > 50 * 1024 * 1024) {
            throw new Error(`${f.name}: 파일당 50MB 까지 업로드할 수 있습니다.`)
          }
          // 카테고리 결정 — 선택값 우선, '자동'이면 MIME 추론
          const chosen = upCat === 'auto' ? guessCategory(f.type) : upCat
          const baseCat: MediaFileCategory = chosen.startsWith('cat:')
            ? 'other'
            : (chosen as MediaFileCategory)
          const tags: string[] = []
          if (chosen.startsWith('cat:')) tags.push(chosen)
          if (upSub) tags.push(`sub:${upSub}`)

          setUploadProgress(`[${i + 1}/${fileList.length}] ${f.name} 업로드 중...`)
          const sign = await fetch(
            `/api/documents/media/upload-url?name=${encodeURIComponent(f.name)}`,
          )
          const signJson = await sign.json()
          if (!sign.ok) throw new Error(signJson.error ?? '업로드 URL 발급 실패')

          const { error: upErr } = await supabase.storage
            .from('media-library')
            .uploadToSignedUrl(signJson.path as string, signJson.token as string, f)
          if (upErr) throw new Error(`업로드 실패: ${upErr.message}`)

          // 이미지/영상 메타 (가능한 경우 클라이언트에서 추출)
          let extraMeta: { width_px?: number; height_px?: number; duration_seconds?: number } = {}
          try {
            extraMeta = await extractMediaMeta(f)
          } catch {
            /* ignore */
          }

          setUploadProgress(`[${i + 1}/${fileList.length}] 메타데이터 저장 중...`)
          const mime = inferMime(f.name, f.type)
          const isImage = mime.startsWith('image/')
          const metaRes = await fetch('/api/documents/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              drive_file_id: `sb:${signJson.path}`,
              drive_view_url: signJson.publicUrl,
              drive_download_url: signJson.publicUrl,
              drive_thumbnail_url: isImage ? signJson.publicUrl : null,
              filename: f.name,
              mime_type: mime,
              size_bytes: f.size,
              ...extraMeta,
              category: baseCat,
              tags,
            }),
          })
          if (!metaRes.ok) {
            const err = await metaRes.json().catch(() => null)
            throw new Error(err?.error ?? `메타데이터 저장 실패: ${metaRes.status}`)
          }
        }

        setUploadProgress(null)
        await fetchFiles()
      } catch (e) {
        setError(e instanceof Error ? e.message : '업로드 실패')
      } finally {
        setUploading(false)
        setUploadProgress(null)
      }
    },
    [upCat, upSub, fetchFiles],
  )

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list) return
    await uploadFiles(Array.from(list))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─────────────────────────────────────────────
  // 드래그앤드롭 (window 전역 + dropzone)
  // ─────────────────────────────────────────────
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      dragCounter.current++
      setIsDragging(true)
    }
    const onDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      dragCounter.current--
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setIsDragging(false)
      }
    }
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault()
      }
    }
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      e.preventDefault()
      dragCounter.current = 0
      setIsDragging(false)
      const dropped = Array.from(e.dataTransfer.files ?? [])
      if (dropped.length > 0) uploadFiles(dropped)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [uploadFiles])

  // ─────────────────────────────────────────────
  // 삭제 — Supabase 파일은 스토리지까지 서버가 삭제, 구 Drive 파일은 메타만
  // ─────────────────────────────────────────────
  const handleDelete = async (file: MediaFile) => {
    const msg = isSb(file)
      ? `"${file.filename}" 을 삭제할까요? (스토리지에서 함께 삭제됩니다)`
      : `"${file.filename}" 을 목록에서 삭제할까요?\n(Drive 원본은 Drive 휴지통에서 별도 관리)`
    if (!confirm(msg)) return
    try {
      await fetch(`/api/documents/media/${file.id}`, { method: 'DELETE' })
      await fetchFiles()
      if (preview?.id === file.id) setPreview(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  // ─────────────────────────────────────────────
  // 카테고리 이동 (기본 enum ↔ 커스텀 'cat:이름')
  // ─────────────────────────────────────────────
  const handleCategoryChange = async (file: MediaFile, newKey: string) => {
    if (newKey === effCat(file)) return
    try {
      const baseTags = (file.tags ?? []).filter((t) => !t.startsWith('cat:'))
      const patch = newKey.startsWith('cat:')
        ? { category: 'other', tags: [newKey, ...baseTags] }
        : { category: newKey, tags: baseTags }
      const res = await fetch(`/api/documents/media/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      await fetchFiles()
    } catch (e) {
      setError(e instanceof Error ? e.message : '카테고리 변경 실패')
    }
  }

  const allCatKeys: string[] = [...MEDIA_CATEGORY_ORDER, ...customCats.map((c) => `cat:${c}`)]

  return (
    <div className="space-y-5 relative">
      {/* 전역 드래그 오버레이 */}
      {isDragging && (
        <div
          className="fixed inset-0 z-40 bg-[#76b900]/10 backdrop-blur-sm pointer-events-none flex items-center justify-center"
          style={{ border: '4px dashed var(--nv-primary)' }}
        >
          <div className="bg-white border-2 border-[var(--nv-primary)] px-8 py-6 text-center" style={{ borderRadius: '2px' }}>
            <UploadCloud className="w-12 h-12 mx-auto text-[var(--nv-primary)] mb-2" strokeWidth={1.5} />
            <p className="text-[18px] font-bold tracking-tight text-[#000]">파일을 여기에 놓으세요</p>
            <p className="text-[12px] text-[#757575] mt-1">아래에서 고른 카테고리로 저장됩니다</p>
          </div>
        </div>
      )}

      {/* 검색 + 업로드 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#757575]" strokeWidth={1.8} />
          <Input
            placeholder="파일명 또는 태그로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <Button onClick={handleUploadClick} disabled={uploading} className="gap-2">
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              업로드 중
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              자료 업로드
            </>
          )}
        </Button>
      </div>

      {/* 업로드 대상 카테고리 선택 — 새 대/하위 카테고리 생성 가능 */}
      <div
        className="flex flex-wrap items-center gap-2 border border-[#e5e5e5] bg-white px-3 py-2"
        style={{ borderRadius: '2px' }}
      >
        <FolderPlus className="w-4 h-4 text-[#76b900]" strokeWidth={2} />
        <span className="text-[11px] font-bold text-[#757575]">업로드 위치</span>
        <select
          value={upCat}
          onChange={(e) => {
            const v = e.target.value
            if (v === '__new__') {
              const key = createCategory()
              if (key) {
                setUpCat(key)
                setUpSub('')
              }
              return
            }
            setUpCat(v)
            setUpSub('')
          }}
          className="h-8 text-[12px] font-bold border border-[#cccccc] bg-white px-2 outline-none focus:border-[#76b900]"
          style={{ borderRadius: '2px' }}
        >
          <option value="auto">자동 분류 (파일 종류대로)</option>
          {MEDIA_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>{MEDIA_CATEGORY_LABEL[c]}</option>
          ))}
          {customCats.map((c) => (
            <option key={c} value={`cat:${c}`}>{c}</option>
          ))}
          <option value="__new__">＋ 새 대카테고리 만들기…</option>
        </select>
        {upCat !== 'auto' && (
          <>
            <span className="text-[11px] text-[#cccccc]">›</span>
            <select
              value={upSub}
              onChange={(e) => {
                const v = e.target.value
                if (v === '__new__') {
                  const name = createSub(upCat)
                  if (name) setUpSub(name)
                  return
                }
                setUpSub(v)
              }}
              className="h-8 text-[12px] font-bold border border-[#cccccc] bg-white px-2 outline-none focus:border-[#76b900]"
              style={{ borderRadius: '2px' }}
            >
              <option value="">하위 카테고리 없음</option>
              {subsFor(upCat).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="__new__">＋ 새 하위 카테고리 만들기…</option>
            </select>
          </>
        )}
        <span className="text-[10px] text-[#999]">
          예: 사진 › 전시회, 중요 문서 › 로고파일 — 나중에 찾기 쉬워집니다
        </span>
      </div>

      {/* 카테고리 필터 칩 */}
      <div className="flex flex-wrap gap-2">
        <CategoryChip
          active={category === 'all'}
          onClick={() => { setCategory('all'); setSubFilter('all') }}
          label="전체"
          count={countsByCategory.all}
        />
        {allCatKeys.map((c) => (
          <CategoryChip
            key={c}
            active={category === c}
            onClick={() => { setCategory(c); setSubFilter('all') }}
            label={catLabel(c)}
            count={countsByCategory[c] ?? 0}
          />
        ))}
      </div>

      {/* 하위 카테고리 칩 — 대카테고리 선택 시 */}
      {category !== 'all' && currentSubs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] font-bold text-[#999] uppercase tracking-wider">하위</span>
          <CategoryChip
            active={subFilter === 'all'}
            onClick={() => setSubFilter('all')}
            label="전체"
            count={visibleFiles.length && subFilter === 'all' ? countsByCategory[category] ?? 0 : countsByCategory[category] ?? 0}
          />
          {currentSubs.map((s) => (
            <CategoryChip
              key={s}
              active={subFilter === s}
              onClick={() => setSubFilter(s)}
              label={s}
              count={files.filter((f) => effCat(f) === category && subTag(f) === s).length}
            />
          ))}
        </div>
      )}

      {/* 에러·상태 안내 */}
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
      {uploadProgress && (
        <div
          className="border border-[#76b900] bg-[#f7fee7] p-3 text-[13px] text-[#365314]"
          style={{ borderRadius: '2px' }}
        >
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {uploadProgress}
          </span>
        </div>
      )}

      {/* 드롭존 + 결과 */}
      {loading ? (
        <div className="text-center py-10 text-[#757575]">불러오는 중...</div>
      ) : visibleFiles.length === 0 ? (
        <Dropzone
          hasFilter={search.trim() !== '' || category !== 'all'}
          onClearFilter={() => {
            setSearch('')
            setCategory('all')
            setSubFilter('all')
          }}
          onPickFiles={handleUploadClick}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {visibleFiles.map((f) => (
            <MediaCard
              key={f.id}
              file={f}
              allCatKeys={allCatKeys}
              onPreview={() => setPreview(f)}
              onDelete={() => handleDelete(f)}
              onCategoryChange={(c) => handleCategoryChange(f, c)}
            />
          ))}
        </div>
      )}

      {/* 미리보기 모달 */}
      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

// ============================================================
// 카테고리 칩
// ============================================================
function CategoryChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-8 px-3 text-[12px] font-bold transition-colors flex items-center gap-1.5',
        active
          ? 'bg-black text-white'
          : 'bg-white text-[#1a1a1a] border border-[#cccccc] hover:border-[#000]',
      )}
      style={{ borderRadius: '2px' }}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            'text-[10px] px-1 rounded',
            active ? 'bg-white/20' : 'bg-[#f7f7f7]',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ============================================================
// 미디어 카드 (갤러리 셀)
// ============================================================
function MediaCard({
  file,
  allCatKeys,
  onPreview,
  onDelete,
  onCategoryChange,
}: {
  file: MediaFile
  allCatKeys: string[]
  onPreview: () => void
  onDelete: () => void
  onCategoryChange: (c: string) => void
}) {
  const cls = classifyMedia(file.mime_type)
  const FallbackIcon =
    cls === 'image' ? ImageIcon : cls === 'video' ? Film : cls === 'pdf' ? FileText : FileIcon
  const sub = subTag(file)
  // 썸네일: 저장된 URL → 없으면 Supabase 이미지 파일은 공개 URL 로 직접 (MIME 누락 구제)
  const thumbSrc =
    file.drive_thumbnail_url ??
    (isSb(file) && looksImage(file) ? file.drive_view_url : null)

  return (
    <div
      className="group relative bg-white border border-[#e5e5e5] hover:border-[#000] hover:shadow-md transition-all overflow-hidden flex flex-col"
      style={{ borderRadius: '2px' }}
    >
      {/* 썸네일 (정사각형) */}
      <button
        onClick={onPreview}
        className="relative aspect-square w-full bg-[#f7f7f7] overflow-hidden flex items-center justify-center"
      >
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt={file.filename}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <FallbackIcon className="w-10 h-10 text-[#cccccc]" strokeWidth={1.5} />
        )}

        {/* 영상 표시 (재생 버튼) */}
        {cls === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
              <Play className="w-5 h-5 text-black ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}

        {/* 듀레이션 배지 (영상) */}
        {cls === 'video' && file.duration_seconds && (
          <span
            className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-mono"
            style={{ borderRadius: '2px' }}
          >
            {formatDuration(file.duration_seconds)}
          </span>
        )}

        {/* 카테고리 라벨 (좌상단) — 커스텀·하위 포함 */}
        <span
          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-white/90 text-[9px] font-bold tracking-tight text-[#000]"
          style={{ borderRadius: '2px' }}
        >
          {catLabel(effCat(file))}
          {sub && <span className="text-[#76b900]"> › {sub}</span>}
        </span>
      </button>

      {/* 정보 + 액션 */}
      <div className="p-2 flex flex-col gap-1.5">
        <button
          onClick={onPreview}
          className="text-left"
          title={file.filename}
        >
          <p className="text-[11px] font-bold tracking-tight text-[#000] line-clamp-1 leading-tight">
            {file.filename}
          </p>
          <p className="text-[10px] text-[#757575] mt-0.5">
            {formatFileSize(file.size_bytes)}
            {file.width_px && file.height_px && ` · ${file.width_px}×${file.height_px}`}
          </p>
        </button>

        <div className="flex items-center gap-1">
          <select
            value={effCat(file)}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="flex-1 text-[10px] font-bold border border-[#cccccc] bg-white px-1 py-0.5 outline-none focus:border-[#76b900]"
            style={{ borderRadius: '2px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {allCatKeys.map((c) => (
              <option key={c} value={c}>
                {catLabel(c)}
              </option>
            ))}
          </select>
          <button
            onClick={onDelete}
            className="h-6 w-6 inline-flex items-center justify-center bg-[#fef2f2] hover:bg-[#fee2e2] text-[#991b1b] transition-colors"
            style={{ borderRadius: '2px' }}
            title="삭제"
          >
            <Trash2 className="w-3 h-3" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 드롭존 (빈 상태일 때 큰 드롭 영역 표시)
// ============================================================
function Dropzone({
  hasFilter,
  onClearFilter,
  onPickFiles,
}: {
  hasFilter: boolean
  onClearFilter: () => void
  onPickFiles: () => void
}) {
  return (
    <div
      className="border-2 border-dashed border-[#cccccc] bg-white py-20 text-center hover:border-[var(--nv-primary)] transition-colors"
      style={{ borderRadius: '2px' }}
    >
      <UploadCloud className="w-14 h-14 mx-auto text-[#cccccc] mb-4" strokeWidth={1.3} />
      {hasFilter ? (
        <>
          <p className="text-[14px] font-bold text-[#000] mb-1">이 카테고리에 자료가 없습니다.</p>
          <p className="text-[12px] text-[#757575] mb-4">
            바로 업로드하면 지금 선택된 카테고리로 저장됩니다.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={onPickFiles} size="sm" className="gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              여기에 업로드
            </Button>
            <Button variant="outline" size="sm" onClick={onClearFilter}>
              필터 초기화
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[16px] font-bold tracking-tight text-[#000] mb-1">
            여기로 드래그하거나 클릭해서 업로드
          </p>
          <p className="text-[12px] text-[#757575] mb-5">
            사진·영상·룩북·PDF — 파일당 50MB, 위에서 카테고리를 고르면 그대로 분류됩니다
          </p>
          <Button onClick={onPickFiles} className="gap-2">
            <Upload className="w-4 h-4" />
            파일 선택
          </Button>
        </>
      )}
    </div>
  )
}

// ============================================================
// 미리보기 모달 (lightbox 이미지 / 비디오 플레이어)
// ============================================================
function PreviewModal({
  file,
  onClose,
}: {
  file: MediaFile
  onClose: () => void
}) {
  const cls = classifyMedia(file.mime_type)
  const sb = isSb(file)
  const url = file.drive_view_url ?? ''
  const sub = subTag(file)
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl max-h-[92vh] flex flex-col"
        style={{ borderRadius: '2px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-[#cccccc]">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold tracking-tight text-[#000] truncate">
              {file.filename}
            </p>
            <p className="text-[11px] text-[#757575] mt-0.5 flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                {catLabel(effCat(file))}
                {sub ? ` › ${sub}` : ''}
              </Badge>
              <span>{formatFileSize(file.size_bytes)}</span>
              {file.width_px && file.height_px && (
                <span>
                  {file.width_px}×{file.height_px}
                </span>
              )}
              {file.duration_seconds && <span>{formatDuration(file.duration_seconds)}</span>}
              <span>{file.mime_type}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {file.drive_download_url && (
              <a
                href={file.drive_download_url}
                download={sb ? file.filename : undefined}
                className="h-8 px-3 text-[12px] font-bold inline-flex items-center justify-center gap-1 bg-[#f7f7f7] hover:bg-[#eeeeee]"
                style={{ borderRadius: '2px' }}
                title="다운로드"
              >
                <Download className="w-3.5 h-3.5" strokeWidth={2} />
                다운로드
              </a>
            )}
            {!sb && file.drive_view_url && (
              <a
                href={file.drive_view_url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 text-[12px] font-bold inline-flex items-center justify-center gap-1 bg-[#f7f7f7] hover:bg-[#eeeeee]"
                style={{ borderRadius: '2px' }}
              >
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                Drive
              </a>
            )}
            <button
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center hover:bg-[#f7f7f7]"
              style={{ borderRadius: '2px' }}
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* 본문 — Supabase 파일은 공개 URL 직접 렌더, 구 Drive 파일은 기존 방식 */}
        <div className="flex-1 overflow-auto bg-black flex items-center justify-center min-h-[400px]">
          {cls === 'image' || (sb && looksImage(file)) ? (
            sb || file.drive_thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sb ? url : file.drive_thumbnail_url!.replace(/=s\d+/, '=s2000')}
                alt={file.filename}
                className="max-w-full max-h-[78vh] object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <iframe
                src={getDrivePreviewUrl(file.drive_file_id)}
                className="w-full h-[78vh] border-0"
                title={file.filename}
              />
            )
          ) : cls === 'video' ? (
            sb ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={url} controls className="max-w-full max-h-[78vh]" />
            ) : (
              <iframe
                src={getDrivePreviewUrl(file.drive_file_id)}
                className="w-full h-[78vh] border-0 bg-black"
                title={file.filename}
                allow="autoplay"
                allowFullScreen
              />
            )
          ) : sb ? (
            <iframe src={url} className="w-full h-[78vh] border-0 bg-white" title={file.filename} />
          ) : (
            <iframe
              src={getDrivePreviewUrl(file.drive_file_id)}
              className="w-full h-[78vh] border-0 bg-white"
              title={file.filename}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 클라이언트 측 미디어 메타 추출 (가능한 한)
// ============================================================
async function extractMediaMeta(
  file: File,
): Promise<{ width_px?: number; height_px?: number; duration_seconds?: number }> {
  if (file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width_px: img.naturalWidth, height_px: img.naturalHeight })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({})
      }
      img.src = url
    })
  }
  if (file.type.startsWith('video/')) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve({
          width_px: video.videoWidth,
          height_px: video.videoHeight,
          duration_seconds: Number(video.duration.toFixed(2)),
        })
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({})
      }
      video.src = url
    })
  }
  return {}
}
