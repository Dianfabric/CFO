// dian_recon_rejections 테이블 존재 확인
// + BankTransaction 상태 분포 확인
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'

// .env 로드
const env = readFileSync('D:/CFO/.env', 'utf-8')
const getEnv = (k) => {
  const m = env.match(new RegExp(`^${k}=(.+)$`, 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY')

console.log('=== Supabase 연결 ===')
console.log(`URL: ${SUPABASE_URL}`)
console.log(`Key present: ${!!SUPABASE_KEY}`)

if (SUPABASE_URL && SUPABASE_KEY) {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
  console.log('\n=== dian_recon_rejections 테이블 확인 ===')
  const { data, error, count } = await sb
    .from('dian_recon_rejections')
    .select('id', { count: 'exact', head: false })
    .limit(5)
  if (error) {
    console.log('❌ 테이블 조회 실패:', error.message)
    console.log('   → 마이그레이션 필요: supabase/migrations/2026-07-02_dian_recon_rejections.sql')
  } else {
    console.log(`✓ 테이블 존재. 저장된 rejection: ${count ?? data?.length ?? 0}건`)
    if (data && data.length > 0) console.log('   샘플:', data.slice(0, 3).map(r => r.id))
  }
}

// BankTransaction 상태 분포
const prisma = new PrismaClient()
console.log('\n=== BankTransaction status 분포 ===')
const dist = await prisma.bankTransaction.groupBy({
  by: ['status', 'type'],
  _count: true,
})
for (const d of dist) {
  console.log(`  ${d.status.padEnd(10)} | ${d.type} | ${d._count}건`)
}

await prisma.$disconnect()
