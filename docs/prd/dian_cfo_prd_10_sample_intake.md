# PRD #10 — 신제품 샘플 입고 워크플로우 (Sample Intake Workflow)

**버전**: v0.1
**작성일**: 2026-05-06
**카테고리**: #2c 운영·실행 하위 (입고 → 평가 → 기획 → 실행 → 추적)
**관련 PRD**: #2c (샘플), #2a (영업), #2b (마케팅), #4 (포지셔닝·티어), #9 (영업자료), #1 (WAM), #8 (팀 공유)

---

## 0. 한 줄 정리

> **신제품 샘플이 입고되면, 24셀 매트릭스에 자동 매핑하고, 단계별 표준 행동 요령에 따라 영업·마케팅·샘플 발송을 한 번에 실행하는 5단계 워크플로우.**

---

## 1. 왜 만드는가

### 1.1 디안의 운영 약점

- **신제품 입고 시 즉시 행동 패턴이 없음** → 쑈룸에 비치하고 잊혀짐
- 어느 직군 × 어느 제품군에 어울리는지 직원마다 판단이 다름 → **체계적 매핑 부재**
- 영업·마케팅·샘플이 따로 움직임 → **신제품 임팩트 분산**
- 입고 후 30·90일 성과 회고 없음 → **다음 입고에 학습이 안 누적됨**

### 1.2 자동화로 얻는 효과

| 지표 | 현재 | 목표 |
|---|---|---|
| 입고 후 첫 액션까지 시간 | 3~7일 | **24시간 이내** |
| 신제품 1건당 활동 | 쑈룸 비치 1개 | **자료·콘텐츠·샘플·공지 5+개** |
| 24셀 매핑 일관성 | 직원 재량 | **AI 추천 + 플레이북 표준화** |
| 30/90일 성과 회고 | 없음 | **자동 모니터링** |
| 카테고리 간 연계 | 수동 | **버튼 한 번에 6개 카테고리 동시 작동** |

### 1.3 핵심 가설

> "신제품의 첫 7일 액션 밀도가 누적 매출의 70%를 결정한다."

→ 첫 7일 안에 영업자료 + 마케팅 1건 + 샘플 5건 + 공지가 자동 실행되도록 강제.

---

## 2. 5단계 워크플로우

### Stage 1: 입고 (`arrived`)

**목적**: 샘플 사실(fact)을 빠르게 시스템에 반영

| 입력 항목 | 필수 | 설명 |
|---|---|---|
| 샘플명 | ✓ | 예: "벨기에 BR-1842 워시드 리넨" |
| 공급처 | ✓ | 직조사·대리점 |
| 출처 | ✓ | 국내 / 해외 |
| 입고일 | ✓ | 자동 = 오늘 |
| 수량 | ✓ | 샘플 단위 (롤·시트 등) |
| 소재 | ✓ | 100% 리넨, 리넨/코튼 80/20 등 |
| 컬러군 | | 쉼표 구분 |
| 추정 단가 | | 원/단위 |
| 사진 (3장) | | 전체 / 디테일 / 결 |
| 메모 | | 공급처 코멘트 등 |

→ 자동: 자산 라이브러리 (#9) 에 자산 1건 등록

### Stage 2: 평가 (`evaluating`)

**목적**: 24셀 매트릭스에 매핑하고 시장성 판단

| 항목 | 입력 방식 |
|---|---|
| 제품군 (sofa/curtain/wall/accessory) | **AI 추천** + 직원 확정 |
| 4티어 추천 | **AI 추천** (소재·단가·해외출처 가중) + 직원 수정 |
| 적합 직업군 (다중) | **AI 추천** + 직원 수정 |
| 경쟁력 점수 (1~5) | 직원 평가 |
| 차별화 포인트 (1줄) | 직원 작성 |
| 리스크 메모 | 옵션 |

→ AI 평가 = Claude 호출, 디안 4티어/24셀 컨텍스트 + 입고 정보 → JSON 응답

### Stage 3: 기획 (`planned`)

**목적**: 누구에게 어떻게 팔지 — 타겟·전략·KPI

| 항목 | 설명 |
|---|---|
| 타겟 직업군 (다중) | 평가 단계에서 제안된 것 중 확정 |
| 타겟 제품군 | 1개 또는 다중 (예: 소파+커튼) |
| 가격 전략 | "프리미엄 포지션, 3개월 할인 금지" 같은 한 줄 |
| 마케팅 앵글 | "장인의 손으로 짠 침묵" 같은 빅 아이디어 후보 |
| **우선 거래처 Top 5** | 24셀 매칭 + 최근 거래 점수로 자동 추천 + 직원 수정 |
| 30일 매출 목표 | 원 |
| 90일 매출 목표 | 원 |
| 비고 | 옵션 |

### Stage 4: 실행 (`in_action`)

**목적**: 자동 생성된 체크리스트를 직원이 클릭만 하면 됨

체크리스트 (자동 생성, 플레이북 기반으로 변형):

| ☐ | 항목 | 자동 연계 |
|---|---|---|
| ☐ | 쑈룸 비치 (위치 입력) | — |
| ☐ | 사진 라이브러리 등록 | (Stage 1에서 자동) |
| ☐ | **영업자료 자동 생성** | #9 위저드 자동 채움 (24셀·티어·제품) |
| ☐ | **마케팅 콘텐츠 1건 등록** | #2b 콘텐츠 캘린더에 카드 추가 |
| ☐ | **우선 거래처 5곳에 샘플 발송** | #2c 샘플 시스템에 5건 자동 등록 |
| ☐ | **WAM 다음 주 안건 등록** | #1 WAM에 안건 추가 |
| ☐ | **슬랙 직원 채널 공지** | #8 슬랙 발송 |

→ 모든 체크리스트 완료 = 자동으로 Stage 5 (추적) 진입

### Stage 5: 추적 (`tracking`)

**목적**: 30·90일 후 성과 회고 + 학습 누적

| 자동 측정 (transactions·sample_requests 집계) |
|---|
| 발송한 샘플 수 |
| 청구된 샘플 수 (회수 또는 분실) |
| 첫 거래 발생 거래처 수 |
| 30일 매출 |
| 90일 매출 |
| 목표 대비 달성률 |

| 직원 작성 회고 (30일·90일 시점) |
|---|
| 잘 된 점 (what_worked) |
| 안 된 점 (what_didnt) |
| 다음 입고에 적용할 학습 (lessons_learned) |

→ 종결 시 `archived` 상태로 전환 + 플레이북에 학습 반영 가능

---

## 3. 페이지 구조 (4개 + 사이드바 1)

```
/finance/operations/intake              ← 칸반 보드 + 통계 (5단계)
/finance/operations/intake/new          ← 입고 등록 (Stage 1)
/finance/operations/intake/[id]         ← 샘플 상세 (단계별 폼 + 액션 버튼)
/finance/operations/intake/playbook     ← 표준 행동 요령 (24셀 × 4티어 매트릭스, CEO 편집 가능)
```

---

## 4. 데이터베이스 (`v11.10_sample_intake.sql`)

### 4.1 메인 테이블

```sql
incoming_samples (
  id, name, supplier, source (domestic/overseas), arrival_date,
  sample_count, unit, material, colors (jsonb),
  estimated_unit_price, photos (jsonb), notes,
  -- Stage 2: 평가
  division (sofa/curtain/wall/accessory), recommended_tier,
  recommended_occupations (jsonb), competitive_score, differentiator, risk_note,
  ai_evaluation (jsonb),
  -- Stage 3: 기획
  target_occupations (jsonb), target_divisions (jsonb),
  pricing_strategy, marketing_angle,
  priority_client_ids (jsonb), revenue_target_30d, revenue_target_90d,
  -- 워크플로우 상태
  stage (arrived/evaluating/planned/in_action/tracking/archived),
  asset_id, generated_material_ids (jsonb), sample_request_ids (jsonb),
  content_item_ids (jsonb),
  -- 메타
  created_by, created_at, updated_at
)

intake_action_items (
  id, sample_id, label, action_kind (manual/sales_material/marketing_content/sample_send/wam/slack/showroom),
  action_url, completed, completed_at, completed_by,
  display_order
)

intake_performance_reviews (
  id, sample_id, review_kind (30d/90d/final),
  measured_metrics (jsonb),
  what_worked, what_didnt, lessons_learned,
  reviewed_by, reviewed_at
)

sample_intake_playbook (
  id, occupation, division, tier,
  recommended_actions (jsonb),  -- 액션 카드 템플릿
  notes, active, updated_by, updated_at
)
```

### 4.2 Seed: 플레이북 (24셀 × 4티어 = 일부만 시드, 나머지는 직원이 채움)

| 직업군 × 제품군 × 티어 | 추천 액션 |
|---|---|
| 인테리어 프로젝트 × 커튼 × premium | 스타일링 디자이너 5명 우선 발송, 빛 투과 영상 콘텐츠, 가격 미공개 |
| 브랜드 가구 × 소파 × premium | 양산 안정성 검증 자료, 단가 협상용 등급 제안서 |
| 인테리어 × 벽 × luxury | 5명 한정 발송 + Price upon request, 블랙룸 사진 |
| 천갈이 × 소파 × value | 화재 인증 강조, 청소·내구성 비교, 가격 강조 |
| 디스플레이 × 소품 × value | 빠른 입고·소량 다품종, 트렌드 중심 |
| ... (총 12~15개 시드, 나머지 빈칸) |

### 4.3 RLS

- CEO·임원·직원 모두 SELECT/INSERT/UPDATE 가능
- 플레이북 편집은 CEO·임원만

---

## 5. AI 평가 (Stage 2 자동화)

### 5.1 입력
- 샘플 정보 (이름·공급처·소재·컬러·추정단가·해외출처)
- 디안 4티어 정의
- 디안 24셀 매트릭스

### 5.2 시스템 프롬프트 요지
```
당신은 디안의 시니어 머천다이저.
입고된 샘플 정보를 보고 다음을 추천하라:
1. 제품군 (sofa/curtain/wall/accessory)
2. 티어 (value/mid/premium/luxury) — 단가·소재·해외출처 가중
3. 적합 직업군 1~3개
4. 경쟁력 점수 (1~5)
5. 차별화 포인트 한 줄
JSON only.
```

### 5.3 출력 → DB의 `ai_evaluation` 컬럼에 저장 + 폼 자동 채움 + 직원이 검토·수정

---

## 6. 카테고리 자동 연계 (핵심 가치)

| 액션 | 자동 처리 |
|---|---|
| **"영업자료 자동 생성"** 클릭 | #9 위저드를 24셀·티어·제품 정보로 미리 채워서 신규 자료 생성 → `generated_material_ids` 에 ID 저장 |
| **"마케팅 콘텐츠 등록"** 클릭 | #2b `content_items` 에 신제품 후보 카드 추가 (channel=instagram, status=draft) |
| **"우선 5곳에 샘플 발송"** 클릭 | #2c `sample_requests` 에 5건 자동 생성 (priority_client_ids → status=pending) |
| **"WAM 안건 등록"** 클릭 | #1 다음 주 WAM 안건에 추가 (cycle_priorities) |
| **"슬랙 공지"** 클릭 | #8 `team_announcements` 에 공지 추가 + 즉시 슬랙 발송 |

---

## 7. KPI (#3 측정·분해와 연동)

| 지표 | 측정 방식 |
|---|---|
| 입고 → 첫 액션까지 시간 | `created_at` ~ 첫 `intake_action_items.completed_at` |
| Stage 4 완료율 | 체크리스트 100% 완료된 샘플 비율 |
| 신제품 30일 매출 | `incoming_samples.priority_client_ids` 거래처의 30일 매출 |
| 신제품 30일 첫 거래 전환율 | 우선 5곳 중 첫 거래 발생 비율 |
| 24셀 균형 | 입고 분포가 24셀 어느 한 쪽에 쏠리는지 모니터링 |

---

## 8. 권한

| 역할 | Stage 1·2 | Stage 3·4 | 회고 (Stage 5) | 플레이북 편집 |
|---|---|---|---|---|
| CEO | ✓ | ✓ | ✓ | ✓ |
| 임원 | ✓ | ✓ | ✓ | ✓ |
| 직원 | ✓ | ✓ | ✓ | ✕ (열람만) |
| AI 에이전트 | Stage 2 평가 | ✕ | ✕ | ✕ |

---

## 9. 출시 단계

### v0.1 (이번 라운드)
- 5단계 칸반 + 입고 등록 + 단계 진행
- AI 평가 (Claude)
- 6개 카테고리 자동 연계 (영업자료·마케팅·샘플·WAM·슬랙·자산)
- 플레이북 (24셀 × 4티어 시드 + 편집)
- 30·90일 자동 측정

### v0.2 (다음)
- 사진 업로드 (Supabase Storage)
- 자동 알림 (30일 시점 → 회고 작성 리마인드)
- 플레이북 학습 자동 반영 (회고 lessons_learned → 플레이북 업데이트 제안)

### v0.3
- 칸반 드래그 앤 드롭으로 단계 이동
- 24셀 히트맵 (어느 셀에 입고가 몰리는지)

---

**문서 끝**
