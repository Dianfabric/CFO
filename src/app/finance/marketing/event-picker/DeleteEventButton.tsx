"use client";

import { deleteEvent } from "./actions";

export function DeleteEventButton({
  eventId,
  title,
}: {
  eventId: string;
  title: string;
}) {
  return (
    <form action={deleteEvent} className="flex">
      <input type="hidden" name="eventId" value={eventId} />
      <button
        type="submit"
        aria-label="이벤트 삭제"
        title="이벤트 삭제"
        onClick={(e) => {
          if (
            !confirm(
              `'${title}' 이벤트를 삭제할까요?\n수집된 댓글·당첨자·제출정보도 함께 삭제되며 되돌릴 수 없습니다.`,
            )
          ) {
            e.preventDefault();
          }
        }}
        className="flex h-full w-12 items-center justify-center rounded-[14px] border border-ep-hairline text-ep-ink-faint transition hover:border-ep-accent hover:text-ep-accent active:scale-[0.96]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </form>
  );
}
