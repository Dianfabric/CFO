/**
 * 업로드 당번판 API.
 *
 * POST /api/upload-log { kind, fileName } — 업로드 성공 기록 (UploadSection 이 호출)
 * GET  /api/upload-log — 당번 현황: 매일(전새로미)/매주(한태원)/매월(한태종)
 *   각 항목이 이번 기간(오늘/이번 주/이번 달)에 업로드됐는지.
 *   간이영수증은 simple_receipts 등록도 완료로 인정 (사진 업로드 경로가 별도라서).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TABLE_MISSING_RE = /find the table|does not exist|schema cache/i

function kstToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

/** 이번 기간 시작 (KST) — daily: 오늘 0시 / weekly: 월요일 / monthly: 1일 */
function periodStarts() {
  const today = kstToday()
  const now = new Date(today + 'T00:00:00+09:00')
  const dow = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  const month = new Date(now)
  month.setDate(1)
  return {
    daily: now.toISOString(),
    weekly: monday.toISOString(),
    monthly: month.toISOString(),
  }
}

interface DutyItem {
  label: string
  kind: string
  /** 같은 kind 안에서 파일명으로 구분 (매월 운임 항목) */
  fileMatch?: RegExp
}

const DUTIES: { cadence: 'daily' | 'weekly' | 'monthly'; title: string; assignee: string; items: DutyItem[] }[] = [
  {
    cadence: 'daily', title: '매일', assignee: '전새로미',
    items: [
      { label: '일계표', kind: '일계표' },
      { label: '미수금 현황', kind: '미수금현황' },
      { label: '거래내역조회 (통장)', kind: '통장' },
      { label: '매입·매출 세금계산서', kind: '세금계산서' },
      { label: '디안_마감 (출고)', kind: '마감' },
    ],
  },
  {
    cadence: 'weekly', title: '매주', assignee: '한태원',
    items: [
      { label: '관리회계', kind: '관리회계' },
      { label: '간이영수증', kind: '간이영수증' },
      { label: '대출·이자', kind: '대출이자' },
    ],
  },
  {
    cadence: 'monthly', title: '매월 (월 마감)', assignee: '한태종',
    items: [
      { label: '로드썬 운임 (항공)', kind: '운임관세', fileMatch: /로드썬/ },
      { label: '글로지텍 운임(배) · 관세/통관', kind: '운임관세', fileMatch: /글로지텍|관세|통관/ },
    ],
  },
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = await createClient()
    const { error } = await supabase.from('upload_log').insert({
      kind: String(body.kind ?? '기타'),
      file_name: String(body.fileName ?? '').slice(0, 300) || null,
    })
    if (error && !TABLE_MISSING_RE.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, logged: !error })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '기록 실패' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const starts = periodStarts()
    const supabase = await createClient()
    const [logsRes, receiptsRes] = await Promise.all([
      supabase.from('upload_log').select('kind, file_name, uploaded_at').gte('uploaded_at', starts.monthly),
      supabase.from('simple_receipts').select('id').gte('created_at', starts.weekly).limit(1),
    ])
    const tableMissing = !!logsRes.error && TABLE_MISSING_RE.test(logsRes.error.message)
    const logs = (logsRes.data ?? []) as { kind: string; file_name: string | null; uploaded_at: string }[]
    const receiptThisWeek = (receiptsRes.data ?? []).length > 0

    const groups = DUTIES.map((g) => {
      const since = starts[g.cadence]
      const items = g.items.map((it) => {
        let done = logs.some(
          (l) =>
            l.kind === it.kind &&
            l.uploaded_at >= since &&
            (!it.fileMatch || it.fileMatch.test(l.file_name ?? '')),
        )
        // 간이영수증은 사진 등록(simple_receipts)도 완료로 인정
        if (!done && it.kind === '간이영수증' && receiptThisWeek) done = true
        return { label: it.label, done }
      })
      const missing = items.filter((i) => !i.done)
      return {
        cadence: g.cadence,
        title: g.title,
        assignee: g.assignee,
        items,
        missingCount: missing.length,
        missingLabels: missing.map((i) => i.label),
      }
    })

    return NextResponse.json({ tableMissing, today: kstToday(), groups })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '당번 현황 조회 실패' })
  }
}
