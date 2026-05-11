/**
 * 루트 dev.db (절대경로) 직접 열어서 OfficialDocument 등 카운트 확인.
 * Prisma datasource 의 file:./ 가 schema.prisma 폴더 기준이라 우회 필요.
 */
import { PrismaClient } from '@prisma/client'
import path from 'path'

const root = process.cwd()
const sep = path.sep === '\\' ? '/' : path.sep
const rootDbPath = root.split(path.sep).join('/') + '/dev.db'
const url = 'file:' + rootDbPath

console.log('Opening:', url)

const p = new PrismaClient({ datasources: { db: { url } } })

try {
  const [docs, tx, prod, clients] = await Promise.all([
    p.officialDocument.count().catch((e) => `ERR: ${e.message.slice(0, 80)}`),
    p.transaction.count().catch((e) => `ERR: ${e.message.slice(0, 80)}`),
    p.product.count().catch((e) => `ERR: ${e.message.slice(0, 80)}`),
    p.client.count().catch((e) => `ERR: ${e.message.slice(0, 80)}`),
  ])
  console.log(`root dev.db: docs=${docs}, tx=${tx}, products=${prod}, clients=${clients}`)
  if (typeof docs === 'number' && docs > 0) {
    const samples = await p.officialDocument.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { documentNumber: true, type: true, title: true, createdAt: true },
    })
    console.log('Sample documents:')
    for (const s of samples) console.log(' -', s.documentNumber, s.type, '-', s.title)
  }
} catch (e) {
  console.error('ERROR:', e.message)
}

await p.$disconnect()
