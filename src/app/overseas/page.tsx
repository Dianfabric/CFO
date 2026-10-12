import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '해외 송금 — DIAVIS',
  description: '해외 거래처 인보이스·예치금 차감·발주별 선수금/잔금 관리 (dian-overseas)',
}

/**
 * 해외 송금 — 별도 앱(dian-overseas.vercel.app)을 DIAVIS 콘텐츠 영역에 임베드.
 * 국내 송금(/domestic)·연차 관리(/leave)·점심 내역(/lunch)과 같은 방식.
 */
export default function OverseasPage() {
  return (
    // main 의 기본 패딩을 벗어나 콘텐츠 영역을 꽉 채움 (풀-블리드 escape)
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12">
      <iframe
        src="https://dian-overseas.vercel.app"
        title="해외 송금"
        className="block w-full border-0 bg-gray-50"
        style={{ height: 'calc(100vh - 3rem)' }}
      />
    </div>
  )
}
