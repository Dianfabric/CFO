import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '국내 송금 — DIAVIS',
  description: '국내 협력업체 월 명세·건별 송금 관리 (dian-domestic)',
}

/**
 * 국내 송금 — 별도 앱(dian-domestic.vercel.app)을 DIAVIS 콘텐츠 영역에 임베드.
 * 연차 관리(/leave)·점심 내역(/lunch)과 같은 방식.
 */
export default function DomesticPage() {
  return (
    // main 의 기본 패딩을 벗어나 콘텐츠 영역을 꽉 채움 (풀-블리드 escape)
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12">
      <iframe
        src="https://dian-domestic.vercel.app"
        title="국내 송금"
        className="block w-full border-0 bg-gray-50"
        style={{ height: 'calc(100vh - 3rem)' }}
      />
    </div>
  )
}
