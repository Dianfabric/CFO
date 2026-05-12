'use client'

/**
 * 서류 보관함 클라이언트 — 검색·필터·업로드·미리보기 통합
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Upload,
  X,
  ExternalLink,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useGoogleDrive } from '@/hooks/useGoogleDrive'
import {
  getOrCreateFolder,
  uploadToDriveWithDetails,
  deleteFromDrive,
} from '@/lib/google-drive'
import {
  DOCUMENT_CATEGORY_LABEL,
  DOCUMENT_CATEGORY_FOLDER_NAME,
  DOCUMENT_CATEGORY_ORDER,
  DOCUMENT_STORAGE_ROOT_NAME,
  classifyMime,
  formatFileSize,
  getDrivePreviewUrl,
  type DocumentFile,
  type DocumentFileCategory,
} from '@/lib/document-storage'
import { cn } from '@/lib/utils'

const ROOT_FOLDER_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID ?? ''

export default function StorageView() {
  const { getToken } = useGoogleDrive()

  // 상태
  const [files, setFiles] = useState<DocumentFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<DocumentFileCategory | 'all'>('all')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [preview, setPreview] = useState<DocumentFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─────────────────────────────────────────────
  // 목록 fetch
  // ─────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (category !== 'all') params.set('category', category)
      const res = await fetch(`/api/documents/storage?${params}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const json = await res.json()
      setFiles(json.files ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [search, category])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // ─────────────────────────────────────────────
  // 카테고리별 개수 (필터 칩)
  // ─────────────────────────────────────────────
  const countsByCategory = useMemo(() => {
    const map: Record<string, number> = { all: files.length }
    for (const f of files) {
      map[f.category] = (map[f.category] ?? 0) + 1
    }
    return map
  }, [files])

  // ─────────────────────────────────────────────
  // 업로드
  // ─────────────────────────────────────────────
  const handleUploadClick = () => {
    if (!ROOT_FOLDER_ID) {
      setError(
        '환경변수 NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID 가 설정되지 않았습니다.',
      )
      return
    }
    fileInputRef.current?.click()
  }

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    if (!ROOT_FOLDER_ID) return

    setError(null)
    setUploading(true)

    // 업로드 시 카테고리 — 현재 필터 카테고리 우선, 'all' 이면 'other'
    const targetCategory: DocumentFileCategory =
      category === 'all' ? 'other' : category

    try {
      const token = await getToken()

      // 1. "디안 서류함" 부모 폴더
      setUploadProgress('디안 서류함 폴더 확인 중...')
      const storageRootId = await getOrCreateFolder(
        DOCUMENT_STORAGE_ROOT_NAME,
        ROOT_FOLDER_ID,
        token,
      )

      // 2. 카테고리 sub-folder
      const folderName = DOCUMENT_CATEGORY_FOLDER_NAME[targetCategory]
      setUploadProgress(`${folderName} 폴더 확인 중...`)
      const categoryFolderId = await getOrCreateFolder(
        folderName,
        storageRootId,
        token,
      )

      // 3. 각 파일 업로드 → Drive + Supabase
      const filesArr = Array.from(fileList)
      for (let i = 0; i < filesArr.length; i++) {
        const f = filesArr[i]
        setUploadProgress(
          `[${i + 1}/${filesArr.length}] ${f.name} Drive 업로드 중...`,
        )
        const details = await uploadToDriveWithDetails(
          f,
          f.name,
          f.type || 'application/octet-stream',
          categoryFolderId,
          token,
        )

        setUploadProgress(`[${i + 1}/${filesArr.length}] 메타데이터 저장 중...`)
        const metaRes = await fetch('/api/documents/storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drive_file_id: details.id,
            drive_folder_id: categoryFolderId,
            drive_view_url: details.webViewLink,
            drive_download_url: details.webContentLink,
            drive_thumbnail_url: details.thumbnailLink,
            filename: details.name,
            mime_type: details.mimeType,
            size_bytes: details.size,
            category: targetCategory,
            tags: [],
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
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─────────────────────────────────────────────
  // 삭제
  // ─────────────────────────────────────────────
  const handleDelete = async (file: DocumentFile) => {
    if (!confirm(`"${file.filename}" 을 휴지통으로 보낼까요?\n(Drive 휴지통에서 복구 가능)`)) return
    try {
      const token = await getToken()
      await deleteFromDrive(file.drive_file_id, token, true)
      await fetch(`/api/documents/storage/${file.id}`, { method: 'DELETE' })
      await fetchFiles()
      if (preview?.id === file.id) setPreview(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  // ─────────────────────────────────────────────
  // 카테고리 변경 (수정)
  // ─────────────────────────────────────────────
  const handleCategoryChange = async (file: DocumentFile, newCat: DocumentFileCategory) => {
    if (newCat === file.category) return
    try {
      const res = await fetch(`/api/documents/storage/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCat }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      await fetchFiles()
    } catch (e) {
      setError(e instanceof Error ? e.message : '카테고리 변경 실패')
    }
  }

  return (
    <div className="space-y-5">
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
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          onClick={handleUploadClick}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              업로드 중
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              서류 업로드
            </>
          )}
        </Button>
      </div>

      {/* 카테고리 필터 칩 */}
      <div className="flex flex-wrap gap-2">
        <CategoryChip
          active={category === 'all'}
          onClick={() => setCategory('all')}
          label="전체"
          count={countsByCategory.all}
        />
        {DOCUMENT_CATEGORY_ORDER.map((c) => (
          <CategoryChip
            key={c}
            active={category === c}
            onClick={() => setCategory(c)}
            label={DOCUMENT_CATEGORY_LABEL[c]}
            count={countsByCategory[c] ?? 0}
          />
        ))}
      </div>

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

      {/* 결과 */}
      {loading ? (
        <div className="text-center py-10 text-[#757575]">불러오는 중...</div>
      ) : files.length === 0 ? (
        <EmptyState
          hasFilter={search.trim() !== '' || category !== 'all'}
          onClearFilter={() => {
            setSearch('')
            setCategory('all')
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {files.map((f) => (
            <FileCard
              key={f.id}
              file={f}
              onPreview={() => setPreview(f)}
              onDelete={() => handleDelete(f)}
              onCategoryChange={(c) => handleCategoryChange(f, c)}
            />
          ))}
        </div>
      )}

      {/* 미리보기 모달 */}
      {preview && (
        <PreviewModal file={preview} onClose={() => setPreview(null)} />
      )}
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
// 파일 카드
// ============================================================
function FileCard({
  file,
  onPreview,
  onDelete,
  onCategoryChange,
}: {
  file: DocumentFile
  onPreview: () => void
  onDelete: () => void
  onCategoryChange: (c: DocumentFileCategory) => void
}) {
  const cls = classifyMime(file.mime_type)
  const Icon = cls === 'image' ? ImageIcon : cls === 'pdf' ? FileText : FileIcon

  return (
    <div
      className="relative border border-[#cccccc] bg-white p-3 hover:shadow-md transition-shadow"
      style={{ borderRadius: '2px' }}
    >
      {/* 썸네일 영역 */}
      <button
        onClick={onPreview}
        className="block w-full h-32 mb-3 bg-[#f7f7f7] flex items-center justify-center overflow-hidden"
        style={{ borderRadius: '2px' }}
      >
        {file.drive_thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.drive_thumbnail_url}
            alt={file.filename}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <Icon className="w-10 h-10 text-[#757575]" strokeWidth={1.5} />
        )}
      </button>

      {/* 파일명 */}
      <button
        onClick={onPreview}
        className="block text-left w-full mb-2"
        title={file.filename}
      >
        <p className="text-[13px] font-bold tracking-tight text-[#000] line-clamp-2 leading-snug">
          {file.filename}
        </p>
      </button>

      {/* 카테고리 선택 + 사이즈 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <select
          value={file.category}
          onChange={(e) => onCategoryChange(e.target.value as DocumentFileCategory)}
          className="text-[10px] font-bold border border-[#cccccc] bg-white px-1.5 py-0.5 outline-none focus:border-[#76b900]"
          style={{ borderRadius: '2px' }}
        >
          {DOCUMENT_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {DOCUMENT_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-[#757575]">
          {formatFileSize(file.size_bytes)}
        </span>
      </div>

      {/* 액션 */}
      <div className="flex items-center gap-1">
        {file.drive_view_url && (
          <a
            href={file.drive_view_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-7 px-2 text-[11px] font-bold inline-flex items-center justify-center gap-1 bg-[#f7f7f7] hover:bg-[#eeeeee] transition-colors"
            style={{ borderRadius: '2px' }}
            title="Drive 에서 열기"
          >
            <ExternalLink className="w-3 h-3" strokeWidth={2} />
            열기
          </a>
        )}
        {file.drive_download_url && (
          <a
            href={file.drive_download_url}
            className="h-7 w-7 inline-flex items-center justify-center bg-[#f7f7f7] hover:bg-[#eeeeee] transition-colors"
            style={{ borderRadius: '2px' }}
            title="다운로드"
          >
            <Download className="w-3 h-3" strokeWidth={2} />
          </a>
        )}
        <button
          onClick={onDelete}
          className="h-7 w-7 inline-flex items-center justify-center bg-[#fef2f2] hover:bg-[#fee2e2] text-[#991b1b] transition-colors"
          style={{ borderRadius: '2px' }}
          title="휴지통으로"
        >
          <Trash2 className="w-3 h-3" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

// ============================================================
// 빈 상태
// ============================================================
function EmptyState({
  hasFilter,
  onClearFilter,
}: {
  hasFilter: boolean
  onClearFilter: () => void
}) {
  return (
    <div
      className="border border-dashed border-[#cccccc] bg-white py-16 text-center"
      style={{ borderRadius: '2px' }}
    >
      <FolderArchive className="w-10 h-10 mx-auto text-[#cccccc] mb-3" strokeWidth={1.5} />
      {hasFilter ? (
        <>
          <p className="text-[14px] font-bold text-[#000] mb-1">
            검색 결과가 없습니다.
          </p>
          <p className="text-[12px] text-[#757575] mb-4">
            다른 검색어를 시도하거나 필터를 해제해보세요.
          </p>
          <Button variant="outline" size="sm" onClick={onClearFilter}>
            필터 초기화
          </Button>
        </>
      ) : (
        <>
          <p className="text-[14px] font-bold text-[#000] mb-1">
            보관함이 비어있습니다.
          </p>
          <p className="text-[12px] text-[#757575]">
            우측 상단 <strong>서류 업로드</strong> 버튼으로 첫 서류를 추가해보세요.
          </p>
        </>
      )}
    </div>
  )
}

// ============================================================
// 미리보기 모달
// ============================================================
function PreviewModal({
  file,
  onClose,
}: {
  file: DocumentFile
  onClose: () => void
}) {
  const cls = classifyMime(file.mime_type)
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col"
        style={{ borderRadius: '2px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-[#cccccc]">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold tracking-tight text-[#000] truncate">
              {file.filename}
            </p>
            <p className="text-[11px] text-[#757575] mt-0.5">
              <Badge variant="secondary">{DOCUMENT_CATEGORY_LABEL[file.category]}</Badge>
              <span className="ml-2">{formatFileSize(file.size_bytes)}</span>
              <span className="ml-2">{file.mime_type}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {file.drive_view_url && (
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

        {/* 본문 */}
        <div className="flex-1 overflow-auto bg-[#f7f7f7]">
          {cls === 'image' && file.drive_view_url ? (
            // 이미지: thumbnailLink 가 있으면 인라인, 없으면 Drive 임베드
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                file.drive_thumbnail_url
                  ? file.drive_thumbnail_url.replace(/=s\d+/, '=s2000')
                  : getDrivePreviewUrl(file.drive_file_id)
              }
              alt={file.filename}
              className="w-full h-auto"
              referrerPolicy="no-referrer"
            />
          ) : (
            // PDF / Office / 기타 — Drive 임베드 iframe
            <iframe
              src={getDrivePreviewUrl(file.drive_file_id)}
              className="w-full h-[70vh] border-0"
              title={file.filename}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// FolderArchive — 빈 상태 아이콘
function FolderArchive(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.strokeWidth ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 20h2a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 5.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h2" />
      <circle cx="12" cy="14" r="4" />
      <path d="M12 12v2l1 1" />
    </svg>
  )
}
