-- ============================================================
-- OKR 시스템 v2 — 빅 목표 / KR 메트릭 코드 / WAM 자기평가
-- ============================================================
-- 기존 cycle_okr.sql 의 employees / employee_goals / key_results /
-- weekly_targets / daily_todos 위에 얹는 증분 마이그레이션.
-- 데이터 보존, 컬럼 추가 + 신규 테이블.
-- ============================================================

-- 0. employee_goals — 빅 목표 플래그
ALTER TABLE employee_goals
  ADD COLUMN IF NOT EXISTS is_big_goal BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_employee_goals_big
  ON employee_goals(employee_id, cycle_id)
  WHERE is_big_goal = true;

-- 1. key_results — 메트릭 코드 (E.2 lib/kr-metrics.ts 의 code 값)
ALTER TABLE key_results
  ADD COLUMN IF NOT EXISTS metric_code TEXT;
-- 'revenue', 'margin', 'content', 'meeting', 'follower', 'contract',
-- 'designer_contact', 'sample', 'hours', 'custom' 등

ALTER TABLE key_results
  ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN NOT NULL DEFAULT false;
-- true 면 후행지표 자동 집계 대상 (transactions 기반)

CREATE INDEX IF NOT EXISTS idx_key_results_metric
  ON key_results(metric_code) WHERE metric_code IS NOT NULL;

-- 2. weekly_self_scores — 직원·주차별 자기평가 (1~5)
DROP TABLE IF EXISTS weekly_self_scores CASCADE;
CREATE TABLE weekly_self_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id    INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  week_number INT NOT NULL CHECK (week_number BETWEEN 1 AND 12),
  self_score  INT NOT NULL CHECK (self_score BETWEEN 1 AND 5),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cycle_id, employee_id, week_number)
);

CREATE INDEX idx_weekly_self_scores_emp ON weekly_self_scores(employee_id, cycle_id);

CREATE OR REPLACE FUNCTION update_self_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_weekly_self_scores_updated_at
BEFORE UPDATE ON weekly_self_scores
FOR EACH ROW EXECUTE FUNCTION update_self_scores_updated_at();

ALTER TABLE weekly_self_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_self_scores_all_anon"
ON weekly_self_scores FOR ALL USING (true) WITH CHECK (true);

-- 3. 헬퍼 함수 — 빅 목표 토글 시 다른 빅 자동 해제
CREATE OR REPLACE FUNCTION enforce_single_big_goal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_big_goal = true THEN
    UPDATE employee_goals
       SET is_big_goal = false
     WHERE cycle_id = NEW.cycle_id
       AND employee_id = NEW.employee_id
       AND id <> NEW.id
       AND is_big_goal = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_goals_single_big ON employee_goals;
CREATE TRIGGER trg_employee_goals_single_big
AFTER INSERT OR UPDATE OF is_big_goal ON employee_goals
FOR EACH ROW
WHEN (NEW.is_big_goal = true)
EXECUTE FUNCTION enforce_single_big_goal();

-- 4. WAM 점수 뷰 — 직원·주차별 자동 점수 + 자기평가 결합
-- 산식:
--   투두 실행률 (week_done / week_total) * 50
--   + KR 진행률 (현재 사이클 KR avg progress * 100) * 0.5
--   = base_score (0~100)
--   자기평가 보정: 1→×0.8, 2→×0.9, 3→×1.0, 4→×1.1, 5→×1.2
--   final_score = LEAST(120, base_score * multiplier)
CREATE OR REPLACE VIEW v_wam_weekly_scores AS
WITH active_cycle AS (
  SELECT id, cycle_number, start_date, end_date
  FROM cycles WHERE status = 'active'
  ORDER BY cycle_number DESC LIMIT 1
),
emp_kr_progress AS (
  -- 직원별 현재 사이클 KR 평균 진행률
  SELECT
    e.id AS employee_id,
    COALESCE(AVG(
      CASE
        WHEN kr.target_value = kr.start_value THEN
          CASE WHEN kr.current_value >= kr.target_value THEN 1 ELSE 0 END
        ELSE GREATEST(0, LEAST(1,
          (kr.current_value - kr.start_value)
            / NULLIF(kr.target_value - kr.start_value, 0)))
      END
    ), 0) AS avg_kr_progress
  FROM employees e
  LEFT JOIN employee_goals g
    ON g.employee_id = e.id
   AND g.cycle_id = (SELECT id FROM active_cycle)
  LEFT JOIN key_results kr ON kr.goal_id = g.id
  WHERE e.active = true
  GROUP BY e.id
)
SELECT
  e.id AS employee_id,
  e.name AS employee_name,
  e.color AS employee_color,
  w AS week_number,
  ac.id AS cycle_id,
  -- 그 주 todo 통계
  (SELECT COUNT(*) FROM daily_todos d
    WHERE d.employee_id = e.id
      AND d.date >= ac.start_date + ((w - 1) * 7)
      AND d.date <= ac.start_date + ((w - 1) * 7 + 6)
  ) AS week_total,
  (SELECT COUNT(*) FROM daily_todos d
    WHERE d.employee_id = e.id
      AND d.status = 'done'
      AND d.date >= ac.start_date + ((w - 1) * 7)
      AND d.date <= ac.start_date + ((w - 1) * 7 + 6)
  ) AS week_done,
  ekp.avg_kr_progress,
  (SELECT self_score FROM weekly_self_scores wss
    WHERE wss.employee_id = e.id
      AND wss.cycle_id = ac.id
      AND wss.week_number = w
  ) AS self_score
FROM active_cycle ac
CROSS JOIN generate_series(1, 12) AS w
CROSS JOIN employees e
LEFT JOIN emp_kr_progress ekp ON ekp.employee_id = e.id
WHERE e.active = true;

-- 끝
