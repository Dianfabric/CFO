'use client'

/**
 * 대사 센터 연결 스트립 — 거래 관리 칸반 위 (대표 지시 2026-07-13)
 * 일계표 대사 체계(계산서·입금·인박스)의 확인 대기 건수를 보여주고
 * 공문/자료 센터의 대사 센터로 바로가기. 대사가 끝나면 칸반 카드가 자동 이동.
 */
import { useEffect, useState } from 'react'
import { GitCompareArrows, ExternalLink } from 'lucide-react'

export default function ReconLinkStrip() {
  const [counts, setCounts] = useState<{ tax: number; ptax: number; deposits: number } | null>(null)

  useEffect(() => {
    fetch('/api/recon/suggestions')
      .then((r) => r.json())
      .then((j) => setCounts({
        tax: Array.isArray(j.tax) ? j.tax.length : 0,
        ptax: Array.isArray(j.ptax) ? j.ptax.length : 0,
        deposits: Array.isArray(j.deposits) ? j.deposits.length : 0,
      }))
      .catch(() => setCounts({ tax: 0, ptax: 0, deposits: 0 }))
  }, [])

  if (!counts) return null
  const total = counts.tax + counts.ptax + counts.deposits
  return (
    <a
      href="/documents"
      className="flex items-center gap-2 px-3 py-2 text-[12px]"
      style={{
        border: '1px solid',
        borderColor: total > 0 ? '#fde68a' : '#e2e8f0',
        backgroundColor: total > 0 ? '#fffbeb' : '#f8fafc',
        borderRadius: '2px',
        color: total > 0 ? '#92400e' : '#64748b',
      }}
    >
      <GitCompareArrows className="w-3.5 h-3.5 shrink-0" />
      {total > 0 ? (
        <span>
          <b>대사 센터 확인 대기 {total}건</b> — 계산서 연결 {counts.tax + counts.ptax}건 ·
          통장입금↔미수 {counts.deposits}건. 승인하면 아래 칸반 카드가 자동 이동합니다.
        </span>
      ) : (
        <span>대사 센터 확인 대기 없음 — 계산서·입금이 모두 연결된 상태입니다.</span>
      )}
      <span className="ml-auto shrink-0 font-bold">
        대사 센터 <ExternalLink className="w-3 h-3 inline" />
      </span>
    </a>
  )
}
