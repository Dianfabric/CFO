-- ============================================================
-- 색동 신사업 — 비전 / 미션 (단일 행, id = 1)
-- 색동 페이지에서 사장님이 직접 작성·수정. 회사 전체 비전
-- (long_term_vision) 과는 별도.
-- ============================================================

CREATE TABLE IF NOT EXISTS saekdong_vision (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vision TEXT,
  mission TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

-- 기본 행 보장 (없으면 생성)
INSERT INTO saekdong_vision (id, vision, mission)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- RLS — 현재 로그인 비활성(V2.2) 상태라 anon 읽기·수정 허용
ALTER TABLE saekdong_vision ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saekdong_vision_all_anon" ON saekdong_vision;
CREATE POLICY "saekdong_vision_all_anon"
ON saekdong_vision
FOR ALL
USING (true)
WITH CHECK (true);
