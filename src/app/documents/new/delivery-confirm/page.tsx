import { Suspense } from 'react'
import Script from 'next/script'
import DeliveryConfirmForm from './DeliveryConfirmForm'

export default function DeliveryConfirmPage() {
  return (
    <>
      {/* GIS — 드라이브 견적서 검색·저장용 OAuth 토큰 client */}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <Suspense fallback={<div className="flex items-center justify-center h-96 text-slate-400">불러오는 중...</div>}>
        <DeliveryConfirmForm />
      </Suspense>
    </>
  )
}
