import type { Metadata } from 'next'
import SamplesApp from './_components/SamplesApp'

export const metadata: Metadata = {
  title: '샘플 관리 — DIAVIS',
  description: '샘플북 대여·반납·거래처 관리',
}

export default function SamplesPage() {
  return <SamplesApp />
}
