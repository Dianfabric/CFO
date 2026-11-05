import { Suspense } from 'react'
import Script from 'next/script'
import PriceChangeForm from './PriceChangeForm'

export default function PriceChangePage() {
  return (
    <>
      {/* GIS — 발행 저장 시 드라이브 업로드용 OAuth 토큰 client */}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <Suspense fallback={
        <div className="flex items-center justify-center h-96 text-slate-400">
          불러오는 중...
        </div>
      }>
        <PriceChangeForm />
      </Suspense>
    </>
  )
}
