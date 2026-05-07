# IBM Carbon Design System — 디안 CFO 적용 기준

> Source of truth (현재 활성). 디자인 토큰·컴포넌트·타이포그래피의 모든 결정은 이 문서를 따른다.
> Apple 스펙은 `apple-spec.md` 로 유지 (참고·복귀용).

## Overview

IBM's marketing system is a faithful application of **Carbon Design System** — IBM's open-source enterprise design system. The dominant surface is `{colors.canvas}` pure white with `{colors.surface-1}` light gray for elevation, charcoal `{colors.ink}` (#161616) for text, and IBM Blue `{colors.primary}` (#0f62fe) as the single brand accent.

The defining choice is **flat geometry**: every CTA, every card, every input, every container uses square corners (`{rounded.none}` 0px) with thin 1px borders. There are no rounded pills, no soft shadows, no atmospheric gradients. The system is engineered, not stylized.

**IBM Plex Sans** carries the entire type hierarchy. Display sizes (76 / 60 / 42px) run at weight **300** — IBM's signature light display treatment that makes 76px feel calmer than competing brands' 700-weight display. Body type sits at weight 400 with `letter-spacing: 0.16px` (a Carbon precision detail) and line-height 1.50. The voice reads as careful, technical, and trustworthy.

The system reaches for color rarely — IBM Blue marks links, primary CTAs, and the rare full-bleed CTA banner. Charcoal carries every other surface that isn't white.

**Key Characteristics:**
- **Carbon Design System** — IBM's marketing chrome IS Carbon. Buttons are square, inputs are square-with-bottom-rule, corners stay at 0px.
- **Light-weight display type**: Plex Sans at weight 300 for 42–76px headlines is the brand's typographic signature.
- **One accent color**: `{colors.primary}` IBM Blue carries every link, primary CTA, and CTA banner. There is no second brand color.
- White canvas + light gray (`{colors.surface-1}`) + charcoal (`{colors.ink}`) cover 95% of surfaces.
- Footer inverts to charcoal (`{colors.inverse-canvas}` #161616) — the only dark surface above the page break.
- Card hierarchy is carried by 1px hairlines and surface change, never by drop shadow.
- `letter-spacing: 0.16px` on body is a Carbon precision detail — the small positive tracking is part of the brand voice.

## Colors

### Brand & Accent
- **IBM Blue** ({colors.primary} = #0f62fe): single brand accent. Links, primary CTAs, CTA banner, focus rings.
- **Blue 60** ({colors.blue-60}): hovered link state.
- **Blue 80** ({colors.blue-80}): pressed primary button.
- **Blue Hover** ({colors.blue-hover}): hover state for primary buttons.

### Surface
- **Canvas** ({colors.canvas} = #ffffff): default page background.
- **Surface 1** ({colors.surface-1} = #f4f4f4): input fields, alternate-row stripes, subtle bands.
- **Surface 2** ({colors.surface-2} = #e0e0e0): disabled fields, hairline-as-fill.
- **Hairline** ({colors.hairline} = #e0e0e0): 1px borders on cards/inputs/dividers.
- **Hairline Strong** ({colors.hairline-strong} = #161616): 1px charcoal underline on focused inputs.
- **Inverse Canvas** ({colors.inverse-canvas} = #161616): footer surface.
- **Inverse Surface 1** ({colors.inverse-surface-1} = #262626): footer column dividers.

### Text
- **Ink** ({colors.ink} = #161616): all headlines and emphasized body.
- **Ink Muted** ({colors.ink-muted} = #525252): secondary type, sub-headlines.
- **Ink Subtle** ({colors.ink-subtle} = #8c8c8c): tertiary, disabled, helper.
- **Inverse Ink** ({colors.inverse-ink} = #ffffff): white on charcoal.
- **Inverse Ink Muted** ({colors.inverse-ink-muted} = #c6c6c6): light gray on charcoal.

### Semantic
- **Success Green** (#24a148): Carbon green-50.
- **Warning Yellow** (#f1c21b): Carbon yellow-30.
- **Error Red** (#da1e28): Carbon red-60; danger button.
- **Info Blue** (#0f62fe): identical to primary.

## Typography

### Font Family
- **IBM Plex Sans** — open-source (SIL OFL). Fallback: `Helvetica Neue, Arial, sans-serif`.
- **IBM Plex Sans KR** — Korean variant for 한글.
- Same family for display, body, caption — hierarchy is size + weight.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `display-xl` | 76px | **300** | 1.17 | -0.5px | Largest hero headline |
| `display-lg` | 60px | **300** | 1.17 | -0.4px | Section opener |
| `display-md` | 42px | **300** | 1.20 | 0 | Sub-section, hero card title |
| `headline` | 32px | 400 | 1.25 | 0 | Card collection heading |
| `card-title` | 24px | 400 | 1.33 | 0 | Feature card title |
| `subhead` | 20px | 400 | 1.40 | 0 | Lead body next to display |
| `body-lg` | 18px | 400 | 1.50 | 0 | Hero subhead, lead paragraphs |
| `body` | 16px | 400 | 1.50 | **0.16px** | Default body |
| `body-sm` | 14px | 400 | 1.29 | 0.16px | Card body, footer |
| `body-emphasis` | 14px | 600 | 1.29 | 0.16px | Selected tab, emphasized line |
| `caption` | 12px | 400 | 1.33 | 0.32px | Captions, utility bar |
| `button` | 14px | 400 | 1.29 | 0.16px | All button labels |
| `eyebrow` | 14px | 400 | 1.29 | 0.16px | Section eyebrows (sentence case) |

### Principles
- **Light-weight display = brand voice**. 300-weight at 76px = quietly authoritative.
- **`letter-spacing: 0.16px` on body** = Carbon precision detail. Don't remove.
- **No mono on marketing** (Plex Mono lives in product UI only).
- **Eyebrow = sentence case 14px** (not all-caps tracked).
- **Line-heights**: 1.17 at display-xl, 1.50 at body.

## Layout

### Spacing System
- **Base unit**: 4px (Carbon's 4-pixel grid).
- **Tokens**: xxs 4 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 · xxl 48 · section **96**.
- Card padding: lg 24 (feature) / xl 32 (product) / xxl 48 (hero, CTA banner).
- Button padding: 12px vertical · 16px horizontal.
- Input padding: 11px vertical · 16px horizontal.

### Grid & Container
- Carbon's 16-column grid at desktop, 8 / 4 columns at tablet / mobile.
- Max content width 1584px (Carbon's max-grid breakpoint).
- Card grids 4-up desktop / 2-up tablet / 1-up mobile.

### Whitespace Philosophy
**Density by design**. Sections separate via `{colors.surface-1}` light gray bands rather than vertical air. IBM customers expect dense pages, not Apple-style breathing room.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | No shadow, no border | Default body, hero text |
| 1 (hairline) | 1px hairline border on canvas | Feature cards, inputs |
| 2 (surface lift) | surface-1 background on canvas | Alternate-row banners |
| 3 (focus ring) | 2px primary outline + 1px hairline-strong underline | Focused input/button |

**No drop shadows on marketing**. Depth = surface change + 1px hairlines. Soft blue gradient backdrops appear only behind hero illustrations (faint blue-to-white wash).

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `none` | 0px | **Default**. Every button, card, input, container. |
| `xs` | 2px | Small badges (rare exception). |
| `sm` | 4px | Avatar squared, dropdown menus. |
| `md` | 6px | Rare. |
| `lg` | 8px | Rare. |
| `pill` | 9999px | Status pills in product UI (rare on marketing). |

**The brand commits to flat 0px corners.**

## Components

### Buttons (모두 `rounded.none` 0px)

- **`button-primary`** — Blue solid CTA. bg primary, text white, padding 12×16.
- **`button-secondary`** — Charcoal solid. bg ink, text white.
- **`button-tertiary`** — White + 1px blue border + blue text.
- **`button-ghost`** — Plain text + chevron, no bg until hover.
- **`button-danger`** — bg semantic-error.

### Cards (모두 `rounded.none` 0px)

- **`feature-card`** — bg canvas, 1px hairline, padding 24.
- **`feature-card-elevated`** — bg surface-1, otherwise identical.
- **`product-card`** — bg canvas, padding 32.
- **`hero-card`** — bg canvas, padding 48, display-md title.
- **`cta-banner`** — bg primary, text white, padding 48, headline type.
- **`resource-tile`** — bg canvas, padding 16.
- **`customer-logo-tile`** — bg canvas, 1px hairline, padding 24.

### Inputs

- **`text-input`** — bg surface-1, 1px hairline, rounded none, padding 11×16.
- **`text-input-focused`** — replace bottom hairline with 2px primary underline.
- **`text-input-error`** — 2px semantic-error bottom underline.
- **`newsletter-input`** — same shape, adjacent button-primary.

### Tabs

- **`product-tab`** — bg canvas, ink-muted text, bottom 1px hairline.
- **`product-tab-selected`** — ink text, body-emphasis weight, bottom 2px primary underline.

### Navigation

- **`top-nav`** — bg canvas, ink text, height 48px, 1px bottom hairline.
- **`utility-bar`** — bg surface-1, ink-muted text, height 32px, caption type.

### Footer

- **`footer`** — bg inverse-canvas (#161616), text inverse-ink-muted, 5-6 link columns, padding 64×32.
- **유일한 inverted surface** above the fold.

## Do's and Don'ts

### Do
- 모든 CTA·card·input·container에 `rounded.none` (0px) 사용.
- Plex Sans **weight 300** for display (42px+), **weight 400** for body.
- IBM Blue 는 primary CTA·링크·focus ring·CTA banner 만. 카드 배경·eyebrow 색상으로 사용 금지.
- Body 사이즈에 **`letter-spacing: 0.16px`** 적용 (Carbon precision).
- 카드 위계는 surface 변경 + 1px hairline. drop shadow 금지.
- Eyebrow 와 section label 은 **sentence case** (all-caps tracking 금지).
- Footer 만 inverse-canvas 로 invert. 나머지는 light.

### Don't
- 버튼·card·input 코너 라운딩 금지. 4px 라운딩도 Carbon 깨짐.
- Display headline bold 금지. Plex Sans **weight 300** 가 브랜드 보이스.
- Atmospheric depth 추가 금지 (gradient·drop shadow·overlay).
- 두 번째 브랜드 컬러 도입 금지.
- IBM Plex Sans 를 Inter·Helvetica 로 대체 시 letter-spacing 0.16px 와 weight 300 display 보존 필수.
- Pill 버튼 사용 금지.
- All-caps tracked eyebrow 금지.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Max | 1584px | Carbon max grid |
| Desktop-XL | 1312px | Default desktop |
| Desktop | 1056px | Card grid 4-up |
| Tablet | 672px | 4-up → 2-up; nav → hamburger |
| Mobile | 320px | Single-column; display-xl 76→32 |

### Touch Targets
- Carbon spec: **48px minimum** tap target.
- 버튼·input 은 touch viewport 에서 48px 유지.

### Collapsing Strategy
- Top nav → 햄버거 below 672px.
- Utility bar → hide below 672px.
- Card grid: 4-up → 2-up (1056) → 1-up (672).
- Display: 76px → ~32px on mobile, weight 300 보존.
- Footer: 6-col → 3-col (tablet) → 1-col (mobile).
