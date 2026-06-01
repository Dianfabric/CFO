-- ============================================================
-- KR 페어 모델 — 한 KR 이 선행 + 후행 두 측정값을 가짐
-- ============================================================
-- 기존:
--   key_results.metric_code/unit/start_value/target_value/current_value
--     → 이게 "선행 측정값" 으로 의미 재정의
--   is_leading 은 의미 약화 (호환성 유지)
--
-- 신규 lag_* 컬럼들 → 후행 측정값
--   lag_metric_code, lag_unit, lag_start_value, lag_target_value,
--   lag_current_value, lag_auto_sync
--
-- 한 KR 카드가 "활동(선행) → 결과(후행)" 흐름을 표시.
-- 둘 다 NULLable — 한쪽만 설정해도 작동 (호환성).
-- ============================================================

ALTER TABLE key_results
  ADD COLUMN IF NOT EXISTS lag_metric_code TEXT,
  ADD COLUMN IF NOT EXISTS lag_unit kr_unit,
  ADD COLUMN IF NOT EXISTS lag_start_value  NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS lag_target_value NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS lag_current_value NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS lag_auto_sync BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_key_results_lag_metric
  ON key_results(lag_metric_code) WHERE lag_metric_code IS NOT NULL;
