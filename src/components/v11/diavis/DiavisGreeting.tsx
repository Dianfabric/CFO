'use client'

/**
 * DIAVIS Greeting — 시간별 인사 + 힘을 주는 형용사 랜덤
 *
 * Client Component — 사용자 시간대로 인사 결정.
 * SSR 시에는 hydration 안전한 기본값("좋은 하루입니다")을 그려두고
 * useEffect 로 실제 시간 갱신.
 */
import { useEffect, useState } from 'react'

/** 시간대별 인사 */
function getTimeGreeting(hour: number): string {
  if (hour >= 5 && hour < 11) return '좋은 아침이에요'
  if (hour >= 11 && hour < 14) return '좋은 점심이에요'
  if (hour >= 14 && hour < 18) return '좋은 오후예요'
  if (hour >= 18 && hour < 22) return '편안한 저녁이에요'
  return '늦은 시간까지 고생이에요'
}

/** 디안 톤의 힘을 주는 형용사 — 매 방문마다 다른 톤 */
const ADJECTIVES = [
  '결을 만드는',
  '공간을 짓는',
  '오늘도 단단한',
  '결의 무게를 아는',
  '감각이 흐르는',
  '한 결을 매만지는',
  '빛에 가까운',
  '시간을 짜는',
  '안목이 깊은',
  '소재를 읽는',
  '결을 잇는',
  '품격을 만드는',
  '오늘도 차분한',
  '빈틈 없는',
  '담담히 나아가는',
]

function pickAdjective(seed?: number): string {
  const idx =
    seed !== undefined
      ? seed % ADJECTIVES.length
      : Math.floor(Math.random() * ADJECTIVES.length)
  return ADJECTIVES[idx]
}

/**
 * 매일 다른 격려 메시지 풀 — 희망·자부심·발전 톤
 * 디안 시그니처 "결" 단어를 자연스럽게 녹임.
 */
const ENCOURAGEMENTS = [
  '오늘 한 결이 내일의 길이 됩니다.',
  '결을 만드는 손이 회사를 만듭니다.',
  '디안의 오늘이 곧 업계의 기준이 됩니다.',
  '한 결, 한 결. 더 단단하게 나아갑시다.',
  '오늘도 결을 짓는 우리가 자랑스럽습니다.',
  '결이 모여 디안의 내일이 됩니다.',
  '더 나은 결을 향해, 흔들림 없이.',
  '오늘 작은 결 하나가 큰 길을 엽니다.',
  '결을 짓는 사람, 그게 우리입니다.',
  '디안의 매 순간이 결이 됩니다.',
  '오늘도 결을 향해 한 걸음 더.',
  '품격은 한 결씩 쌓여 만들어집니다.',
  '디안의 손이 닿은 공간이 더 깊어집니다.',
  '오늘의 결이 누군가의 공간을 짓습니다.',
  '한 결 한 결, 우리가 만들어 갑니다.',
  '결을 아는 사람만이 길을 엽니다.',
  '디안이 짓는 결, 디안이 여는 내일.',
  '오늘도 단단한 결로 시작합니다.',
  '결을 만드는 자부심으로 하루를 엽니다.',
  '디안의 결, 세상의 한 자리.',
]

function pickEncouragement(seed?: number): string {
  const idx =
    seed !== undefined
      ? seed % ENCOURAGEMENTS.length
      : Math.floor(Math.random() * ENCOURAGEMENTS.length)
  return ENCOURAGEMENTS[idx]
}

export default function DiavisGreeting() {
  // SSR-safe 기본값
  const [greeting, setGreeting] = useState<string>('좋은 하루예요')
  const [adjective, setAdjective] = useState<string>('결을 만드는')
  const [encouragement, setEncouragement] = useState<string>('오늘 한 결이 내일의 길이 됩니다.')
  const [member, setMember] = useState<string>('디안 멤버님')

  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(getTimeGreeting(hour))
    // 형용사 + 격려: 날짜를 시드로 → 같은 날 같은 메시지
    const today = new Date()
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
    setAdjective(pickAdjective(seed))
    setEncouragement(pickEncouragement(seed + 7)) // 시드 다르게 → 형용사·격려 독립 분포

    // 추후 사용자 프로필에서 이름 읽어올 자리 — 빈/비-JSON 응답 안전 처리
    fetch('/api/company-profile')
      .then(async (r) => {
        if (!r.ok) return null
        const text = await r.text()
        if (!text) return null
        try {
          return JSON.parse(text)
        } catch {
          return null
        }
      })
      .then((data) => {
        if (data?.ceoName) setMember(`${data.ceoName} 멤버님`)
        else if (data?.companyName) setMember(`${data.companyName} 멤버님`)
      })
      .catch(() => {})
  }, [])

  return (
    <>
      {/* H1 — 시간 인사 + 멤버 */}
      <h1
        className="nv-display-xl tracking-tight"
        style={{ color: 'var(--nv-on-dark)', maxWidth: '900px' }}
      >
        {greeting},
        <br />
        <span style={{ color: 'var(--nv-primary)' }}>{adjective}</span>{' '}
        {member}.
      </h1>

      {/* Subhead — 한 줄 작은 글씨 (매일 다른 격려 메시지) */}
      <p
        className="mt-4 text-[13px] sm:text-[14px] font-normal max-w-2xl"
        style={{ color: 'var(--nv-on-dark-mute)' }}
      >
        DIAVIS<span style={{ color: 'var(--nv-primary)' }}>가</span> 준비되어 있습니다. {encouragement}
      </p>
    </>
  )
}
