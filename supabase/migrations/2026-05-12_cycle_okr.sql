-- ============================================================
-- 12주 사이클 OKR 체계 (V2.4)
-- ============================================================
-- 계층 구조:
--   employees (직원 마스터, 6~10명)
--     └─ employee_goals (직원별 12주 목표, 3개 권장)
--          └─ key_results (목표당 KR 3개)
--               └─ weekly_targets (KR당 12주 분 주간 타겟)
--                    └─ daily_todos (일일 투두, 협업 태그)
--
-- B2B / B2C / both 트랙 분리.
-- key_results.is_company_pinned 으로 메인 대시보드 핀.
-- daily_todos.collaborator_ids 로 협업 태그.
-- ============================================================

-- 0. 클린업 (재실행 안전)
DROP TABLE IF EXISTS daily_todos CASCADE;
DROP TABLE IF EXISTS weekly_targets CASCADE;
DROP TABLE IF EXISTS key_results CASCADE;
DROP TABLE IF EXISTS employee_goals CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TYPE IF EXISTS business_track CASCADE;
DROP TYPE IF EXISTS kr_unit CASCADE;
DROP TYPE IF EXISTS todo_status CASCADE;
DROP TYPE IF EXISTS goal_status CASCADE;

-- 1. enums
CREATE TYPE business_track AS ENUM ('b2b', 'b2c', 'both');
CREATE TYPE kr_unit AS ENUM ('KRW', 'count', 'percent', 'ratio', 'hours', 'other');
CREATE TYPE todo_status AS ENUM ('todo', 'doing', 'done', 'blocked');
CREATE TYPE goal_status AS ENUM ('active', 'paused', 'done', 'cancelled');

-- ============================================================
-- 2. employees (직원 마스터)
-- ============================================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  role_label  TEXT,                    -- '대표', '부장', '과장', '팀장' 등 직위
  department  TEXT,                    -- '영업', '마케팅', '운영', 'B2C 신사업' 등 (옵션)
  business_track business_track NOT NULL DEFAULT 'both',
  color       TEXT NOT NULL DEFAULT '#76b900',  -- 카드 색상
  avatar_emoji TEXT,                    -- 이모지 아바타 (옵션)
  is_leader   BOOLEAN NOT NULL DEFAULT false,    -- 대표 여부
  active      BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  profile_id  UUID,                     -- profiles.id 와 매핑 (추후 로그인 연결, nullable)
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_employees_active ON employees(active, display_order);

-- ============================================================
-- 3. employee_goals (직원별 12주 목표)
-- ============================================================
CREATE TABLE employee_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id     INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  business_track business_track NOT NULL DEFAULT 'both',
  status       goal_status NOT NULL DEFAULT 'active',
  display_order INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_employee_goals_cycle    ON employee_goals(cycle_id);
CREATE INDEX idx_employee_goals_employee ON employee_goals(employee_id);
CREATE INDEX idx_employee_goals_track    ON employee_goals(business_track);

-- ============================================================
-- 4. key_results (목표당 KR — 3개 권장)
-- ============================================================
CREATE TABLE key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      UUID NOT NULL REFERENCES employee_goals(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  unit         kr_unit NOT NULL DEFAULT 'count',
  is_leading   BOOLEAN NOT NULL DEFAULT false,   -- 선행지표 여부
  start_value  NUMERIC(14, 2) DEFAULT 0,
  target_value NUMERIC(14, 2) NOT NULL,
  current_value NUMERIC(14, 2) DEFAULT 0,
  is_company_pinned BOOLEAN NOT NULL DEFAULT false,  -- 메인 대시보드 핀
  pinned_order INT,                              -- 핀 순서 (1, 2, 3...)
  display_order INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_key_results_goal     ON key_results(goal_id);
CREATE INDEX idx_key_results_pinned   ON key_results(is_company_pinned, pinned_order)
  WHERE is_company_pinned = true;

-- ============================================================
-- 5. weekly_targets (KR 당 12주 분 주간 타겟)
-- ============================================================
CREATE TABLE weekly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_id UUID NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
  week_number   INT NOT NULL CHECK (week_number BETWEEN 1 AND 12),
  target_value  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  actual_value  NUMERIC(14, 2) DEFAULT 0,
  note          TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(key_result_id, week_number)
);
CREATE INDEX idx_weekly_targets_kr ON weekly_targets(key_result_id, week_number);

-- ============================================================
-- 6. daily_todos (일일 투두 — 주간 계획 + 매일 추가 둘 다)
-- ============================================================
CREATE TABLE daily_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  weekly_target_id UUID REFERENCES weekly_targets(id) ON DELETE SET NULL,
  date             DATE NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  status           todo_status NOT NULL DEFAULT 'todo',
  is_shared        BOOLEAN NOT NULL DEFAULT false,
  collaborator_ids UUID[] DEFAULT ARRAY[]::UUID[],   -- 협업 직원 id 들
  priority         INT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  order_in_day     INT NOT NULL DEFAULT 0,
  blocker_note     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);
CREATE INDEX idx_daily_todos_employee_date ON daily_todos(employee_id, date);
CREATE INDEX idx_daily_todos_date          ON daily_todos(date);
CREATE INDEX idx_daily_todos_weekly_target ON daily_todos(weekly_target_id) WHERE weekly_target_id IS NOT NULL;
CREATE INDEX idx_daily_todos_collab        ON daily_todos USING gin (collaborator_ids);

-- ============================================================
-- 7. updated_at 트리거 (공통)
-- ============================================================
CREATE OR REPLACE FUNCTION update_okr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employees_updated_at      BEFORE UPDATE ON employees      FOR EACH ROW EXECUTE FUNCTION update_okr_updated_at();
CREATE TRIGGER trg_employee_goals_updated_at BEFORE UPDATE ON employee_goals FOR EACH ROW EXECUTE FUNCTION update_okr_updated_at();
CREATE TRIGGER trg_key_results_updated_at    BEFORE UPDATE ON key_results    FOR EACH ROW EXECUTE FUNCTION update_okr_updated_at();
CREATE TRIGGER trg_weekly_targets_updated_at BEFORE UPDATE ON weekly_targets FOR EACH ROW EXECUTE FUNCTION update_okr_updated_at();

-- todo 완료시 completed_at 자동 갱신
CREATE OR REPLACE FUNCTION update_todo_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status <> 'done') THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_todos_completed_at BEFORE UPDATE ON daily_todos FOR EACH ROW EXECUTE FUNCTION update_todo_completed_at();

-- ============================================================
-- 8. RLS (anon 허용 - V2.2 로그인 강제 해제 상태)
-- ============================================================
ALTER TABLE employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_todos    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_all_anon"      ON employees      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "employee_goals_all_anon" ON employee_goals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "key_results_all_anon"    ON key_results    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "weekly_targets_all_anon" ON weekly_targets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "daily_todos_all_anon"    ON daily_todos    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 9. 초기 직원 6명 INSERT
-- ============================================================
INSERT INTO employees (name, role_label, department, business_track, color, avatar_emoji, is_leader, display_order, active)
VALUES
  ('한태원', '대표',  '경영',     'both', '#76b900', '👑', true,  1, true),
  ('한태종', '부장',  '영업',     'b2b',  '#0ea5e9', NULL, false, 2, true),
  ('유대현', '과장',  '운영',     'both', '#f59e0b', NULL, false, 3, true),
  ('최현진', '팀장',  '마케팅',   'b2c',  '#a855f7', NULL, false, 4, true),
  ('김범중', '과장',  '영업',     'b2b',  '#f43f5e', NULL, false, 5, true),
  ('박여천', '과장',  'B2C 신사업', 'b2c', '#14b8a6', NULL, false, 6, true);

-- ============================================================
-- 10. 편의 뷰 — 회사 전체 핀 KR (메인 대시보드용)
-- ============================================================
CREATE OR REPLACE VIEW v_company_pinned_krs AS
SELECT
  kr.id            AS kr_id,
  kr.title         AS kr_title,
  kr.unit,
  kr.is_leading,
  kr.start_value,
  kr.target_value,
  kr.current_value,
  kr.pinned_order,
  CASE
    WHEN kr.target_value = kr.start_value THEN 0
    ELSE LEAST(
      100,
      GREATEST(0, (kr.current_value - kr.start_value)
              / NULLIF(kr.target_value - kr.start_value, 0) * 100)
    )
  END              AS progress_pct,
  g.id             AS goal_id,
  g.title          AS goal_title,
  g.business_track,
  e.id             AS employee_id,
  e.name           AS employee_name,
  e.role_label,
  e.color          AS employee_color,
  c.id             AS cycle_id,
  c.cycle_number,
  c.start_date     AS cycle_start,
  c.end_date       AS cycle_end
FROM key_results kr
JOIN employee_goals g ON g.id = kr.goal_id
JOIN employees e      ON e.id = g.employee_id
JOIN cycles c         ON c.id = g.cycle_id
WHERE kr.is_company_pinned = true
  AND c.status = 'active'
  AND e.active = true
ORDER BY kr.pinned_order NULLS LAST, kr.created_at;

-- ============================================================
-- 끝
-- ============================================================
