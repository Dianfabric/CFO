/**
 * 디안 자료 보관함 — 공용 타입/라벨/유틸
 * (Google Drive + Supabase media_files 테이블 기반)
 * 사진·영상·룩북·레퍼런스 등 비주얼 자산.
 */

export type MediaFileCategory =
  | 'photo'
  | 'video'
  | 'lookbook'
  | 'reference'
  | 'other'

export const MEDIA_CATEGORY_LABEL: Record<MediaFileCategory, string> = {
  photo: '사진',
  video: '영상',
  lookbook: '룩북·카탈로그',
  reference: '레퍼런스',
  other: '기타',
}

/** Drive 폴더명 (카테고리별) */
export const MEDIA_CATEGORY_FOLDER_NAME: Record<MediaFileCategory, string> = {
  photo: '01_사진',
  video: '02_영상',
  lookbook: '03_룩북',
  reference: '04_레퍼런스',
  other: '99_기타',
}

/** 디안 자료함 — Drive root folder 안에 자동 생성될 부모 폴더명 */
export const MEDIA_STORAGE_ROOT_NAME = '디안 자료함'

/** 카테고리 순서 (UI 표시용) */
export const MEDIA_CATEGORY_ORDER: MediaFileCategory[] = [
  'photo',
  'video',
  'lookbook',
  'reference',
  'other',
]

export interface MediaFile {
  id: string
  drive_file_id: string
  drive_folder_id: string | null
  drive_view_url: string | null
  drive_download_url: string | null
  drive_thumbnail_url: string | null
  filename: string
  mime_type: string | null
  size_bytes: number | null
  width_px: number | null
  height_px: number | null
  duration_seconds: number | null
  category: MediaFileCategory
  tags: string[]
  client_id: number | null
  notes: string | null
  captured_date: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

/** 파일 사이즈 사람이 읽을 수 있는 형식으로 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

/** MIME 타입 → 미디어 분류 */
export function classifyMedia(
  mime: string | null | undefined,
): 'image' | 'video' | 'pdf' | 'other' {
  if (!mime) return 'other'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'application/pdf') return 'pdf'
  return 'other'
}

/** MIME → 카테고리 자동 추론 */
export function guessCategory(
  mime: string | null | undefined,
): MediaFileCategory {
  const cls = classifyMedia(mime)
  if (cls === 'image') return 'photo'
  if (cls === 'video') return 'video'
  if (cls === 'pdf') return 'lookbook'
  return 'other'
}

/** Google Drive 임베드 가능한 미리보기 URL */
export function getDrivePreviewUrl(driveFileId: string): string {
  return `https://drive.google.com/file/d/${driveFileId}/preview`
}

/** 영상 길이 (초) → "mm:ss" */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
