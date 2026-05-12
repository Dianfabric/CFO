/**
 * 디안 서류 보관함 — 공용 타입/라벨/유틸
 * (Google Drive + Supabase document_files 테이블 기반)
 */

export type DocumentFileCategory =
  | 'contract'
  | 'business_reg'
  | 'flameproof'
  | 'test_report'
  | 'certification'
  | 'tax_invoice'
  | 'other'

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentFileCategory, string> = {
  contract: '계약서',
  business_reg: '사업자등록증',
  flameproof: '방염서류',
  test_report: '시험성적서',
  certification: '인증서',
  tax_invoice: '세금계산서',
  other: '기타',
}

/** Drive 폴더명 (카테고리별) */
export const DOCUMENT_CATEGORY_FOLDER_NAME: Record<DocumentFileCategory, string> = {
  contract: '01_계약서',
  business_reg: '02_사업자등록증',
  flameproof: '03_방염서류',
  test_report: '04_시험성적서',
  certification: '05_인증서',
  tax_invoice: '06_세금계산서',
  other: '99_기타',
}

/** 디안 서류함 — Drive root folder 안에 자동 생성될 부모 폴더명 */
export const DOCUMENT_STORAGE_ROOT_NAME = '디안 서류함'

/** 카테고리 순서 (UI 표시용) */
export const DOCUMENT_CATEGORY_ORDER: DocumentFileCategory[] = [
  'contract',
  'business_reg',
  'flameproof',
  'test_report',
  'certification',
  'tax_invoice',
  'other',
]

export interface DocumentFile {
  id: string
  drive_file_id: string
  drive_folder_id: string | null
  drive_view_url: string | null
  drive_download_url: string | null
  drive_thumbnail_url: string | null
  filename: string
  mime_type: string | null
  size_bytes: number | null
  category: DocumentFileCategory
  tags: string[]
  client_id: string | null
  notes: string | null
  issued_date: string | null
  expires_date: string | null
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

/** MIME 타입 → 단순 분류 (이미지·PDF·기타) */
export function classifyMime(
  mime: string | null | undefined,
): 'image' | 'pdf' | 'office' | 'other' {
  if (!mime) return 'other'
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (
    mime.startsWith('application/vnd.openxmlformats') ||
    mime.startsWith('application/vnd.ms-') ||
    mime.includes('msword') ||
    mime.includes('excel') ||
    mime.includes('powerpoint')
  )
    return 'office'
  return 'other'
}

/** Google Drive 임베드 가능한 미리보기 URL (PDF / Office) */
export function getDrivePreviewUrl(driveFileId: string): string {
  return `https://drive.google.com/file/d/${driveFileId}/preview`
}

/** 검색 쿼리 정규화 */
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase()
}
