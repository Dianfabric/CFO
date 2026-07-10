/**
 * GET /api/maintenance/dedupe-freight        — 중복 후보 미리보기 (dry-run)
 * GET /api/maintenance/dedupe-freight?apply=1 — 실제 삭제
 *
 * 2026-07-10 운임·관세 폴더 재업로드로 같은 인보이스가 2~3중 등록된 것을 정리.
 * 같은 날짜+유형+설명+금액 그룹에서 1건만 남긴다 (B/L이 서로 다른 실제 별건은 보존).
 * 남길 기준: 정상 메타(Invoice: OIHI…)가 있는 행 우선, 동률이면 먼저 등록된 행.
 * 부수 정리: 해외운송비 행의 taxAmount(표시용)를 0으로 통일.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TARGET_DESCRIPTIONS = [
  '해외운송비 (글로지텍 운임)',
  '해외운송비 (수입세금)',
  '해외운송비 (수입원자재)',
  '관세/통관비용',
  '국제운송비 (로드썬)',
]

const GOOD_NOTES = /Invoice: OIHI|수입세금계산서|수입신고필증|관세:|공급자:|운임합계/
const BAD_NOTES = /FCL\/LCL|Invoice: C?YWYTIN/
const BL_RE = /(YWYTIN[A-Z0-9-]+|RSE\d+|01-GAR[\d-]+)/

interface Row {
  id: string
  date: Date
  type: string
  description: string | null
  totalAmount: number
  notes: string | null
  createdAt: Date
}

function score(r: Row): number {
  const n = r.notes ?? ''
  return (GOOD_NOTES.test(n) ? 2 : 0) + (BAD_NOTES.test(n) ? -2 : 0)
}

/** B/L 정규화 — 같은 선적인데 표기가 갈리는 변형 통일 (CYWYTIN…, 끝의 -1/-2 접미사) */
function normBl(notes: string | null): string | undefined {
  const bl = (notes ?? '').match(BL_RE)?.[1]
  return bl?.replace(/-\d+$/, '')
}

export async function GET(req: NextRequest) {
  try {
    const apply = req.nextUrl.searchParams.get('apply') === '1'

    const rows: Row[] = await prisma.transaction.findMany({
      where: {
        description: { in: TARGET_DESCRIPTIONS },
        date: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31T23:59:59') },
      },
      select: { id: true, date: true, type: true, description: true, totalAmount: true, notes: true, createdAt: true },
    })

    // 날짜+유형+설명+금액 그룹핑
    const groups = new Map<string, Row[]>()
    for (const r of rows) {
      const key = `${r.date.toISOString().slice(0, 10)}|${r.type}|${r.description}|${r.totalAmount}`
      const arr = groups.get(key) ?? []
      arr.push(r)
      groups.set(key, arr)
    }

    const toDelete: Row[] = []
    const report: { key: string; keep: string; drop: string[] }[] = []

    for (const [key, arr] of groups) {
      if (arr.length < 2) continue

      // B/L이 서로 다른 진짜 별건은 B/L별로 분리해서 판단
      const byBl = new Map<string, Row[]>()
      const realBls = new Set<string>()
      for (const r of arr) {
        const bl = normBl(r.notes)
        if (bl) realBls.add(bl)
      }
      for (const r of arr) {
        const bl = normBl(r.notes)
        // 실제 B/L이 2개 이상 섞였으면 B/L 없는(메타 깨진) 행은 판단 보류
        const sub = realBls.size > 1 ? (bl ?? `__keep_${r.id}`) : 'ALL'
        const list = byBl.get(sub) ?? []
        list.push(r)
        byBl.set(sub, list)
      }

      for (const sub of byBl.values()) {
        if (sub.length < 2) continue
        sub.sort((a, b) => score(b) - score(a) || a.createdAt.getTime() - b.createdAt.getTime())
        const keep = sub[0]
        const drop = sub.slice(1)
        toDelete.push(...drop)
        report.push({ key, keep: keep.id, drop: drop.map((d) => d.id) })
      }
    }

    // 월별 삭제 영향 합계
    const impactByMonth = new Map<string, number>()
    for (const r of toDelete) {
      const ym = r.date.toISOString().slice(0, 7)
      impactByMonth.set(ym, (impactByMonth.get(ym) ?? 0) + r.totalAmount)
    }

    let deleted = 0
    let taxFixed = 0
    if (apply) {
      const ids = toDelete.map((r) => r.id)
      if (ids.length > 0) {
        await prisma.transactionItem.deleteMany({ where: { transactionId: { in: ids } } })
        const res = await prisma.transaction.deleteMany({ where: { id: { in: ids } } })
        deleted = res.count
      }
      // 표시용 taxAmount 통일 (수기 등록분 10% 자동계산 정정)
      const fix = await prisma.transaction.updateMany({
        where: { description: { in: TARGET_DESCRIPTIONS }, taxAmount: { gt: 0 }, type: 'PURCHASE' },
        data: { taxAmount: 0 },
      })
      taxFixed = fix.count
    }

    return NextResponse.json({
      dryRun: !apply,
      scanned: rows.length,
      duplicateGroups: report.length,
      deleteCandidates: toDelete.length,
      deleted,
      taxFixed,
      impactByMonth: Object.fromEntries([...impactByMonth.entries()].sort()),
      report,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '정리 실패' }, { status: 500 })
  }
}
