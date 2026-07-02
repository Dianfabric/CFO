/**
 * 경영 계기판 — 단계적 통합 섹션 골격.
 *
 * 색동 신사업 페이지 방식(매출 → 입금·발행 확인 → 매입·비용 → 재고)을
 * 디안 전체로 확장하는 자리. 하나씩 이 페이지에 통합해 나간다.
 */
import Link from 'next/link'
import {
  Building2, Banknote, FileCheck2, Package, Lock, Shuffle, Boxes, ArrowRight,
} from 'lucide-react'

const SECTIONS = [
  {
    title: '법인 매출 (엔에이아이디)',
    desc: '법인 거래 매출 — 데이터 연동 준비 중',
    icon: Building2,
    href: null,
    status: '연동 예정',
  },
  {
    title: '쇼핑몰 입금 확인',
    desc: '아임웹 매출 ↔ 통장 입금 자동 대사 (현재 색동 페이지)',
    icon: Banknote,
    href: '/saekdong',
    status: '통합 예정',
  },
  {
    title: '세금계산서 발행 현황',
    desc: '매출 발행·수취 체크 (현재 색동 오프라인 매출)',
    icon: FileCheck2,
    href: '/saekdong',
    status: '통합 예정',
  },
  {
    title: '매입 관리',
    desc: '원단·완제품 매입 + 송금·계산서 체크 (현재 색동)',
    icon: Package,
    href: '/saekdong',
    status: '통합 예정',
  },
  {
    title: '고정비',
    desc: '디안 전체 고정비 — 현재 색동 비용 탭 + 비용 관리',
    icon: Lock,
    href: '/costs',
    status: '통합 예정',
  },
  {
    title: '변동비',
    desc: '디안 전체 변동비 — 현재 색동 비용 탭 + 비용 관리',
    icon: Shuffle,
    href: '/costs',
    status: '통합 예정',
  },
  {
    title: '재고 (스와치·샘플)',
    desc: '스와치·샘플북·샘플 재고 — 색동 재고 방식 확장',
    icon: Boxes,
    href: null,
    status: '연동 예정',
  },
]

export default function UpcomingSections() {
  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-slate-900">단계적 통합 섹션</h2>
      <p className="mb-3 text-xs text-slate-400">
        색동 신사업에서 검증한 방식을 디안 전체로 확장합니다 — 하나씩 이 페이지에 통합해
        나갑니다.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const card = (
            <div
              className="bg-white p-4 h-full transition-colors"
              style={{ border: '1px dashed var(--nv-hairline, #e2e8f0)', borderRadius: '2px' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className="w-4 h-4" style={{ color: 'var(--nv-mute, #64748b)' }} />
                <span
                  className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
                  style={{
                    backgroundColor: s.href ? 'rgba(118,185,0,0.1)' : '#f1f5f9',
                    color: s.href ? 'var(--nv-success-deep, #4a7c00)' : '#94a3b8',
                    borderRadius: '2px',
                  }}
                >
                  {s.status}
                </span>
              </div>
              <div className="text-[13px] font-bold text-slate-800">{s.title}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{s.desc}</div>
              {s.href && (
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--nv-success-deep, #4a7c00)' }}>
                  지금은 여기서 <ArrowRight className="w-3 h-3" />
                </div>
              )}
            </div>
          )
          return s.href ? (
            <Link key={s.title} href={s.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={s.title}>{card}</div>
          )
        })}
      </div>
    </div>
  )
}
