-- 12주 사이클 1:1 (One-on-One) 미팅 요청
-- · 작성: 직원별 OKR 페이지 → 주별 카드 펼침 → 건의사항 아래 입력
-- · 자동: POST 시 요청자/대상자 일일 투두에 자동 todo 2개 생성 (source_one_on_one_id 연결)
-- · 표시: 다음 주 WAM 회의 페이지에서 1:1 미팅 예정 표시
-- · 삭제: 1:1 미팅 삭제 시 연결된 daily_todos 도 CASCADE 자동 삭제

CREATE TABLE IF NOT EXISTS cycle_one_on_ones (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  week_number_created INT NOT NULL CHECK (week_number_created BETWEEN 1 AND 12),
  requester_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  meeting_time TIME,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_different_persons CHECK (requester_id != target_id)
);

CREATE INDEX IF NOT EXISTS idx_cycle_one_on_ones_cycle ON cycle_one_on_ones(cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_one_on_ones_date ON cycle_one_on_ones(meeting_date);
CREATE INDEX IF NOT EXISTS idx_cycle_one_on_ones_requester ON cycle_one_on_ones(requester_id);
CREATE INDEX IF NOT EXISTS idx_cycle_one_on_ones_target ON cycle_one_on_ones(target_id);

-- daily_todos 에 1:1 미팅 source 연결 컬럼 추가 (이미 있어도 OK)
ALTER TABLE daily_todos
  ADD COLUMN IF NOT EXISTS source_one_on_one_id BIGINT
  REFERENCES cycle_one_on_ones(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_daily_todos_source_one_on_one
  ON daily_todos(source_one_on_one_id)
  WHERE source_one_on_one_id IS NOT NULL;

-- RLS — V2.2 anon 허용
ALTER TABLE cycle_one_on_ones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cycle_one_on_ones_all_anon ON cycle_one_on_ones;
CREATE POLICY cycle_one_on_ones_all_anon ON cycle_one_on_ones FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE cycle_one_on_ones IS '12주 사이클 1:1 미팅 요청 — POST 시 두 직원 daily_todos 에 자동 todo 2개 생성';
COMMENT ON COLUMN cycle_one_on_ones.requester_id IS '미팅 요청자';
COMMENT ON COLUMN cycle_one_on_ones.target_id IS '미팅 대상자';
COMMENT ON COLUMN daily_todos.source_one_on_one_id IS '1:1 미팅 자동 생성된 todo — 미팅 삭제 시 CASCADE 자동 삭제';
