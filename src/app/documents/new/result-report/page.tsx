import { Suspense } from 'react'
import Script from 'next/script'
import ResultReportForm from './ResultReportForm'

export default function ResultReportPage() {
  return (
    <>
      {/* GIS — 발행본 드라이브 저장용 OAuth 토큰 client */}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <Suspense fallback={<div className="flex items-center justify-center h-96 text-slate-400">불러오는 중...</div>}>
        <ResultReportForm />
      </Suspense>
    </>
  )
}
