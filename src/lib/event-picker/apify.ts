// Apify Instagram 댓글 스크래퍼 연동.
// actor를 실행하고 완료까지 폴링한 뒤 데이터셋(댓글 작성자 목록)을 반환.
//
// 주의: actor의 출력 필드명은 버전마다 다를 수 있어 username을 여러 후보에서 추출한다.
// 토큰/실패 시에는 명확한 에러를 던지고, UI는 "붙여넣기 폴백"으로 우회 가능.

const API = "https://api.apify.com/v2";

export interface ScrapedComment {
  username: string;
  text: string | null;
  commentedAt: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pickUsername(item: Record<string, unknown>): string | null {
  const candidates = [
    item.ownerUsername,
    item.username,
    (item.owner as Record<string, unknown> | undefined)?.username,
    (item.user as Record<string, unknown> | undefined)?.username,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function pickTimestamp(item: Record<string, unknown>): string | null {
  const t = item.timestamp ?? item.createdAt ?? item.created_at;
  return typeof t === "string" ? t : null;
}

/**
 * 댓글 스크래퍼 실행 → 완료 폴링 → 작성자 목록 반환.
 * @param urls 이벤트 피드 URL 목록
 * @param resultsLimit 게시물당 최대 수집 댓글 수
 */
export async function scrapeComments(
  urls: string[],
  resultsLimit = 5000,
): Promise<ScrapedComment[]> {
  const token = process.env.APIFY_TOKEN;
  const actor = process.env.APIFY_COMMENT_ACTOR ?? "apify~instagram-comment-scraper";
  if (!token) throw new Error("APIFY_TOKEN 미설정 — 붙여넣기 폴백을 사용하세요.");
  if (!urls.length) throw new Error("수집할 URL이 없습니다.");

  // 1) actor run 시작
  const startRes = await fetch(`${API}/acts/${actor}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directUrls: urls, resultsLimit }),
  });
  if (!startRes.ok) {
    throw new Error(`Apify 실행 시작 실패 (${startRes.status}): ${await startRes.text()}`);
  }
  const startJson = await startRes.json();
  const runId: string = startJson.data?.id;
  const datasetId: string = startJson.data?.defaultDatasetId;
  if (!runId || !datasetId) throw new Error("Apify 응답에 runId/datasetId 없음");

  // 2) 완료까지 폴링 (최대 ~4분)
  const maxAttempts = 80;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);
    const statusRes = await fetch(`${API}/actor-runs/${runId}?token=${token}`);
    if (!statusRes.ok) continue;
    const status: string = (await statusRes.json()).data?.status;
    if (status === "SUCCEEDED") break;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify 실행 ${status}`);
    }
    if (i === maxAttempts - 1) throw new Error("Apify 수집 시간 초과");
  }

  // 3) 데이터셋 가져오기
  const itemsRes = await fetch(
    `${API}/datasets/${datasetId}/items?token=${token}&clean=true&format=json`,
  );
  if (!itemsRes.ok) {
    throw new Error(`Apify 데이터셋 조회 실패 (${itemsRes.status})`);
  }
  const items: Record<string, unknown>[] = await itemsRes.json();

  const out: ScrapedComment[] = [];
  for (const item of items) {
    const username = pickUsername(item);
    if (!username) continue;
    out.push({
      username,
      text: typeof item.text === "string" ? item.text : null,
      commentedAt: pickTimestamp(item),
    });
  }
  return out;
}
