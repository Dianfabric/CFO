/**
 * 디안 자료 보관함 (V2.3)
 *
 * Google Drive 의 "디안 자료함" 폴더 + Supabase media_files 메타데이터.
 *
 * 동작:
 *   - 드래그앤드롭 또는 버튼 업로드 → Drive (카테고리별 sub-folder) → Supabase 메타
 *   - 갤러리 그리드 (사진 큰 썸네일, 영상 poster + ▶︎)
 *   - 클릭 → lightbox (이미지) 또는 비디오 플레이어 (영상)
 *
 * 인증: Google Identity Services (GIS) — drive.file scope
 */
import Link from 'next/link'
import { ChevronLeft, ImageIcon } from 'lucide-react'
import Script from 'next/script'
import MediaView from './MediaView'

export const dynamic = 'force-dynamic'

export default function MediaStoragePage() {
  return (
    <>
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
            <ImageIcon
              className="w-6 h-6"
              style={{ color: 'var(--nv-primary)' }}
              strokeWidth={1.8}
            />
            <h1 className="text-[24px] font-bold tracking-tight text-[#000]">
              디안 자료 보관함
            </h1>
          </div>
          <p className="text-[13px] text-[#757575] mt-1.5">
            사진·영상·룩북·레퍼런스 등 비주얼 자료를 Google Drive 에 저장하고 빠르게 검색합니다. 드래그앤드롭으로 한 번에 업로드.
          </p>
        </div>

        <MediaView />
      </div>
    </>
  )
}
