'use client'

/**
 * 색동 신사업 12주 목표 — 프로젝트 하나에 OKR 트리 적용.
 *
 * 12주 대시보드의 직원별 OKR(OkrTree)을 그대로 재사용하되,
 * '색동 신사업' 이라는 단일 프로젝트(employee) 에 대해서만 렌더한다.
 * 큰 목표 + KR(선행/후행) + 12주 주별 타겟 + 5일 투두 구조가 동일하게 작동.
 */
import { useState } from 'react'
import OkrTree from '@/app/finance/cycle/employees/OkrTree'
import type { Employee } from '@/lib/cycle-okr'

interface Props {
  project: Employee
  cycleId: number
  cycleStart: string
  cycleEnd: string
}

export default function SaekdongOkr({
  project,
  cycleId,
  cycleStart,
  cycleEnd,
}: Props) {
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {error && (
        <div
          className="px-3 py-2 text-[12px]"
          style={{
            border: '1px solid var(--nv-error)',
            backgroundColor: '#fef2f2',
            color: 'var(--nv-error)',
            borderRadius: '2px',
          }}
        >
          ⚠ {error}
        </div>
      )}
      <OkrTree
        employee={project}
        allEmployees={[project]}
        cycleId={cycleId}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        onError={setError}
      />
    </div>
  )
}
