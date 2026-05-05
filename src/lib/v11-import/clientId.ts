/**
 * 거래처 ID 생성 유틸 (Prisma fallback)
 *
 * 배경: v1.0 Prisma 스키마에는 Client 모델이 없지만 Transaction.clientId,
 * AccountsReceivable.clientId 컬럼이 존재 + AR은 NOT NULL.
 * 거래처명을 받아 결정론적 ID를 만들어, 같은 이름은 항상 같은 ID로 묶이게 한다.
 *
 * NOTE: SHA-256으로 충분히 충돌 없이 거래처명을 ID화 (디안 거래처 100~수백 규모).
 */
import { createHash } from 'node:crypto'

const PREFIX = 'cli_'

/** 거래처명 → 결정론적 24자 ID. 정규화(NFC + trim + 공백 정리) 후 해시. */
export function clientIdFromName(name: string): string {
  const normalized = name.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (!normalized) return PREFIX + 'unknown'
  const hash = createHash('sha256').update(normalized).digest('hex')
  return PREFIX + hash.slice(0, 20)
}
