/**
 * 경영 계기판 — 연동 예정 섹션.
 *
 * 매입·고정비·변동비·입금확인·발행·재고는 IntegratedSections 로 통합 완료.
 * 남은 것: 엔에이아이디(법인) 매출 연동, 본체 스와치·샘플 재고.
 */
import { Building2, Boxes } from 'lucide-react'

const SECTIONS = [
  {
    title: '법인 매출 (엔에이아이디)',
    desc: '법인 거래 매출·비용 — 데이터 소스 결정 후 연동',
    icon: Building2,
  },
  {
    title: '본체 재고 (스와치·샘플)',
    desc: '스와치·샘플북·샘플 재고 — 색동 재고 방식 확장 예정',
    icon: Boxes,
  },
]

export default function UpcomingSections() {
  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-slate-900">연동 예정</h2>
      <p className="mb-3 text-xs text-slate-400">다음 단계에서 이 페이지에 통합됩니다.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.title}
              className="bg-white p-4 h-full"
              style={{ border: '1px dashed var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className="w-4 h-4 text-slate-400" />
                <span
                  className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400"
                  style={{ backgroundColor: '#f1f5f9', borderRadius: '2px' }}
                >
                  연동 예정
                </span>
              </div>
              <div className="text-[13px] font-bold text-slate-700">{s.title}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{s.desc}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
