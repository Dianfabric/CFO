'use client'

/**
 * Service Worker 등록 + 자동 업데이트 처리
 *
 * - 페이지 mount 시 /sw.js 등록
 * - 새 버전 감지 시 자동 reload (선택적으로 토스트 알림 후 reload)
 * - 1시간마다 background update check
 *
 * production 빌드에서만 등록 (dev 환경에서는 HMR 과 충돌 방지)
 */
import { useEffect, useState } from 'react'

export default function ServiceWorkerRegistrar() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // dev 환경에서는 SW 등록 안 함 (Turbopack HMR 과 충돌 방지)
    if (process.env.NODE_ENV !== 'production') return

    let registration: ServiceWorkerRegistration | null = null

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none', // sw.js 자체는 캐시하지 않음 (항상 fresh 체크)
        })

        // 새 버전 감지 — installing → installed (waiting) → 자동 activate
        registration.addEventListener('updatefound', () => {
          const newWorker = registration?.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // 새 버전 설치 완료 — 토스트 표시 (현재는 자동 활성화)
              setUpdateAvailable(true)
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        // 1시간마다 background update check
        setInterval(
          () => {
            registration?.update().catch(() => {})
          },
          60 * 60 * 1000,
        )
      } catch (e) {
        // SW 등록 실패는 silent (앱 동작에 지장 없음)
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.warn('SW register failed:', e)
        }
      }
    }

    register()

    // 새 SW 가 controller 가 되면 (활성화 완료) — page reload 로 새 코드 적용
    let refreshing = false
    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // SW 로부터 NEW_VERSION 메시지 받으면 토스트
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEW_VERSION') {
        setUpdateAvailable(true)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [])

  if (!updateAvailable) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 px-4 py-3 bg-black text-white shadow-lg flex items-center gap-3"
      style={{ borderRadius: '2px', maxWidth: 320 }}
      role="status"
    >
      <span
        className="inline-block w-2 h-2"
        style={{ backgroundColor: '#76b900' }}
      />
      <div className="flex-1 text-[12px]">
        <p className="font-bold">새 버전이 설치되었습니다</p>
        <p className="text-white/70 text-[11px]">잠시 후 자동으로 새로고침됩니다</p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-[11px] font-bold px-2 py-1"
        style={{
          backgroundColor: '#76b900',
          color: '#000',
          borderRadius: '2px',
        }}
      >
        지금 적용
      </button>
    </div>
  )
}
