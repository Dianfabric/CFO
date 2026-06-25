import Link from "next/link";

// 댓글 이벤트 피커 — 색동 톤 배경 래퍼 (CFO 대시보드 안의 독립 섹션)
export default function EventPickerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-ep-parchment text-ep-ink">
      <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6">
        <Link
          href="/finance/marketing"
          className="text-[13px] text-ep-ink-muted underline-offset-4 hover:text-ep-ink"
        >
          ← 마케팅 허브
        </Link>
      </div>
      {children}
    </div>
  );
}
