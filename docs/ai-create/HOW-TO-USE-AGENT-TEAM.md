# 디안 상세페이지 Agent Team 사용 가이드

> Claude Code 의 공식 **Sub-Agents + Skills + Agent Teams** 기능을 활용한 5-에이전트 팀.
> 디안 CFO 코드베이스에서 한 줄 명령으로 production-ready 상세페이지를 생성.

---

## 1. 구성 요소

### Skills (`.claude/skills/`)
프롬프트·규칙 라이브러리 — 에이전트가 invoke 해서 사용:

```
.claude/skills/
├── dian-design-system/SKILL.md   ← Apple 토큰·타이포·간격 규칙
├── dian-13-sections/SKILL.md     ← 13 섹션 골격·프레임워크·티어 변형
└── dian-tier-tone/SKILL.md       ← 4티어 어휘·금기 매트릭스
```

### Subagents (`.claude/agents/`)
전문 에이전트 — 특정 task 에 자동 위임:

```
.claude/agents/
├── dian-product-detail-team-lead.md   ★ 팀 리드 (orchestrator)
├── dian-section-architect.md           ① 섹션 구조 설계
├── dian-copy-craftsman.md              ② 카피 (Sonnet 4.6)
├── dian-image-prompter.md              ③ Imagen 3 프롬프트
├── dian-html-renderer.md               ④ HTML + .tsx (Sonnet 4.6)
└── dian-design-reviewer.md             ⑤ 최종 검수
```

---

## 2. 사용 방법 — 3가지 모드

### 모드 A: 팀 리드에게 한 번에 위임 (가장 간단)

Claude Code 에 이렇게 말하면 자동:

```
"디안 SS26 워시드 리넨 상세페이지를 premium 티어로 만들어줘.
타겟은 인테리어 디자이너 + 커튼 스타일링."
```

→ Claude 가 description 매칭으로 `dian-product-detail-team-lead` 자동 위임
→ 팀 리드가 5단계 파이프라인 순차 실행
→ 중간 checkpoint 마다 사용자에게 결과 제시

### 모드 B: @mention 으로 명시적 호출

```
"@agent-dian-product-detail-team-lead

ProductBrief:
- 제품: SS26 워시드 리넨
- 티어: premium
- 직업군: interior_project, curtain_styling
- 셀링포인트: 자연 워싱, 1858년 직조사, 4컬러"
```

### 모드 C: 개별 에이전트 호출 (디버그·재실행)

```
"@agent-dian-copy-craftsman

이전 SectionPlan 으로 카피만 다시 작성해줘. luxury 톤으로 전환."
```

---

## 3. Agent Teams (실험 기능) — 병렬·복잡 워크플로우

상세페이지 1건은 순차로 충분하지만, **여러 제품의 상세페이지를 동시 생성** 또는 **상세페이지 + 쇼츠 + 카드뉴스 동시 제작** 시 Agent Teams 가 유용합니다.

### 활성화

```powershell
# Claude Code 시작 전 환경변수
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"
claude
```

### 사용 예시

```
"3개 제품 상세페이지를 동시에 만들어줘:
1. SS26 워시드 리넨 (premium)
2. SS26 헤비 캔버스 (mid)
3. SS26 럭셔리 실크 (luxury)

각각 dian-product-detail-team-lead 사용. 병렬 진행."
```

→ Claude 가 3개 teammate session 생성 (split-pane)
→ 각자 5단계 파이프라인 진행
→ 공유 task list 로 진행상황 추적

---

## 4. 흐름 예시 (모드 A 가장 일반적)

```
사용자: "워시드 리넨 상세페이지 premium 으로 만들어줘"
   │
   ▼
[Claude 자동 위임]
@agent-dian-product-detail-team-lead 활성화
   │
   ▼
팀 리드: "어떤 셀링포인트를 강조하시겠어요? (3개 권장)"
사용자: "1858년 직조사, 자연 워싱, 4컬러"
   │
   ▼
팀 리드: ProductBrief 정리 → @agent-dian-section-architect 호출
   │
   ▼ [10초]
SectionPlan 출력 (13 섹션 + tile rhythm + 티어 변형)
   │
   ▼
팀 리드: "13 섹션 구성안입니다. 진행할까요?"
사용자: "OK"
   │
   ▼
팀 리드: → @agent-dian-copy-craftsman (Sonnet 4.6, 30초)
       → CopyDeck JSON
   │
   ▼
팀 리드: "Hero 카피: '빛에 가장 가까운 결.' 어떠세요?"
사용자: "더 강하게"
   │
   ▼
팀 리드: 카피만 재실행 → 새 CopyDeck
   │
   ▼ (사용자 OK)
팀 리드: → @agent-dian-image-prompter (20초)
       → ImagePromptDeck (13개 영문 프롬프트)
   │
       → @agent-dian-html-renderer (Sonnet 4.6, 1분)
       → RenderableBundle (HTML + .tsx)
   │
       → @agent-dian-design-reviewer (15초)
       → DesignReviewReport (pass / fail)
   │
   ▼
팀 리드 최종 보고:
  ✅ 13/13 섹션 완성
  📄 HTML: docs/ai-create/runs/<id>/page.html
  📦 React: src/app/products/.../page.tsx
  🎨 이미지: 13 프롬프트 (Imagen 3 준비)
  🔍 리뷰: pass (warning 1)

사용자: "PNG 로 렌더링" → Puppeteer 파이프라인 실행
```

---

## 5. 검수·재실행

### 자동 검수 (design-reviewer)

매 실행마다 자동 호출. 5 카테고리 검사:
1. 디자인 토큰 위반 (인라인 hex, 임의 px)
2. 타이포 위반 (weight 500, 16px body)
3. 13 섹션 골격 위반 (tile rhythm, 순서)
4. 4티어 정책 위반 (luxury 가격 노출, "특가" 어휘 등)
5. 모바일 반응형 위반 (`px-8` 만, `grid-cols-N` 만)

### 재실행 옵션

| 명령 | 의미 |
|---|---|
| "카피 다시" | ② 만 재실행, 다른 톤 시도 |
| "디자인 톤 luxury 로 바꿔줘" | ProductBrief.target_tier 변경 → 1번부터 재실행 |
| "섹션 5개 만으로 줄여줘" | ① 재실행, luxury 변형 강제 |
| "이 섹션 5만 다른 색으로" | ④ 재실행, 일부만 |

---

## 6. 결과물 구조

각 실행은 고유 ID 로 docs/ai-create/runs/ 에 저장:

```
docs/ai-create/runs/run_20260507_143022/
├── 01-section-plan.json       ← architect 출력
├── 02-copy-deck.json          ← copy-craftsman 출력
├── 03-image-prompts.json      ← image-prompter 출력
├── 04-renderable-bundle.json  ← html-renderer 출력
├── 05-review-report.json      ← design-reviewer 출력
├── page.html                  ← 정적 HTML (Puppeteer 입력)
├── page.tsx                   ← React 컴포넌트 (선택, 디안 사이트 통합용)
└── meta.json                  ← run 메타데이터 (사용자·시간·티어)
```

---

## 7. 비용 (Anthropic API)

5-에이전트 팀 1회 실행:

| 에이전트 | 모델 | 토큰 | 비용 |
|---|---|---|---|
| ① section-architect | Sonnet 4.5 | ~3K | ~$0.03 |
| ② copy-craftsman ⭐ | Sonnet 4.6 | ~8K | ~$0.13 |
| ③ image-prompter | Sonnet 4.5 | ~5K | ~$0.05 |
| ④ html-renderer ⭐ | Sonnet 4.6 | ~12K | ~$0.20 |
| ⑤ design-reviewer | Sonnet 4.5 | ~6K | ~$0.06 |
| **합계 (코드만)** | | | **~$0.47** |

이미지 생성 (Imagen 3) + 렌더 (Puppeteer) 는 별도 파이프라인.

---

## 8. 다음 에이전트로 확장

쇼츠·롱폼·프리젠테이션·카드뉴스·블로그 에이전트 만들 때:

1. 같은 Skills 재사용 (`dian-design-system`, `dian-tier-tone`)
2. 콘텐츠 종류별 specific skill 추가 (`dian-shorts-template`, `dian-blog-template`)
3. 같은 5-에이전트 팀 패턴 (architect / craft / prompter / renderer / reviewer)
4. 새 team-lead subagent 만 추가

→ 결국 **architect + reviewer 는 공유 가능**, content-specific craft·prompter·renderer 만 각 에이전트별 작성.

---

## 9. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| Subagent 가 자동 위임 안 됨 | description 이 모호함 | "@agent-<name>" 명시적 호출 |
| Skill 이 invoke 안 됨 | frontmatter `disable-model-invocation: true` 또는 description 미스 | `/skill-name` 직접 호출 |
| 출력이 JSON 이 아님 | 모델이 explanation 추가 | 시스템 프롬프트에 "JSON only" 강조 |
| Agent Teams 가 split-pane 으로 안 뜸 | tmux 또는 iTerm2 미설치 | in-process 모드로 사용 (기본) |
| 같은 에이전트가 다른 결과 | temperature 또는 모델 버전 차이 | seed 또는 cache 활용 |

---

## 10. 참조

- `docs/design-system/apple-spec.md` — Apple 디자인 시스템
- `docs/ai-create/product-detail-team.md` — 5-에이전트 아키텍처 전체
- `docs/ai-create/product-detail-13-sections.md` — 13 섹션 상세 스펙
- Claude Code 공식 문서:
  - Subagents: https://code.claude.com/docs/en/sub-agents.md
  - Skills: https://code.claude.com/docs/en/skills.md
  - Agent Teams: https://code.claude.com/docs/en/agent-teams.md
