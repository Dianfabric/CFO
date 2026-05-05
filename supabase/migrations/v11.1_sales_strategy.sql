-- ============================================================================
-- v1.1 마이그레이션: 영업 전략 (#2a) 스키마
-- ============================================================================
-- 적용 방법: Supabase SQL Editor에 붙여넣고 Run
-- 기존 테이블·데이터에는 영향 없음 (새 객체만 추가)
-- ============================================================================

-- 1) ENUM 타입
DO $$ BEGIN
  CREATE TYPE sales_activity_type AS ENUM (
    'call',           -- 전화
    'meeting',        -- 미팅
    'email',          -- 이메일/카톡
    'sample_send',    -- 샘플 발송
    'sample_return',  -- 샘플 반환
    'catalog_send',   -- 카탈로그/SS·FW 룩북
    'proposal_send',  -- 제안서/견적
    'consultation',   -- 큐레이션 컨설팅
    'follow_up',      -- 후속 연락
    'visit',          -- 방문
    'event',          -- 전시·박람회·세미나
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE sales_stage_7 AS ENUM (
    'prospecting',    -- 1. 탐색 (탐색·니즈 가설)
    'rapport',        -- 2. 관계 형성 (친밀감·신뢰)
    'needs',          -- 3. 니즈 파악 (인터뷰·관찰)
    'presentation',   -- 4. 제안 (큐레이션·샘플·제안서)
    'objection',      -- 5. 이의 처리 (반대 의견 응대)
    'closing',        -- 6. 성사 (수주·계약)
    'follow_up'       -- 7. 사후 관리 (재구매·추천)
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE objection_type AS ENUM (
    'price',          -- 가격 부담
    'quality',        -- 품질 의문
    'lead_time',      -- 납기 우려
    'competitor',     -- 경쟁사 사용중
    'budget',         -- 예산 이슈
    'authority',      -- 결정권자 부재
    'urgency',        -- 시급성 부족
    'fit',            -- 디자인·소재 맞지 않음
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE need_card_status AS ENUM (
    'new',            -- 발견됨
    'shared',         -- 팀 공유
    'in_progress',    -- 대응 중
    'addressed',      -- 해결됨
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) clients 테이블 확장 — 7단계 + 라이프사이클 + 영업담당자
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS current_stage sales_stage_7 DEFAULT 'prospecting',
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT DEFAULT 'new',  -- new/growing/mature/at_risk/churned
  ADD COLUMN IF NOT EXISTS last_contact_date DATE,
  ADD COLUMN IF NOT EXISTS dream100 BOOLEAN DEFAULT false;  -- Dream 100 표적 여부

CREATE INDEX IF NOT EXISTS idx_clients_stage ON clients(current_stage);
CREATE INDEX IF NOT EXISTS idx_clients_agent ON clients(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_clients_lifecycle ON clients(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_clients_dream100 ON clients(dream100) WHERE dream100 = true;

-- 3) 영업 활동 (Activities)
CREATE TABLE IF NOT EXISTS sales_activities (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id),  -- 사람 또는 AI 에이전트 (profiles.role='ai_agent')
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  activity_type sales_activity_type NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_time TIME,
  duration_minutes INTEGER,  -- 미팅·통화 시간
  -- 결과
  outcome TEXT,                       -- 결과 한 줄
  value_generated NUMERIC(12,2),      -- 즉시 매출 발생액 (있으면)
  next_action TEXT,                   -- 다음 행동
  next_action_date DATE,
  -- 단계 변동 (트레이시 7단계)
  stage_before sales_stage_7,
  stage_after sales_stage_7,
  -- 메타
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_activities_agent_date ON sales_activities(agent_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_activities_client ON sales_activities(client_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_activities_type ON sales_activities(activity_type);

-- 4) 단계 전환 이력 (Stage Transitions) — 자동 기록
CREATE TABLE IF NOT EXISTS stage_transitions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  from_stage sales_stage_7,
  to_stage sales_stage_7 NOT NULL,
  transition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  days_in_previous_stage INTEGER,
  triggered_by_activity INTEGER REFERENCES sales_activities(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_transitions_client ON stage_transitions(client_id, transition_date DESC);

-- 5) 거절·이의 기록 (Objection Records)
CREATE TABLE IF NOT EXISTS sales_objections (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id),
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  objection_type objection_type NOT NULL,
  lost_stage sales_stage_7,             -- 어느 단계에서 막혔는지
  description TEXT,
  resolution TEXT,                      -- 어떻게 해결했는지 (또는 결국 잃었는지)
  resolved BOOLEAN DEFAULT false,
  learning_note TEXT,                   -- 다음에 적용할 학습
  occurred_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_objections_type ON sales_objections(objection_type);
CREATE INDEX IF NOT EXISTS idx_sales_objections_agent ON sales_objections(agent_id);

-- 6) 니즈 카드 (Need Cards) — 디자이너 인사이트 보드
CREATE TABLE IF NOT EXISTS need_cards (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id),
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  category TEXT,                        -- '소재', '컨셉', '컬러', '시즌', '가격', '사이즈', '기타'
  description TEXT NOT NULL,            -- 니즈 핵심 문장
  discovery_method TEXT,                -- '인터뷰', '관찰', 'DM', '미팅', '전시'
  status need_card_status DEFAULT 'new',
  votes INTEGER DEFAULT 0,              -- 다른 멤버가 동의/공감
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_need_cards_status ON need_cards(status);
CREATE INDEX IF NOT EXISTS idx_need_cards_category ON need_cards(category);
CREATE INDEX IF NOT EXISTS idx_need_cards_client ON need_cards(client_id);

-- 7) 영업 KPI 스냅샷 (월/주별 자동 누적용)
CREATE TABLE IF NOT EXISTS sales_kpi_snapshots (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT DEFAULT 'week',      -- 'week' | 'month'
  -- 활동 KPI (선행지표)
  meetings INTEGER DEFAULT 0,
  calls INTEGER DEFAULT 0,
  samples_sent INTEGER DEFAULT 0,
  contacts INTEGER DEFAULT 0,           -- 신규 컨택
  proposals INTEGER DEFAULT 0,
  -- 결과 KPI (후행지표)
  quotes_amount NUMERIC(12,2) DEFAULT 0,
  sales_amount NUMERIC(12,2) DEFAULT 0,
  new_clients INTEGER DEFAULT 0,
  retained_clients INTEGER DEFAULT 0,   -- 재구매
  lost_clients INTEGER DEFAULT 0,       -- 이탈
  -- 시간 효율
  total_hours NUMERIC(6,2) DEFAULT 0,
  time_charge NUMERIC(12,2) DEFAULT 0,  -- 시간당 매출 환산
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, period_start, period_end, period_type)
);

CREATE INDEX IF NOT EXISTS idx_kpi_agent_period ON sales_kpi_snapshots(agent_id, period_start DESC);

-- 8) AI 추천 (AIRecommendation)
CREATE TABLE IF NOT EXISTS ai_sales_recommendations (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id),
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  recommendation_type TEXT,             -- 'next_action', 'objection_handling', 'segment_message', 'content_suggestion'
  recommendation TEXT NOT NULL,
  rationale TEXT,
  status TEXT DEFAULT 'pending',        -- 'pending' | 'accepted' | 'declined' | 'completed'
  generated_at TIMESTAMPTZ DEFAULT now(),
  acted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_sales_rec_agent ON ai_sales_recommendations(agent_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sales_rec_status ON ai_sales_recommendations(status);

-- 9) 24셀 세그먼트 메시지 보강 (segments 테이블 확장 — 비어있다면)
ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS sales_sequence TEXT[],
  ADD COLUMN IF NOT EXISTS recommended_catalog TEXT,
  ADD COLUMN IF NOT EXISTS typical_objections TEXT[],
  ADD COLUMN IF NOT EXISTS conversion_tips TEXT;

-- 10) 자동 트리거: 영업 활동 등록 시 client.last_contact_date 갱신 + 단계 전환 자동 기록
CREATE OR REPLACE FUNCTION update_client_on_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 마지막 컨택일 갱신
  UPDATE clients SET last_contact_date = NEW.activity_date
  WHERE id = NEW.client_id AND (last_contact_date IS NULL OR last_contact_date < NEW.activity_date);

  -- 단계 전환이 있으면 stage_transitions에 기록 + clients.current_stage 갱신
  IF NEW.stage_after IS NOT NULL AND NEW.stage_after IS DISTINCT FROM NEW.stage_before THEN
    INSERT INTO stage_transitions (client_id, from_stage, to_stage, transition_date, triggered_by_activity)
    VALUES (NEW.client_id, NEW.stage_before, NEW.stage_after, NEW.activity_date, NEW.id);

    UPDATE clients SET current_stage = NEW.stage_after WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_client_on_activity ON sales_activities;
CREATE TRIGGER trg_update_client_on_activity
  AFTER INSERT ON sales_activities
  FOR EACH ROW EXECUTE FUNCTION update_client_on_activity();

-- 11) 뷰: 거래처별 영업 활동 요약
CREATE OR REPLACE VIEW client_activity_summary AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  c.current_stage,
  c.lifecycle_stage,
  c.dream100,
  c.last_contact_date,
  COUNT(a.id) AS total_activities,
  COUNT(a.id) FILTER (WHERE a.activity_date >= CURRENT_DATE - INTERVAL '30 days') AS activities_30d,
  COUNT(a.id) FILTER (WHERE a.activity_type IN ('meeting', 'visit')) AS meetings,
  COUNT(a.id) FILTER (WHERE a.activity_type = 'sample_send') AS samples_sent,
  COALESCE(SUM(a.value_generated), 0) AS total_value_generated,
  MAX(a.activity_date) AS most_recent_activity
FROM clients c
LEFT JOIN sales_activities a ON a.client_id = c.id
GROUP BY c.id, c.name, c.current_stage, c.lifecycle_stage, c.dream100, c.last_contact_date;

-- 12) 뷰: 7단계 깔때기
CREATE OR REPLACE VIEW sales_funnel AS
SELECT
  current_stage,
  COUNT(*) AS client_count,
  COUNT(*) FILTER (WHERE dream100) AS dream100_count,
  COUNT(*) FILTER (WHERE last_contact_date >= CURRENT_DATE - INTERVAL '14 days') AS recent_count
FROM clients
WHERE active = true
GROUP BY current_stage
ORDER BY
  CASE current_stage
    WHEN 'prospecting' THEN 1
    WHEN 'rapport' THEN 2
    WHEN 'needs' THEN 3
    WHEN 'presentation' THEN 4
    WHEN 'objection' THEN 5
    WHEN 'closing' THEN 6
    WHEN 'follow_up' THEN 7
  END;

-- 13) RLS 정책
ALTER TABLE sales_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE need_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sales_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_transitions ENABLE ROW LEVEL SECURITY;

-- 영업 활동: CEO/임원 전체, 본인 활동 본인이
DO $$ BEGIN
  CREATE POLICY "sales_activities_select" ON sales_activities FOR SELECT USING (
    current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_activities_insert" ON sales_activities FOR INSERT WITH CHECK (
    current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_activities_update" ON sales_activities FOR UPDATE USING (
    current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_objections_all" ON sales_objections FOR ALL USING (
    current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "need_cards_all" ON need_cards FOR ALL USING (
    current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "kpi_snapshots_select" ON sales_kpi_snapshots FOR SELECT USING (
    current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "ai_sales_rec_all" ON ai_sales_recommendations FOR ALL USING (
    current_user_role() IN ('ceo', 'executive') OR agent_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "stage_transitions_select" ON stage_transitions FOR SELECT USING (
    current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- supabase_auth_admin은 자동 트리거에서 INSERT 가능해야 하므로 권한 부여
GRANT INSERT ON stage_transitions TO supabase_auth_admin;
GRANT UPDATE ON clients TO supabase_auth_admin;

-- ============================================================================
-- 완료. SQL Editor에서 다음 쿼리로 검증:
--   SELECT COUNT(*) FROM information_schema.tables
--     WHERE table_schema = 'public' AND table_name IN
--     ('sales_activities','stage_transitions','sales_objections','need_cards',
--      'sales_kpi_snapshots','ai_sales_recommendations');
--   -- 6이 나와야 정상
-- ============================================================================
