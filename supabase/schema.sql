-- ============================================================================
-- 디안(Dian) CFO 대시보드 v1.1 - 데이터베이스 스키마
-- Phase 0: P0 페이지 범위
--
-- 7개 PRD 카테고리 중 1차 출시(P0) 페이지를 위한 핵심 테이블·관계·뷰.
-- Supabase Postgres 기반. RLS(Row Level Security) 포함.
--
-- P0 페이지 (10-12개):
--   #1 12주 대시보드, 비전·목표
--   #2c 일일 운영 대시보드, 거래 입력
--   #3 재무 메인, 매출 인수분해
--   #4 포지셔닝 매트릭스, 4단계 워크플로우
--   #7 모닝 브리핑, 라이브 컨설팅
-- ============================================================================

-- ============================================================================
-- 1. ENUM 타입 정의
-- ============================================================================

CREATE TYPE user_role AS ENUM ('ceo', 'executive', 'employee', 'ai_agent');

-- 24셀 세그먼트의 직업군 (PRD #2a 자료)
CREATE TYPE occupation_type AS ENUM (
  'interior_project',        -- 인테리어 프로젝트
  'brand_furniture',         -- 브랜드 가구
  'project_furniture',       -- 프로젝트 가구
  'commercial_reupholster',  -- 업소용 천갈이
  'curtain_styling',         -- 커튼 스타일링
  'display'                  -- 디스플레이
);

-- 24셀 세그먼트의 제품군
CREATE TYPE product_division AS ENUM (
  'sofa',      -- 소파원단
  'curtain',   -- 커튼원단
  'wall',      -- 벽원단
  'accessory'  -- 소품원단
);

-- 4티어 포지셔닝 (PRD #4)
CREATE TYPE price_tier AS ENUM (
  'value',     -- 저가
  'mid',       -- 중가
  'premium',   -- 프리미엄
  'luxury'     -- 럭셔리
);

-- 거래처 등급 (PRD #3 ⑤ 고객 수익성)
CREATE TYPE client_tier AS ENUM (
  'vip',
  'general',
  'small',
  'growth_potential',
  'inefficient'
);

-- 거래 단계 (PRD #2c)
CREATE TYPE transaction_stage AS ENUM (
  'quote',      -- 견적
  'confirmed',  -- 확정
  'shipping',   -- 출하
  'delivered',  -- 납품
  'paid',       -- 입금
  'cancelled'   -- 취소
);

-- 비용 변동성 (PRD #3 ③ 자원 인수분해)
CREATE TYPE expense_variability AS ENUM ('variable', 'fixed');
CREATE TYPE expense_discretion AS ENUM ('discretionary', 'non_discretionary');

-- 가격 결정 유형 (PRD #4)
CREATE TYPE decision_type AS ENUM (
  'new_product',
  'price_increase',
  'price_decrease',
  'discount',
  'differentiation'
);

-- ============================================================================
-- 2. 인증 및 사용자 프로필
-- ============================================================================

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  -- 드러커 자기경영 (PRD #7 ⑤)
  self_strengths TEXT[],
  golden_hours_start TIME,
  golden_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);

-- Auth 사용자 생성 시 자동 프로필 생성
-- 주의: SECURITY DEFINER 함수는 search_path를 명시해야 supabase_auth_admin이
-- profiles 테이블을 찾을 수 있다. 누락 시 "Database error creating new user" 발생.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- supabase_auth_admin이 트리거 함수를 통해 profiles에 INSERT할 수 있도록 권한 부여
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT ON public.profiles TO supabase_auth_admin;

-- ============================================================================
-- 3. 마스터 데이터 - 24셀 세그먼트
-- ============================================================================

CREATE TABLE segments (
  id SERIAL PRIMARY KEY,
  occupation occupation_type NOT NULL,
  division product_division NOT NULL,
  -- PRD #2a ③ 세그먼트별 영업 매트릭스
  core_message TEXT,
  sales_sequence TEXT[],
  avg_cycle_days INTEGER,
  recommended_catalog TEXT,
  notes TEXT,
  UNIQUE(occupation, division)
);

-- 24개 셀 자동 생성 (6직업군 × 4제품군)
INSERT INTO segments (occupation, division, core_message, avg_cycle_days)
SELECT
  occ::occupation_type,
  div::product_division,
  NULL,
  NULL
FROM
  unnest(ARRAY['interior_project', 'brand_furniture', 'project_furniture',
               'commercial_reupholster', 'curtain_styling', 'display']) AS occ,
  unnest(ARRAY['sofa', 'curtain', 'wall', 'accessory']) AS div;

-- ============================================================================
-- 4. 마스터 데이터 - 4티어 + 제품 라인
-- ============================================================================

CREATE TABLE price_tiers (
  tier price_tier PRIMARY KEY,
  display_name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  target_margin_min NUMERIC(5,2),
  target_margin_max NUMERIC(5,2),
  discount_policy TEXT,
  description TEXT
);

INSERT INTO price_tiers (tier, display_name, display_order, target_margin_min, target_margin_max, discount_policy) VALUES
  ('value',   '저가',     1, 20.00, 30.00, '광고에 가격 강조 가능. 9.99 등 문턱가격 적용'),
  ('mid',     '중가',     2, 35.00, 45.00, '제한적 할인 가능'),
  ('premium', '프리미엄', 3, 50.00, 65.00, '특가·세일 회피. 가치 강조'),
  ('luxury',  '럭셔리',   4, 70.00, 85.00, '할인 절대 금지. Price upon request 옵션');

-- 제품 라인 (브랜드/시리즈 단위)
CREATE TABLE product_lines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand_name TEXT,
  tier price_tier NOT NULL REFERENCES price_tiers(tier),
  division product_division NOT NULL,
  -- PRD #4 ② 가치 정의 워크북
  value_essential TEXT,
  value_extended TEXT,
  value_roi_note TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_lines_tier ON product_lines(tier);
CREATE INDEX idx_product_lines_division ON product_lines(division);

-- 제품 (SKU)
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  line_id INTEGER REFERENCES product_lines(id),
  division product_division NOT NULL,
  -- 가격
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- 스펙 (PRD #2c ③)
  martindale INTEGER,
  flame_retardant BOOLEAN DEFAULT false,
  stain_resistant BOOLEAN DEFAULT false,
  width_cm INTEGER,
  weight_gsm INTEGER,
  -- 시즌
  season TEXT DEFAULT 'all',  -- 'all', 'ss', 'fw', 'limited'
  -- 재고
  current_stock INTEGER DEFAULT 0,
  threshold_stock INTEGER DEFAULT 0,
  -- 메타
  photo_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_line ON products(line_id);
CREATE INDEX idx_products_division ON products(division);
CREATE INDEX idx_products_active ON products(active);

-- ============================================================================
-- 5. 거래처
-- ============================================================================

CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  -- 24셀 매핑
  occupation occupation_type,
  primary_division product_division,
  -- 등급 (PRD #3 ⑤)
  tier client_tier DEFAULT 'general',
  -- 연락처
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  contact_instagram TEXT,
  address TEXT,
  -- 결제
  payment_terms_days INTEGER DEFAULT 30,
  -- 메타
  source TEXT,  -- 'referral', 'instagram', 'website', 'dream100' 등
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clients_occupation ON clients(occupation);
CREATE INDEX idx_clients_tier ON clients(tier);
CREATE INDEX idx_clients_active ON clients(active);

-- 거래처별 가격 정책 (PRD #4 ⑤ 가격 차별화)
CREATE TABLE client_pricing_policies (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  line_id INTEGER REFERENCES product_lines(id),
  discount_rate NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  effective_from DATE DEFAULT CURRENT_DATE,
  UNIQUE(client_id, line_id)
);

-- ============================================================================
-- 6. 거래 (PRD #2c ②)
-- ============================================================================

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id INTEGER REFERENCES clients(id),
  -- 자동 매핑 (트리거로 채움)
  segment_id INTEGER REFERENCES segments(id),
  tier price_tier,
  -- 단계
  stage transaction_stage DEFAULT 'quote',
  -- 금액
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  margin_amount NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - total_cost) STORED,
  -- 일정
  delivery_date DATE,
  payment_due_date DATE,
  payment_received_date DATE,
  payment_received_amount NUMERIC(12,2) DEFAULT 0,
  -- 메타
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_client ON transactions(client_id);
CREATE INDEX idx_transactions_stage ON transactions(stage);
CREATE INDEX idx_transactions_segment ON transactions(segment_id);

CREATE TABLE transaction_items (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes TEXT
);

CREATE INDEX idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product ON transaction_items(product_id);

-- 거래 등록·수정 시 자동 segment_id, tier 매핑
CREATE OR REPLACE FUNCTION auto_map_transaction_segment()
RETURNS TRIGGER AS $$
DECLARE
  client_occupation occupation_type;
  client_primary_div product_division;
  product_tier price_tier;
BEGIN
  -- 거래처 정보 가져오기
  SELECT occupation, primary_division INTO client_occupation, client_primary_div
  FROM clients WHERE id = NEW.client_id;

  -- 세그먼트 매핑
  IF client_occupation IS NOT NULL AND client_primary_div IS NOT NULL THEN
    SELECT id INTO NEW.segment_id
    FROM segments
    WHERE occupation = client_occupation AND division = client_primary_div;
  END IF;

  -- 티어 매핑 (가장 비중 큰 제품 라인의 티어)
  SELECT pl.tier INTO product_tier
  FROM transaction_items ti
  JOIN products p ON ti.product_id = p.id
  JOIN product_lines pl ON p.line_id = pl.id
  WHERE ti.transaction_id = NEW.id
  GROUP BY pl.tier
  ORDER BY SUM(ti.subtotal) DESC
  LIMIT 1;

  IF product_tier IS NOT NULL THEN
    NEW.tier = product_tier;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_map_segment
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION auto_map_transaction_segment();

-- ============================================================================
-- 7. 비용 (자원) - PRD #3 ③
-- ============================================================================

CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  expense_date DATE NOT NULL,
  category TEXT NOT NULL,  -- 인건비, 광고비, 임차료, 운영비, 원단매입 등
  amount NUMERIC(12,2) NOT NULL,
  variability expense_variability NOT NULL,
  discretion expense_discretion NOT NULL,
  team TEXT,  -- 영업, 마케팅, 운영, 디자인, 백오피스
  description TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_variability ON expenses(variability);

-- ============================================================================
-- 8. 일일결산 (PRD #2c ① + v1.0 보존)
-- ============================================================================

CREATE TABLE daily_closes (
  id SERIAL PRIMARY KEY,
  close_date DATE UNIQUE NOT NULL,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  contribution_margin NUMERIC(12,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  new_clients_count INTEGER DEFAULT 0,
  payment_received NUMERIC(12,2) DEFAULT 0,
  outstanding_change NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 거래 변경 시 자동으로 일일결산 갱신
CREATE OR REPLACE FUNCTION update_daily_close()
RETURNS TRIGGER AS $$
DECLARE
  target_date DATE;
BEGIN
  target_date = COALESCE(NEW.transaction_date, OLD.transaction_date);

  INSERT INTO daily_closes (close_date, total_revenue, total_cost, contribution_margin, transaction_count)
  SELECT
    target_date,
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(total_cost), 0),
    COALESCE(SUM(margin_amount), 0),
    COUNT(*)
  FROM transactions
  WHERE transaction_date = target_date
    AND stage IN ('confirmed', 'shipping', 'delivered', 'paid')
  ON CONFLICT (close_date) DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    total_cost = EXCLUDED.total_cost,
    contribution_margin = EXCLUDED.contribution_margin,
    transaction_count = EXCLUDED.transaction_count,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_close
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_daily_close();

-- ============================================================================
-- 9. 12주 사이클 + 목표 (PRD #1)
-- ============================================================================

CREATE TABLE cycles (
  id SERIAL PRIMARY KEY,
  cycle_number INTEGER UNIQUE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  vision_statement TEXT,
  status TEXT DEFAULT 'active',  -- 'planning', 'active', 'review', 'completed'
  reflection_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE goals (
  id SERIAL PRIMARY KEY,
  cycle_id INTEGER REFERENCES cycles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,  -- 'revenue', 'sales_activity', 'marketing', 'operations', 'finance'
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC(12,2),
  unit TEXT,  -- 'KRW', 'count', '%'
  current_value NUMERIC(12,2) DEFAULT 0,
  is_leading_indicator BOOLEAN DEFAULT false,  -- 선행지표 여부
  owner_id UUID REFERENCES profiles(id),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_goals_cycle ON goals(cycle_id);

-- WAM (Weekly Action Meeting) - PRD #1 ④
CREATE TABLE weekly_action_meetings (
  id SERIAL PRIMARY KEY,
  cycle_id INTEGER REFERENCES cycles(id),
  meeting_date DATE NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 12),
  attendees TEXT[],
  scorecard JSONB,  -- {goal_id: {target, current, status}}
  next_week_priorities TEXT[],
  blockers TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 10. 가격 의사결정 (PRD #4)
-- ============================================================================

CREATE TABLE price_decisions (
  id SERIAL PRIMARY KEY,
  decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type decision_type NOT NULL,
  -- 대상 (셋 중 하나)
  target_product_id INTEGER REFERENCES products(id),
  target_line_id INTEGER REFERENCES product_lines(id),
  target_client_id INTEGER REFERENCES clients(id),
  -- 결정 내용
  previous_price NUMERIC(12,2),
  decided_price NUMERIC(12,2),
  decision_rationale TEXT,
  -- 4단계 워크플로우 (PRD #4 ③)
  step1_strategy JSONB,  -- 포지셔닝, 이익 목표
  step2_analysis JSONB,  -- 원가, 경쟁사, 지불용의
  step3_decision JSONB,  -- 후보 가격, 시뮬레이션
  step4_execution JSONB, -- 시행일, 심리학 적용, 가치 소통 계획
  -- 승인
  ceo_approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  -- 90일 후 검증
  validation_due_date DATE,
  validation_completed BOOLEAN DEFAULT false,
  validation_notes TEXT,
  quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 5),
  -- 메타
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_price_decisions_date ON price_decisions(decision_date);
CREATE INDEX idx_price_decisions_type ON price_decisions(type);
CREATE INDEX idx_price_decisions_validation ON price_decisions(validation_due_date)
  WHERE validation_completed = false;

-- ============================================================================
-- 11. AI 컨설팅 (PRD #7)
-- ============================================================================

-- 모닝 브리핑 + 이브닝 노트
CREATE TABLE ai_briefings (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  briefing_date DATE NOT NULL,
  type TEXT NOT NULL,  -- 'morning', 'evening'
  -- 모닝 브리핑 (PRD #7 ①)
  top_changes JSONB,         -- 어제 핵심 변화 3개
  priorities JSONB,          -- 오늘 우선순위
  schedule_summary JSONB,    -- 오늘 일정
  alerts JSONB,              -- 위기·기회 신호
  coaching_message TEXT,     -- 일일 코칭 (캠벨/드러커)
  drucker_question TEXT,     -- 주 1회 드러커 3가지 질문
  -- 이브닝 노트 (PRD #7 ③)
  daily_summary TEXT,
  variance_analysis JSONB,   -- 계획 vs 실제 (그로브)
  five_habits_check JSONB,   -- 드러커 5가지 점검
  decisions_made JSONB,
  ai_feedback TEXT,
  -- 메타
  generated_at TIMESTAMPTZ DEFAULT now(),
  user_reviewed BOOLEAN DEFAULT false,
  user_notes TEXT,
  UNIQUE(user_id, briefing_date, type)
);

CREATE INDEX idx_ai_briefings_user_date ON ai_briefings(user_id, briefing_date DESC);

-- 라이브 컨설팅 세션
CREATE TABLE ai_consulting_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  topic TEXT,
  messages JSONB DEFAULT '[]'::jsonb,  -- [{role, content, timestamp, dataRefs}]
  data_references JSONB,  -- {category: [table.column], ...}
  decisions_made JSONB,
  related_decision_id INTEGER REFERENCES price_decisions(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_sessions_user ON ai_consulting_sessions(user_id, started_at DESC);

-- ============================================================================
-- 12. 자주 쓰는 뷰 (View)
-- ============================================================================

-- 월별 P&L (PRD #3 ①)
CREATE OR REPLACE VIEW monthly_pl AS
SELECT
  DATE_TRUNC('month', t.transaction_date)::date AS month,
  SUM(t.total_amount) AS revenue,
  SUM(t.total_cost) AS variable_cost,
  SUM(t.margin_amount) AS contribution_margin,
  CASE WHEN SUM(t.total_amount) > 0
    THEN ROUND((SUM(t.margin_amount) / SUM(t.total_amount) * 100)::numeric, 2)
    ELSE 0 END AS contribution_margin_rate,
  COUNT(*) AS transaction_count,
  COUNT(DISTINCT t.client_id) AS active_clients
FROM transactions t
WHERE t.stage IN ('confirmed', 'shipping', 'delivered', 'paid')
GROUP BY DATE_TRUNC('month', t.transaction_date)
ORDER BY month DESC;

-- 일별 P&L (PRD #3 ① + #2c ①)
CREATE OR REPLACE VIEW daily_pl AS
SELECT
  t.transaction_date AS date,
  SUM(t.total_amount) AS revenue,
  SUM(t.total_cost) AS variable_cost,
  SUM(t.margin_amount) AS contribution_margin,
  COUNT(*) AS transaction_count
FROM transactions t
WHERE t.stage IN ('confirmed', 'shipping', 'delivered', 'paid')
GROUP BY t.transaction_date
ORDER BY date DESC;

-- 거래처별 수익성 (PRD #3 ⑤)
CREATE OR REPLACE VIEW client_profitability AS
SELECT
  c.id AS client_id,
  c.name,
  c.tier,
  c.occupation,
  c.primary_division,
  COUNT(t.id) AS transaction_count,
  COALESCE(SUM(t.total_amount), 0) AS total_revenue,
  COALESCE(SUM(t.margin_amount), 0) AS total_margin,
  CASE WHEN SUM(t.total_amount) > 0
    THEN ROUND((SUM(t.margin_amount) / SUM(t.total_amount) * 100)::numeric, 2)
    ELSE 0 END AS margin_rate,
  MAX(t.transaction_date) AS last_transaction_date
FROM clients c
LEFT JOIN transactions t ON t.client_id = c.id
  AND t.stage IN ('confirmed', 'shipping', 'delivered', 'paid')
GROUP BY c.id, c.name, c.tier, c.occupation, c.primary_division;

-- 24셀 매트릭스별 매출 (PRD #3 ② + #2a ③)
CREATE OR REPLACE VIEW revenue_by_segment AS
SELECT
  s.id AS segment_id,
  s.occupation,
  s.division,
  COUNT(t.id) AS transaction_count,
  COALESCE(SUM(t.total_amount), 0) AS revenue,
  COALESCE(SUM(t.margin_amount), 0) AS margin,
  COUNT(DISTINCT t.client_id) AS active_clients
FROM segments s
LEFT JOIN transactions t ON t.segment_id = s.id
  AND t.stage IN ('confirmed', 'shipping', 'delivered', 'paid')
GROUP BY s.id, s.occupation, s.division;

-- 티어별 매출 (PRD #4 ①)
CREATE OR REPLACE VIEW revenue_by_tier AS
SELECT
  pt.tier,
  pt.display_name,
  pt.target_margin_min,
  pt.target_margin_max,
  COUNT(t.id) AS transaction_count,
  COALESCE(SUM(t.total_amount), 0) AS revenue,
  COALESCE(SUM(t.margin_amount), 0) AS margin,
  CASE WHEN SUM(t.total_amount) > 0
    THEN ROUND((SUM(t.margin_amount) / SUM(t.total_amount) * 100)::numeric, 2)
    ELSE 0 END AS actual_margin_rate
FROM price_tiers pt
LEFT JOIN transactions t ON t.tier = pt.tier
  AND t.stage IN ('confirmed', 'shipping', 'delivered', 'paid')
GROUP BY pt.tier, pt.display_name, pt.target_margin_min, pt.target_margin_max, pt.display_order
ORDER BY pt.display_order;

-- 자원 인수분해 - 변동/고정·재량/비재량 (PRD #3 ③)
CREATE OR REPLACE VIEW expense_decomposition AS
SELECT
  DATE_TRUNC('month', expense_date)::date AS month,
  variability,
  discretion,
  category,
  team,
  SUM(amount) AS total_amount,
  COUNT(*) AS expense_count
FROM expenses
GROUP BY DATE_TRUNC('month', expense_date), variability, discretion, category, team
ORDER BY month DESC, total_amount DESC;

-- 미수금 현황 (PRD #3 ⑨)
CREATE OR REPLACE VIEW outstanding_payments AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  c.tier,
  t.id AS transaction_id,
  t.transaction_date,
  t.payment_due_date,
  t.total_amount,
  COALESCE(t.payment_received_amount, 0) AS received,
  (t.total_amount - COALESCE(t.payment_received_amount, 0)) AS outstanding,
  (CURRENT_DATE - t.payment_due_date) AS days_overdue,
  CASE
    WHEN t.payment_due_date IS NULL THEN 'no_due_date'
    WHEN CURRENT_DATE - t.payment_due_date <= 0 THEN 'on_time'
    WHEN CURRENT_DATE - t.payment_due_date <= 30 THEN 'overdue_30'
    WHEN CURRENT_DATE - t.payment_due_date <= 60 THEN 'overdue_60'
    WHEN CURRENT_DATE - t.payment_due_date <= 90 THEN 'overdue_90'
    ELSE 'overdue_90_plus'
  END AS aging_bucket
FROM transactions t
JOIN clients c ON c.id = t.client_id
WHERE t.stage IN ('delivered', 'shipping')
  AND (t.payment_received_amount IS NULL OR t.payment_received_amount < t.total_amount)
ORDER BY days_overdue DESC NULLS LAST;

-- ============================================================================
-- 13. RLS (Row Level Security) - 권한 위계
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_pricing_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_consulting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_action_meetings ENABLE ROW LEVEL SECURITY;

-- 헬퍼 함수: 현재 사용자의 역할 확인
-- SECURITY DEFINER + search_path 명시 (RLS 정책 안에서 호출되므로)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- 프로필: 본인 + CEO/임원은 모든 프로필
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  auth.uid() = id OR current_user_role() IN ('ceo', 'executive')
);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 거래: CEO/임원은 전체, 직원은 본인 등록만
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive') OR created_by = auth.uid()
);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (
  current_user_role() IN ('ceo', 'executive', 'employee')
);
CREATE POLICY "transactions_update" ON transactions FOR UPDATE USING (
  current_user_role() IN ('ceo', 'executive') OR created_by = auth.uid()
);

CREATE POLICY "transaction_items_select" ON transaction_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM transactions t WHERE t.id = transaction_id
    AND (current_user_role() IN ('ceo', 'executive') OR t.created_by = auth.uid()))
);

-- 비용: 본인 등록 + CEO/임원
CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive') OR created_by = auth.uid()
);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (
  current_user_role() IN ('ceo', 'executive', 'employee')
);

-- 거래처: 모두 조회, CEO/임원만 수정
CREATE POLICY "clients_select" ON clients FOR SELECT USING (true);
CREATE POLICY "clients_modify" ON clients FOR ALL USING (
  current_user_role() IN ('ceo', 'executive')
);

-- 가격 차별화 정책: CEO/임원만 (매우 민감)
CREATE POLICY "client_pricing_ceo_only" ON client_pricing_policies FOR ALL USING (
  current_user_role() IN ('ceo', 'executive')
);

-- 가격 결정: CEO/임원
CREATE POLICY "price_decisions_ceo" ON price_decisions FOR ALL USING (
  current_user_role() IN ('ceo', 'executive')
);

-- AI 브리핑: 본인만 (CEO 전용 데이터)
CREATE POLICY "ai_briefings_own" ON ai_briefings FOR ALL USING (user_id = auth.uid());

-- AI 컨설팅: 본인만
CREATE POLICY "ai_sessions_own" ON ai_consulting_sessions FOR ALL USING (user_id = auth.uid());

-- 12주 사이클·목표·WAM: 모두 조회, CEO/임원만 작성
CREATE POLICY "cycles_select" ON cycles FOR SELECT USING (true);
CREATE POLICY "cycles_modify" ON cycles FOR ALL USING (
  current_user_role() IN ('ceo', 'executive')
);
CREATE POLICY "goals_select" ON goals FOR SELECT USING (true);
CREATE POLICY "goals_modify" ON goals FOR ALL USING (
  current_user_role() IN ('ceo', 'executive') OR owner_id = auth.uid()
);
CREATE POLICY "wam_select" ON weekly_action_meetings FOR SELECT USING (true);
CREATE POLICY "wam_modify" ON weekly_action_meetings FOR ALL USING (
  current_user_role() IN ('ceo', 'executive')
);

-- ============================================================================
-- 14. 초기 데이터 (선택) - 첫 12주 사이클 생성
-- ============================================================================

-- 첫 번째 12주 사이클을 오늘부터 시작
-- (실제 운영 시작일에 맞춰 수정)
INSERT INTO cycles (cycle_number, start_date, end_date, vision_statement, status)
VALUES (
  1,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '12 weeks',
  '디안 v1.1 시스템 도입 + 첫 12주 운영',
  'active'
);

-- ============================================================================
-- 끝.
-- 
-- 다음 단계:
--   1. Supabase 프로젝트에서 SQL 에디터에 이 파일 전체 실행
--   2. 첫 사용자 등록 후 profiles에서 role을 'ceo'로 변경
--   3. 마스터 데이터 입력 (제품 라인, 제품, 거래처)
--   4. v1.0 데이터 마이그레이션 (별도 스크립트)
-- ============================================================================
