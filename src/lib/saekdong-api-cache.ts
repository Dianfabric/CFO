/**
 * 색동 아임웹 API 공유 캐시 (서버 전용).
 *
 * Vercel 서버리스는 인스턴스 간 메모리를 공유하지 않아 아임웹 호출 제한
 * (5건/초)을 넘기 쉽다. Supabase saekdong_api_cache 테이블로:
 * - TTL 내에는 캐시 반환 (아임웹 호출 0)
 * - 갱신은 refreshing_since 락으로 한 인스턴스만 수행 (동시 갱신 방지)
 * - 갱신 실패 시 이전 성공값 반환 (화면이 에러 대신 마지막 값 유지)
 * - 테이블이 없으면 직접 조회로 폴백 (기존 동작)
 */
import { createClient } from '@/lib/supabase/server'

const DEAD_LOCK_MS = 3 * 60 * 1000 // 3분 넘은 락은 죽은 것으로 간주

interface CacheRow {
  payload: unknown
  fetched_at: string | null
  refreshing_since: string | null
}

/** fetcher 결과에 error 필드가 차 있으면 부분 실패로 간주 */
function isErrorPayload(v: unknown): boolean {
  return !!v && typeof v === 'object' && 'error' in v && !!(v as { error?: unknown }).error
}

export async function withApiCache<T>(
  key: string,
  ttlSec: number,
  fetcher: () => Promise<T>,
  forceRefresh = false,
): Promise<T> {
  let sb: Awaited<ReturnType<typeof createClient>>
  try {
    sb = await createClient()
  } catch {
    return fetcher()
  }

  try {
    const { data, error } = await sb
      .from('saekdong_api_cache')
      .select('payload, fetched_at, refreshing_since')
      .eq('key', key)
      .maybeSingle()
    if (error) return fetcher() // 테이블 없음 등 → 폴백

    const row = (data as CacheRow | null) ?? null
    const now = Date.now()
    const fresh =
      row?.fetched_at != null && now - new Date(row.fetched_at).getTime() < ttlSec * 1000
    if (row?.payload != null && fresh && !forceRefresh) return row.payload as T

    // 행이 없으면 생성 (락 겸)
    if (!row) {
      const { error: insErr } = await sb
        .from('saekdong_api_cache')
        .insert({ key, refreshing_since: new Date().toISOString() })
      if (insErr) return fetcher() // 경합 패배 등 → 직접 조회
    } else {
      // 갱신 락 시도 — 락이 비었거나 3분 이상 지난 죽은 락만 탈취
      const staleLockIso = new Date(now - DEAD_LOCK_MS).toISOString()
      const { data: locked } = await sb
        .from('saekdong_api_cache')
        .update({ refreshing_since: new Date().toISOString() })
        .eq('key', key)
        .or(`refreshing_since.is.null,refreshing_since.lt.${staleLockIso}`)
        .select('key')
      const gotLock = (locked?.length ?? 0) > 0
      if (!gotLock) {
        // 다른 인스턴스가 갱신 중 → 이전 값 반환 (없으면 직접 조회)
        if (row.payload != null) return row.payload as T
        return fetcher()
      }
    }

    try {
      const result = await fetcher()
      if (isErrorPayload(result) && row?.payload != null) {
        // 부분 실패 → 락 해제하고 이전 성공값 유지
        await sb.from('saekdong_api_cache').update({ refreshing_since: null }).eq('key', key)
        return row.payload as T
      }
      await sb.from('saekdong_api_cache').upsert({
        key,
        payload: result as object,
        fetched_at: new Date().toISOString(),
        refreshing_since: null,
      })
      return result
    } catch (e) {
      await sb.from('saekdong_api_cache').update({ refreshing_since: null }).eq('key', key)
      if (row?.payload != null) return row.payload as T
      throw e
    }
  } catch {
    return fetcher()
  }
}
