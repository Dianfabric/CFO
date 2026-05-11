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
        // NVIDIA text-input (V2.1) — 44px height, 2px radius, hairline #cccccc, green focus
        "h-11 w-full min-w-0 rounded-[2px] border border-[#cccccc] bg-white px-4 py-2 text-[16px] text-[#000000] transition-colors outline-none",
        "placeholder:text-[#757575]",
        "focus-visible:border-[#76b900] focus-visible:border-2",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        // file input
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-foreground",
        // 다크 모드
        "dark:bg-card dark:border-white/10",
        className
      )}
      {...props}
    />
  )
}

export { Input }
