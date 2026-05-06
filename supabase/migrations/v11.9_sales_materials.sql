-- v1.1 Sales Materials Migration (#9)
-- Apply via Supabase SQL Editor.

-- 1) 심리/인지과학 프레임워크 정의 (8종 seed)
CREATE TABLE IF NOT EXISTS sales_psychology_frameworks (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  summary TEXT,
  principles JSONB DEFAULT '[]'::jsonb,
  recommended_tiers JSONB DEFAULT '[]'::jsonb,
  recommended_occupations JSONB DEFAULT '[]'::jsonb,
  prompt_template TEXT,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO sales_psychology_frameworks (key, name, summary, principles, recommended_tiers, recommended_occupations, prompt_template, display_order)
VALUES
  ('cialdini_6', '치알디니 6원칙',
   '사회적 증거·희소성·권위·호감·상호성·일관성으로 설득',
   '["사회적 증거 (다른 디자이너 사용 사례)", "희소성 (한정 입고/재고)", "권위 (전문가 인증/이력)", "호감 (브랜드 친밀도)", "상호성 (샘플 무상)", "일관성 (시즌마다 약속한 품질)"]'::jsonb,
   '["value", "mid", "premium", "luxury"]'::jsonb,
   '["interior_project", "brand_furniture", "project_furniture", "commercial_reupholster", "curtain_styling", "display"]'::jsonb,
   '치알디니 6원칙 중 사회적 증거(다른 디자이너 사용 사례)와 희소성(한정 입고)을 중심으로 하되, 자료 후반에 권위(소재 인증·이력)를 배치하라.', 1),

  ('storybrand_7', '스토리브랜드 7단계',
   '영웅(고객) - 문제 - 가이드(디안) - 계획 - CTA - 실패회피 - 성공',
   '["영웅은 디자이너/거래처. 디안은 가이드.", "문제: 적절한 원단을 못 찾는 답답함.", "계획: 1) 컬렉션 보기 → 2) 샘플 받기 → 3) 결정.", "성공: 클라이언트 만족·프로젝트 완성도.", "실패회피: 잘못된 소재로 시공 실패."]'::jsonb,
   '["mid", "premium"]'::jsonb,
   '["interior_project", "brand_furniture"]'::jsonb,
   '스토리브랜드 구조로 슬라이드를 짜라. 1슬라이드: 영웅(디자이너)의 문제. 2슬라이드: 가이드(디안)의 등장. 3-4슬라이드: 3단계 계획. 5-6슬라이드: 성공/실패 시나리오. 마지막: CTA.', 2),

  ('russell_hso', '러셀 Hook-Story-Offer',
   '3초 후크 → 스토리 → 명확한 제안',
   '["후크: 3초 안에 스크롤을 멈추게 한다.", "스토리: 감정적 연결 — 고객이 자기 자신을 본다.", "제안: 너무 좋아 거절할 수 없는 형태."]'::jsonb,
   '["value", "mid"]'::jsonb,
   '["display", "curtain_styling", "commercial_reupholster"]'::jsonb,
   '첫 슬라이드는 3초 후크(시각적 임팩트 + 한 줄 카피). 중간은 스토리(왜 이 원단인가). 마지막은 거절할 수 없는 제안(샘플 무상 + 시한).', 3),

  ('cognitive_ease', '인지적 용이성',
   '익숙함·반복·대조·Before/After로 뇌의 부담을 줄여 호감 형성',
   '["반복: 같은 메시지를 슬라이드마다 다른 각도로.", "대조: Before/After 또는 경쟁 소재 비교.", "익숙함: 이미 본 적 있는 듯한 컬러/구도.", "단순함: 한 슬라이드 한 메시지."]'::jsonb,
   '["value", "mid"]'::jsonb,
   '["commercial_reupholster", "project_furniture"]'::jsonb,
   '한 슬라이드에 한 메시지만 담아라. Before/After 비교를 적극 활용하고, 핵심 키워드는 3회 이상 반복하라. 복잡한 사양표는 시각화.', 4),

  ('peak_end', 'Peak-End 법칙',
   '경험은 절정과 끝만 기억된다',
   '["첫 슬라이드: 가장 강한 비주얼 (절정 1).", "마지막 슬라이드: 가장 강한 비주얼/CTA (절정 2).", "중간은 정보 — 짧고 명확하게."]'::jsonb,
   '["premium", "luxury"]'::jsonb,
   '["interior_project", "brand_furniture", "curtain_styling", "display"]'::jsonb,
   '첫 슬라이드와 마지막 슬라이드를 자료 전체의 두 절정으로 만들어라. 중간 슬라이드는 정보 전달에 충실하되 길지 않게. 전체 분량의 이미지 예산을 80%를 첫·끝에 배분.', 5),

  ('mirror_neuron', '거울뉴런',
   '타인이 사용하는 모습을 보면 나도 쓰고 싶어진다',
   '["디자이너의 손이 원단을 만지는 마크로샷 필수.", "현장 작업 모습 (현실감).", "최종 시공 인테리어에 클라이언트가 있는 모습.", "디자이너 인터뷰 인용 한 줄."]'::jsonb,
   '["premium", "luxury"]'::jsonb,
   '["interior_project"]'::jsonb,
   '슬라이드의 핵심 비주얼에 사람의 손/모습을 반드시 포함시켜라. 원단을 만지는 손, 시공하는 디자이너, 완성된 공간에 있는 사람. 이는 거울뉴런을 자극해 자신이 사용하는 장면을 상상하게 만든다.', 6),

  ('sensory_integration', '감각통합',
   '촉감·소리·향을 시각/언어로 변환해 다중 감각 자극',
   '["원단 표면 묘사: 양털·실크·돌결 등 비유.", "마크로샷으로 결을 보여주고 촉감 단어 병기.", "사운드 묘사: 바람에 흔들리는 결.", "온도감: 따뜻한·차가운·서늘한."]'::jsonb,
   '["premium", "luxury"]'::jsonb,
   '["interior_project", "brand_furniture", "curtain_styling"]'::jsonb,
   '시각 정보에 반드시 촉감/온도/소리 단어를 함께 배치하라. "부드럽고 서늘한 결, 손끝에 머무는 무게감" 같은 다중 감각 카피. 마크로샷이 핵심.', 7),

  ('luxury_minimalism', '럭셔리 미니멀',
   '여백·침묵·가격 숨김·스토리만이 럭셔리를 만든다',
   '["가격 절대 노출 금지. ''Price upon request''.", "여백이 곧 메시지. 슬라이드 60% 이상 빈 공간.", "스토리: 장인·역사·한정·계보.", "절제된 텐션의 BGM 무드."]'::jsonb,
   '["luxury"]'::jsonb,
   '["interior_project", "brand_furniture"]'::jsonb,
   '럭셔리 라인 자료는 정보를 줄여라. 슬라이드당 한 단어 또는 한 문장. 가격은 절대 표시하지 말 것 ("Price upon request"). 여백 60% 이상. 스토리 중심. 비주얼은 미니멀하지만 압도적.', 8)
ON CONFLICT (key) DO NOTHING;

-- 2) 소스 자산 라이브러리 (이미지·해외 자료)
CREATE TABLE IF NOT EXISTS sales_material_assets (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'pdf', 'url', 'text')),
  title TEXT,
  description TEXT,
  storage_path TEXT,
  external_url TEXT,
  body_text TEXT,
  source TEXT DEFAULT 'domestic' CHECK (source IN ('domestic', 'overseas')),
  tags JSONB DEFAULT '[]'::jsonb,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_kind ON sales_material_assets(kind);
CREATE INDEX IF NOT EXISTS idx_assets_source ON sales_material_assets(source);

-- 3) 생성된 자료 메타
CREATE TABLE IF NOT EXISTS sales_materials (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  target_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  target_segment_id INTEGER REFERENCES segments(id) ON DELETE SET NULL,
  target_tier TEXT,
  target_occupation TEXT,
  target_persona TEXT,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name_input TEXT,
  product_attrs JSONB DEFAULT '{}'::jsonb,
  framework_ids JSONB DEFAULT '[]'::jsonb,
  tone_settings JSONB DEFAULT '{}'::jsonb,
  slide_count INTEGER DEFAULT 7,
  video_durations JSONB DEFAULT '[15, 30]'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'generated', 'published', 'failed')),
  generated_pptx_path TEXT,
  slides JSONB DEFAULT '[]'::jsonb,
  video_scripts JSONB DEFAULT '[]'::jsonb,
  ai_meta JSONB DEFAULT '{}'::jsonb,
  generation_error TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materials_status ON sales_materials(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_client ON sales_materials(target_client_id);
CREATE INDEX IF NOT EXISTS idx_materials_creator ON sales_materials(created_by);

-- 4) 자료 ↔ 자산 다대다
CREATE TABLE IF NOT EXISTS sales_material_uses_assets (
  material_id INTEGER NOT NULL REFERENCES sales_materials(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES sales_material_assets(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'reference',
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (material_id, asset_id)
);

-- 5) 버전 히스토리 (재생성)
CREATE TABLE IF NOT EXISTS sales_material_versions (
  id SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL REFERENCES sales_materials(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  slides JSONB DEFAULT '[]'::jsonb,
  video_scripts JSONB DEFAULT '[]'::jsonb,
  framework_ids JSONB DEFAULT '[]'::jsonb,
  tone_settings JSONB DEFAULT '{}'::jsonb,
  ai_meta JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (material_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_versions_material ON sales_material_versions(material_id, version_number DESC);

-- 6) RLS
ALTER TABLE sales_psychology_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_material_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_material_uses_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_material_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS frameworks_select ON sales_psychology_frameworks;
CREATE POLICY frameworks_select ON sales_psychology_frameworks FOR SELECT USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS frameworks_modify ON sales_psychology_frameworks;
CREATE POLICY frameworks_modify ON sales_psychology_frameworks FOR ALL USING (
  current_user_role() IN ('ceo', 'executive')
);

DROP POLICY IF EXISTS assets_all ON sales_material_assets;
CREATE POLICY assets_all ON sales_material_assets FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS materials_all ON sales_materials;
CREATE POLICY materials_all ON sales_materials FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS material_assets_all ON sales_material_uses_assets;
CREATE POLICY material_assets_all ON sales_material_uses_assets FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS versions_all ON sales_material_versions;
CREATE POLICY versions_all ON sales_material_versions FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);
