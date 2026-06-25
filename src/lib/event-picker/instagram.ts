// 인스타그램 아이디 정규화 + 붙여넣기 텍스트에서 아이디 추출.

// 인스타 아이디 규칙: 영문/숫자/마침표/언더스코어, 1~30자.
const IG_USERNAME = /^[a-zA-Z0-9._]{1,30}$/;
// 텍스트 안의 @멘션 추출용
const IG_MENTION = /@([a-zA-Z0-9._]{1,30})/g;

// 인스타 댓글을 그대로 복사하면 섞여 들어오는 UI 잡음(아이디로 오인될 수 있는 ASCII 단어).
// 한글 UI("답글 달기","좋아요","번역 보기","팔로우" 등)는 영문 아이디 규칙에서 자동 탈락한다.
const NOISE = new Set([
  "reply", "replies", "like", "liked", "likes", "follow", "following",
  "followers", "verified", "edited", "more", "translation", "translations",
  "view", "hide", "author", "pinned", "instagram", "suggested", "original",
  "audio", "see", "send", "share", "report", "comment", "comments",
]);

function isNoise(s: string): boolean {
  const low = s.toLowerCase();
  if (NOISE.has(low)) return true;
  if (/^\d+$/.test(s)) return true; // 순수 숫자(좋아요 수 등)
  return false;
}

// "user · 1일", "user 2주", "user 3h" 처럼 아이디 뒤에 시간/메타가 붙은 줄 판별용
const TIME_META =
  /(·|•|\d+\s*(일|주|시간|분|초|개|년|월)\b|\b\d+\s*[smhwdy]\b|ago|좋아요|답글)/i;

/** "@user", " User ", "user\n" 등을 표준 아이디로 정규화. 유효하지 않으면 null. */
export function normalizeUsername(raw: string): string | null {
  if (!raw) return null;
  let u = raw.trim();
  if (u.startsWith("@")) u = u.slice(1);
  u = u.trim();
  // 끝의 마침표는 문장부호일 수 있으니 정리 (아이디 자체 마침표는 가운데만 유효)
  u = u.replace(/[.]+$/, "");
  if (!IG_USERNAME.test(u)) return null;
  return u.toLowerCase();
}

/**
 * 붙여넣기 텍스트에서 아이디 목록 추출.
 * 두 가지 입력 형태를 모두 지원:
 *  1) 한 줄에 아이디 하나 ("user" 또는 "@user")
 *  2) 문장 속 @멘션 ("축하 @user1 @user2 ...")
 * 줄 단위로 먼저 시도하고, 줄이 통째로 아이디가 아니면 그 줄의 @멘션을 줍는다.
 */
export function extractUsernamesFromText(text: string): string[] {
  const found: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // 1) 줄 전체가 아이디 ("user" / "@user")
    const asWhole = normalizeUsername(line);
    if (asWhole && !isNoise(asWhole)) {
      found.push(asWhole);
      continue;
    }

    // 2) "user · 1일", "user 2주" 처럼 아이디 + 시간/메타가 한 줄에 있는 형태
    //    → 첫 토큰이 아이디이고, 줄에 시간/메타 표시가 있을 때만 (댓글 첫 단어 오인 방지)
    const firstTok = line.split(/[\s·•]+/)[0];
    const firstNorm = normalizeUsername(firstTok);
    if (firstNorm && !isNoise(firstNorm) && TIME_META.test(line)) {
      found.push(firstNorm);
    }

    // 3) 문장 속 @멘션
    for (const m of line.matchAll(IG_MENTION)) {
      const n = normalizeUsername(m[1]);
      if (n && !isNoise(n)) found.push(n);
    }
  }
  return dedupeUsernames(found);
}

/** 대소문자 무시 중복 제거, 입력 순서 보존. */
export function dedupeUsernames(list: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const u = typeof raw === "string" ? raw.toLowerCase() : "";
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}
