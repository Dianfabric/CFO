# Apple 디자인 시스템 명세 (디안 CFO 적용 기준)

> **Source of truth**. 디자인 토큰·컴포넌트·타이포그래피의 모든 결정은 이 문서를 따른다.
> 변경이 필요할 때 이 파일을 먼저 수정한 뒤 코드 토큰을 업데이트한다.

## Overview

Apple's web presence is a masterclass in **reverent product photography framed by near-invisible UI**. Every page is a stack of edge-to-edge product "tiles" — alternating light and dark canvases, each centered on a hero headline, a one-line tagline, two tiny blue pill CTAs, and an impossibly crisp product render. Nothing competes with the product. Typography is confident but quiet; color is either pure white, an off-white parchment, or a near-black tile; interactive elements are a single, quiet blue.

Density is unusually low even by contemporary SaaS standards. Each tile occupies roughly one viewport, and there is no decorative chrome — no borders, no gradients, no decorative frames, no shadows on headlines. Elevation appears only when a product image rests on a surface (a single soft `rgba(0, 0, 0, 0.22) 3px 5px 30px` drop for visual weight). The result is a catalog that feels more like a museum gallery: the wall disappears and the artifact takes over.

Store and shop surfaces retain the same chassis but switch modes. The product configurator (iPhone 17 Pro, accessories grid) introduces a tight grid of white utility cards at `{rounded.lg}` (18px) radius with a thin border, paired with a persistent thin sub-nav strip. The environment page leans darker and more editorial. Across all five surfaces the typographic system, spacing rhythm, and the single blue accent are consistent — this is one design language expressed at different volumes.

**Key Characteristics:**
- Photography-first presentation; UI recedes so the product can speak.
- Alternating full-bleed tile sections: white/parchment ↔ near-black, with the color change itself acting as the section divider.
- Single blue accent (`{colors.primary}` — #0066cc) carries every interactive element. No second brand color exists.
- Two button grammars: tiny blue pill CTAs (`{rounded.pill}`) and compact utility rects (`{rounded.sm}`).
- SF Pro Display + SF Pro Text — negative letter-spacing at display sizes for the signature "Apple tight" headline feel.
- Whisper-soft elevation used only when a product image needs to breathe — exactly one drop-shadow in the entire system.
- Tight two-row nav: slim `{component.global-nav}` + product-specific `{component.sub-nav-frosted}` with persistent right-aligned primary CTA.
- Section rhythm across multiple pages: light hero → dark product tile → light utility tile → dark tile → parchment footer — a predictable pulse.

## Colors

> **Source pages analyzed:** homepage, environment, store, iPhone 17 Pro buy page, accessories index. The color system is identical across all five surfaces; only the surface-mode mix differs.

### Brand & Accent
- **Action Blue** (`{colors.primary}` — #0066cc): The single brand-level interactive color. All text links, all blue pill CTAs ("Learn more", "Buy"), and the focus ring root. This is Apple's quiet but universal "click me" signal. Press state shifts to a slightly darker variant via the active scale transform rather than a hex change.
- **Focus Blue** (`{colors.primary-focus}` — #0071e3): A marginally brighter sibling of Action Blue, reserved for the keyboard focus ring on buttons (`outline: 2px solid`).
- **Sky Link Blue** (`{colors.primary-on-dark}` — #2997ff): A brighter blue used on dark surfaces for in-copy links and inline callouts, where Action Blue would disappear against the tile background.

### Surface
- **Pure White** (`{colors.canvas}` — #ffffff): The dominant canvas. Content, utility cards, store tiles, configurator grids.
- **Parchment** (`{colors.canvas-parchment}` — #f5f5f7): The signature Apple off-white. Used for alternating light tiles, footer region, and the default page canvas in store utility sections. Just different enough from white to create rhythm.
- **Pearl Button** (`{colors.surface-pearl}` — #fafafc): A near-white used as the fill for secondary "ghost" buttons — lighter than the parchment canvas so the button still reads as a button against `{colors.canvas-parchment}`.
- **Near-Black Tile 1** (`{colors.surface-tile-1}` — #272729): The primary dark-tile surface on the homepage product grid.
- **Near-Black Tile 2** (`{colors.surface-tile-2}` — #2a2a2c): A micro-step lighter — used where a dark tile sits directly above or below Tile 1 to create the faintest separation.
- **Near-Black Tile 3** (`{colors.surface-tile-3}` — #252527): A micro-step darker — used at the bottom of the stack and in embedded video/player frames.
- **Pure Black** (`{colors.surface-black}` — #000000): Reserved for true void — video player backgrounds, edge-to-edge photographic overlays, the global nav bar background.
- **Translucent Chip Gray** (`{colors.surface-chip-translucent}` — #d2d2d7): The base hex of the translucent gray chip used over photography for circular control buttons. In production, applied at ~64% alpha as `rgba(210, 210, 215, 0.64)`.

### Text
- **Near-Black Ink** (`{colors.ink}` — #1d1d1f): The voice of every headline, every body paragraph, and the dark utility button's fill. Chosen instead of pure black to keep the page feeling photographic rather than printed.
- **Body** (`{colors.body}` — #1d1d1f): Same hex as ink — Apple uses one near-black tone for all text on light surfaces.
- **Body On Dark** (`{colors.body-on-dark}` — #ffffff): All text on dark tiles and on the global nav bar.
- **Body Muted** (`{colors.body-muted}` — #cccccc): Secondary copy on dark tiles where pure white would be too loud.
- **Ink Muted 80** (`{colors.ink-muted-80}` — #333333): Body text on the white Pearl Button surface — slightly softer than pure black.
- **Ink Muted 48** (`{colors.ink-muted-48}` — #7a7a7a): Disabled button text and legal fine-print.

### Hairlines & Borders
- **Divider Soft** (`{colors.divider-soft}` — #f0f0f0): The "border" tone on secondary buttons — functions as a ring shadow rather than a hard line. In production, often applied as `rgba(0, 0, 0, 0.04)`.
- **Hairline** (`{colors.hairline}` — #e0e0e0): The 1px hairline border on store utility cards and configurator chips.

### Brand Gradient
**No decorative gradients.** Atmospheric depth on product photography is inherent to the imagery, not a CSS gradient overlay. Apple is the rare luxury-brand site with zero gradient-based design tokens.

## Typography

### Font Family
- **Display**: `SF Pro Display, system-ui, -apple-system, sans-serif`
- **Body / UI**: `SF Pro Text, system-ui, -apple-system, sans-serif`
- **OpenType features**: `font-variant-numeric: numerator` is enabled on numeric links.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.hero-display}` | 56px | 600 | 1.07 | -0.28px | Hero headline; the signature "Apple tight" tracking |
| `{typography.display-lg}` | 40px | 600 | 1.10 | 0 | Tile headlines atop every product tile |
| `{typography.display-md}` | 34px | 600 | 1.47 | -0.374px | Section heads (SF Pro Text at display proportions) |
| `{typography.lead}` | 28px | 400 | 1.14 | 0.196px | Product tile subcopy |
| `{typography.lead-airy}` | 24px | 300 | 1.5 | 0 | Environment-page lead paragraphs (the rare weight 300) |
| `{typography.tagline}` | 21px | 600 | 1.19 | 0.231px | Sub-tile tagline; sub-nav category name |
| `{typography.body-strong}` | 17px | 600 | 1.24 | -0.374px | Inline strong emphasis |
| `{typography.body}` | 17px | 400 | 1.47 | -0.374px | Default paragraph |
| `{typography.dense-link}` | 17px | 400 | 2.41 | 0 | Footer / store utility link lists (relaxed leading) |
| `{typography.caption}` | 14px | 400 | 1.43 | -0.224px | Secondary captions, button text |
| `{typography.caption-strong}` | 14px | 600 | 1.29 | -0.224px | Emphasized captions |
| `{typography.button-large}` | 18px | 300 | 1.0 | 0 | Store hero CTAs (the rare weight 300) |
| `{typography.button-utility}` | 14px | 400 | 1.29 | -0.224px | Utility/nav button labels |
| `{typography.fine-print}` | 12px | 400 | 1.0 | -0.12px | Fine-print, footer body |
| `{typography.micro-legal}` | 10px | 400 | 1.3 | -0.08px | Micro legal disclaimers |
| `{typography.nav-link}` | 12px | 400 | 1.0 | -0.12px | Global nav menu items |

### Principles

- **Negative letter-spacing at display sizes.** Headlines at 17px+ carry slight tracking tighten (`-0.12 → -0.374px`). Never used at 12px or below.
- **Body copy at 17px, not 16px.** Apple breaks the SaaS convention. The extra pixel gives "reading, not scanning" pace.
- **Weight 300 is real and rare.** Used on `{typography.button-large}` (18px) and `{typography.lead-airy}` (24px). Light-atmosphere cue.
- **Weight 600, not 700, for headlines.** Weight 700 is sparingly for `{typography.tagline}` (21px).
- **Line-height is context-specific.** Display 1.07–1.19 (tight), Body 1.47, Footer columns 2.41 (relaxed leading).
- **Weight 500 is deliberately absent.** Ladder is 300 / 400 / 600 / 700.

### Note on Font Substitutes (디안 한글 적용)
- 영문: `system-ui, -apple-system, BlinkMacSystemFont` (macOS/iOS 에서는 SF Pro 자동 적용), 그 외에는 **Inter** (variable, weight 600 + `ss03` ligature 가 SF Pro 의 둥근 'a' 와 가장 유사)
- 한글: **Pretendard** (variable) — SF Pro 의 톤과 가장 잘 맞는 한글 폰트. 디안 톤에 적합.
- Inter/Pretendard 사용 시 letter-spacing 을 `-0.01em` 더 좁혀야 SF Pro 의 "Apple tight" 느낌에 근접.

## Layout

### Spacing System
- **Base unit:** 8px. Sub-base (2, 4, 5, 6, 7) for tight typographic adjustments; structural layout snaps to 8/12/16/20/24.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 17px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 80px.
- **Section vertical padding:** `{spacing.section}` (80px).
- **Card padding:** `{spacing.lg}` (24px).
- **Button padding:** 8–11px vertical, 15–22px horizontal.

### Grid & Container
- **Max content width:** ~980px on text-heavy sections, ~1440px on product grids, full-bleed for product tiles.
- **Column patterns:** 3–5 column utility card grid; 2-column side-by-side tiles; single-column centered stack on heroes.
- **Gutters:** 20–24px between cards.

### Whitespace Philosophy
Whitespace is the product's pedestal. Tiles begin with 64px of air above headline, 48–64px below. Product renders are never crowded. Footer is the only deliberate density area.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Full-bleed tiles, global nav, footer, body sections |
| Soft hairline | 1px `rgba(0, 0, 0, 0.08)` border | Utility cards, sub-nav frosted-glass separator |
| Backdrop blur | `backdrop-filter: blur(N)` on Parchment 80% | Sub-nav and floating sticky bar |
| Product shadow | `rgba(0, 0, 0, 0.22) 3px 5px 30px 0` | Product renders only — never UI |

**Shadow philosophy.** Exactly **one** drop-shadow, applied to photographic product imagery — never to cards, buttons, or text.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-bleed product tiles |
| `{rounded.xs}` | 5px | Inline links as subtle chips (rare) |
| `{rounded.sm}` | 8px | Dark utility buttons, inline card imagery |
| `{rounded.md}` | 11px | White Pearl Button capsules |
| `{rounded.lg}` | 18px | Store utility cards, accessories grid cards |
| `{rounded.pill}` | 9999px | Primary blue pill CTAs, sub-nav buy button, configurator chips, search input |
| `{rounded.full}` | 9999px / 50% | Circular control chips floating over photography |

## Components (요약)

- **`global-nav`**: black 44px, SF Pro Text 12px, edge-to-edge.
- **`sub-nav-frosted`**: 80% parchment + backdrop-blur, 52px, category name (21px/600) + persistent CTA.
- **`button-primary`**: Action Blue pill, 17px/400, padding 11×22, `transform: scale(0.95)` on press.
- **`button-secondary-pill`**: transparent + 1px Action Blue border + Action Blue text, pill.
- **`button-dark-utility`**: ink #1d1d1f bg, 14px white text, `{rounded.sm}` 8px.
- **`button-pearl-capsule`**: pearl bg + 3px divider-soft border, ink-muted-80 text, `{rounded.md}` 11px.
- **`product-tile-light/parchment/dark`**: full-bleed, 80px vertical padding, headline 40px/600 + tagline 28px + 2 CTAs + product render.
- **`store-utility-card`**: white + 1px hairline border + `{rounded.lg}` 18px + 24px padding + 17px/600 product name.
- **`configurator-option-chip`**: pill, 14px, 12×16 padding. Selected = 2px primary-focus border.
- **`floating-sticky-bar`**: 80% parchment + backdrop-blur, 64px, price left + button-primary right.
- **`search-input`**: white + 1px black 8% border + pill + 17px body, 44px height.
- **`button-icon-circular`**: 44×44, translucent gray chip 64% alpha, ink icon.
- **`footer`**: parchment bg, dense-link 17px/400/2.41 columns, fine-print legal row.

## Do's and Don'ts

### Do
- 단일 액션 컬러 `{colors.primary}` (Action Blue #0066cc) 만 사용
- Hero 폰트 `{typography.hero-display}` 또는 `{typography.display-lg}` + 음수 letter-spacing
- Body 17px (`{typography.body}`) — 16px 아님
- 라이트 ↔ 다크 타일 교차로 풀-블리드 섹션 리듬
- `{rounded.pill}` 은 액션용으로만 (CTA, 검색, 칩)
- 제품 이미지에만 단일 product-shadow
- 누름 상태는 `transform: scale(0.95)`
- Global nav 만 pure black (#000)

### Don't
- 두 번째 액센트 컬러 추가 금지
- 카드/버튼/텍스트에 그림자 추가 금지
- 데코용 그라데이션 금지
- Body weight 500 금지 (사다리: 300 / 400 / 600 / 700)
- 풀-블리드 타일 라운딩 금지
- Body line-height 1.47 미만 금지
- 라디우스 grammar 혼용 금지 (sm / md / lg / pill 만)
- `{colors.primary-on-dark}` (Sky Link Blue) 를 라이트 표면에 사용 금지

## Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|---|---|---|
| Small phone | ≤ 419px | Single-column tiles; hero h1 28px |
| Phone | 420–640px | Single-column stack; hero h1 34px |
| Large phone | 641–735px | Tile padding 48px vs 80px |
| Tablet portrait | 736–833px | Global nav → hamburger; sub-nav 축소 |
| Tablet landscape | 834–1023px | Global nav 풀, 3-col → 2-col |
| Small desktop | 1024–1068px | Hero h1 40px |
| Desktop | 1069–1440px | Full layout, 1440 max |
| Wide desktop | ≥ 1441px | Content lock 1440 |

핵심 breakpoints: 1440 (lock), 1068, 833, 734, 640, 480.

### Touch Targets
최소 44×44px. Primary 버튼 ~44×100px. Icon-circular 정확히 44×44.

### Collapsing Strategy
- Global nav: 풀 로우 → 834px 이하 햄버거
- Product tiles: 2-col → 834px 이하 1-col, 패딩 80→48
- Utility grids: 5 → 4 (1440) → 3 (1068) → 2 (834) → 1 (640)
- Hero typo: 56 → 40 (1068) → 34 (640) → 28 (419)

## Iteration Guide

1. ONE component at a time.
2. 변형(`-active`, `-focus`, `-2`)은 별도 entry.
3. `{token.refs}` 만 사용 — inline hex 금지.
4. Hover 문서화 금지. Default 와 Active/Pressed 만.
5. Display SF Pro Display 600 + 음수 letter-spacing. Body SF Pro Text 400 17px. 경계 깨지 않음.
6. 단일 product-shadow 는 제품 사진에만.
7. 강조가 필요하면 chrome 추가 전에 표면 교차 (라이트→다크) 우선.

## Known Gaps
- Form validation/error states 미정의 (검색 input 만 문서화)
- Player controls 별도 widget
- Dark-mode utility cards 미문서화
- Backdrop-filter blur 정확치 미확정 (production: `saturate(180%) blur(20px)` 베이스라인)

## 디안 CFO 적용 시 추가 결정사항 (이 명세 외)

이 명세를 디안 CFO 의 데이터 중심 환경에 맞춰 적용하려면 다음 결정 필요:
1. **테이블·차트** 같은 데이터 컴포넌트는 Apple 기본 명세에 없음 → 디안 보강 토큰 필요
2. **알림·뱃지** (이상치 알림 #3 등) 의 색상 — Action Blue 단일 원칙 안에서 어떻게 표현?
3. **티어별 컬러 강조** (디안의 4티어) — Apple 의 단일 액센트 원칙과의 조정
