// 당첨자 배송정보 입력 (공개) — 색동 톤, CFO 대시보드 크롬 없이 독립 페이지
export default function ClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full min-h-screen bg-ep-parchment text-ep-ink">{children}</div>
  );
}
