---
name: dian-design-system
description: 디안 CFO Apple-style 디자인 시스템의 토큰·타이포·간격·컬러 규칙을 빠르게 적용해야 할 때 사용. UI 컴포넌트 작성·검토·리뉴얼 시 트리거.
allowed-tools: Read, Grep, Glob
context: inline
---

# 디안 Apple Design System — Quick Reference

> Source of truth: `docs/design-system/apple-spec.md`
> 모든 UI 코드는 이 토큰만 사용. 인라인 hex / 임의 px 금지.

## 컬러 (절대 원칙)

```
--color-action: #0066cc      ← 단일 액션 컬러. 모든 클릭·링크.
--color-action-on-dark: #2997ff  ← 다크 tile 위 링크
--color-canvas: #ffffff
--color-canvas-parchment: #f5f5f7
--color-surface-tile-1: #272729  ← Apple alternating dark
--color-ink: #1d1d1f
--color-hairline: #e0e0e0
--color-alert-red: #ff3b30   ← 위험 신호 dot 만 (배경 X)
--color-status-green: #34c759
```

**금지**: 두 번째 액센트 컬러 / 그라데이션 / 컬러풀 호버 배경

## 타이포 유틸리티 (clamp 자동)

```css
.text-hero        /* clamp(44px, 7vw, 96px) — Hero 헤드라인 */
.text-display-xl  /* clamp(36px, 5.5vw, 72px) */
.text-display-lg  /* clamp(32px, 4.2vw, 56px) — 섹션 헤드라인 */
.text-display-md  /* clamp(24px, 2.8vw, 40px) */
.text-lead        /* clamp(20px, 2.3vw, 28px) — weight 300 */
.text-tagline     /* 21px / 600 */
.giant            /* clamp(48px, 7vw, 88px) — KPI 거대 숫자 */
.giant-sm         /* clamp(36px, 5vw, 60px) */
.eyebrow          /* 12px / 600 / uppercase / tracking 0.12em / Action Blue */
```

**Apple-tight letter-spacing**:
- Hero: `-0.028em`
- Display-lg: `-0.024em`
- Body: `-0.012em`
- Body 17px (16px 아님)
- 한글: Pretendard Variable

## 간격 (Apple section padding)

```css
.section-pad     /* clamp(80px, 12vw, 192px) — 일반 섹션 */
.section-pad-sm  /* clamp(64px, 8vw, 128px) — 작은 섹션 */
```

## Pedestal (차트·매트릭스 = 제품)

```css
.pedestal {
  background: var(--color-canvas);
  border: 1px solid var(--color-hairline);
  border-radius: 18px;
  padding: clamp(20px, 2.5vw, 40px);
}
.shadow-product       /* rgba(0,0,0,0.22) 5px 30px — 원단 사진만 */
.shadow-product-soft  /* rgba(0,0,0,0.06) 4px 24px — pedestal 만 */
```

## Tile rhythm (페이지 구조)

```
section.bg-canvas (light)
section.bg-canvas-parchment (parchment)
section.bg-surface-tile-1 (dark)  ← Apple alternating 핵심
section.bg-canvas (다시 light)
```

각 section: `section-pad px-4 sm:px-6 lg:px-8`

## 라디우스

```
rounded-sm: 8px        — 다크 유틸 버튼
rounded-md: 11px       — Pearl Capsule
rounded-lg: 18px       — utility cards
rounded-full: 9999px   — primary CTA pill, 검색
none: 0px              — 풀-블리드 tile
```

## 모바일 반응형 (필수)

```
패딩: px-4 sm:px-6 lg:px-8
그리드: grid-cols-1 sm:grid-cols-2 lg:grid-cols-N
타이포: clamp() 자동 또는 text-base sm:text-lg lg:text-xl
사이드바: hidden md:flex (모바일 햄버거)
```

## Press 마이크로 인터랙션

모든 버튼·카드: `press-scale` 클래스 또는 `active:scale-95`

## 절대 금지 (Apple 톤 깨짐)

- ❌ 카드/버튼/텍스트에 `shadow-*` (제품·차트 외)
- ❌ `bg-gradient-*` 배경
- ❌ Body weight 500 (사다리: 300/400/600/700)
- ❌ 풀-블리드 tile rounded
- ❌ Body line-height 1.47 미만
- ❌ 임의 hex/px (반드시 토큰)
- ❌ 두 번째 accent color
- ❌ Sky Link Blue 를 라이트 표면에 사용

## 적용 체크리스트 (코드 작성 후)

1. ☐ 모든 컬러가 `var(--color-*)` 또는 토큰 클래스인가
2. ☐ 헤드라인이 Apple-tight (`tracking-[-0.022em]` 이하)인가
3. ☐ Body 가 17px 인가 (16 아님)
4. ☐ 모바일 `px-4 sm:px-6 lg:px-8` 적용했나
5. ☐ 그림자가 제품/차트에만 있나
6. ☐ press-scale (또는 active:scale) 적용했나
