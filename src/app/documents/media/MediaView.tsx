'use client'

/**
 * 자료 보관함 클라이언트 — 드래그앤드롭 + 갤러리 + lightbox
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
  MEDIA_CATEGORY_LABEL,
  MEDIA_CATEGORY_FOLDER_NAME,
  MEDIA_CATEGORY_ORDER,
  MEDIA_STORAGE_ROOT_NAME,
  classifyMedia,
  guessCategory,
  formatFileSize,
  formatDuration,
  getDrivePreviewUrl,
  type MediaFile,
  type MediaFileCategory,
} from '@/lib/media-storage'
import { cn } from '@/lib/utils'

const ROOT_FOLDER_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID ?? ''

export default function MediaView() {
  const { getToken } = useGoogleDrive()

  // 상태
  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<MediaFileCategory | 'all'>('all')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [preview, setPreview] = useState<MediaFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)
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
      const res = await fetch(`/api/documents/media?${params}`)
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

  // 카테고리별 개수
  const countsByCategory = useMemo(() => {
    const map: Record<string, number> = { all: files.length }
    for (const f of files) map[f.category] = (map[f.category] ?? 0) + 1
    return map
  }, [files])

  // ─────────────────────────────────────────────
  // 업로드 코어
  // ─────────────────────────────────────────────
  const uploadFiles = useCallback(
    async (fileList: File[]) => {
      if (fileList.length === 0) return
      if (!ROOT_FOLDER_ID) {
        setError(
          '환경변수 NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID 가 설정되지 않았습니다.',
        )
        return
      }

      setError(null)
      setUploading(true)

      try {
        const token = await getToken()

        // 1. "디안 자료함" 부모 폴더
        setUploadProgress('디안 자료함 폴더 확인 중...')
        const storageRootId = await getOrCreateFolder(
          MEDIA_STORAGE_ROOT_NAME,
          ROOT_FOLDER_ID,
          token,
        )

        // 2. 카테고리별 folder 캐시 (반복 업로드 시 1회만)
        const folderCache: Record<string, string> = {}
        const getFolder = async (cat: MediaFileCategory): Promise<string> => {
          if (folderCache[cat]) return folderCache[cat]
          const name = MEDIA_CATEGORY_FOLDER_NAME[cat]
          setUploadProgress(`${name} 폴더 확인 중...`)
          const id = await getOrCreateFolder(name, storageRootId, token)
          folderCache[cat] = id
          return id
        }

        for (let i = 0; i < fileList.length; i++) {
          const f = fileList[i]
          // 현재 필터 카테고리가 있으면 그걸로, 'all' 이면 MIME 추론
          const targetCategory: MediaFileCategory =
            category === 'all' ? guessCategory(f.type) : category

          const folderId = await getFolder(targetCategory)
          setUploadProgress(
            `[${i + 1}/${fileList.length}] ${f.name} Drive 업로드 중...`,
          )
          const details = await uploadToDriveWithDetails(
            f,
            f.name,
            f.type || 'application/octet-stream',
            folderId,
            token,
          )

          // 이미지/영상 메타 (가능한 경우 클라이언트에서 추출)
          let extraMeta: {
            width_px?: number
            height_px?: number
            duration_seconds?: number
          } = {}
          try {
            extraMeta = await extractMediaMeta(f)
          } catch {
            /* ignore */
          }

          setUploadProgress(`[${i + 1}/${fileList.length}] 메타데이터 저장 중...`)
          const metaRes = await fetch('/api/documents/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              drive_file_id: details.id,
              drive_folder_id: folderId,
              drive_view_url: details.webViewLink,
              drive_download_url: details.webContentLink,
              drive_thumbnail_url: details.thumbnailLink,
              filename: details.name,
              mime_type: details.mimeType,
              size_bytes: details.size,
              ...extraMeta,
              category: targetCategory,
              tags: [],
            }),
          })
          if (!metaRes.ok) {
            const err = await metaRes.json().catch(() => null)
            throw new Error(
              err?.error ?? `메타데이터 저장 실패: ${metaRes.status}`,
            )
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
    [category, fetchFiles, getToken],
  )

  // ─────────────────────────────────────────────
  // 버튼 업로드
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
  // 삭제
  // ─────────────────────────────────────────────
  const handleDelete = async (file: MediaFile) => {
    if (!confirm(`"${file.filename}" 을 휴지통으로 보낼까요?\n(Drive 휴지통에서 복구 가능)`)) return
    try {
      const token = await getToken()
      await deleteFromDrive(file.drive_file_id, token, true)
      await fetch(`/api/documents/media/${file.id}`, { method: 'DELETE' })
      await fetchFiles()
      if (preview?.id === file.id) setPreview(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  // ─────────────────────────────────────────────
  // 카테고리 변경
  // ─────────────────────────────────────────────
  const handleCategoryChange = async (
    file: MediaFile,
    newCat: MediaFileCategory,
  ) => {
    if (newCat === file.category) return
    try {
      const res = await fetch(`/api/documents/media/${file.id}`, {
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
            <p className="text-[12px] text-[#757575] mt-1">사진·영상·룩북 등 자동 분류됩니다</p>
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
          accept="image/*,video/*,application/pdf"
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

      {/* 카테고리 필터 칩 */}
      <div className="flex flex-wrap gap-2">
        <CategoryChip
          active={category === 'all'}
          onClick={() => setCategory('all')}
          label="전체"
          count={countsByCategory.all}
        />
        {MEDIA_CATEGORY_ORDER.map((c) => (
          <CategoryChip
            key={c}
            active={category === c}
            onClick={() => setCategory(c)}
            label={MEDIA_CATEGORY_LABEL[c]}
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

      {/* 드롭존 + 결과 */}
      {loading ? (
        <div className="text-center py-10 text-[#757575]">불러오는 중...</div>
      ) : files.length === 0 ? (
        <Dropzone
          hasFilter={search.trim() !== '' || category !== 'all'}
          onClearFilter={() => {
            setSearch('')
            setCategory('all')
          }}
          onPickFiles={handleUploadClick}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {files.map((f) => (
            <MediaCard
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
  onPreview,
  onDelete,
  onCategoryChange,
}: {
  file: MediaFile
  onPreview: () => void
  onDelete: () => void
  onCategoryChange: (c: MediaFileCategory) => void
}) {
  const cls = classifyMedia(file.mime_type)
  const FallbackIcon =
    cls === 'image' ? ImageIcon : cls === 'video' ? Film : cls === 'pdf' ? FileText : FileIcon

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
        {file.drive_thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.drive_thumbnail_url}
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

        {/* 카테고리 라벨 (좌상단) */}
        <span
          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-white/90 text-[9px] font-bold tracking-tight text-[#000]"
          style={{ borderRadius: '2px' }}
        >
          {MEDIA_CATEGORY_LABEL[file.category]}
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
            value={file.category}
            onChange={(e) => onCategoryChange(e.target.value as MediaFileCategory)}
            className="flex-1 text-[10px] font-bold border border-[#cccccc] bg-white px-1 py-0.5 outline-none focus:border-[#76b900]"
            style={{ borderRadius: '2px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {MEDIA_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {MEDIA_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <button
            onClick={onDelete}
            className="h-6 w-6 inline-flex items-center justify-center bg-[#fef2f2] hover:bg-[#fee2e2] text-[#991b1b] transition-colors"
            style={{ borderRadius: '2px' }}
            title="휴지통으로"
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
          <p className="text-[14px] font-bold text-[#000] mb-1">검색 결과가 없습니다.</p>
          <p className="text-[12px] text-[#757575] mb-4">
            다른 검색어를 시도하거나 필터를 해제해보세요.
          </p>
          <Button variant="outline" size="sm" onClick={onClearFilter}>
            필터 초기화
          </Button>
        </>
      ) : (
        <>
          <p className="text-[16px] font-bold tracking-tight text-[#000] mb-1">
            여기로 드래그하거나 클릭해서 업로드
          </p>
          <p className="text-[12px] text-[#757575] mb-5">
            사진·영상·룩북·PDF — 자동으로 분류되어 Drive 에 저장됩니다
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
              <Badge variant="secondary">{MEDIA_CATEGORY_LABEL[file.category]}</Badge>
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
                className="h-8 px-3 text-[12px] font-bold inline-flex items-center justify-center gap-1 bg-[#f7f7f7] hover:bg-[#eeeeee]"
                style={{ borderRadius: '2px' }}
                title="다운로드"
              >
                <Download className="w-3.5 h-3.5" strokeWidth={2} />
                다운로드
              </a>
            )}
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
        <div className="flex-1 overflow-auto bg-black flex items-center justify-center min-h-[400px]">
          {cls === 'image' ? (
            // 이미지: 큰 thumbnail (=s2000) → 없으면 Drive preview iframe
            file.drive_thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.drive_thumbnail_url.replace(/=s\d+/, '=s2000')}
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
            // 영상: Drive 임베드 player (HTML5 <video> 는 Drive raw url 인증 필요해서 iframe 이 안정)
            <iframe
              src={getDrivePreviewUrl(file.drive_file_id)}
              className="w-full h-[78vh] border-0 bg-black"
              title={file.filename}
              allow="autoplay"
              allowFullScreen
            />
          ) : (
            // PDF / 기타: Drive iframe
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
