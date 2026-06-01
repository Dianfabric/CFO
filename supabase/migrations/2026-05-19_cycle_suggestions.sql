-- 12주 사이클 건의사항 — 직원이 매주 작성, 회의에서 토론, 체크 시 해결로 처리
-- · 작성: 직원별 OKR 페이지 → 주별 카드 펼침 → 금요일 아래 입력
-- · 표시: 회사 미니 헤더 strip + WAM 회의자료 + 12주 사이클 도구 목록 페이지
-- · 해결: 체크박스 클릭 → status=resolved + resolved_at 자동 기록

CREATE TABLE IF NOT EXISTS cycle_suggestions (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  week_number_created INT NOT NULL CHECK (week_number_created BETWEEN 1 AND 12),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_at TIMESTAMPTZ,
  resolved_note TEXT,
  resolved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cycle_suggestions_cycle ON cycle_suggestions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_suggestions_status ON cycle_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_cycle_suggestions_week ON cycle_suggestions(cycle_id, week_number_created);

-- RLS — V2.2 anon 허용 (CLAUDE.md §0.1 로그인 해제 상태)
ALTER TABLE cycle_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cycle_suggestions_all_anon ON cycle_suggestions;
CREATE POLICY cycle_suggestions_all_anon ON cycle_suggestions FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE cycle_suggestions IS '12주 사이클 건의/개선 요청 — 직원이 매주 작성, 월요일 회의에서 토론, 해결 시 체크';
COMMENT ON COLUMN cycle_suggestions.week_number_created IS '작성된 주차 (1~12)';
COMMENT ON COLUMN cycle_suggestions.status IS 'open=미해결, resolved=해결됨 (미니 헤더에서 사라짐)';
