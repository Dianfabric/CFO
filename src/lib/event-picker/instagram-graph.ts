// 인스타그램 Graph API — 다계정 지원 + 게시물 URL로 소유 계정 자동 라우팅.
// env: IG_GRAPH_TOKEN/IG_BUSINESS_ACCOUNT_ID (계정1), IG_GRAPH_TOKEN_2/IG_BUSINESS_ACCOUNT_ID_2 (계정2)...

const GRAPH = "https://graph.facebook.com/v21.0";

export interface IgAccount {
  token: string;
  igId: string;
  label: string;
}

export interface GraphComment {
  username: string;
  text: string | null;
  timestamp: string | null;
}

interface MediaItem {
  id: string;
  permalink?: string;
}
interface MediaResp {
  data?: MediaItem[];
  paging?: { next?: string };
  error?: { message: string };
}
interface CommentItem {
  id?: string;
  username?: string;
  text?: string;
  timestamp?: string;
  replies?: { data?: CommentItem[] };
}
interface CommentResp {
  data?: CommentItem[];
  paging?: { next?: string };
  error?: { message: string };
}

/** 연결된 모든 인스타 계정 (env 기반, 계정1 + 추가 _2.._9) */
export function getAccounts(): IgAccount[] {
  const accts: IgAccount[] = [];
  const t1 = process.env.IG_GRAPH_TOKEN;
  const i1 = process.env.IG_BUSINESS_ACCOUNT_ID;
  if (t1 && i1) accts.push({ token: t1, igId: i1, label: process.env.IG_ACCOUNT_LABEL ?? "색동공장" });
  for (let n = 2; n <= 9; n++) {
    const t = process.env[`IG_GRAPH_TOKEN_${n}`];
    const i = process.env[`IG_BUSINESS_ACCOUNT_ID_${n}`];
    if (t && i) accts.push({ token: t, igId: i, label: process.env[`IG_ACCOUNT_LABEL_${n}`] ?? `계정 ${n}` });
  }
  return accts;
}

export function graphConfigured(): boolean {
  return getAccounts().length > 0;
}

/** 게시물 URL → shortcode (DYhOYL-oAxl 등) */
export function shortcodeFromUrl(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return m ? m[1] : null;
}

/** 한 계정 미디어 목록에서 permalink 매칭으로 media id 찾기 */
async function findMediaId(igId: string, token: string, shortcode: string): Promise<string | null> {
  let next: string | null = `${GRAPH}/${igId}/media?fields=id,permalink&limit=50&access_token=${token}`;
  for (let page = 0; page < 30 && next; page++) {
    const res: Response = await fetch(next);
    const json: MediaResp = await res.json();
    if (json.error) throw new Error(`미디어 조회 오류: ${json.error.message}`);
    for (const m of json.data ?? []) {
      if (m.permalink && m.permalink.includes(`/${shortcode}`)) return m.id;
    }
    next = json.paging?.next ?? null;
  }
  return null;
}

/** 게시물 URL이 어느 계정 소유인지 자동 감지 → {account, mediaId} */
export async function resolveMedia(
  postUrl: string,
): Promise<{ account: IgAccount; mediaId: string } | null> {
  const shortcode = shortcodeFromUrl(postUrl);
  if (!shortcode) return null;
  for (const a of getAccounts()) {
    try {
      const mediaId = await findMediaId(a.igId, a.token, shortcode);
      if (mediaId) return { account: a, mediaId };
    } catch {
      /* 이 계정에선 권한/조회 실패 — 다음 계정 시도 */
    }
  }
  return null;
}

/** 이벤트 URL들의 소유 계정 (첫 매칭) */
export async function resolveAccountForUrls(urls: string[]): Promise<IgAccount | null> {
  for (const u of urls) {
    const r = await resolveMedia(u);
    if (r) return r.account;
  }
  return null;
}

/** 한 게시물의 전체 댓글(답글 포함) 수집 — 소유 계정 자동 감지 */
export async function fetchCommentsViaGraph(postUrl: string): Promise<GraphComment[]> {
  if (!graphConfigured()) throw new Error("Graph API 미설정");
  const r = await resolveMedia(postUrl);
  if (!r) {
    throw new Error(
      "이 게시물을 연결된 계정 미디어에서 찾지 못했습니다. 연결된 계정(본인 비즈니스 계정) 중 하나의 게시물인지 확인하세요.",
    );
  }
  const out: GraphComment[] = [];
  const push = (c: CommentItem) => {
    if (c.username) out.push({ username: c.username, text: c.text ?? null, timestamp: c.timestamp ?? null });
  };
  let next: string | null = `${GRAPH}/${r.mediaId}/comments?fields=username,text,timestamp,replies{username,text,timestamp}&limit=50&access_token=${r.account.token}`;
  for (let page = 0; page < 200 && next; page++) {
    const res: Response = await fetch(next);
    const json: CommentResp = await res.json();
    if (json.error) throw new Error(`댓글 조회 오류: ${json.error.message}`);
    for (const c of json.data ?? []) {
      push(c);
      for (const rp of c.replies?.data ?? []) push(rp);
    }
    next = json.paging?.next ?? null;
  }
  return out;
}

/** 여러 URL 합쳐서 수집 */
export async function fetchCommentsForUrls(urls: string[]): Promise<GraphComment[]> {
  const all: GraphComment[] = [];
  for (const u of urls) all.push(...(await fetchCommentsViaGraph(u)));
  return all;
}

// ── 답글용: 댓글 ID 인덱스 + 답글/DM 작성 ──────────────────────
export interface CommentRef {
  id: string;
  username: string;
  text: string | null;
}

/** media id + token 으로 최상위 댓글들 id+username 조회 */
async function fetchCommentRefs(mediaId: string, token: string): Promise<CommentRef[]> {
  const out: CommentRef[] = [];
  let next: string | null = `${GRAPH}/${mediaId}/comments?fields=id,username,text&limit=50&access_token=${token}`;
  for (let page = 0; page < 200 && next; page++) {
    const res: Response = await fetch(next);
    const json: CommentResp = await res.json();
    if (json.error) throw new Error(`댓글 조회 오류: ${json.error.message}`);
    for (const c of json.data ?? []) {
      if (c.id && c.username) out.push({ id: c.id, username: c.username, text: c.text ?? null });
    }
    next = json.paging?.next ?? null;
  }
  return out;
}

/** 여러 URL → username(소문자) → 최상위 댓글 ref (계정 자동 감지) */
export async function fetchCommentIndexForUrls(urls: string[]): Promise<Map<string, CommentRef>> {
  const map = new Map<string, CommentRef>();
  for (const u of urls) {
    const r = await resolveMedia(u);
    if (!r) continue;
    for (const c of await fetchCommentRefs(r.mediaId, r.account.token)) {
      const key = c.username.toLowerCase();
      if (!map.has(key)) map.set(key, c);
    }
  }
  return map;
}

/** 댓글에 공개 답글 작성 (해당 게시물 소유 계정 토큰으로) */
export async function replyToComment(
  commentId: string,
  message: string,
  account: IgAccount,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetch(`${GRAPH}/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message, access_token: account.token }),
  });
  const json: { id?: string; error?: { message: string } } = await res.json();
  if (json.error) return { ok: false, error: json.error.message };
  return { ok: true, id: json.id };
}

/** 댓글 작성자에게 비공개 답장(DM) — 해당 계정 페이지(/me) 기준 전송 */
export async function sendPrivateReply(
  commentId: string,
  text: string,
  account: IgAccount,
): Promise<{ ok: boolean; error?: string }> {
  // 페이지 토큰의 /me = 연결된 페이지. (/{ig-id}/messages 는 #3 capability 오류)
  const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(account.token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
  });
  const json: { error?: { message: string } } = await res.json();
  if (json.error) return { ok: false, error: json.error.message };
  return { ok: true };
}
