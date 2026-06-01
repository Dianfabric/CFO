-- ============================================================
-- 사이클 archive — 종료 / AI 요약 / 회고 / carryover
-- ============================================================
-- cycles 에 컬럼 추가:
--   completed_at       : 사이클 종료 시점
--   ai_summary         : Claude 가 생성한 한 줄 요약
--   ai_analysis        : Claude 가 생성한 상세 분석 (JSON)
--   retro_data         : 직원별 4가지 회고 답변 (JSONB)
--   previous_cycle_id  : 이전 사이클 (carryover 추적)
--   total_revenue      : 사이클 누적 매출 (스냅샷 — 종료 시점)
--   total_margin       : 사이클 누적 마진 (스냅샷)
-- ============================================================

ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
  ADD COLUMN IF NOT EXISTS retro_data JSONB,
  ADD COLUMN IF NOT EXISTS previous_cycle_id INTEGER REFERENCES cycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_revenue NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS total_margin NUMERIC(14, 2);

CREATE INDEX IF NOT EXISTS idx_cycles_completed ON cycles(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cycles_previous ON cycles(previous_cycle_id) WHERE previous_cycle_id IS NOT NULL;
