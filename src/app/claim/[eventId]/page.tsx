import { getSupabaseAdmin } from "@/lib/event-picker/supabase";
import { ClaimForm } from "./ClaimForm";

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const sb = getSupabaseAdmin();

  const { data: ev } = await sb
    .from("events")
    .select("title")
    .eq("id", eventId)
    .single<{ title: string }>();

  const { count } = await sb
    .from("winners")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (!ev || !count) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-20">
        <p className="text-center text-[15px] text-ep-ink-muted">
          유효하지 않은 이벤트이거나 아직 추첨이 진행되지 않았습니다.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-7 sm:py-16">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 h-1.5 w-28 overflow-hidden rounded-full">
          <span className="flex h-full">
            <span className="flex-1 bg-[#2E6E6A]" />
            <span className="flex-1 bg-[#B5392E]" />
            <span className="flex-1 bg-[#D9A441]" />
            <span className="flex-1 bg-[#2A2622]" />
          </span>
        </div>
        <h1 className="text-[24px] font-semibold tracking-[-0.022em] text-ep-ink">
          당첨을 축하합니다
        </h1>
        <p className="mt-1.5 text-[14px] text-ep-ink-muted">{ev.title}</p>
        <p className="mt-3 text-[15px] text-ep-ink-muted">
          경품 배송을 위해 아래 정보를 입력해주세요.
        </p>
      </div>
      <ClaimForm eventId={eventId} />
    </main>
  );
}
