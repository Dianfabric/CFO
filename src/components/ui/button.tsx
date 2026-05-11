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
        // 기본 — NVIDIA primary (green fill, 2px radius, bold 700)
        default:
          "rounded-[2px] bg-primary text-primary-foreground font-bold tracking-tight hover:bg-[#5a8d00] active:scale-95",

        // outline — NVIDIA secondary (2px green border)
        outline:
          "rounded-[2px] bg-transparent text-foreground border-2 border-primary font-bold tracking-tight hover:bg-primary/5 active:scale-95",

        // secondary — NVIDIA surface-soft button
        secondary:
          "rounded-[2px] bg-[#f7f7f7] text-[#1a1a1a] border border-[#cccccc] font-bold hover:bg-[#eeeeee] active:scale-95",

        // dark — NVIDIA dark surface utility
        dark:
          "rounded-[2px] bg-black text-white font-bold tracking-tight hover:bg-[#1a1a1a] active:scale-95",

        // ghost — ultra-quiet
        ghost:
          "rounded-[2px] bg-transparent text-foreground hover:bg-[#f7f7f7] aria-expanded:bg-[#f7f7f7]",

        // destructive — NVIDIA error
        destructive:
          "rounded-[2px] bg-transparent text-destructive border border-destructive/40 hover:bg-destructive/5 active:scale-95",

        // link — inline 텍스트 링크
        link:
          "rounded-none bg-transparent text-primary underline-offset-4 hover:underline px-0",
      },
      size: {
        // default — NVIDIA standard CTA: 44px height, 24px padding, 16px bold
        default:
          "h-11 px-6 text-[16px] gap-1.5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",

        xs: "h-6 px-2.5 text-[11px] gap-1 [&_svg:not([class*='size-'])]:size-3",

        sm: "h-8 px-3 text-[13px] gap-1 [&_svg:not([class*='size-'])]:size-3.5",

        // lg — NVIDIA hero CTA (button-lg: 18px bold)
        lg: "h-12 px-7 text-[18px] font-bold gap-2",

        // icon — 44×44 (touch target) — 2px radius (NVIDIA: only avatar/social are full)
        icon: "size-10 rounded-[2px]",

        "icon-xs": "size-6 rounded-[2px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[2px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11 rounded-[2px]",
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
