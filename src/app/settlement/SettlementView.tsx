'use client'

/**
 * 경영 계기판 — DIAN COMPASS.
 *
 * ① 디안 전체 경영지표 (생키 + 스트립 + BEP, 통합·본체·법인)
 * ② 경영 그래프 — 사업체별 매출·지출·이익 추이 + 출고 축 분석
 * ③ 쇼핑몰·비용·대사·세금·마감 인사이트 등 운영 섹션
 *
 * (구 '결산 상세' 일별 화면은 경영 그래프로 대체 — 결산 API 는
 *  DianOverview PULSE 가 계속 사용)
 */
import { Compass } from 'lucide-react'
import DianOverview from './DianOverview'
import BizTrends from './BizTrends'
import IntegratedSections from './IntegratedSections'
import DianShopSales from './DianShopSales'
import CostIntel from './CostIntel'
import LoanSection from './LoanSection'
import ReconCenter from './ReconCenter'
import BankInbox from './BankInbox'
import TaxPrep from './TaxPrep'
import MagamInsights from './MagamInsights'
import UpcomingSections from './UpcomingSections'

export default function SettlementView() {
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="max-w-2xl">
        <div className="mb-1 flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
            Dian Compass
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          경영 계기판 — 지금 어디에, 어디로.
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          흔들리는 것은 방향을 몰라서가 아니라, 지금 어디에 있는지 모르기 때문입니다.
          매출·이익·현금의 흐름으로 디안의 현재 위치를 확인하고 나아갈 방향을 짚는
          나침반입니다.
        </p>
        <p className="mt-2 border-l-2 border-slate-200 pl-2.5 text-xs italic text-slate-400">
          “측정할 수 없으면, 관리할 수 없다.” — 피터 드러커
        </p>
      </div>

      {/* ① 디안 전체 경영지표 + DIAN PULSE — 통합·본체·법인 손익 흐름 */}
      <DianOverview />

      {/* ② 경영 그래프 — 사업체별 매출·지출·이익 추이 + 직군·품목·가공 */}
      <BizTrends />

      {/* 디안 원단 쇼핑몰 매출 (아임웹 2호점 — 색동과 동일 방식) */}
      <DianShopSales />

      {/* ③ 비용 구조 · 입금·발행 확인 · 재고 — 본체+색동 통합 */}
      <IntegratedSections />

      {/* 비용 인텔리전스 — 관리회계 원장 (재량 절감·구독료 트래커) */}
      <CostIntel />

      {/* 대출·이자 — 원금/이자 상환 + 통장 크로스체크 (디안/법인) */}
      <LoanSection />

      {/* ④ 대사 센터 — 퍼지 매칭 제안 (매출↔세금계산서 · 통장입금↔미수) */}
      <ReconCenter />

      {/* 통장 미처리 인박스 — 남은 입출금 수동 처리 (거래처 연결 / 사유 분류) */}
      <BankInbox />

      {/* 세금 준비 — 분기 부가세 예상 + 미발행/미수취 파악 */}
      <TaxPrep />

      {/* 출고·마감 인사이트 — 미표기 추적 + 출고&미수 (거래 관리 연동 예정) */}
      <MagamInsights />

      {/* ⑤ 연동 예정 (엔에이아이디) */}
      <UpcomingSections />
    </div>
  )
}
