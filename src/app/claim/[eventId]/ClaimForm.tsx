"use client";

import { useActionState, useEffect, useState } from "react";
import { submitClaim, type ClaimState } from "../actions";

const initial: ClaimState = { ok: false };

const inputCls =
  "h-12 rounded-xl border border-ep-hairline bg-ep-field px-3.5 text-[17px] text-ep-ink outline-none transition focus:border-ep-accent focus:ring-4 focus:ring-ep-accent-soft";

type Fields = {
  username: string;
  name: string;
  address: string;
  addressDetail: string;
  phone: string;
};
const EMPTY: Fields = { username: "", name: "", address: "", addressDetail: "", phone: "" };

export function ClaimForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(submitClaim, initial);
  const storeKey = `claim:${eventId}`;
  const [f, setF] = useState<Fields>(EMPTY);
  const [agreed, setAgreed] = useState(false);
  const [restored, setRestored] = useState(false);

  // 입력값 복원 (새로고침·키보드로 화면 바뀌어도 보존)
  useEffect(() => {
    try {
      const s = localStorage.getItem(storeKey);
      if (s) setF({ ...EMPTY, ...JSON.parse(s) });
    } catch {
      /* localStorage 차단 시 무시 */
    }
    setRestored(true);
  }, [storeKey]);

  // 입력할 때마다 자동 저장
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify(f));
    } catch {
      /* 무시 */
    }
  }, [f, restored, storeKey]);

  // 제출 완료되면 저장본 삭제
  useEffect(() => {
    if (state.done) {
      try {
        localStorage.removeItem(storeKey);
      } catch {
        /* 무시 */
      }
    }
  }, [state.done, storeKey]);

  const upd =
    (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setF((prev) => ({ ...prev, [k]: e.target.value }));

  // 입력란 포커스 시 키보드 위로 스크롤 (가림 방지). 키보드 뜨는 시간 후 실행.
  function handleFocus(e: React.FocusEvent<HTMLFormElement>) {
    const t = e.target;
    if (t instanceof HTMLInputElement) {
      setTimeout(() => {
        t.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 300);
    }
  }

  if (state.done) {
    return (
      <div className="rounded-[18px] border border-ep-hairline bg-ep-card p-8 text-center">
        <div className="mx-auto mb-3 h-1.5 w-24 overflow-hidden rounded-full">
          <span className="flex h-full">
            <span className="flex-1 bg-[#2E6E6A]" />
            <span className="flex-1 bg-[#B5392E]" />
            <span className="flex-1 bg-[#D9A441]" />
            <span className="flex-1 bg-[#2A2622]" />
          </span>
        </div>
        <h2 className="text-[19px] font-semibold text-ep-ink">제출 완료되었습니다</h2>
        <p className="mt-1.5 text-[15px] text-ep-ink-muted">
          배송 정보가 정상적으로 접수되었어요. 감사합니다!
        </p>
      </div>
    );
  }

  return (
    <form action={action} onFocusCapture={handleFocus} className="flex flex-col gap-3 pb-[40vh] sm:pb-6">
      <input type="hidden" name="eventId" value={eventId} />

      <Field label="인스타 아이디" hint="당첨 발표에 올라온 그 아이디">
        <input
          name="username"
          required
          value={f.username}
          onChange={upd("username")}
          placeholder="@your_id"
          className={inputCls}
        />
      </Field>
      <Field label="이름 (수령인)">
        <input
          name="name"
          required
          value={f.name}
          onChange={upd("name")}
          placeholder="홍길동"
          className={inputCls}
        />
      </Field>
      <Field label="주소">
        <input
          name="address"
          required
          value={f.address}
          onChange={upd("address")}
          placeholder="도로명 주소"
          className={inputCls}
        />
      </Field>
      <Field label="상세 주소">
        <input
          name="addressDetail"
          value={f.addressDetail}
          onChange={upd("addressDetail")}
          placeholder="동·호수 등"
          className={inputCls}
        />
      </Field>
      <Field label="전화번호">
        <input
          name="phone"
          required
          value={f.phone}
          onChange={upd("phone")}
          placeholder="010-0000-0000"
          className={inputCls}
          inputMode="tel"
        />
      </Field>

      {/* PIPA 동의 */}
      <div className="rounded-xl border border-ep-hairline bg-ep-parchment p-4 text-[12px] leading-relaxed text-ep-ink-muted">
        <p className="mb-2 font-medium text-ep-ink">개인정보 수집·이용 동의 (필수)</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>수집 항목: 이름, 주소, 전화번호, 인스타 아이디</li>
          <li>이용 목적: 이벤트 경품 배송</li>
          <li>보유 기간: 배송 완료 후 3개월 이내 파기</li>
        </ul>
      </div>
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          name="agreed"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="h-5 w-5 rounded border-ep-hairline accent-ep-accent"
        />
        <span className="text-[15px] text-ep-ink">위 개인정보 수집·이용에 동의합니다.</span>
      </label>

      {state.error && <p className="text-[14px] text-ep-accent">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-ep-accent px-5 text-[16px] font-semibold text-ep-on-accent transition active:scale-[0.97] disabled:opacity-50"
      >
        {pending ? "제출 중…" : "배송 정보 제출"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-medium text-ep-ink-muted">
        {label}
        {hint && <span className="ml-1.5 text-[12px] font-normal text-ep-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
