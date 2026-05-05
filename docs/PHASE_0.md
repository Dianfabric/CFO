# 디안 CFO 대시보드 v1.1 — 개발 시작 가이드

> v1.0 (https://dian-cfo.vercel.app/) 위에 7개 PRD 카테고리를 단계적으로 얹는 작업.

---

## Phase 0: 데이터베이스 셋업 (이번 단계)

이 단계가 끝나면 디안의 모든 페이지가 공유할 데이터베이스 토대가 완성됩니다. 약 1-2시간 소요.

### Step 1: Supabase 프로젝트 생성

1. https://supabase.com 가입 및 로그인 (무료 티어로 시작 가능)
2. **New Project** 클릭
3. 프로젝트 정보 입력:
   - **Name**: `dian-cfo-v1.1`
   - **Database Password**: 강력한 비밀번호 (별도 안전한 곳에 보관)
   - **Region**: `Northeast Asia (Seoul)` ― 한국 사용자 응답 속도 최적화
   - **Pricing Plan**: Free (시작 시), 추후 Pro로 업그레이드 권장
4. 프로젝트 생성까지 약 2-3분 대기

### Step 2: 데이터베이스 스키마 적용

1. Supabase 대시보드 좌측 메뉴 → **SQL Editor**
2. **New query** 클릭
3. 동봉된 `supabase_schema.sql` 파일 전체 내용을 복사하여 붙여넣기
4. 우측 상단 **Run** 클릭 (또는 `Ctrl+Enter`)
5. 성공 메시지 확인 (오류 발생 시 README 하단 트러블슈팅 참고)

이 스크립트가 만드는 것:
- **테이블 16개**: profiles, segments, products, clients, transactions, expenses, cycles, goals, ai_briefings 등
- **마스터 데이터**: 24셀 세그먼트(6×4) 자동 생성, 4티어 정의
- **자동 트리거**: 거래 입력 시 일일결산 자동 갱신, 세그먼트·티어 자동 매핑
- **뷰 6개**: monthly_pl, daily_pl, client_profitability, revenue_by_segment, revenue_by_tier, outstanding_payments
- **권한 정책 (RLS)**: CEO/임원/직원/AI 역할별 접근 제어
- **첫 12주 사이클 자동 시작** (오늘부터)

### Step 3: 첫 사용자 등록 + CEO 역할 부여

1. Supabase 좌측 메뉴 → **Authentication** → **Users**
2. **Add user** → **Create new user** 선택
3. 대표님 이메일 + 비밀번호 입력 → **Create user**
4. 좌측 메뉴 → **Table Editor** → `profiles` 테이블
5. 방금 만든 사용자 행을 찾아 **role** 컬럼을 `employee` → `ceo`로 변경
6. **full_name** 컬럼에 대표님 이름 입력

**중요**: 이 작업이 끝나면 대표님 계정이 모든 데이터에 접근 가능합니다. 다른 직원·임원도 같은 방법으로 추가하되 `role`을 `executive` 또는 `employee`로 설정.

### Step 4: API 키 확보

다음 응답에서 Next.js 프로젝트를 만들 때 필요합니다.

1. Supabase 대시보드 → **Project Settings** (좌측 하단 톱니바퀴)
2. **API** 탭에서 다음 두 값 복사하여 안전한 곳에 보관:
   - **Project URL** (예: `https://abcdefg.supabase.co`)
   - **anon / public key** (긴 JWT 토큰)
3. **service_role key**도 있는데, 이건 **절대 클라이언트 코드에 노출 금지**. 서버에서만 사용.

### Step 5: 마스터 데이터 입력 (1회성)

스키마가 적용되면 시스템이 작동하기 위해 다음 마스터 데이터가 필요합니다. **다음 응답에서 입력 페이지를 만들어 드릴 수 있고**, 또는 지금 SQL Editor에서 직접 입력하셔도 됩니다.

**① 24셀 세그먼트 메시지 보강 (선택)**

스키마가 24개 셀을 자동 생성했지만, 각 셀의 핵심 메시지·시퀀스는 비어있습니다. 우선 자주 쓰는 셀부터 채워 나가시면 됩니다.

```sql
-- 예시: 인테리어 프로젝트 × 벽원단
UPDATE segments
SET
  core_message = '공간의 텍스처 컨셉 파트너',
  sales_sequence = ARRAY['컨셉 미팅', '무드보드 송부', '샘플북 발송', '큐레이션 제안'],
  avg_cycle_days = 42
WHERE occupation = 'interior_project' AND division = 'wall';
```

**② 제품 라인 등록**

디안의 주요 제품 라인을 4티어로 분류하여 등록:

```sql
INSERT INTO product_lines (name, brand_name, tier, division, value_essential) VALUES
  ('베이직 라인',    '디안 베이직', 'value',   'sofa',   '내구성과 가격의 균형'),
  ('스탠다드 라인',  '디안',       'mid',     'sofa',   '품질과 디자인 다양성'),
  ('프리미엄 라인',  '디안 시그니처', 'premium', 'sofa', '고급 소재 + 디자이너 컬렉션'),
  -- 럭셔리 라인은 추후 결정 (별도 브랜드명 검토 필요)
  ('커튼 베이직',    '디안',       'mid',     'curtain', NULL);
-- 실제 디안의 라인업에 맞춰 수정·확장
```

**③ v1.0 거래처·거래 데이터 임포트**

v1.0에 이미 등록된 거래처·거래 데이터가 있다면 마이그레이션이 필요합니다. **이 작업은 v1.0의 정확한 스키마를 알아야 안전하게 진행되니, 다음 응답에서 별도 스크립트로 다루겠습니다.**

당장 v1.0과 별도로 v1.1을 시작하시려면 이 단계를 건너뛰어도 됩니다.

---

## Phase 1: Next.js 프로젝트 + 첫 페이지 (다음 응답)

Phase 0가 완료되면 다음 응답에서 만들어 드릴 것:

1. **Next.js 14 프로젝트 시작 구조** (App Router + TypeScript + Tailwind + shadcn/ui)
2. **Supabase 클라이언트 설정** (서버·클라이언트 분리)
3. **인증 페이지** (로그인·회원가입)
4. **공통 레이아웃** (사이드바·헤더, 7대 카테고리 네비게이션)
5. **첫 페이지: 재무 메인 대시보드** (#3 ①) ― 데이터 가져와서 차트로 표시

이걸 받으시면 Vercel에 바로 배포해서 작동하는 v1.1을 보실 수 있습니다.

---

## Phase 2+: 페이지 추가 (Claude Code 활용)

Phase 1이 작동하기 시작하면, 그 다음부터는 **대표님이 Claude Code 또는 Cursor로 직접** 페이지를 추가하시는 게 효율적입니다. PRD 7개가 모두 마크다운 파일로 정리되어 있으니 AI 도구가 컨텍스트로 활용하기 좋습니다.

### Claude Code 활용 워크플로우 (권장)

**셋업**:
```bash
# 프로젝트 폴더에서
claude
# (또는 처음이면) curl -fsSL https://claude.ai/install.sh | sh
```

**페이지 추가 시 프롬프트 패턴**:
```
다음 PRD 파일을 참고해서 [페이지 이름] 페이지를 만들어줘:

@docs/prd/dian_cfo_prd_03_measurement_decomposition.md

이 PRD의 [4.2 ② 매출 인수분해] 섹션을 구현해줘.
- 데이터는 Supabase의 revenue_by_segment 뷰에서 가져옴
- 차트는 recharts의 트리맵 사용
- 기존 src/app/finance/page.tsx의 디자인 시스템 따름
```

Claude Code가 PRD를 읽고, 기존 코드 패턴을 따라 새 페이지를 만들어줍니다. 대표님은 결과를 검토·수정·배포하시면 됩니다.

### 페이지 구현 우선순위 (1차 출시 12개 페이지)

다음 순서대로 만들어 가시는 걸 권장:

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
| 12 | WAM | #1 ④ | 주간 회의 |

각 페이지당 평균 1-2일 작업 (Claude Code 활용 시). 본업 병행하며 주 1-2개 페이지 추가하면 **2-3개월 내 1차 출시 완료** 가능.

---

## 트러블슈팅

### Q1. SQL 실행 시 `relation "auth.users" does not exist` 오류
A. Supabase의 `auth` 스키마는 자동 생성됩니다. 프로젝트 생성 직후 실행하면 정상 작동. 만약 다른 DB에서 실행 중이라면 Supabase가 아닌 환경입니다.

### Q2. RLS 정책 적용 후 데이터가 안 보임
A. 첫 사용자의 `role`이 `employee`(기본값)로 시작합니다. profiles 테이블에서 본인 행의 role을 `ceo`로 변경하세요.

### Q3. 24셀 세그먼트가 자동 생성되지 않음
A. 스크립트 13번째 섹션 직전에 `INSERT INTO segments ...` 부분이 있습니다. 이 부분이 실행되었는지 SQL Editor에서 확인:
```sql
SELECT COUNT(*) FROM segments;  -- 24가 나와야 정상
```

### Q4. 트리거가 작동 안 함
A. PostgreSQL 트리거는 RLS와 별도입니다. `supabase_schema.sql`을 다시 처음부터 실행하면 트리거가 재생성됩니다.

### Q5. v1.0과 동시 운영
A. v1.0은 자체 데이터베이스가 있을 가능성이 높습니다. v1.1은 새 Supabase 프로젝트로 별도 운영하시고, v1.0 데이터를 v1.1로 이관하는 마이그레이션 스크립트는 다음 단계에서 작성합니다.

---

## 다음 단계 안내

Phase 0가 끝나면 (Supabase 셋업 + 스키마 실행 + CEO 계정 생성), 저에게 다음과 같이 알려주세요:

> "Supabase 셋업 완료. Project URL: [...], anon key: [...]. 다음 단계 진행해줘."

또는 Phase 0 진행 중 막히는 부분이 있으면 그 지점을 알려주시면 됩니다. 다음 응답에서 Next.js 프로젝트 구조 + 첫 페이지(재무 메인 대시보드) 코드를 만들어 드리겠습니다.

---

## 파일 구성 (이번 응답)

```
dian_v1.1/
├── supabase_schema.sql    ← Supabase에 실행할 전체 스키마
└── README.md              ← 이 파일 (Phase 0 가이드)
```

다음 응답에서 추가될 파일:
```
dian_v1.1/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx
│   │       └── finance/
│   │           └── page.tsx    ← 첫 페이지: 재무 메인 대시보드
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── design-tokens.ts
│   └── components/
│       ├── ui/         ← shadcn/ui
│       └── charts/
├── package.json
├── tailwind.config.ts
└── .env.local.example
```

수고하셨습니다. Supabase 셋업 진행해 주시면 다음 단계로 넘어가겠습니다.
