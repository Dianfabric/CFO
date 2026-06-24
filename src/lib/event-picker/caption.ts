import Anthropic from "@anthropic-ai/sdk";

// 캡션 생성 모델 (필요시 교체)
export const CAPTION_MODEL = "claude-sonnet-4-6";

export interface CaptionInput {
  title: string;
  winners: string[];
  note?: string;
}

// ── 캡션 작성 스킬(프롬프트) — 여기를 다듬어가며 톤을 잡습니다 ──────────
export function buildSystemPrompt(): string {
  return `당신은 전통 오방색·색동 감성의 라이프스타일 브랜드 '색동공장'의 인스타그램 운영자입니다.
댓글 이벤트 '당첨자 발표' 게시물의 캡션을 작성합니다.

# 톤
- 짧고 강렬하게. 군더더기 없이.
- 따뜻하고 세련된, 정갈한 한국어. 디자이너·안목 있는 고객이 읽기 좋게.
- 과장·낚시성 표현 금지. 이모지는 0~2개만 절제해서.

# 반드시 포함
1) 짧은 축하 인사 (1~2문장).
2) 당첨자 아이디 — 받은 @핸들 목록을 그대로 나열.
3) 배송정보 신청 방법 — 인스타 캡션의 링크는 클릭되지 않으므로
   "프로필 링크" 또는 "DM으로 보내드린 링크"에서 배송정보를 입력하라고 안내.
   기한 안내(예: 7일 내 미입력 시 보결 진행)를 자연스럽게 덧붙이면 좋음.
4) 마지막 줄에 해시태그 3~6개 (브랜드·이벤트 관련, 한국어 위주).

# 형식
- 전체 6~10줄 내외. 인스타 캡션 한 화면 분량.
- 줄바꿈으로 가독성 확보.
- 해설·머리말·따옴표 없이 캡션 본문만 출력.`;
}

export function buildUserPrompt(input: CaptionInput): string {
  const list = input.winners.map((w) => "@" + w).join(" ");
  let p = `이벤트명: ${input.title}\n당첨자(${input.winners.length}명): ${list}`;
  const note = (input.note ?? "").trim();
  if (note) {
    p += `\n\n[운영자 참고 문구 — 아래 내용을 자연스럽게 반영]\n${note}`;
  }
  p += `\n\n위 정보로 당첨 발표 캡션을 작성해줘.`;
  return p;
}

export async function generateCaptionText(input: CaptionInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY가 없습니다. .env.local에 키를 추가하고 서버를 재시작하세요.",
    );
  }
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: CAPTION_MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });
  return msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}
