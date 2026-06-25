// 재현 가능한 시드 기반 랜덤 추첨.
// 같은 (후보 목록 + 시드) 조합이면 항상 같은 결과 → 공정성 검증 가능.

/** 문자열 시드 → 32bit 정수 시드 생성기 (xmur3) */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** 32bit 정수 시드 → [0,1) 난수 생성기 (mulberry32) */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 시드 문자열로부터 결정론적 난수 함수 생성 */
export function makeRng(seed: string): () => number {
  const seedFn = xmur3(seed);
  return mulberry32(seedFn());
}

/** Fisher–Yates 셔플 (시드 고정 → 재현 가능). 원본 배열은 변경하지 않음. */
export function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  const rng = makeRng(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface DrawResult<T> {
  winners: T[];
  backups: T[];
  seed: string;
  candidateCount: number;
}

/**
 * 후보 중에서 당첨자(winnerCount)와 보결(backupCount)을 비복원 추출.
 * @param candidates 정제 완료된 후보 목록 (중복 제거 등은 호출 전에 끝낸 상태)
 * @param winnerCount 당첨 인원
 * @param seed 재현용 시드 (생략 시 호출부에서 생성해 전달 권장)
 * @param backupCount 보결 인원 (기본 0)
 */
export function drawWinners<T>(
  candidates: readonly T[],
  winnerCount: number,
  seed: string,
  backupCount = 0,
): DrawResult<T> {
  const shuffled = seededShuffle(candidates, seed);
  const winners = shuffled.slice(0, Math.max(0, winnerCount));
  const backups = shuffled.slice(
    winnerCount,
    winnerCount + Math.max(0, backupCount),
  );
  return { winners, backups, seed, candidateCount: candidates.length };
}

/** 추첨용 시드 생성 (앱 런타임 전용 — Date/random 사용). */
export function generateSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
