-- ============================================================
-- 1일 체크리스트 — 매일 확인·입력해야 할 일 (공문/자료 페이지)
--
-- items: 체크 항목 마스터 (담당자 표시). checks: 날짜별 완료 기록
-- (하루 지나면 자동으로 미체크 상태로 시작 — 날짜 키 기반).
-- 시드: '색동 선물 내역 입력' (색동 신사업 재고 현황에 선물 기록)
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_checklist_items (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  memo TEXT,                    -- 설명 (무엇을 어디에 입력하는지)
  link TEXT,                    -- 관련 페이지 (예: /saekdong)
  assignee TEXT NOT NULL DEFAULT '대표', -- 담당자
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_checklist_checks (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES daily_checklist_items(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,     -- KST 기준 YYYY-MM-DD
  checked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (item_id, check_date)
);

ALTER TABLE daily_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_checklist_items_all_anon" ON daily_checklist_items;
CREATE POLICY "daily_checklist_items_all_anon" ON daily_checklist_items
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE daily_checklist_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_checklist_checks_all_anon" ON daily_checklist_checks;
CREATE POLICY "daily_checklist_checks_all_anon" ON daily_checklist_checks
  FOR ALL USING (true) WITH CHECK (true);

-- 시드: 색동 선물 내역 (중복 방지)
INSERT INTO daily_checklist_items (title, memo, link, assignee, sort_order)
SELECT
  '색동 선물 내역 입력',
  '오늘 선물(무료 증정)을 줬다면 색동 신사업 → 매입·비용 → 재고 현황에서 기록',
  '/saekdong',
  '대표',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM daily_checklist_items WHERE title = '색동 선물 내역 입력'
);
