import { Suspense } from 'react'
import NoticeForm from './NoticeForm'

export default function NoticePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96 text-slate-400">불러오는 중...</div>}>
      <NoticeForm />
    </Suspense>
  )
}
