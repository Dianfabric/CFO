import { Suspense } from 'react'
import PaymentRequestForm from './PaymentRequestForm'

export default function PaymentRequestPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96 text-slate-400">불러오는 중...</div>}>
      <PaymentRequestForm />
    </Suspense>
  )
}
