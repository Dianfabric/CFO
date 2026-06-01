/**
 * 잠재 거래처 / 문의 컨택 풀 (V2.5)
 *
 * 모르는 거래처에서 문의 → 이름·연락처·직군·관심제품·메모 기록.
 * Supabase 1차 저장 + Google Sheets 동기화 + CSV 다운로드.
 *
 * Drive 폴더: "디안 거래처 풀" 안에 자동 생성된 시트 1개.
 */
import Link from 'next/link'
import { ChevronLeft, UserPlus } from 'lucide-react'
import Script from 'next/script'
import ContactsView from './ContactsView'

export const dynamic = 'force-dynamic'

export default function ContactsPage() {
  return (
    <>
      {/* GIS — Sheets + Drive scope */}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div className="space-y-6">
        <div>
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 text-[12px] tracking-tight text-[#757575] hover:text-[#000] transition-colors mb-3"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={1.8} />
            공문 / 자료
          </Link>
          <div className="flex items-center gap-2.5">
            <UserPlus
              className="w-6 h-6"
              style={{ color: 'var(--nv-primary)' }}
              strokeWidth={1.8}
            />
            <h1 className="text-[24px] font-bold tracking-tight text-[#000]">
              잠재 거래처 등록
            </h1>
          </div>
          <p className="text-[13px] text-[#757575] mt-1.5">
            가격·제품 문의가 오면 즉시 기록하세요. 직군·관심 제품을 함께 남기면 추후 영업·마케팅 자료로 활용할 수 있습니다.
          </p>
        </div>

        <ContactsView />
      </div>
    </>
  )
}
