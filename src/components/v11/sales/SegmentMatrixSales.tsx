'use client'
/**
 * 24셀 영업 매트릭스 (편집 가능 버전, PRD #2a ③)
 */
import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  OCCUPATION_LABEL,
  DIVISION_LABEL,
} from '@/lib/v11-labels'
import SegmentMessageDialog, {
  type SegmentRow,
} from './SegmentMessageDialog'

const OCCUPATIONS = [
  'interior_project',
  'brand_furniture',
  'project_furniture',
  'commercial_reupholster',
  'curtain_styling',
  'display',
]
const DIVISIONS = ['sofa', 'curtain', 'wall', 'accessory']

export default function SegmentMatrixSales({
  segments,
}: {
  segments: SegmentRow[]
}) {
  const [editing, setEditing] = useState<SegmentRow | null>(null)

  const cellMap = new Map<string, SegmentRow>()
  for (const s of segments) {
    cellMap.set(`${s.occupation}|${s.division}`, s)
  }

  const filledCount = segments.filter(
    (s) =>
      (s.core_message && s.core_message.trim().length > 0) ||
      (s.sales_sequence && s.sales_sequence.length > 0),
  ).length
  const fillRate = Math.round((filledCount / 24) * 100)

  return (
    <>
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-slate-600">
          채워진 셀: <strong>{filledCount}</strong> / 24 ({fillRate}%)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-32 bg-white px-2 py-2 text-left text-xs font-semibold text-slate-500">
                직업군 ＼ 제품군
              </th>
              {DIVISIONS.map((d) => (
                <th
                  key={d}
                  className="px-2 py-2 text-center text-xs font-semibold text-slate-700"
                >
                  {DIVISION_LABEL[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OCCUPATIONS.map((occ) => (
              <tr key={occ}>
                <td className="sticky left-0 z-10 bg-white px-2 py-2 text-xs font-medium text-slate-700 align-top">
                  {OCCUPATION_LABEL[occ]}
                </td>
                {DIVISIONS.map((div) => {
                  const seg = cellMap.get(`${occ}|${div}`)
                  const filled =
                    seg &&
                    (seg.core_message ||
                      (seg.sales_sequence && seg.sales_sequence.length > 0))
                  return (
                    <td key={div} className="p-1 align-top">
                      <button
                        type="button"
                        onClick={() => seg && setEditing(seg)}
                        disabled={!seg}
                        className={cn(
                          'group block min-h-[80px] w-full rounded-md border-2 p-2 text-left text-[11px] transition',
                          filled
                            ? 'border-blue-200 bg-blue-50/30 hover:border-blue-400'
                            : 'border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                        )}
                      >
                        {filled ? (
                          <div className="space-y-1">
                            {seg.core_message && (
                              <div className="font-semibold text-slate-800 line-clamp-2">
                                {seg.core_message}
                              </div>
                            )}
                            {seg.sales_sequence && seg.sales_sequence.length > 0 && (
                              <div className="text-[10px] text-slate-500">
                                {seg.sales_sequence.length}단계 시퀀스
                              </div>
                            )}
                            {seg.avg_cycle_days && (
                              <div className="text-[10px] text-slate-500">
                                평균 {seg.avg_cycle_days}일
                              </div>
                            )}
                            <Pencil className="mt-1 h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-400">
                            <span className="text-[10px]">+ 메시지 추가</span>
                          </div>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SegmentMessageDialog
        segment={editing}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      />
    </>
  )
}
