/**
 * 색동 페이지 클라이언트 공유 fetch.
 *
 * 계기판(SaekdongKpi)과 매출 섹션(SaekdongSales/OfflineSales)이 같은 API 를
 * 각자 부르면 아임웹 호출 제한(5건/초)을 초과한다(Vercel 은 라우트 호출마다
 * 별도 인스턴스라 서버측 간격 제어가 서로 안 보임).
 * → 같은 페이지 로드에서는 프라미스를 공유해 1회만 요청한다.
 */

let salesPromise: Promise<unknown> | null = null
let offlinePromise: Promise<unknown> | null = null

export function fetchSharedSales<T>(force = false): Promise<T> {
  if (force || !salesPromise) {
    // refresh=1 → 서버 공유 캐시 TTL 을 건너뛰고 갱신
    salesPromise = fetch(
      force ? '/api/saekdong/sales?refresh=1' : '/api/saekdong/sales',
      force ? { cache: 'no-store' } : {},
    )
      .then((r) => r.json())
      .catch((e) => {
        salesPromise = null // 실패 시 다음 시도에서 재요청
        throw e
      })
  }
  return salesPromise as Promise<T>
}

export function fetchSharedOffline<T>(force = false): Promise<T> {
  if (force || !offlinePromise) {
    offlinePromise = fetch('/api/saekdong/offline-sales', force ? { cache: 'no-store' } : {})
      .then((r) => r.json())
      .catch((e) => {
        offlinePromise = null
        throw e
      })
  }
  return offlinePromise as Promise<T>
}
