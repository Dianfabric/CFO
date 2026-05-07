import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * 디안 CFO Input — Apple-style
 * 기준: docs/design-system/apple-spec.md (search-input 패턴)
 * - white bg + 1px hairline border + rounded-md (11px) — 검색 input 은 rounded-full
 * - text 17px (Apple body), placeholder ink-muted-48
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Apple search-input 패턴 — h-11 (44 touch target), 17px body, hairline border
        "h-11 w-full min-w-0 rounded-[11px] border border-[var(--color-hairline)] bg-card px-4 py-2 text-[15px] text-foreground tracking-[-0.012em] transition-colors outline-none",
        "placeholder:text-[var(--color-ink-muted-48)]",
        "focus-visible:border-[var(--color-action-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-focus)]/30",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        // file input 처리
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // 다크 모드
        "dark:bg-card dark:border-white/10",
        className
      )}
      {...props}
    />
  )
}

export { Input }
