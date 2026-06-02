/**
 * 견적서 작성 — DIAVIS 안에 iframe 으로 임베드
 *
 * 원본: https://dianfabric.github.io/dian-quote/
 * 외부 사이트가 X-Frame-Options 미설정 → iframe 임베드 허용됨.
 * PWA 안에서도 외부 새 탭 없이 직접 사용 가능.
 */
import Link from 'next/link'
import { ChevronLeft, Receipt, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

const QUOTE_URL = 'https://dianfabric.github.io/dian-quote/'

export default function QuotePage() {
  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12 flex flex-col h-[calc(100vh-64px)]">
      {/* 상단 toolbar */}
      <div
        className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-2.5 shrink-0"
        style={{
          borderBottom: '1px solid var(--nv-hairline)',
          backgroundColor: 'var(--nv-surface-soft)',
        }}
      >
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-[12px]"
          style={{ color: 'var(--nv-mute)' }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          공문 / 자료
        </Link>
        <span style={{ color: 'var(--nv-hairline)' }}>·</span>
        <Receipt className="w-4 h-4" style={{ color: '#6366f1' }} />
        <h1
          className="text-[14px] font-bold tracking-tight flex-1"
          style={{ color: 'var(--nv-ink)' }}
        >
          견적서 작성 — DiAN 견적서 생성기
        </h1>
        <a
          href={QUOTE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault()
            window.open(QUOTE_URL, '_blank', 'noopener,noreferrer')
          }}
          className="h-7 px-2.5 inline-flex items-center gap-1 text-[11px] font-bold transition-colors"
          style={{
            border: '1px solid var(--nv-hairline)',
            color: 'var(--nv-mute)',
            backgroundColor: '#ffffff',
            borderRadius: '2px',
          }}
          title="외부 사이트에서 새 탭으로 열기"
        >
          <ExternalLink className="w-3 h-3" />
          새 창
        </a>
      </div>

      {/* iframe — 남은 영역 전체 사용 */}
      <iframe
        src={QUOTE_URL}
        title="DiAN 견적서 생성기"
        className="flex-1 w-full border-0"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        referrerPolicy="no-referrer-when-downgrade"
        allow="clipboard-write; clipboard-read"
      />
    </div>
  )
}
