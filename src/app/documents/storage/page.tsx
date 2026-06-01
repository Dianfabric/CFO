/**
 * 디안 서류 보관함 (V2.3)
 *
 * Google Drive 의 "디안 서류함" 폴더 + Supabase document_files 메타데이터.
 *
 * 동작:
 *   - 업로드: 클라이언트 → Drive (카테고리별 sub-folder) → Supabase 메타데이터 등록
 *   - 검색·필터: Supabase 에서 (filename / tags / category / client_id)
 *   - 미리보기: Drive iframe (PDF) 또는 인라인 이미지
 *
 * 인증: Google Identity Services (GIS) — 사용자 OAuth 토큰 (drive.file scope)
 */
import Link from 'next/link'
import { ChevronLeft, FolderArchive } from 'lucide-react'
import Script from 'next/script'
import StorageView from './StorageView'

export const dynamic = 'force-dynamic'

export default function DocumentStoragePage() {
  return (
    <>
      {/* GIS — Google Identity Services (OAuth 토큰 client) */}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div className="space-y-6">
        {/* 헤더 */}
        <div>
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 text-[12px] tracking-tight text-[#757575] hover:text-[#000] transition-colors mb-3"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={1.8} />
            공문 / 자료
          </Link>
          <div className="flex items-center gap-2.5">
            <FolderArchive
              className="w-6 h-6"
              style={{ color: 'var(--nv-primary)' }}
              strokeWidth={1.8}
            />
            <h1 className="text-[24px] font-bold tracking-tight text-[#000]">
              디안 서류 보관함
            </h1>
          </div>
          <p className="text-[13px] text-[#757575] mt-1.5">
            계약서·사업자등록증·방염서류·시험성적서 등 서류를 Google Drive 에 저장하고 빠르게 검색합니다.
          </p>
        </div>

        <StorageView />
      </div>
    </>
  )
}
