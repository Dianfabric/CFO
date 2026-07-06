/**
 * DIAVIS Service Worker — 자동 업데이트 + 오프라인 fallback
 *
 * 자동 업데이트 흐름:
 *   1. Vercel 배포 → /sw.js 가 갱신됨 (BUILD_ID 변경)
 *   2. 사용자가 앱 열면 브라우저가 sw.js 를 fetch (~24h 캐시 + 강제 갱신)
 *   3. 새 SW 감지 → install 시 skipWaiting() → 즉시 활성화
 *   4. activate 시 clients.claim() + 오래된 캐시 삭제
 *   5. 클라이언트(ServiceWorkerRegistrar)에 'NEW_VERSION' 메시지 전송 → 자동 reload
 */

// BUILD_ID 는 배포마다 바뀜 (Next.js 가 빌드 시 SW 파일을 갱신해주지 않으므로 캐시 무효화 위해 timestamp 사용)
const CACHE_VERSION = 'diavis-v2'
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

// install — 새 버전 즉시 활성화 대기 없이 진행
self.addEventListener('install', () => {
  self.skipWaiting()
})

// activate — 새 SW 가 즉시 모든 클라이언트 점유 + 오래된 캐시 청소
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k.startsWith('diavis-') && !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      )
      await self.clients.claim()
      // 모든 열린 탭에 새 버전 알림 (자동 reload 트리거)
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        client.postMessage({ type: 'NEW_VERSION', version: CACHE_VERSION })
      }
    })(),
  )
})

// fetch — 네트워크 우선 (최신 데이터 우선), 실패 시 캐시 (오프라인 fallback)
self.addEventListener('fetch', (event) => {
  const { request } = event

  // 1) 인증/POST/PATCH/DELETE 등 비-GET 은 SW 우회
  if (request.method !== 'GET') return

  // 2) API 호출은 캐시 X — 항상 네트워크 (실시간 데이터)
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) return

  // 3) Supabase / 외부 도메인은 SW 우회
  if (url.origin !== self.location.origin) return

  // 4) 정적 자산: 네트워크 우선 → 실패 시 캐시
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request)
        // 성공 응답만 캐시 저장
        if (fresh && fresh.status === 200) {
          const cache = await caches.open(RUNTIME_CACHE)
          cache.put(request, fresh.clone())
        }
        return fresh
      } catch {
        // 오프라인 — 캐시 fallback
        const cached = await caches.match(request)
        if (cached) return cached
        // 캐시도 없으면 fallback 페이지
        if (request.mode === 'navigate') {
          const fallback = await caches.match('/')
          if (fallback) return fallback
        }
        return new Response('오프라인 — 인터넷 연결을 확인하세요', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    })(),
  )
})

// 클라이언트에서 'SKIP_WAITING' 메시지 받으면 즉시 활성화 (수동 업데이트 버튼용)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
