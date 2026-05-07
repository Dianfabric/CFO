import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * 디안 CFO Card — Apple-style (store-utility-card 패턴)
 * 기준: docs/design-system/apple-spec.md
 * - 기본: white bg + 1px hairline border + rounded-lg (18px) + padding 24px
 * - 그림자 없음 (Apple: 그림자는 제품 사진에만)
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        // base — flat + hairline + 18px radius (store-utility-card)
        "group/card flex flex-col gap-5 overflow-hidden rounded-[18px] bg-card py-6 text-card-foreground border border-[var(--color-hairline)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0",
        // sm size — 더 작은 카드
        "data-[size=sm]:gap-3 data-[size=sm]:py-4 data-[size=sm]:has-data-[slot=card-footer]:pb-0",
        // 이미지 처리
        "*:[img:first-child]:rounded-t-[18px] *:[img:last-child]:rounded-b-[18px]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 px-6 group-data-[size=sm]/card:px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-5 [.border-b]:border-[var(--color-hairline)] group-data-[size=sm]/card:[.border-b]:pb-3",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        // Apple body-strong: 17px / 600 / -0.374px tracking
        "text-[17px] font-semibold leading-tight tracking-[-0.022em] group-data-[size=sm]/card:text-[15px]",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        // Apple caption: 14px / 400 / -0.224px
        "text-[14px] tracking-[-0.016em] text-[var(--color-ink-muted-48)]",
        className
      )}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6 group-data-[size=sm]/card:px-4", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-[18px] border-t border-[var(--color-hairline)] bg-[var(--color-canvas-parchment)] px-6 py-4 group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:py-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
