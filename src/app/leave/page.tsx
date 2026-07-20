import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '연차 관리 — DIAVIS',
  description: '디안 직원 연차 확인·등록 (dian-leave)',
}

/**
 * 연차 관리 — 별도 앱(dian-leave.vercel.app)을 DIAVIS 콘텐츠 영역에 임베드.
 * 사이드바·헤더를 유지한 채 오른쪽 영역에 표시된다.
 */
export default function LeavePage() {
  return (
    // main 의 기본 패딩을 벗어나 콘텐츠 영역을 꽉 채움 (풀-블리드 escape)
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 sm:-my-10 lg:-my-12">
      <iframe
        src="https://dian-leave.vercel.app"
        title="연차 관리"
        className="block w-full border-0 bg-gray-50"
        style={{ height: 'calc(100vh - 3rem)' }}
      />
    </div>
  )
}
