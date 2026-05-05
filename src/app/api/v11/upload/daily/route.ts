/**
 * v1.1 일계표 업로드 (Prisma + Supabase 양쪽 쓰기)
 *
 * POST /api/v11/upload/daily
 * Body: multipart/form-data (file: Excel)
 *
 * 정책:
 * - 인증된 사용자만 호출 가능 (CEO, executive, employee 모두 OK)
 * - 각 일자마다 Prisma·Supabase 양쪽에 기록을 시도
 * - 한쪽 실패해도 다른쪽은 진행 (best-effort dual write)
 * - 중복 검사는 각 DB에서 독립적으로
 */
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { extractDaySheets, isDailyLedgerFormat } from '@/lib/v11-import/parser'
import { syncDayToPrisma } from '@/lib/v11-import/prismaSync'
import { syncDayToSupabase } from '@/lib/v11-import/supabaseSync'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  // 인증 확인 (RLS와 별도로 명시적 게이트)
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: '인증 검사 실패.' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    if (!isDailyLedgerFormat(workbook)) {
      return NextResponse.json(
        { error: '일계표(리스트) 파일 형식이 아닙니다.' },
        { status: 400 },
      )
    }

    const days = extractDaySheets(workbook)
    if (days.length === 0) {
      return NextResponse.json(
        { error: '날짜 시트(예: 26.04.30)를 찾지 못했습니다.' },
        { status: 400 },
      )
    }

    const details: Array<{
      date: string
      prisma: { ok: boolean; message?: string; error?: string; salesCount: number; expenseCount: number; purchaseCount: number; arCount: number }
      supabase: { ok: boolean; message?: string; error?: string; salesCount: number; expenseCount: number; purchaseCount: number }
    }> = []

    for (const day of days) {
      const [prismaRes, supabaseRes] = await Promise.all([
        syncDayToPrisma(day),
        syncDayToSupabase(day),
      ])
      details.push({
        date: day.dateStr,
        prisma: {
          ok: prismaRes.ok,
          message: prismaRes.message,
          error: prismaRes.error,
          salesCount: prismaRes.salesCount,
          expenseCount: prismaRes.expenseCount,
          purchaseCount: prismaRes.purchaseCount,
          arCount: prismaRes.arCount,
        },
        supabase: {
          ok: supabaseRes.ok,
          message: supabaseRes.message,
          error: supabaseRes.error,
          salesCount: supabaseRes.salesCount,
          expenseCount: supabaseRes.expenseCount,
          purchaseCount: supabaseRes.purchaseCount,
        },
      })
    }

    // 집계
    const totals = details.reduce(
      (acc, d) => {
        acc.prismaSales += d.prisma.salesCount
        acc.prismaExpenses += d.prisma.expenseCount
        acc.prismaPurchases += d.prisma.purchaseCount
        acc.supabaseSales += d.supabase.salesCount
        acc.supabaseExpenses += d.supabase.expenseCount
        acc.supabasePurchases += d.supabase.purchaseCount
        return acc
      },
      { prismaSales: 0, prismaExpenses: 0, prismaPurchases: 0, supabaseSales: 0, supabaseExpenses: 0, supabasePurchases: 0 },
    )

    return NextResponse.json({
      success: true,
      sheetsTotal: workbook.SheetNames.length,
      processedDays: days.length,
      totals,
      details,
    })
  } catch (error) {
    console.error('[v11/upload/daily] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '파일 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
