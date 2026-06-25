// 인스타 로그인 세션(sessionid 쿠키)으로 내부 웹 API에서 전체 댓글 수집.
// Meta 개발자 계정 불필요. 단 비공식 API라 인스타 변경 시 깨질 수 있음.
// 필요한 env: IG_SESSIONID (브라우저 instagram.com 쿠키의 sessionid 값)

import type { GraphComment } from "./instagram-graph";
import { shortcodeFromUrl } from "./instagram-graph";

const APP_ID = "936619743392459"; // 인스타 웹 앱 id
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function cookieConfigured(): boolean {
  return !!process.env.IG_SESSIONID;
}

/** 인스타 shortcode → 숫자 media id (base64 디코딩) */
export function shortcodeToMediaId(shortcode: string): string {
  let id = BigInt(0);
  const base = BigInt(64);
  for (const ch of shortcode) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) break;
    id = id * base + BigInt(idx);
  }
  return id.toString();
}

interface IgComment {
  user?: { username?: string };
  username?: string;
  text?: string;
  created_at?: number;
}
interface IgResp {
  comments?: IgComment[];
  next_min_id?: string;
  has_more_comments?: boolean;
  message?: string;
  status?: string;
}

function headers(sid: string): Record<string, string> {
  return {
    "User-Agent": UA,
    "x-ig-app-id": APP_ID,
    "x-requested-with": "XMLHttpRequest",
    Accept: "*/*",
    Cookie: `sessionid=${sid}`,
  };
}

/** 한 게시물의 전체 댓글 수집 */
export async function fetchCommentsViaCookie(postUrl: string): Promise<GraphComment[]> {
  const sid = process.env.IG_SESSIONID;
  if (!sid) throw new Error("IG_SESSIONID 미설정");
  const shortcode = shortcodeFromUrl(postUrl);
  if (!shortcode) throw new Error("게시물 URL 형식을 확인하세요.");
  const mediaId = shortcodeToMediaId(shortcode);

  const out: GraphComment[] = [];
  const seen = new Set<string>();
  let minId: string | undefined;
  for (let page = 0; page < 200; page++) {
    const url =
      `https://www.instagram.com/api/v1/media/${mediaId}/comments/?can_support_threading=true&permalink_enabled=false` +
      (minId ? `&min_id=${encodeURIComponent(minId)}` : "");
    const res = await fetch(url, { headers: headers(sid) });
    if (res.status === 401 || res.status === 403) {
      throw new Error("쿠키 인증 실패 — sessionid가 만료됐거나 잘못됐어요. 다시 복사해주세요.");
    }
    if (res.status === 404) {
      throw new Error("게시물을 찾을 수 없습니다 (URL 확인).");
    }
    if (!res.ok) throw new Error(`수집 실패 (HTTP ${res.status})`);
    const json: IgResp = (await res.json()) as IgResp;

    const batch = json.comments ?? [];
    for (const c of batch) {
      const u = c.user?.username ?? c.username;
      if (!u) continue;
      const key = `${u}:${c.created_at ?? ""}:${(c.text ?? "").slice(0, 12)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        username: u,
        text: c.text ?? null,
        timestamp: c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
      });
    }

    if (!json.has_more_comments || !json.next_min_id || batch.length === 0) break;
    minId = json.next_min_id;
  }
  return out;
}

export async function fetchCookieForUrls(urls: string[]): Promise<GraphComment[]> {
  const all: GraphComment[] = [];
  for (const u of urls) all.push(...(await fetchCommentsViaCookie(u)));
  return all;
}
