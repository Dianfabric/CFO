import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * 디안 CFO Button — Apple-style
 * 기준: docs/design-system/apple-spec.md
 * - default: button-primary (Action Blue pill, 17px/400, padding 11×22, scale 0.95 active)
 * - outline: button-secondary-pill (transparent + Action Blue 1px border + Action Blue text, pill)
 * - secondary: button-pearl-capsule (pearl bg + divider-soft border, ink-muted-80, rounded-md 11px)
 * - dark: button-dark-utility (ink bg, white text, rounded-sm 8px)
 * - ghost: ultra-quiet hover (no bg by default)
 * - destructive: subtle red (no bg, red text + red hairline)
 * - link: text-primary inline link
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap font-normal transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        // 기본 — Apple Action Blue pill (button-primary)
        default:
          "rounded-full bg-primary text-primary-foreground tracking-tight hover:bg-[#0058b3] active:scale-95",

        // outline = ghost pill (button-secondary-pill)
        outline:
          "rounded-full bg-transparent text-primary border border-primary/80 tracking-tight hover:bg-primary/5 active:scale-95",

        // secondary = pearl capsule (button-pearl-capsule)
        secondary:
          "rounded-[11px] bg-[var(--color-surface-pearl)] text-[var(--color-ink-muted-80)] border border-[var(--color-divider-soft)] hover:bg-[var(--color-canvas-parchment)] active:scale-95",

        // dark utility — global nav 액션 (Sign In, Bag 같은 것)
        dark:
          "rounded-lg bg-[var(--color-ink)] text-white tracking-tight hover:bg-[var(--color-surface-tile-1)] active:scale-95",

        // ghost — ultra-quiet (사이드바 메뉴 등)
        ghost:
          "rounded-lg bg-transparent text-foreground hover:bg-[var(--color-canvas-parchment)] aria-expanded:bg-[var(--color-canvas-parchment)] dark:hover:bg-muted/30",

        // destructive — 민감한 액션 (Apple 톤: 배경 거의 없음)
        destructive:
          "rounded-full bg-transparent text-destructive border border-destructive/40 hover:bg-destructive/5 active:scale-95",

        // link — inline 텍스트 링크
        link:
          "rounded-none bg-transparent text-primary underline-offset-4 hover:underline px-0",
      },
      size: {
        // default — Apple primary CTA: 11×22 padding, 17px body, h ~44
        default:
          "h-10 px-5 text-[15px] gap-1.5 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",

        // xs — 미니 (xs 칩, 인라인 액션)
        xs: "h-6 px-2.5 text-[11px] gap-1 [&_svg:not([class*='size-'])]:size-3",

        // sm — 유틸리티 액션
        sm: "h-8 px-3 text-[13px] gap-1 [&_svg:not([class*='size-'])]:size-3.5",

        // lg — Store hero CTA (Apple spec: 18px, weight 300!)
        lg: "h-12 px-7 text-[18px] font-light gap-2",

        // icon — 44×44 (Apple touch target)
        icon: "size-10 rounded-full",

        "icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-full [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
