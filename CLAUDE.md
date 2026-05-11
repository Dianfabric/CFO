# 디안(Dian) CFO 대시보드 — 프로젝트 컨텍스트

> 이 파일은 Claude Code가 자동으로 읽어 프로젝트 컨텍스트를 파악하기 위한 문서입니다.
> 새 세션 시작 시 이 파일을 먼저 확인하세요.
>
> **현재 단계**: v1.0 (운영 중) + v1.1 (Phase 0 완료, Phase 1 대기)
> **저장소**: 단일 저장소 — `Dianfabric/CFO` (Vercel 자동 배포)

---

## ⚠️ 0. Next.js 경고 (코드 작성 전 반드시 확인)

@AGENTS.md

이 프로젝트는 **Next.js 15.5 + App Router + React 19** 를 사용합니다. API·컨벤션·파일 구조가 모델 학습 데이터와 다를 수 있습니다. 코드 작성 전 `node_modules/next/dist/docs/` 의 관련 가이드를 먼저 확인하세요. Deprecation 경고가 보이면 무시하지 말 것.

---

## 🔓 0.1. 로그인 강제 해제 상태 (V2.2 — 개발 중, 추후 복구 예정)

> **현재 모든 페이지는 로그인 없이 접근·기능 가능**. 추후 인증 시스템 다시 활성화할 때 이 섹션을 참고해 복구.

### 풀려있는 곳

**1. `src/middleware.ts`**
- `PROTECTED_PREFIXES: string[] = []` — 비어있음
- 복구: `['/finance']` 로 되돌리면 `/finance/*` 만 인증 강제 (v1.0 경로는 원래 보호 안 함)

**2. 20개 server action 파일** (`src/app/finance/**/actions.ts`)
- 패턴 변경: `if (!user) return { ok: false, error: '로그인이 필요합니다.' }` → `const userId = user?.id ?? '00000000-0000-0000-0000-000000000000'`
- 패턴 변경: `if (!user) throw new Error('로그인이 필요합니다.')` → 동일한 fallback
- `user.id` 사용처 → `userId` 로 자동 치환됨
- 복구 시 ANON_UUID(`00000000-...`) 검색 + grep 으로 한 번에 되돌리기 가능

**3. page 들의 `if (!user) return null`** — 그대로 둠 (빈 결과 반환 — UI 는 정상 렌더). 인증 복구 시 그대로 작동.

### 복구 명령 (참고 — sed 또는 Python 일괄 치환)
```bash
# 1. middleware 복구
# PROTECTED_PREFIXES: string[] = [] → ['/finance']

# 2. server actions 일괄 복구 (Python)
# const userId = user?.id ?? '00000000-...' → if (!user) return { ok: false, error: '로그인이 필요합니다.' }
# userId → user.id (단, 다른 곳에 userId 변수 있을 수 있으니 주의)
```

### 관련 commit
- 해제: `389dd46` (feat: 로그인 강제 해제 — 개발 중 모든 페이지 + 기능 anon 허용)
- 복구 시 이 commit 의 diff 를 역으로 적용하면 가장 안전

---

## 1. 프로젝트 정체성

**디안(Dian)** — B2B 프리미엄 인테리어 원단 유통·큐레이션 기업의 CFO 대시보드 시스템.

- **포지셔닝**: 저가~럭셔리 멀티티어 (4티어), 럭셔리 라인 도전 예정
- **타겟 고객**: 인테리어 디자이너, 스튜디오, 가구사, 스타일리스트
- **핵심 가치**: 공간의 가치를 결정짓는 '소재의 품격', 전문가를 위한 '최적의 솔루션'
- **인력**: 대표 1명 + 마케팅 담당자 1명 + AI 도구 적극 활용 (소규모 팀)
- **현재 사이트**: https://dian-cfo.vercel.app/ (v1.0, Next.js + Vercel, 11개 메뉴)

## 2. 비즈니스 핵심 구조

### 2.1 24셀 매트릭스 (모든 거래·고객·제품에 자동 매핑)

**6직업군 × 4제품군 = 24셀**

| 직업군 (occupation) | 제품군 (division) |
|---|---|
| 인테리어 프로젝트 (interior_project) | 소파원단 (sofa) |
| 브랜드 가구 (brand_furniture) | 커튼원단 (curtain) |
| 프로젝트 가구 (project_furniture) | 벽원단 (wall) |
| 업소용 천갈이 (commercial_reupholster) | 소품원단 (accessory) |
| 커튼 스타일링 (curtain_styling) |  |
| 디스플레이 (display) |  |

### 2.2 4티어 포지셔닝

| 티어 (tier) | 표시명 | 목표 마진 범위 | 가격 정책 |
|---|---|---|---|
| value | 저가 | 20-30% | 광고에 가격 강조 가능, 9.99 등 문턱가격 |
| mid | 중가 | 35-45% | 제한적 할인 가능 |
| premium | 프리미엄 | 50-65% | 특가·세일 회피, 가치 강조 |
| luxury | 럭셔리 | 70-85% | 할인 절대 금지, Price upon request |

### 2.3 시즌 사이클 + 샘플 운영

- SS·FW 두 시즌 + 인테리어 트렌드 사이클
- 디자이너에게 보내는 샘플 추적 (반환/분실/재구매 전환) — 디안 고유 영역

## 3. 기술 스택

### 3.1 v1.1 (신규 도입)

```
프론트엔드: Next.js 15.5 + App Router + React 19 + TypeScript
스타일링:   Tailwind CSS v4 + shadcn/ui
데이터베이스: Supabase (Postgres + Auth + Storage + RLS)
차트:       Recharts
AI:         Anthropic Claude API
배포:       Vercel (https://dian-cfo.vercel.app/)
```

### 3.2 v1.0 (운영 중, 점진 마이그레이션 예정)

```
DB ORM:     Prisma (현재 운영 — 점진적으로 Supabase 마이그레이션)
DB:         Postgres (Vercel DATABASE_URL)
인증:       NextAuth (Supabase Auth로 통합 예정)
외부 연동:  Google Drive, Google Sheets, Airtable, Anthropic Claude
```

### 3.3 DB 마이그레이션 결정 (옵션 B 채택)

- **현재**: Prisma + Postgres (v1.0) + Supabase 신규 생성 (v1.1)
- **목표**: 통합 Supabase 단일 DB (24셀·4티어 매핑 일관성을 위해 필수)
- **방식**: 무중단 또는 단축 다운타임 (시점 미정 — 대표 결정 대기)
- **Phase 순서**: Phase 0(스키마) → v1.0 데이터 마이그레이션 → Phase 1 시작

## 4. 7개 PRD 카테고리 구조

PRD 파일들은 `docs/prd/` 폴더에 있습니다. **새 페이지 만들 때 해당 PRD를 먼저 읽으세요.**

| # | 카테고리 | 책 | 핵심 사명 | PRD 파일 |
|---|---|---|---|---|
| 1 | 목표·계획 | 위대한 12주 | 12주 PDCA 사이클 디지털화 | `dian_cfo_prd_01_goals_planning.md` |
| 2a | 영업 전략 | 키엔스·트레이시 | 카톡·머릿속 → SFA + AI 영업 동등 모델링 | `dian_cfo_prd_2a_sales_strategy.md` |
| 2b | 마케팅·브랜딩 | 러셀 4부작·맥키·룬·비숍 | 꾸준한 업로드 → AI 콘텐츠 엔진 | `dian_cfo_prd_2b_marketing_branding.md` |
| 2c | 운영 실행 | (책 무관, v1.0 보강) | 데이터 인프라 허브 + 샘플 추적 | `dian_cfo_prd_2c_operations_execution.md` |
| 3 | 측정·분해 | 회계감각 | 인수분해 + 결과의 질 + BSC | `dian_cfo_prd_03_measurement_decomposition.md` |
| 4 | 의사결정 | 지몬 | "그때그때" → 4단계 워크플로우 | `dian_cfo_prd_04_decision_pricing.md` |
| 7 | CEO 코크핏 | 드러커·그로브·캠벨 | 4차원 AI 경영 파트너 | `dian_cfo_prd_07_ceo_cockpit.md` |

## 5. 핵심 설계 원칙 (반드시 지킬 것)

### 5.1 v1.0 데이터 보존 절대 원칙

- 신규 카테고리는 v1.0 위에 얹는 **레이어** (Repo C 전략)
- v1.0의 기존 메뉴·데이터(일일결산·거래·제품·거래처·미수금·비용·분석·시뮬레이션·AI CFO 자문·공문 작성)는 **절대 삭제·훼손 금지**
- 사이드바에 v1.1 신규 메뉴 그룹을 별도 추가 (v1.0 메뉴 유지)
- v1.0 → Supabase 마이그레이션 시 데이터 100% 보존

### 5.2 AI 에이전트를 사람과 동등하게 모델링

- AI 영업 담당자(`SalesAgent`)는 사람 영업 직원과 같은 엔티티로 처리 (#2a)
- AI도 활동 기록·KPI·타겟이 있고, 인간과 협업하는 구조

### 5.3 멀티티어 라인 분리

- 저가~럭셔리 4티어가 명확히 구분되어야 함 (책의 토요타-렉서스 사례)
- 같은 디안 안에 있어도 가격 정책·메시지·디자인이 분리

### 5.4 권한 위계 — 신뢰의 보호

- **1:1 미팅 노트**: 대표라도 다른 사람의 1:1 노트 직접 조회 안 함 (캠벨 신뢰 원칙)
- **AI 브리핑·이브닝 노트**: 본인만 접근 (자기경영 데이터)
- **가격 차별화 정책**: CEO/임원만 접근 (매우 민감)
- **거래 데이터**: CEO/임원은 전체, 직원은 본인 등록만

### 5.5 마스터 데이터 자동 매핑

- 모든 거래·고객·제품은 24셀 세그먼트 + 4티어에 자동 매핑됨
- 트리거(`auto_map_transaction_segment`)가 거래 입력 시 자동 처리
- 수동 매핑은 예외적 (사용자가 자동 매핑 결과 검토·수정 가능)

## 6. 1차 출시 (P0) 범위 — 10-12개 페이지

**다음 순서대로 구현 권장**:

| 순서 | 페이지 | 카테고리 | 우선순위 근거 |
|---|---|---|---|
| 1 | 재무 메인 대시보드 | #3 ① | 매일 보고 싶은 화면, 즉시 가치 |
| 2 | 거래 입력 | #2c ② | 모든 데이터의 출발점 |
| 3 | 일일 운영 대시보드 | #2c ① | 매일 아침 진입 |
| 4 | 매출 인수분해 | #3 ② | 24셀 시각화 |
| 5 | 12주 대시보드 | #1 ① | 사이클 운영 시작 |
| 6 | 비전·목표 | #1 ② | 12주 목표 설정 |
| 7 | 모닝 브리핑 | #7 ① | AI 파트너 첫 작동 |
| 8 | 라이브 컨설팅 | #7 ② | AI 채팅 |
| 9 | 포지셔닝 매트릭스 | #4 ① | 멀티티어 정의 |
| 10 | 4단계 워크플로우 | #4 ③ | "그때그때" 차단 |
| 11 | 자원 인수분해 | #3 ③ | 자원 관리 |
| 12 | WAM (Weekly Action Meeting) | #1 ④ | 주간 회의 |

영업(#2a 전체)·마케팅(#2b 전체)·CEO 코크핏 고도화(④⑤⑥⑧)는 1차 출시 후 단계적으로 추가.

## 7. 데이터베이스

`supabase/schema.sql` 참조 (794줄, 28KB).

### 7.1 주요 테이블

```
profiles              사용자 + 역할 (ceo / executive / employee / ai_agent)
segments              24셀 세그먼트 마스터 (자동 INSERT)
price_tiers           4티어 정의 (자동 INSERT)
product_lines         제품 라인 (브랜드/시리즈, 4티어 분류)
products              SKU
clients               거래처 (24셀 매핑 + 등급)
client_pricing_policies  거래처별 가격 차별화
transactions          거래 (segment_id, tier 자동 매핑)
transaction_items     거래 품목
expenses              비용 (변동/고정 × 재량/비재량)
daily_closes          일일결산 (자동 갱신)
cycles                12주 사이클
goals                 12주 목표
weekly_action_meetings  WAM
price_decisions       가격 의사결정 + 4단계 워크플로우 + 90일 검증
ai_briefings          모닝/이브닝 브리핑 (CEO 본인만)
ai_consulting_sessions  라이브 컨설팅 세션 (CEO 본인만)
```

### 7.2 자동 트리거

- `handle_new_user`: Auth 사용자 생성 시 profiles 자동 생성
- `auto_map_transaction_segment`: 거래 등록 시 segment_id, tier 자동 매핑
- `update_daily_close`: 거래 변경 시 일일결산 자동 갱신

### 7.3 분석 뷰

- `monthly_pl`, `daily_pl`: 월별/일별 P&L
- `client_profitability`: 거래처별 수익성
- `revenue_by_segment`: 24셀 매트릭스 매출
- `revenue_by_tier`: 티어별 매출
- `outstanding_payments`: 미수금 에이징

## 8. v1.0 운영 컨텍스트 (이미 배포된 부분)

### 8.1 운영 정보

- **사이트**: https://dian-cfo.vercel.app/
- **저장소**: `Dianfabric/CFO` (Vercel 자동 배포 main 브랜치)
- **DB ORM**: Prisma
- **DB 환경변수**: `DATABASE_URL` (Vercel)

### 8.2 v1.0 11개 메뉴 (절대 보존 대상)

1. 대시보드
2. 일일 결산
3. 거래 관리
4. 거래처 관리
5. 미수금 관리
6. 제품 관리
7. 비용 관리
8. 분석/시뮬레이션
9. AI CFO 자문
10. 공문 작성 (단가 인상/인하/안내, 발행 이력 + 미리보기 + 수정 생성)
11. 설정

### 8.3 v1.0 → v1.1 마이그레이션 (대표 결정 사항)

- **DB 전략**: 옵션 B (Prisma → Supabase 통합 마이그레이션)
- **저장소 전략**: 옵션 C (단일 저장소 `Dianfabric/CFO` 안에 v1.1 레이어 추가)
- **다운타임**: 무중단 vs 단축 다운타임 미결정 (대표 결정 대기)
- **시점**: Phase 0 셋업 완료 후 진행

## 9. 환경변수 (`.env.local`)

`.env.local` 은 `.gitignore` 로 보호됨. 다음 변수 필요:

```env
# Supabase v1.1 (생성 완료)
NEXT_PUBLIC_SUPABASE_URL=https://duzlsicqthmbxbgsvlfz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<jwt>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=<jwt>  # 서버 전용, 절대 클라이언트 노출 금지
SUPABASE_PROJECT_REF=duzlsicqthmbxbgsvlfz

# v1.0 (기존 .env)
DATABASE_URL=<postgres>          # Prisma 운영 DB
ANTHROPIC_API_KEY=<key>           # AI CFO 자문
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=<url>
AIRTABLE_API_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_CLIENTS_TABLE_ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID, NEXT_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID
SHEETS_ID, SHEETS_API_KEY
```

## 10. 현재 진행 상황

### 10.1 완료된 작업

- ✅ v1.0 11개 메뉴 운영 중 (Vercel 배포)
- ✅ v1.0 공문 작성 시스템 v1.1 확장 배포 완료 (단가 인상/안내, 발행 이력 미리보기, VIP가, Lead time 등)
- ✅ 7개 카테고리 PRD v0.1 작성 완료 (`docs/prd/`)
- ✅ Phase 0: 데이터베이스 스키마 작성 (`supabase/schema.sql`, 794줄)
- ✅ Supabase 프로젝트 생성 (`dian-dash`, ref: duzlsicqthmbxbgsvlfz)
- ✅ `.env.local` 에 Supabase 키 등록
- ✅ 핵심 설계 결정 (24셀 자동 매핑, 4티어 분리, 권한 위계, AI 에이전트 동등 모델링)
- ✅ Supabase 스키마 적용 + `handle_new_user` 트리거 search_path 패치
- ✅ CEO 첫 사용자 등록 (diantex00@gmail.com) + profiles role=ceo 부여

### 10.2 진행 중 / 다음 작업

- ⏭ Phase 0 검증 쿼리 (segments=24, price_tiers=4, profiles role=ceo)
- ⏭ Phase 0.5: v1.0 Prisma → Supabase 데이터 마이그레이션 스크립트
- ⏭ Phase 1 ①: 재무 메인 대시보드
- ⏭ Phase 1 ②~⑫: P0 12개 페이지 단계 추가

### 10.3 대표 결정 필요 항목 (가장 시급한 순서)

1. **드림 100 리스트** (#2b ⑥) — 1일 워크숍 권장 (마케팅의 모든 활동 정렬 기준)
2. **드러커 3가지 질문 답변** (#7) — 모든 AI 분석의 기준점, 2-3시간 워크숍
3. **빅 아이디어 + 브랜드 페르소나** (#2b ①, ②)
4. **본인 강점 자기 인식** (#7 ⑤)
5. **4티어별 목표 매출총이익률 범위** (#4)
6. **럭셔리 라인 별도 브랜드명 도입 여부** (#4 11.4)
7. **시각 정체성**: 컬러·폰트·이미지 스타일
8. **사용 AI 모델, 텔레그램봇 도입 시점, 모닝/이브닝 발송 시간** (#7)
9. **v1.0 → Supabase 마이그레이션 다운타임 방식**

## 11. 작업 시 가이드라인

### 11.1 새 페이지 만들 때

1. 해당 PRD 파일을 먼저 읽기 (`docs/prd/`)
2. 카테고리 간 데이터 흐름 확인 (PRD 7장 "다른 카테고리와의 연계")
3. 권한 위계 확인 (PRD 6장)
4. 디안 비즈니스 특성 반영 (24셀, 4티어, 시즌, 샘플)
5. v1.0 데이터 보존 원칙 준수
6. v1.0 메뉴와 충돌 없이 사이드바에 추가

### 11.2 톤 & 매너

- 디안의 톤은 "세련된 전문가" — 격조 있고 신뢰감 있게
- 지나치게 가볍지 않으면서 창의적 영감을 줄 수 있는 어조
- 인테리어 디자이너·건축가가 사용하기 편한 UI

### 11.3 코드 스타일

- TypeScript strict mode
- React Server Components 우선, Client Components는 필요한 경우만
- Tailwind CSS 변수 사용 (디안 브랜드 가이드 결정 후 토큰 정리 예정)
- Supabase 클라이언트는 서버/클라이언트 분리 (`lib/supabase/server.ts`, `lib/supabase/client.ts`)

### 11.3.5 모바일 반응형 필수 원칙 ★

**모든 신규 페이지·컴포넌트는 모바일 반응형을 기본으로 작성한다.** 데스크탑 먼저 만들고 나중에 모바일 대응 X. 처음부터 모바일·태블릿·데스크탑 동시 고려.

**브레이크포인트 (Tailwind 기본 + 디안 spec)**
- `sm:` ≥ 640px (큰 폰)
- `md:` ≥ 768px (태블릿 portrait)
- `lg:` ≥ 1024px (태블릿 landscape / 작은 데스크탑)
- `xl:` ≥ 1280px (데스크탑)
- `2xl:` ≥ 1440px (와이드)

**필수 체크리스트 (페이지·컴포넌트 작성 시)**

1. **그리드는 1-column 부터 시작** — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N` 패턴
2. **타이포는 `clamp()` 또는 `text-base sm:text-lg lg:text-xl`** — 절대 고정 px 헤드라인 금지
3. **패딩은 viewport 적응** — `px-4 sm:px-6 lg:px-8`, `py-8 sm:py-12 lg:py-16`
4. **테이블·매트릭스·차트는 `overflow-x-auto` 래퍼 필수** — 모바일에서 가로 스크롤 허용
5. **버튼·터치 타겟 최소 44×44px** — 모바일 탭 가능
6. **사이드바·드로어는 데스크탑 sticky / 모바일 Sheet 분리**
7. **이미지는 `srcset` 또는 `next/image`** — 모바일에선 작게
8. **폼은 1-column 모바일** — `flex-col sm:flex-row`
9. **모달·다이얼로그 풀스크린 모바일** — shadcn Dialog 가 자동 처리
10. **페이지 헤더 액션은 `flex-wrap`** — 좁은 화면에서 줄바꿈

**테스트 viewport (개발 시 반드시 확인)**
- 375px (iPhone SE / Pro 13)
- 768px (iPad portrait)
- 1024px (iPad landscape / 작은 노트북)
- 1440px (외장 모니터)

**참조 파일**
- `src/app/globals.css` — `text-hero`, `section-pad` 등 clamp 유틸리티
- `src/components/layout/Sidebar.tsx` — 데스크탑 sticky 패턴
- `src/components/layout/MobileNav.tsx` — 모바일 Sheet 드로어 패턴
- `docs/design-system/apple-spec.md` — Responsive Behavior 섹션

### 11.4 별도 PRD가 필요한 영역 (추후)

- 미수금 관리 상세 PRD (#3 ⑨에서 자리만 잡음)
- 회계법인 연동 상세 PRD
- 배송·물류 통합 PRD
- PRD 2a v0.2: 트레이시 자료 정식 통합 (부록 13장 → 본문 ⑦ 자기경영)

### 11.5 배포 워크플로우 (메모리 규칙)

- **로컬 수정 → 로컬 미리보기 → commit 까지는 자유**
- **`git push` 와 Vercel 배포는 사용자가 명시 요청 시에만 수행**
- 사용자 ("푸시해줘", "배포해줘") 명시 전엔 자동 push 금지

---

## 빠른 시작

새 세션에서 작업을 이어가려면:

1. 이 `CLAUDE.md` 파일이 자동으로 컨텍스트로 로드됨
2. `docs/prd/` 폴더에서 작업할 카테고리의 PRD 확인
3. `supabase/schema.sql` 로 데이터베이스 구조 파악
4. `docs/PHASE_0.md` 에서 Phase 0 셋업 가이드 확인
5. 작업 진행 후 진행 상황을 이 파일 10.1, 10.2 섹션에 업데이트

---

**문서 버전**: 통합 v1.0 (v1.0 운영 컨텍스트 + v1.1 신규 컨텍스트 결합)
**최종 갱신**: 2026-05-05
