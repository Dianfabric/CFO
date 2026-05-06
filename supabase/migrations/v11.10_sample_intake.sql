-- v1.1 Sample Intake Workflow Migration (#10)
-- Apply via Supabase SQL Editor.

-- 1) 메인 — 입고된 샘플
CREATE TABLE IF NOT EXISTS incoming_samples (
  id SERIAL PRIMARY KEY,
  -- Stage 1: 입고
  name TEXT NOT NULL,
  supplier TEXT,
  source TEXT DEFAULT 'domestic' CHECK (source IN ('domestic', 'overseas')),
  arrival_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sample_count INTEGER DEFAULT 1,
  unit TEXT DEFAULT 'roll',
  material TEXT,
  colors JSONB DEFAULT '[]'::jsonb,
  estimated_unit_price NUMERIC(12, 2),
  photos JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  -- Stage 2: 평가
  division TEXT CHECK (division IS NULL OR division IN ('sofa', 'curtain', 'wall', 'accessory')),
  recommended_tier TEXT CHECK (recommended_tier IS NULL OR recommended_tier IN ('value', 'mid', 'premium', 'luxury')),
  recommended_occupations JSONB DEFAULT '[]'::jsonb,
  competitive_score INTEGER CHECK (competitive_score IS NULL OR competitive_score BETWEEN 1 AND 5),
  differentiator TEXT,
  risk_note TEXT,
  ai_evaluation JSONB DEFAULT '{}'::jsonb,
  -- Stage 3: 기획
  target_occupations JSONB DEFAULT '[]'::jsonb,
  target_divisions JSONB DEFAULT '[]'::jsonb,
  pricing_strategy TEXT,
  marketing_angle TEXT,
  priority_client_ids JSONB DEFAULT '[]'::jsonb,
  revenue_target_30d NUMERIC(12, 2),
  revenue_target_90d NUMERIC(12, 2),
  -- 워크플로우 상태
  stage TEXT DEFAULT 'arrived' CHECK (stage IN ('arrived', 'evaluating', 'planned', 'in_action', 'tracking', 'archived')),
  asset_id INTEGER REFERENCES sales_material_assets(id) ON DELETE SET NULL,
  generated_material_ids JSONB DEFAULT '[]'::jsonb,
  sample_request_ids JSONB DEFAULT '[]'::jsonb,
  content_item_ids JSONB DEFAULT '[]'::jsonb,
  -- 메타
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_stage ON incoming_samples(stage, arrival_date DESC);
CREATE INDEX IF NOT EXISTS idx_intake_arrival ON incoming_samples(arrival_date DESC);
CREATE INDEX IF NOT EXISTS idx_intake_division_tier ON incoming_samples(division, recommended_tier);

-- 2) 단계별 체크리스트 / 액션
CREATE TABLE IF NOT EXISTS intake_action_items (
  id SERIAL PRIMARY KEY,
  sample_id INTEGER NOT NULL REFERENCES incoming_samples(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  action_kind TEXT DEFAULT 'manual' CHECK (action_kind IN ('manual', 'sales_material', 'marketing_content', 'sample_send', 'wam', 'slack', 'showroom', 'asset')),
  action_url TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_actions_sample ON intake_action_items(sample_id, display_order);
CREATE INDEX IF NOT EXISTS idx_intake_actions_pending ON intake_action_items(sample_id, completed);

-- 3) 30·90일 회고
CREATE TABLE IF NOT EXISTS intake_performance_reviews (
  id SERIAL PRIMARY KEY,
  sample_id INTEGER NOT NULL REFERENCES incoming_samples(id) ON DELETE CASCADE,
  review_kind TEXT DEFAULT '30d' CHECK (review_kind IN ('30d', '90d', 'final')),
  measured_metrics JSONB DEFAULT '{}'::jsonb,
  what_worked TEXT,
  what_didnt TEXT,
  lessons_learned TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sample_id, review_kind)
);

-- 4) 플레이북 (24셀 × 4티어 표준 행동 요령)
CREATE TABLE IF NOT EXISTS sample_intake_playbook (
  id SERIAL PRIMARY KEY,
  occupation TEXT NOT NULL CHECK (occupation IN ('interior_project', 'brand_furniture', 'project_furniture', 'commercial_reupholster', 'curtain_styling', 'display')),
  division TEXT NOT NULL CHECK (division IN ('sofa', 'curtain', 'wall', 'accessory')),
  tier TEXT NOT NULL CHECK (tier IN ('value', 'mid', 'premium', 'luxury')),
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (occupation, division, tier)
);

CREATE INDEX IF NOT EXISTS idx_playbook_lookup ON sample_intake_playbook(occupation, division, tier) WHERE active = true;

-- 5) 플레이북 시드 (12개 — 자주 쓰는 조합 우선)
INSERT INTO sample_intake_playbook (occupation, division, tier, recommended_actions, notes)
VALUES
  ('interior_project', 'curtain', 'premium',
   '["스타일링 디자이너 5명 우선 발송", "빛 투과 영상 콘텐츠 1건", "가격 미공개 (Price upon request 톤)", "쇼룸 메인 윈도우 비치", "포트폴리오 디자이너 인터뷰 인용 자료"]'::jsonb,
   '커튼은 빛·드레이프가 핵심. 영상 콘텐츠 필수. 디자이너 인용 한 줄이 매출에 큰 영향.'),

  ('interior_project', 'wall', 'luxury',
   '["5명 한정 발송 + Price upon request", "블랙룸 무드 사진 (어두운 배경)", "장인·역사 스토리 슬라이드", "쇼룸 단독 룸 비치", "마크로샷 영상 60초"]'::jsonb,
   '럭셔리 벽지·벽재는 여백·침묵·스토리. 가격 절대 노출 금지. 발송 수량 적게, 임팩트 크게.'),

  ('interior_project', 'sofa', 'premium',
   '["인테리어 디자이너 7명 발송", "시공 완성도 비교 자료", "디자이너 작업실 사진", "쇼룸 메인 디스플레이 1주일", "Behind/After 영상 30초"]'::jsonb,
   '소파 원단은 시공 후 보이는 모습이 핵심. Before/After 구도가 효과적.'),

  ('brand_furniture', 'sofa', 'premium',
   '["가구 브랜드 R&D 담당자 5명 발송", "양산 안정성·로트 일관성 자료", "단가 등급 협상 시트", "쇼룸 비치 (가구 브랜드 미팅 시)", "디안 SS/FW 컬렉션북에 등재 검토"]'::jsonb,
   '브랜드 가구는 단가·안정성·일관성. 디자인보다는 운영 안정성 강조.'),

  ('brand_furniture', 'curtain', 'mid',
   '["가구 브랜드 5곳 발송", "원가·도매 단가 시트", "샘플북 등재", "쇼룸 비치", "라이프스타일 화보용 사진 1세트"]'::jsonb,
   '중가 라인은 가성비·합리적 선택을 강조.'),

  ('project_furniture', 'sofa', 'mid',
   '["프로젝트 가구사 5곳 발송", "납기·MOQ·단가표 즉시 발송", "화재·내구성 인증서 첨부", "쇼룸 비치 (서비스용)", "Lead time 명시"]'::jsonb,
   '프로젝트 가구는 납기·단가·인증이 전부. 감성보다 정보.'),

  ('commercial_reupholster', 'sofa', 'value',
   '["천갈이 거래처 10곳 발송", "화재 인증·청소 가이드", "내구성 비교표", "가격 강조 (특가 가능)", "쇼룸 매트 비치 (만져보기 쉽게)"]'::jsonb,
   '천갈이는 가격·내구성·인증이 핵심. 럭셔리 톤 절대 금물.'),

  ('curtain_styling', 'curtain', 'premium',
   '["커튼 스타일리스트 7명 우선 발송", "광원·드레이프 영상 (15초)", "계절감·시즌 매칭", "쇼룸 윈도우 비치 1주일", "스타일링 케이스 1건 콘텐츠"]'::jsonb,
   '커튼 스타일링은 빛·계절·드레이프. 영상이 사진보다 강력.'),

  ('curtain_styling', 'curtain', 'luxury',
   '["VIP 스타일리스트 3명만 발송", "Price upon request", "장인 인터뷰 인용", "쇼룸 단독 윈도우 1개월", "60초 영상 (미니멀 피아노 BGM)"]'::jsonb,
   '럭셔리 커튼은 한정성·여백·스토리.'),

  ('display', 'accessory', 'value',
   '["디스플레이 5곳 발송", "트렌드 키워드 카드", "특가·시한 명시", "쇼룸 트렌드 코너 비치", "인스타 릴스 1건"]'::jsonb,
   '디스플레이는 단기 효과·트렌드. 가격·시한 강조.'),

  ('display', 'accessory', 'mid',
   '["디스플레이 7곳 발송", "트렌드+합리적 가격", "월 단위 회전율 강조", "쇼룸 비치", "인스타 1건"]'::jsonb,
   '중가는 가성비+트렌드.'),

  ('interior_project', 'sofa', 'luxury',
   '["하이엔드 디자이너 3명만 발송", "Price upon request 명시", "장인성·계보 스토리", "쇼룸 단독 룸 비치", "마크로 슬로우 영상 60초"]'::jsonb,
   '럭셔리 소파 원단은 결·무게·드레이프를 다중 감각으로.')
ON CONFLICT (occupation, division, tier) DO NOTHING;

-- 6) RLS
ALTER TABLE incoming_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_intake_playbook ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intake_all ON incoming_samples;
CREATE POLICY intake_all ON incoming_samples FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS intake_actions_all ON intake_action_items;
CREATE POLICY intake_actions_all ON intake_action_items FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS intake_reviews_all ON intake_performance_reviews;
CREATE POLICY intake_reviews_all ON intake_performance_reviews FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS playbook_select ON sample_intake_playbook;
CREATE POLICY playbook_select ON sample_intake_playbook FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS playbook_modify ON sample_intake_playbook;
CREATE POLICY playbook_modify ON sample_intake_playbook FOR ALL USING (
  current_user_role() IN ('ceo', 'executive')
);
