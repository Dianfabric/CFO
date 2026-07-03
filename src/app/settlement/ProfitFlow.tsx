'use client'

/**
 * 손익 흐름 생키 — "디안은 이렇게 벌고 쓴다".
 *
 * 총매출 → (−매출원가) → 매출총이익 → (−변동비) → 공헌이익
 *        → (−고정비) → 영업이익 → (−영업외·이자) → 순이익
 *
 * 파랑 = 매출, 초록 = 이익 흐름, 빨강 = 비용 분기. 밴드 폭은 금액 비례.
 */
import { formatKRW } from '@/lib/formatters'

interface Props {
  revenue: number
  cogs: number
  gross: number
  variable: number
  contribution: number
  fixed: number
  operating: number
  nonOp: number
  net: number
  /** BEP 매출 (고정비 ÷ 공헌이익률) — 산출 불가 시 null */
  bep: number | null
  /** BEP 달성률 % (공헌이익 ÷ 고정비) — 고정비 미등록 시 null */
  bepRate: number | null
  periodKey: string
}

const COL_X = [60, 280, 500, 720, 940] // 메인 노드 x
const NODE_W = 12
const FLOW_TOP = 64
const MAX_H = 160
const COST_Y = 258
const COST_MAX_H = 56

/** 두 세로 구간을 잇는 부드러운 밴드 */
function band(x0: number, y0a: number, y0b: number, x1: number, y1a: number, y1b: number): string {
  const mx = (x0 + x1) / 2
  return `M${x0},${y0a} C${mx},${y0a} ${mx},${y1a} ${x1},${y1a} L${x1},${y1b} C${mx},${y1b} ${mx},${y0b} ${x0},${y0b} Z`
}

export default function ProfitFlow(p: Props) {
  if (p.revenue <= 0) {
    return (
      <p className="py-8 text-center text-[12px] text-slate-400">
        기간 매출이 없어 손익 흐름을 그릴 수 없습니다.
      </p>
    )
  }

  const unit = MAX_H / p.revenue
  const barH = (v: number) => (v <= 0 ? 4 : Math.max(4, Math.min(MAX_H, Math.round(v * unit))))
  const rate = (v: number) => (p.revenue > 0 ? (v / p.revenue) * 100 : 0)

  const mains = [
    { label: '총매출', v: p.revenue, isRevenue: true },
    { label: '매출총이익', v: p.gross },
    { label: '공헌이익', v: p.contribution },
    { label: '영업이익', v: p.operating },
    { label: '순이익', v: p.net },
  ]
  const costs = [
    { label: '매출원가', v: p.cogs, rateName: '원가율' },
    { label: '변동비', v: p.variable, rateName: '매출 대비' },
    { label: '고정비', v: p.fixed, rateName: '매출 대비' },
    { label: '영업외·이자', v: p.nonOp, rateName: '매출 대비' },
  ]
  const mh = mains.map((m) => barH(m.v))

  const amountColor = (m: { v: number; isRevenue?: boolean }) =>
    m.isRevenue ? '#2563eb' : m.v >= 0 ? '#3d7a00' : '#dc2626'
  const nodeColor = (m: { v: number; isRevenue?: boolean }) =>
    m.isRevenue ? '#3b82f6' : m.v >= 0 ? '#76b900' : '#ef4444'

  return (
    <div className="overflow-x-auto">
      <style>{`
        .pf-el { opacity: 0; animation: pfIn 0.7s ease-out forwards; }
        @keyframes pfIn { to { opacity: 1; } }
      `}</style>
      <svg
        key={p.periodKey}
        viewBox="0 0 1040 352"
        style={{ minWidth: 880, width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="손익 흐름: 총매출에서 순이익까지"
      >
        {/* BEP 점선 마커 — 총매출 막대 위 '여기까지가 본전' 지점 */}
        {p.bep != null && p.bep <= p.revenue && (() => {
          const y = FLOW_TOP + (p.bep / p.revenue) * mh[0]
          return (
            <g className="pf-el" style={{ animationDelay: '0.8s' }}>
              <line
                x1={COL_X[0] - 8} x2={COL_X[0] + NODE_W + 8} y1={y} y2={y}
                stroke="#334155" strokeWidth="1.2" strokeDasharray="3 2"
              />
              <text x={COL_X[0] - 11} y={y + 3.5} textAnchor="end" fontSize="9" fontWeight="700" fill="#475569">
                BEP
              </text>
            </g>
          )
        })()}

        {/* BEP 블록 — 좌하단: 본전 매출 + 달성률 게이지 */}
        <g className="pf-el" style={{ animationDelay: '0.7s' }}>
          <text x={40} y={COST_Y + 10} fontSize="11" fontWeight="600" fill="#64748b" style={{ letterSpacing: '0.04em' }}>
            손익분기점 (BEP)
          </text>
          {p.bepRate == null ? (
            <text x={40} y={COST_Y + 30} fontSize="11" fill="#94a3b8">고정비 미등록 — 산출 불가</text>
          ) : (
            <>
              <text x={40} y={COST_Y + 31} fontSize="13" fontWeight="700" fill="#0f172a" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {p.bep == null ? '공헌이익 적자' : formatKRW(p.bep)}
              </text>
              <text x={40} y={COST_Y + 48} fontSize="11" fontWeight="700" fill={p.bepRate >= 100 ? '#3d7a00' : '#dc2626'}>
                달성률 {p.bepRate.toFixed(1)}% {p.bepRate >= 100 ? '· 본전 넘김' : '· 본전 미달'}
              </text>
              <rect x={40} y={COST_Y + 56} width={150} height={6} fill="#f1f5f9" rx="3" />
              <rect
                x={40} y={COST_Y + 56}
                width={Math.max(2, Math.min(150, (p.bepRate / 100) * 150))}
                height={6} fill={p.bepRate >= 100 ? '#76b900' : '#ef4444'} rx="3"
              />
              <line x1={190} x2={190} y1={COST_Y + 53} y2={COST_Y + 65} stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
            </>
          )}
        </g>

        {mains.map((m, i) => {
          const x = COL_X[i]
          const cx = x + NODE_W / 2
          const next = i < mains.length - 1
          const delay = `${i * 0.14}s`
          return (
            <g key={m.label} className="pf-el" style={{ animationDelay: delay }}>
              {/* 이익 흐름 밴드 (이 노드 → 다음 노드) */}
              {next && (
                <path
                  d={band(
                    x + NODE_W, FLOW_TOP, FLOW_TOP + Math.min(mh[i + 1], mh[i]),
                    COL_X[i + 1], FLOW_TOP, FLOW_TOP + mh[i + 1],
                  )}
                  fill={mains[i + 1].v >= 0 ? 'rgba(118,185,0,0.30)' : 'rgba(239,68,68,0.15)'}
                />
              )}
              {/* 비용 분기 밴드 + 비용 바 */}
              {next && costs[i].v > 0 && (() => {
                const c = costs[i]
                const costX = COL_X[i + 1] - 60
                const ch = Math.max(4, Math.min(COST_MAX_H, Math.round(c.v * unit)))
                const splitTop = FLOW_TOP + Math.min(mh[i + 1], mh[i] - 2)
                return (
                  <>
                    <path
                      d={band(x + NODE_W, splitTop, FLOW_TOP + mh[i], costX, COST_Y, COST_Y + ch)}
                      fill="rgba(239,68,68,0.18)"
                    />
                    <rect x={costX} y={COST_Y} width={NODE_W} height={ch} fill="#ef4444" rx="1.5" />
                    <text x={costX + NODE_W / 2} y={COST_Y + ch + 18} textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748b">
                      (−) {c.label}
                    </text>
                    <text x={costX + NODE_W / 2} y={COST_Y + ch + 34} textAnchor="middle" fontSize="13" fontWeight="700" fill="#b91c1c" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatKRW(c.v)}
                    </text>
                    <text x={costX + NODE_W / 2} y={COST_Y + ch + 48} textAnchor="middle" fontSize="10" fill="#94a3b8">
                      {c.rateName} {rate(c.v).toFixed(1)}%
                    </text>
                  </>
                )
              })()}
              {/* 비용이 0이면 자리 표시만 (연동 전 슬롯) */}
              {next && costs[i].v <= 0 && (
                <text x={COL_X[i + 1] - 60 + NODE_W / 2} y={COST_Y + 18} textAnchor="middle" fontSize="10" fill="#cbd5e1">
                  (−) {costs[i].label} 0
                </text>
              )}
              {/* 메인 노드 */}
              <rect x={x} y={FLOW_TOP} width={NODE_W} height={mh[i]} fill={nodeColor(m)} rx="1.5" />
              <text x={cx} y={20} textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748b" style={{ letterSpacing: '0.04em' }}>
                {m.label}
              </text>
              <text x={cx} y={40} textAnchor="middle" fontSize="16" fontWeight="800" fill={amountColor(m)} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatKRW(m.v)}
              </text>
              <text x={cx} y={56} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={m.isRevenue ? '#94a3b8' : m.v >= 0 ? 'rgba(61,122,0,0.8)' : '#dc2626'}>
                {m.isRevenue ? '100%' : `이익률 ${rate(m.v).toFixed(1)}%`}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
