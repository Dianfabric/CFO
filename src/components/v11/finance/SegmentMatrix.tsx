/**
 * 24셀 매출 매트릭스 (PRD #3 ②)
 * 6직업군 × 4제품군 = 24셀.
 * 빈 데이터에서도 24개 셀이 모두 보이도록 — 구조 시각화.
 */
import { formatKRW } from '@/lib/formatters'

type SegmentRow = {
  segment_id: number
  occupation: string
  division: string
  revenue: number
  margin: number
  transaction_count: number
  active_clients: number
}

const OCCUPATION_LABELS: Record<string, string> = {
  interior_project: '인테리어 프로젝트',
  brand_furniture: '브랜드 가구',
  project_furniture: '프로젝트 가구',
  commercial_reupholster: '업소용 천갈이',
  curtain_styling: '커튼 스타일링',
  display: '디스플레이',
}

const DIVISION_LABELS: Record<string, string> = {
  sofa: '소파원단',
  curtain: '커튼원단',
  wall: '벽원단',
  accessory: '소품원단',
}

const OCCUPATIONS = Object.keys(OCCUPATION_LABELS)
const DIVISIONS = Object.keys(DIVISION_LABELS)

/** 매출액에 따른 배경 색상 강도 (heatmap) */
function intensity(revenue: number, max: number): string {
  if (max === 0 || revenue === 0) return 'bg-slate-50 text-slate-400'
  const ratio = revenue / max
  if (ratio > 0.66) return 'bg-blue-600 text-white'
  if (ratio > 0.33) return 'bg-blue-300 text-blue-900'
  return 'bg-blue-100 text-blue-700'
}

export default function SegmentMatrix({ data }: { data: SegmentRow[] }) {
  // 셀 룩업 맵
  const cellMap = new Map<string, SegmentRow>()
  for (const row of data) {
    cellMap.set(`${row.occupation}|${row.division}`, row)
  }

  const max = Math.max(0, ...data.map((d) => Number(d.revenue) || 0))
  const totalRevenue = data.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
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
                {DIVISION_LABELS[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {OCCUPATIONS.map((occ) => (
            <tr key={occ}>
              <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
                {OCCUPATION_LABELS[occ]}
              </td>
              {DIVISIONS.map((div) => {
                const cell = cellMap.get(`${occ}|${div}`)
                const revenue = Number(cell?.revenue) || 0
                const txCount = Number(cell?.transaction_count) || 0
                return (
                  <td key={div} className="p-1">
                    <div
                      className={`flex h-16 flex-col items-center justify-center rounded-md text-[11px] font-medium tabular-nums ${intensity(
                        revenue,
                        max,
                      )}`}
                      title={`${OCCUPATION_LABELS[occ]} × ${DIVISION_LABELS[div]}: ${formatKRW(revenue)} (${txCount}건)`}
                    >
                      <div className="font-bold">{revenue === 0 ? '—' : formatKRW(revenue)}</div>
                      <div className="text-[10px] opacity-80">{txCount}건</div>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span>총 24셀 · 활성 셀 {data.filter((d) => Number(d.revenue) > 0).length}개</span>
        <span>총 매출 {formatKRW(totalRevenue)}</span>
      </div>
    </div>
  )
}
