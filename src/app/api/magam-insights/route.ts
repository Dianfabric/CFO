/**
 * GET /api/magam-insights?days=90
 *
 * 마감(출고) 데이터 인사이트:
 * - 직군/제품/가공·기능/재료별 매출 집계 (영업·마케팅 자료)
 * - 메타 미표기 현황 — 담당자별 (표기 완료까지 계속 표시)
 * - 출고 완료(담당자 태깅됨) + 미수금 잔존 거래 — 미수금 0% 도전
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function kstYmd(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

function agg(map: Map<string, { amount: number; count: number }>, key: string | null, amount: number) {
  const k = (key ?? '').trim() || '미표기'
  const cur = map.get(k) ?? { amount: 0, count: 0 }
  cur.amount += amount
  cur.count += 1
  map.set(k, cur)
}

function toSorted(map: Map<string, { amount: number; count: number }>) {
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)
}

export async function GET(req: NextRequest) {
  try {
    const days = Number(req.nextUrl.searchParams.get('days')) || 90
    const since = new Date(Date.now() - days * 86400000)

    const txs = await prisma.transaction.findMany({
      where: {
        type: 'SALE',
        date: { gte: since },
        totalAmount: { gt: 0 },
        OR: [
          { description: null },
          {
            NOT: {
              OR: [
                { description: { startsWith: '이월 매출 보정' } },
                { description: { startsWith: '이월 매출 -' } },
                { description: { startsWith: '선수금 placeholder' } },
              ],
            },
          },
        ],
      },
      include: {
        items: true,
        client: { select: { name: true } },
        accountsReceivable: { select: { remainingAmount: true } },
      },
      orderBy: { date: 'desc' },
    })

    const byIndustry = new Map<string, { amount: number; count: number }>()
    const byProduct = new Map<string, { amount: number; count: number }>()
    const byProcess = new Map<string, { amount: number; count: number }>()
    const byMaterial = new Map<string, { amount: number; count: number }>()
    // 미표기 — 담당자별
    const untaggedByPerson = new Map<string, { count: number; amount: number }>()
    const untaggedSamples: { date: string; client: string; product: string; person: string; amount: number }[] = []
    // 출고완료(담당자 태깅) + 미수
    const shippedUnpaid: { id: string; date: string; client: string; person: string; remaining: number }[] = []

    for (const tx of txs) {
      const person = tx.salesPerson ?? '담당 미지정'
      for (const it of tx.items) {
        agg(byIndustry, it.industry, it.amount)
        agg(byProduct, it.productCategory, it.amount)
        agg(byProcess, it.processFunction, it.amount)
        agg(byMaterial, it.material, it.amount)
        const untagged = !it.industry && !it.productCategory && !it.processFunction && !it.material
        if (untagged && it.amount > 0) {
          const cur = untaggedByPerson.get(person) ?? { count: 0, amount: 0 }
          cur.count += 1
          cur.amount += it.amount
          untaggedByPerson.set(person, cur)
          if (untaggedSamples.length < 8) {
            untaggedSamples.push({
              date: kstYmd(tx.date),
              client: tx.client?.name ?? '거래처 미상',
              product: it.productName,
              person,
              amount: it.amount,
            })
          }
        }
      }
      // 출고완료 + 미수 (마감 담당자 태깅 = 출고 처리됨으로 간주)
      if (tx.salesPerson) {
        const remaining = tx.accountsReceivable.reduce((s, a) => s + a.remainingAmount, 0)
        if (remaining > 0 && shippedUnpaid.length < 50) {
          shippedUnpaid.push({
            id: tx.id,
            date: kstYmd(tx.date),
            client: tx.client?.name ?? '거래처 미상',
            person: tx.salesPerson,
            remaining,
          })
        }
      }
    }

    const untaggedTotal = [...untaggedByPerson.values()].reduce((s, v) => s + v.count, 0)
    shippedUnpaid.sort((a, b) => b.remaining - a.remaining)

    return NextResponse.json({
      days,
      byIndustry: toSorted(byIndustry),
      byProduct: toSorted(byProduct),
      byProcess: toSorted(byProcess),
      byMaterial: toSorted(byMaterial),
      untagged: {
        total: untaggedTotal,
        byPerson: [...untaggedByPerson.entries()]
          .map(([person, v]) => ({ person, ...v }))
          .sort((a, b) => b.count - a.count),
        samples: untaggedSamples,
      },
      shippedUnpaid: {
        count: shippedUnpaid.length,
        sum: shippedUnpaid.reduce((s, x) => s + x.remaining, 0),
        top: shippedUnpaid.slice(0, 6),
      },
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : '마감 인사이트 조회 실패',
    })
  }
}
