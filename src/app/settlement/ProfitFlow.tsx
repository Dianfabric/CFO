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

export interface BreakdownItem {
  label: string
  amount: number
}

/** 비용 노드별 세부 구성 — 자료가 등록된 만큼 막대 아래에 표시 */
export interface CostBreakdowns {
  cogs?: BreakdownItem[]
  variable?: BreakdownItem[]
  fixed?: BreakdownItem[]
  nonOp?: BreakdownItem[]
}

/** 좁은 라벨용 축약 금액 — 1.2억 / 340만 / 5,000원 */
function compactKRW(v: number): string {
  const a = Math.abs(v)
  if (a >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (a >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만`
  return `${v.toLocaleString()}원`
}

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
  /** 마지막 노드 라벨 (기본 '순이익' — 사업부 뷰는 '세전이익') */
  netLabel?: string
  /** 영업외 분기 라벨 (기본 '영업외·이자') */
  nonOpLabel?: string
  /** 비용 세부 구성 — 있으면 각 비용 막대 아래 상위 항목 표시 */
  breakdowns?: CostBreakdowns
}

const COL_X = [60, 280, 500, 720, 940] // 메인 노드 x
const NODE_W = 12
const FLOW_TOP = 64
const MAX_H = 160
const COST_Y = 258
const COST_MAX_H = 64
const COST_W = 22 // 비용 막대 폭 — 분할 세그먼트가 보이도록 메인 노드보다 넓게

/** 두 세로 구간을 잇는 부드러운 밴드 */
function band(x0: number, y0a: number, y0b: number, x1: number, y1a: number, y1b: number): string {
  const mx = (x0 + x1) / 2
  return `M${x0},${y0a} C${mx},${y0a} ${mx},${y1a} ${x1},${y1a} L${x1},${y1b} C${mx},${y1b} ${mx},${y0b} ${x0},${y0b} Z`
}

export default function ProfitFlow(p: Props) {
  // 매출이 0이어도 그린다 (0에서 시작 — 비용 규모를 스케일 기준으로 사용)
  const scaleBase = Math.max(p.revenue, p.cogs + p.variable + p.fixed + p.nonOp, 1)
  const unit = MAX_H / scaleBase
  const barH = (v: number) => (v <= 0 ? 4 : Math.max(4, Math.min(MAX_H, Math.round(v * unit))))
  const rate = (v: number) => (p.revenue > 0 ? (v / p.revenue) * 100 : 0)

  const mains = [
    { label: '총매출', v: p.revenue, isRevenue: true },
    { label: '매출총이익', v: p.gross },
    { label: '공헌이익', v: p.contribution },
    { label: '영업이익', v: p.operating },
    { label: p.netLabel ?? '순이익', v: p.net },
  ]
  const costs = [
    { label: '매출원가', v: p.cogs, rateName: '원가율', key: 'cogs' as const },
    { label: '변동비', v: p.variable, rateName: '매출 대비', key: 'variable' as const },
    { label: '고정비', v: p.fixed, rateName: '매출 대비', key: 'fixed' as const },
    { label: p.nonOpLabel ?? '영업외·이자', v: p.nonOp, rateName: '매출 대비', key: 'nonOp' as const },
  ]
  const mh = mains.map((m) => barH(m.v))

  // 비용 세부 구성이 하나라도 있으면 아래 여백 확장
  const hasBreakdown = (['cogs', 'variable', 'fixed', 'nonOp'] as const).some((k) =>
    (p.breakdowns?.[k] ?? []).some((it) => it.amount > 0),
  )
  const vbH = hasBreakdown ? 448 : 352

  // 비용 막대 분할 색 — 큰 항목부터 진한 빨강 → 연한 빨강, 마지막은 '기타'
  const SEG_COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca']

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
        viewBox={`0 0 1040 ${vbH}`}
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
                const costX = COL_X[i + 1] - 72
                const cx2 = costX + COST_W / 2
                // 비용 막대는 갈라짐이 보이도록 확대 스케일 (최소 28px 보장)
                const ch = Math.max(28, Math.min(COST_MAX_H, Math.round(c.v * unit * 1.5)))
                const splitTop = FLOW_TOP + Math.min(mh[i + 1], mh[i] - 2)
                // 세부 구성 — 상위 4개 + 나머지 '기타'
                const items = (p.breakdowns?.[c.key] ?? [])
                  .filter((it) => it.amount > 0)
                  .sort((a, b) => b.amount - a.amount)
                const shown = items.slice(0, 4)
                const restCount = items.length - shown.length
                // 구성 합계가 총액에 못 미치면 차액도 '기타'로 (자료 미연동분)
                const restSum = Math.max(0, c.v - shown.reduce((s, it) => s + it.amount, 0))
                const segs: { label: string; amount: number; color: string }[] = [
                  ...shown.map((it, k) => ({ ...it, color: SEG_COLORS[k] })),
                  ...(restSum > c.v * 0.005
                    ? [{ label: restCount > 0 ? `기타 ${restCount}건` : '기타', amount: restSum, color: SEG_COLORS[4] }]
                    : []),
                ]
                const segTotal = segs.reduce((s, it) => s + it.amount, 0)
                // 뚜쥬루식 — 막대를 구성비례로 가르고, 각 조각 옆에 품목·숫자를 리더선으로 연결
                let segY = COST_Y
                const segRects = segs.map((sg) => {
                  const h = Math.max(2, (sg.amount / segTotal) * ch)
                  const r = { ...sg, y: segY, h }
                  segY += h
                  return r
                })
                // 라벨 y 좌표 — 조각 중심 기준, 겹치면 13px 간격으로 아래로 밀기
                const LABEL_GAP = 13
                let prevY = COST_Y - LABEL_GAP
                const labelY = segRects.map((sg) => {
                  const yy = Math.max(sg.y + sg.h / 2, prevY + LABEL_GAP)
                  prevY = yy
                  return yy
                })
                const stackBottom = Math.max(COST_Y + ch, labelY[labelY.length - 1] ?? COST_Y + ch)
                const multi = segs.length > 1
                return (
                  <>
                    <path
                      d={band(x + NODE_W, splitTop, FLOW_TOP + mh[i], costX, COST_Y, COST_Y + ch)}
                      fill="rgba(239,68,68,0.18)"
                    />
                    {multi ? (
                      segRects.map((sg) => (
                        <rect
                          key={sg.label}
                          x={costX} y={sg.y} width={COST_W} height={sg.h}
                          fill={sg.color} stroke="#fff" strokeWidth="0.8"
                        />
                      ))
                    ) : (
                      <rect x={costX} y={COST_Y} width={COST_W} height={ch} fill="#ef4444" rx="1.5" />
                    )}
                    {/* 조각 → 품목·숫자 리더선 라벨 (막대 오른쪽) */}
                    {segRects.map((sg, k) => (
                      <g key={`lb-${sg.label}`}>
                        <path
                          d={`M${costX + COST_W},${sg.y + sg.h / 2} C${costX + COST_W + 7},${sg.y + sg.h / 2} ${costX + COST_W + 7},${labelY[k]} ${costX + COST_W + 13},${labelY[k]}`}
                          fill="none" stroke={multi ? sg.color : '#ef4444'} strokeWidth="1.2"
                        />
                        <text
                          x={costX + COST_W + 17} y={labelY[k] + 3.2}
                          fontSize="9.5" fill="#64748b"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {sg.label} <tspan fontWeight="800" fill="#334155">{compactKRW(sg.amount)}</tspan>
                          {multi && (
                            <tspan fill="#b91c1c" fontWeight="700"> {segTotal > 0 ? Math.round((sg.amount / segTotal) * 100) : 0}%</tspan>
                          )}
                        </text>
                      </g>
                    ))}
                    {/* 총액 헤더 — 막대·라벨 스택 아래 */}
                    <text x={cx2} y={stackBottom + 20} textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748b">
                      (−) {c.label}
                    </text>
                    <text x={cx2} y={stackBottom + 36} textAnchor="middle" fontSize="13" fontWeight="700" fill="#b91c1c" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatKRW(c.v)}
                    </text>
                    <text x={cx2} y={stackBottom + 50} textAnchor="middle" fontSize="10" fill="#94a3b8">
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
