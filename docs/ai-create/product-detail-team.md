# 상세페이지 AI 에이전트 팀 — 구조도

> AI Create 의 첫 번째 에이전트.
> 5개 전문 에이전트가 순차·일부 병렬로 협력하여 디안 톤의 제품 상세페이지를 자동 생성한다.

## 0. 한 줄 정리

> **사용자의 짧은 브리프 → 5개 전문 AI 에이전트 협력 → 디안 톤의 한국형 상세페이지 PNG (한 장의 긴 이미지).**

**최종 결과물 형식: PNG**
- 한국 이커머스 표준 — 네이버 스마트스토어·쿠팡·11번가에 그대로 업로드 가능
- 폭: 860px (모바일 최적) 또는 1200px (PC), 길이: 4,000~10,000px (콘텐츠 따라 가변)
- 섹션별 PNG 분리 옵션도 제공 (필요 시 일부 교체 가능)
- 부수 결과물: 코드(.tsx) — 디안 자체 사이트에 그대로 통합 가능 (선택)

---

## 1. 5-에이전트 팀 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                  사용자 (대표 / 마케팅 담당자)                   │
│                                                                  │
│  "신제품 SS26 워시드 리넨 상세페이지를 만들고 싶어"              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  ① 정보수집 Agent (Intake)            ☁ Anthropic / Sonnet 4.5  │
│  ─────────────────────────────────────────────────────────────  │
│  Role:    대화로 부족한 정보 수집                               │
│  Input:   짧은 브리프 + 대화                                    │
│  Output:  ProductBrief (JSON) — 24셀·4티어 자동 매핑 포함        │
│                                                                  │
│  • 제품명·소재·컬러·시즌                                         │
│  • 타겟 (24셀 자동 매핑 + 직원 확인)                             │
│  • 4티어 (자동 추천 + 확인)                                      │
│  • 핵심 셀링 포인트 3개                                          │
│  • 참고 레퍼런스 (URL · 이미지)                                  │
│  • 톤·길이 옵션                                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  ② 리서치 Agent (Research)           ☁ Anthropic / Sonnet 4.5  │
│  ─────────────────────────────────────────────────────────────  │
│  Role:    시장·경쟁·트렌드 조사                                 │
│  Input:   ProductBrief                                          │
│  Output:  ResearchPack (JSON)                                   │
│                                                                  │
│  • 경쟁 제품 분석 (3-5개)                                        │
│  • 타겟 고객 페인포인트 (24셀 기반)                              │
│  • 디자인 트렌드 + 컬러 팔레트 동향                              │
│  • 인용 가능한 데이터·통계                                       │
│  • 차별화 각도 (디안만의 우위)                                   │
│                                                                  │
│  Tools:   Anthropic Web Search · Extended Thinking              │
│           · 자산 라이브러리 (sales_material_assets)              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  ③ 카피라이팅 Agent (Copy)           ☁ Anthropic / Sonnet 4.5  │
│  ─────────────────────────────────────────────────────────────  │
│  Role:    디안 톤·티어 맞춤 카피 작성                           │
│  Input:   ProductBrief + ResearchPack                           │
│  Output:  CopyDeck (JSON)                                       │
│                                                                  │
│  • Hero 헤드라인 (Apple-tight)                                   │
│  • 서브 헤드라인 + 한 줄 lead                                    │
│  • 섹션별 본문 (소재·컬러·디테일·시공·CTA)                       │
│  • FAQ 5-10개                                                    │
│  • 상품 설명 (SEO 메타)                                          │
│  • CTA 카피 3안                                                  │
│                                                                  │
│  적용 프레임워크 (#9 8종 자동 추천 + 직원 선택):                  │
│  치알디니 · 스토리브랜드 · 러셀 HSO · 인지적 용이성 ·             │
│  Peak-End · 거울뉴런 · 감각통합 · 럭셔리 미니멀                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  ④ 디자인 Agent (Design)             🔮 Google / Gemini 3 Pro   │
│  ─────────────────────────────────────────────────────────────  │
│  Role:    비주얼 시안·레이아웃·이미지 프롬프트 생성             │
│  Input:   ProductBrief + ResearchPack + CopyDeck                │
│  Output:  DesignSpec (JSON)                                     │
│                                                                  │
│  • 섹션별 레이아웃 wireframe                                     │
│  • 컬러 팔레트 (디안 시각 정체성 + 티어 톤)                      │
│  • 이미지 프롬프트 (DALL·E / Midjourney / Imagen 3)              │
│  • 타이포그래피 위계 (Apple spec 준수)                           │
│  • 비주얼 무드 가이드 (사진 스타일·구도·조명)                    │
│  • 반응형 레이아웃 가이드 (mobile / tablet / desktop)            │
│                                                                  │
│  Why Gemini 3 Pro:                                              │
│  • 멀티모달 비주얼 추론 강함                                     │
│  • 레퍼런스 이미지 분석 능력                                     │
│  • 디자인 시스템 일관성 인식                                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑤ 프롬프팅 Agent (Dev/Code)         ☁ Anthropic / Sonnet 4.6  │
│  ─────────────────────────────────────────────────────────────  │
│  Role:    HTML/CSS 코드 + 이미지 프롬프트 정밀화                │
│  Input:   ProductBrief + CopyDeck + DesignSpec                  │
│  Output:  RenderableBundle                                      │
│                                                                  │
│  • HTML + Tailwind 코드 (랜더링용, .tsx 도 부수 출력)            │
│  • 섹션별 이미지 프롬프트 정밀화 (Imagen 3 입력용)               │
│  • 폰트·여백·계조 상세 명세                                      │
│  • 모바일 폭 (860px) 기준 vertical layout                        │
│  • 한국 이커머스 표준 비율 자동 적용                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑥ Image Gen + Render Pipeline       (서버 측 자동화)           │
│  ─────────────────────────────────────────────────────────────  │
│  6a. 비주얼 이미지 생성  🔮 Google Imagen 3 / Imagen on Vertex   │
│      • 히어로 이미지 (마크로샷·라이프스타일·시공 사진)           │
│      • 섹션별 비주얼 (소재 클로즈업·컬러칩·시공 사례)            │
│      • 디안 시각 정체성 + 무드 + 4티어 톤 자동 적용              │
│                                                                  │
│  6b. HTML 렌더링      🎬 Puppeteer / Playwright (Headless Chrome)│
│      • HTML + 생성된 이미지 → 한 장의 긴 PNG                     │
│      • 폰트(Pretendard) 임베드 후 렌더                           │
│      • 폭 860/1200, 길이 자동 (콘텐츠 따라)                      │
│      • 섹션별 분리 PNG 도 함께 export                            │
│                                                                  │
│  6c. 후처리          📐 Sharp (Node.js)                          │
│      • 압축 (PNG-8 또는 WebP 옵션)                               │
│      • 워터마크 (디안 로고 우측 하단, 옵션)                      │
│      • 메타데이터 (제품명·생성일)                                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  결과물 (Artifact)                                               │
│  ─────────────────────────────────────────────────────────────  │
│  ✅ 메인 결과물                                                   │
│  • 상세페이지 PNG (한 장, 모바일 860px / PC 1200px)              │
│  • 섹션별 분리 PNG (재편집·재사용 가능)                          │
│                                                                  │
│  📦 부수 결과물                                                   │
│  • HTML + Tailwind 코드 (.html / .tsx)                           │
│  • 이미지 프롬프트 (재생성 가능)                                 │
│  • 카피 (CopyDeck JSON, SEO 메타)                                │
│                                                                  │
│  🔁 옵션                                                          │
│  • 재생성 (각 단계별)                                            │
│  • 버전 히스토리                                                 │
│  • Vercel 운영 사이트에 즉시 배포 (선택)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 데이터 스키마 (에이전트 간 hand-off)

### 2.1 ProductBrief (① → ②③④⑤)

```typescript
interface ProductBrief {
  // 기본
  product_name: string
  category: string         // 소파원단·커튼원단·벽원단·소품
  material: string
  colors: string[]
  season: string           // SS26 / FW26
  estimated_unit_price: number | null

  // 24셀 매핑 (자동 추천 + 확인)
  target_occupations: Array<
    | 'interior_project'
    | 'brand_furniture'
    | 'project_furniture'
    | 'commercial_reupholster'
    | 'curtain_styling'
    | 'display'
  >
  target_division: 'sofa' | 'curtain' | 'wall' | 'accessory'
  target_tier: 'value' | 'mid' | 'premium' | 'luxury'

  // 핵심 셀링 포인트
  key_selling_points: string[]   // 최대 3개

  // 참고 자료
  reference_urls?: string[]
  reference_images?: string[]    // Supabase Storage URLs
  competitor_pages?: string[]

  // 옵션
  page_length: 'short' | 'medium' | 'long'  // 5 / 8 / 12 섹션
  tone: { emotional: number; formal: number; visual_density: number }

  // 컨텍스트
  brand_identity: BrandIdentity   // brand_identity 테이블에서 자동 주입
  client_context?: ClientContext  // 특정 거래처 대상이면
}
```

### 2.2 ResearchPack (② → ③④)

```typescript
interface ResearchPack {
  competitors: Array<{
    name: string
    url: string
    strengths: string[]
    weaknesses: string[]
    pricing_clue?: string
  }>
  pain_points: string[]              // 타겟 고객의 진짜 고민
  trends: {
    color_trends: string[]
    material_trends: string[]
    layout_trends: string[]
    season_keywords: string[]
  }
  cited_data: Array<{
    fact: string
    source: string
    relevance: 'high' | 'medium' | 'low'
  }>
  differentiation_angles: string[]   // 디안만의 우위
  recommended_frameworks: string[]   // 8종 중 추천
}
```

### 2.3 CopyDeck (③ → ④⑤)

```typescript
interface CopyDeck {
  hero: {
    headline: string                 // Apple-tight, 1-2줄
    subheadline: string
    primary_cta: string
    secondary_cta?: string
  }
  sections: Array<{
    id: string
    kind: 'material' | 'color' | 'usage' | 'comparison' |
          'social_proof' | 'craftsmanship' | 'specs' | 'cta' | 'faq'
    headline: string
    body: string
    bullets?: string[]
    image_brief: string              // 디자인 에이전트가 활용
    framework_applied: string        // 어떤 프레임워크가 이 섹션을 만들었는지
  }>
  faq: Array<{ q: string; a: string }>
  meta: {
    title: string
    description: string
    og_title: string
    og_description: string
    keywords: string[]
  }
}
```

### 2.4 DesignSpec (④ → ⑤)

```typescript
interface DesignSpec {
  layout: {
    structure: 'single_column' | 'mixed' | 'two_column' | 'grid'
    sections: Array<{
      copy_section_id: string        // CopyDeck.sections 참조
      visual_kind: 'hero' | 'image_left_text_right' | 'image_right_text_left' |
                   'full_bleed_image' | 'card_grid' | 'comparison_table' |
                   'quote' | 'cta_band'
      tile_color: 'canvas' | 'parchment' | 'tile_dark' | 'tile_dark_2'
      vertical_padding: 'sm' | 'md' | 'lg' | 'xl'  // section-pad mapping
    }>
  }
  visual: {
    color_palette: { primary: string; accent: string; surface: string }
    typography: {
      hero_size: number
      body_size: number
      tracking: 'apple_tight' | 'normal'
    }
    image_style: string              // "마크로샷 + 자연광 + 매트한 톤" 등
    mood: string                     // "고급·절제·여백" 등
  }
  image_prompts: Array<{
    section_id: string
    prompt: string                   // DALL·E / Midjourney / Imagen 3 용
    aspect: '1:1' | '16:9' | '4:3' | '3:4' | '9:16'
    fallback_brief: string           // 자체 촬영 시 가이드
  }>
  responsive: {
    mobile: { hidden_sections?: string[]; reordered?: string[] }
    tablet: { columns?: number }
    desktop: { max_width: number }
  }
}
```

### 2.5 RenderableBundle (⑤ → ⑥)

```typescript
interface RenderableBundle {
  /** 렌더링 가능한 HTML (Tailwind 인라인 또는 styled) */
  html: string

  /** 부수 코드 (선택, 디안 사이트에 통합용) */
  files?: Array<{
    path: string
    content: string
    language: 'tsx' | 'ts' | 'css' | 'html'
  }>

  /** 섹션별 이미지 프롬프트 (Imagen 3 용) */
  image_prompts: Array<{
    section_id: string
    placement: 'hero' | 'section_main' | 'detail' | 'lifestyle' | 'comparison'
    prompt: string                   // 정밀화된 영문 프롬프트
    aspect: '1:1' | '16:9' | '4:3' | '3:4' | '4:5'
    negative_prompt?: string
  }>

  /** 렌더링 옵션 */
  render_config: {
    width: 860 | 1200                // 모바일 / PC
    font_family: 'Pretendard' | 'system-ui'
    background: 'canvas' | 'parchment'
    sections_separately: boolean     // 섹션별 분리 PNG 도 export
  }

  notes: string                      // 구현 결정·트레이드오프
  version: number
}
```

### 2.6 PNGOutput (⑥ → 사용자)

```typescript
interface PNGOutput {
  /** 메인 결과물 — 한 장의 긴 PNG */
  main_png: {
    url: string                      // Supabase Storage URL
    width: number
    height: number
    file_size_kb: number
  }

  /** 섹션별 분리 PNG (재편집·재사용용) */
  section_pngs?: Array<{
    section_id: string
    url: string
    width: number
    height: number
  }>

  /** 생성된 비주얼 이미지 (Imagen 3 출력) */
  generated_images: Array<{
    prompt_section_id: string
    url: string
    prompt_used: string
  }>

  /** 부수 결과물 */
  html?: string                       // 원본 HTML (재렌더 가능)
  copy_deck: CopyDeck                 // 텍스트만 별도 export
  meta: {
    seo_title: string
    seo_description: string
    og_image_url: string              // main_png URL
  }

  version: number
  created_at: string
}
```

---

## 3. Orchestration (조정자) — Pipeline + Human-in-the-loop

### 3.1 흐름

```
[사용자 입력]
    ↓
① 정보수집 Agent (대화형, 스트리밍)
    ↓
[checkpoint 1] 사용자 확인 → ProductBrief 확정
    ↓
② 리서치 Agent (1-3분, 백그라운드)
    │       ↓
    │   [optional] 사용자 검토·수정
    ↓
③ 카피라이팅 Agent (30초-1분)
    ↓
[checkpoint 2] 사용자 카피 검토·수정
    ↓
④ 디자인 Agent (Gemini 3 Pro, 30초-1분)
    ↓
[checkpoint 3] 디자인 시안 검토
    ↓
⑤ 프롬프팅 Agent (코드 생성, 30초-2분)
    ↓
[결과물] 미리보기 + 다운로드 + 재생성 옵션
```

### 3.2 병렬화 가능 지점

- ②리서치 와 ④디자인 중 **이미지 프롬프트 생성** 부분은 병렬 가능
- ⑤프롬프팅 단계에서 **코드 + SEO 메타 + OG 태그** 병렬 생성

### 3.3 재실행 (Regenerate)

각 checkpoint 에서 사용자가:
- "카피 다시" → ③ 재실행 (다른 프레임워크 / 톤)
- "디자인 다시" → ④ 재실행 (다른 레이아웃 / 무드)
- "코드 다시" → ⑤ 재실행 (다른 컴포넌트 구조)

이전 단계 결과는 보존, 해당 단계만 새 버전.

---

## 4. UI / UX 흐름

### 4.1 대화 + 위저드 하이브리드

```
┌─────────────────────────────────────────────────────────────┐
│  /finance/ai-create/product-detail/new                       │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Step 1 — ① 정보수집  [● ○ ○ ○ ○]                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 💬 채팅 인터페이스                                     │ │
│  │                                                        │ │
│  │ AI: "어떤 신제품을 위한 페이지인가요?"                  │ │
│  │ 사용자: "SS26 워시드 리넨 컬렉션"                       │ │
│  │ AI: "타겟은 어떤 분들인가요?"                           │ │
│  │ 사용자: "인테리어 디자이너 + 커튼 스타일링"             │ │
│  │ AI: "이런 톤으로 가시면 어떨까요? [premium tier]"        │ │
│  │ ...                                                    │ │
│  │                                                        │ │
│  │ [ProductBrief 미리보기 우측 패널]                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ▼ ProductBrief 확정 시 다음 단계                            │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 단계별 화면

| Step | 인터랙션 | 결과물 미리보기 |
|---|---|---|
| 1. 정보수집 | 채팅 + 자동 폼 채움 | 우측에 ProductBrief 카드 |
| 2. 리서치 | 진행 표시 + 결과 카드 | 경쟁사·페인포인트·트렌드 카드 |
| 3. 카피 | 카피 카드 + 인라인 편집 | Hero + 섹션별 카피 미리보기 |
| 4. 디자인 | Wireframe + 이미지 프롬프트 | 레이아웃 시안 (mobile/desktop) |
| 5. 프롬프팅 | 코드 + 라이브 미리보기 | iframe 라이브 페이지 + 코드 다운로드 |

---

## 5. 기술 스택

### 5.1 LLM 모델

| 에이전트 | 모델 | 이유 |
|---|---|---|
| ① 정보수집 | Anthropic **Sonnet 4.5** | 대화 + JSON 추출 충분, 비용 효율 |
| ② 리서치 | Anthropic **Sonnet 4.5** + Web Search | 정확한 인용 + 웹 검색, 비용 효율 |
| ③ 카피라이팅 | Anthropic **Sonnet 4.6** ⭐ | 한국어 카피 품질 결정적 — 최신 모델 |
| ④ 디자인 | **Google Gemini 3 Pro** | 멀티모달 비주얼 추론 |
| ⑤ 프롬프팅 | Anthropic **Sonnet 4.6** ⭐ | 코드 품질 결정적 — 최신 모델 |

**모델 사용 정책 (성능·비용 분리):**
- **Sonnet 4.6** ⭐ — 결과물 품질이 사용자에게 직접 보이는 단계 (카피·코드)
- **Sonnet 4.5** — 중간 단계 데이터 처리 (정보수집·리서치)

### 5.2 SDK / 통합

```typescript
// 기존 (Anthropic)
import { getAnthropic, MODEL } from '@/lib/anthropic'

// 신규 (Gemini + Imagen)
import { GoogleGenerativeAI } from '@google/generative-ai'

// 신규 (HTML → PNG 렌더링)
import puppeteer from 'puppeteer'        // 또는 playwright
import sharp from 'sharp'                 // 후처리·압축

// 새 lib 모듈
src/lib/v11-ai-create/
├── orchestrator.ts          // 6단계 파이프라인 조정자
├── agents/
│   ├── intake.ts            // ① 정보수집 (Claude 4.5)
│   ├── research.ts          // ② 리서치 (Claude 4.5 + Web Search)
│   ├── copywriting.ts       // ③ 카피 (Claude 4.6 ⭐)
│   ├── design.ts            // ④ 디자인 (Gemini 3 Pro)
│   └── prompting.ts         // ⑤ 프롬프팅 (Claude 4.6 ⭐)
├── render/
│   ├── image-gen.ts         // ⑥a Imagen 3 호출
│   ├── puppeteer-render.ts  // ⑥b HTML → PNG
│   └── post-process.ts      // ⑥c Sharp 압축·워터마크
├── schemas/
│   ├── product-brief.ts
│   ├── research-pack.ts
│   ├── copy-deck.ts
│   ├── design-spec.ts
│   ├── renderable-bundle.ts
│   └── png-output.ts
└── prompts/
    ├── intake-system.txt
    ├── research-system.txt
    ├── copywriting-system.txt
    ├── design-system.txt
    └── prompting-system.txt
```

### 5.2.5 PNG 렌더링 파이프라인 상세

```
RenderableBundle.html
    +
이미지 프롬프트 (Imagen 3 호출)
    │
    ▼
[Imagen 3] → 섹션별 PNG (hero·material·lifestyle 등)
    │
    ▼
HTML 에 생성된 이미지 URL 주입 (DOM 치환)
    │
    ▼
[Puppeteer] Headless Chrome 으로 HTML 렌더
    • viewport: { width: 860, height: 100 }
    • Pretendard 폰트 임베드
    • 모든 리소스 load 대기
    • fullPage: true 스크린샷
    │
    ▼
[Sharp] 후처리
    • PNG 압축
    • 워터마크 (옵션)
    • 메타데이터 삽입
    │
    ▼
[Supabase Storage] 업로드
    • Bucket: ai-create-outputs/
    • Path: product-detail/{project_id}/v{n}/main.png
    • + section_pngs/{section_id}.png
    │
    ▼
PNGOutput 반환 → DB 저장 + UI 표시
```

### 5.3 환경변수

```env
# Anthropic (기존)
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-5         # 기본 (정보수집·리서치)
ANTHROPIC_MODEL_PREMIUM=claude-sonnet-4-6 # 카피·프롬프팅 ⭐

# Google Gemini (신규)
GOOGLE_GENAI_API_KEY=...
GEMINI_MODEL=gemini-3-pro-latest
```

### 5.4 스토리지 (실행 결과 영속)

```sql
-- 마이그레이션 v11.11
CREATE TABLE ai_create_projects (
  id SERIAL PRIMARY KEY,
  agent_kind TEXT NOT NULL,             -- 'product_detail', 'shorts', ...
  product_brief JSONB,
  research_pack JSONB,
  copy_deck JSONB,
  design_spec JSONB,
  code_bundle JSONB,
  current_step INT DEFAULT 1,
  status TEXT DEFAULT 'in_progress',    -- 'in_progress' | 'done' | 'archived'
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ai_create_versions (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES ai_create_projects(id) ON DELETE CASCADE,
  step INT,
  payload JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. 구현 단계 (Phase 별)

### Phase 1 — Foundation (1-2일)
- `src/lib/v11-ai-create/` 구조 셋업
- 5개 에이전트 시스템 프롬프트 작성
- 데이터 스키마 (Zod / TypeScript) 정의
- Gemini SDK 통합 + API 키 설정
- 마이그레이션 v11.11

### Phase 2 — Core Agents (3-5일)
- ① 정보수집 (대화 + JSON 추출) — 가장 중요
- ③ 카피라이팅 — #9 영업자료의 프레임워크 재사용
- ⑤ 프롬프팅 — Tailwind 토큰 자동 적용
- (스킵 가능: ②리서치 ④디자인 — 단순 fallback)

### Phase 3 — Advanced Agents (3-5일)
- ② 리서치 (Web Search 통합)
- ④ 디자인 (Gemini 3 Pro 통합)
- 이미지 프롬프트 생성 + 외부 이미지 API 통합 (선택)

### Phase 4 — UI / UX (3-5일)
- `/finance/ai-create/product-detail/new` — 위저드 + 채팅
- 단계별 미리보기 + 인라인 편집
- 라이브 코드 미리보기 (iframe sandbox)
- 코드 다운로드 + Git 통합 (선택)

### Phase 5 — Polish (2-3일)
- 재생성 / 버전 히스토리
- 에러 핸들링 + 재시도
- 비용 모니터링 (Anthropic + Gemini 토큰 추적)
- A/B 테스트 (다른 프레임워크로 동시 생성)

**총 예상: 12-20일** (전업 기준)

---

## 7. 비용 예상 (1건당)

### 7.1 LLM + 이미지 생성

| 단계 | 모델 | 비용 (USD) |
|---|---|---|
| ① 정보수집 | Sonnet 4.5 | ~$0.04 |
| ② 리서치 | Sonnet 4.5 + WS | ~$0.10 |
| ③ 카피 ⭐ | Sonnet 4.6 | ~$0.10 |
| ④ 디자인 | Gemini 3 Pro | ~$0.05 |
| ⑤ 프롬프팅 ⭐ | Sonnet 4.6 | ~$0.16 |
| **6a. 이미지 생성** | Imagen 3 (5~10장) | ~$0.20 |
| **6b. Puppeteer 렌더** | 자체 호스팅 (Vercel) | $0 |
| **6c. Sharp 후처리** | 자체 | $0 |
| **합계** | | **~$0.65 / 페이지** |

### 7.2 월 사용량별 예상

| 월 생성량 | 비용 |
|---|---|
| 50건 | ~$33 |
| 100건 | ~$65 |
| 200건 | ~$130 |

### 7.3 절감 옵션

- **6a 이미지 자동생성 OFF** → Imagen 3 비용 ($0.20) 제거. 사용자가 자체 사진 업로드 → $0.45/페이지
- **⑤ 프롬프팅 4.5 로 다운그레이드** → -$0.06 절감 (코드 품질 약간 저하)
- **사진 라이브러리 재사용** → 이미 등록된 디안 자산 우선 활용 → Imagen 3 호출 50% 감소

### 7.4 Imagen 3 무료 한도

Google AI Studio 무료 tier:
- Imagen 3: 일 100장 무료 (정확한 한도 변동 가능)
- 디안 월 50건 (페이지당 5-10장) → **무료 영역 안에 들어감**

---

## 8. 다른 카테고리와의 연계

| 카테고리 | 연계 |
|---|---|
| **#2b 마케팅** | brand_identity (컬러·폰트·이미지 스타일) 자동 주입 |
| **#9 영업자료 자동생성** | 8종 심리·인지과학 프레임워크 공유 + 자산 라이브러리 |
| **#10 입고 워크플로우** | 신제품 입고 시 → "상세페이지 만들기" 버튼으로 직접 진입 (사전 채움) |
| **#7 CEO 코크핏** | 생성 활동 모니터링 (월 N건, 전환율) |
| **#3 측정·분해** | 페이지 → 샘플 청구 → 첫 거래 깔때기 측정 |

---

## 9. 향후 확장

- **다른 에이전트 (쇼츠·롱폼·카드뉴스·블로그)** 가 같은 5-에이전트 패턴 채택
- 정보수집·리서치·프롬프팅 에이전트는 공유 가능
- 카피 + 디자인 에이전트만 콘텐츠 종류별 특화
- 결국 Cross-agent reuse 로 개발 속도 가속

---

**문서 끝**
