---
name: dian-13-sections
description: 디안 상세페이지의 13개 고정 섹션 골격 + 적용 프레임워크 + 4티어 변형을 적용해야 할 때 사용. 상세페이지 코드·카피 생성·검토 시 트리거.
allowed-tools: Read, Grep
context: inline
---

# 디안 상세페이지 13개 섹션 — Quick Reference

> Source of truth: `docs/ai-create/product-detail-13-sections.md`
> 모든 상세페이지는 이 13개 골격을 따른다. 임의 추가·생략은 4티어 변형 정책 안에서만.

## 13 섹션 (순서·표면·프레임워크)

| # | 섹션 | tile | 프레임워크 | 핵심 |
|---|---|---|---|---|
| 01 | Cover | canvas/dark | Peak-End | 빅 비주얼 + 제품명 + 1-line lead |
| 02 | Big Idea | dark | Hook (Russell) | 한 문장 가치 제안 |
| 03 | Material | parchment | 감각통합 | 마크로샷 + 촉감 카피 |
| 04 | Color | canvas | 인지적 용이성 | 컬러칩 그리드 + 컬러 스토리 |
| 05 | Specs | parchment | 권위 | 미니멀 표 (5-7행) |
| 06 | Use Case | canvas | 사회적증거+거울뉴런 | 시공 사진 2개 + 디자이너명 |
| 07 | Designer Voice | dark | 거울뉴런·권위 | 한 명 인용 + 실명·직책 |
| 08 | Compare | parchment | 인지적 용이성 | Before/After 또는 vs 일반 |
| 09 | Lifestyle | canvas | 감각통합 | 풀-블리드 인테리어 완성샷 |
| 10 | Craftsmanship | dark | 스토리브랜드 | 손·직기·역사·연도 |
| 11 | Authority | parchment | 권위 | 4-icon 인증 + 정책 |
| 12 | FAQ | canvas | 인지적 용이성 | 5-10개 질문 |
| 13 | CTA / Closing | dark | Peak-End 절정 | 마지막 비주얼 + CTAs |

## tile 리듬 (절대 깨지 말 것)

```
01 canvas/dark
02 dark           ← Apple alternating 핵심
03 parchment
04 canvas
05 parchment
06 canvas
07 dark           ← 두 번째 dark 절정
08 parchment
09 canvas
10 dark           ← 세 번째 dark (스토리)
11 parchment
12 canvas
13 dark           ← 마지막 절정 (Peak-End)
```

## 4티어 변형 표 (요약)

```
티어         | 생략 가능 섹션              | 강조 섹션
─────────────────────────────────────────────────────
luxury     | 08 Compare, 12 FAQ          | 02·07·09·10·13 (스토리 우선)
premium    | (없음)                       | 06·07·10 (디자이너+장인)
mid        | 07 Designer (선택)           | 03·05·08 (가성비)
value      | 09 Lifestyle, 10 Craftsman   | 04·05·08·11·12 (가격·정보)
```

## 카피 길이 가이드 (섹션별)

| 섹션 | Headline | Body | 비고 |
|---|---|---|---|
| 01 Cover | 12자 이내 | lead 25자 | 풀-블리드 |
| 02 Big Idea | 16-30자 | (없음) | 한 문장 마침표 |
| 03 Material | 8-12자 | 30-50자 + bullet 3 | 촉감 단어 필수 |
| 04 Color | 4-6자 | 컬러 1단어 스토리 × N | "여명·안개·숲·심해" |
| 05 Specs | 4자 | 5-7행 표 | tabular-nums |
| 06 Use Case | 6-10자 | 디자이너명 + 공간 | 사진 캡션 |
| 07 Designer | (인용 12-24자) | 실명+직책 | 한국 따옴표 " " |
| 08 Compare | 4자 | 각 항목 1-2단어 | 대조 |
| 09 Lifestyle | (없음) | 시적 한 줄 10자 | 분위기 |
| 10 Craftsmanship | 6-10자 | 2-4문장 | 연도·장소·이름 |
| 11 Authority | 8-12자 | 정책 한 문장 | 4-icon row |
| 12 FAQ | (없음) | 질문 + 답 | 17px |
| 13 CTA | 14-22자 | (희소성 옵션 한 줄) | 강한 마무리 |

## 모바일 반응형 패턴

| 섹션 | Mobile 변형 |
|---|---|
| 03 Material 2-col | 1-col 스택 (이미지 위, 텍스트 아래) |
| 04 Color 4-grid | 2x2 grid |
| 06 Use Case 2-col | 1-col 스택 |
| 08 Compare 좌우 | 상하 스택 |
| 09 Lifestyle 21:9 | 4:5 crop 옵션 |

모든 섹션 padding: `clamp(64px, 12vw, 192px)` (section-pad utility)

## Image brief 표준 형식

각 섹션에서 이미지 자리표시자는 다음 구조:

```typescript
{
  section_id: 'cover' | 'material' | 'color' | ...,
  placement: 'hero' | 'macro' | 'lifestyle' | 'craft' | 'comparison',
  prompt: '영문 정밀 prompt',  // Imagen 3 입력용
  aspect: '16:9' | '4:3' | '1:1' | '3:4',
  fallback_brief: '자체 촬영 가이드 (한국어)'
}
```

## 사용 예시 (카피 생성 에이전트)

```
주어진: ProductBrief (제품·24셀·티어·셀링포인트)
적용: 13 섹션 골격 + 4티어 변형
출력: CopyDeck JSON, 13개 섹션 전부 (tier 변형 적용)
```
