'use client'
/**
 * v1.1 일계표 업로드 페이지 (/finance/upload)
 *
 * Excel 일계표 파일 업로드 → /api/v11/upload/daily → Prisma + Supabase 동시 기록.
 * 보호 경로 (middleware가 인증 체크).
 */
import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { formatKRW } from '@/lib/formatters'

interface DayDetail {
  date: string
  prisma: {
    ok: boolean
    message?: string
    error?: string
    salesCount: number
    expenseCount: number
    purchaseCount: number
    arCount: number
  }
  supabase: {
    ok: boolean
    message?: string
    error?: string
    salesCount: number
    expenseCount: number
    purchaseCount: number
  }
}

interface UploadResponse {
  success: boolean
  sheetsTotal?: number
  processedDays?: number
  totals?: {
    prismaSales: number
    prismaExpenses: number
    prismaPurchases: number
    supabaseSales: number
    supabaseExpenses: number
    supabasePurchases: number
  }
  details?: DayDetail[]
  error?: string
}

export default function FinanceUploadPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setResult(null)
    setErrorMsg(null)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/v11/upload/daily', {
        method: 'POST',
        body: form,
      })
      const json = (await res.json()) as UploadResponse

      if (!res.ok || !json.success) {
        setErrorMsg(json.error || '업로드에 실패했습니다.')
        return
      }
      setResult(json)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '네트워크 오류')
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 신규 · 데이터 입력
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">일계표 업로드</h1>
        <p className="mt-1 text-sm text-slate-500">
          Excel 일계표 파일을 올리면 v1.0 (Prisma) + v1.1 (Supabase) 양쪽에 동시 기록됩니다.
        </p>
      </div>

      {/* 업로드 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            일계표 (리스트형)
          </CardTitle>
          <CardDescription>
            첫 시트 첫 행에 &quot;일계표&quot;가 포함된 Excel(.xlsx)만 처리합니다. 시트명이
            <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">26.04.30</code>
            형식인 시트들이 일자별로 처리됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-stretch gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="w-fit"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  업로드 중... (수십 초 소요 가능)
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Excel 파일 선택
                </>
              )}
            </Button>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 결과 요약 */}
      {result?.success && result.totals && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <CheckCircle className="h-5 w-5" />
              업로드 완료 · {result.processedDays}일 처리
            </CardTitle>
            <CardDescription>
              <Link href="/finance" className="font-medium text-emerald-700 hover:underline">
                → 재무 메인 대시보드에서 확인
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-md border border-emerald-200 bg-white p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  v1.0 Prisma (기존 메뉴 데이터)
                </div>
                <ul className="space-y-1 text-xs text-slate-700">
                  <li>매출 거래: <strong>{result.totals.prismaSales}건</strong></li>
                  <li>매입 거래: <strong>{result.totals.prismaPurchases}건</strong></li>
                  <li>경비: <strong>{result.totals.prismaExpenses}건</strong></li>
                </ul>
              </div>
              <div className="rounded-md border border-emerald-200 bg-white p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  v1.1 Supabase (24셀·4티어 자동 매핑)
                </div>
                <ul className="space-y-1 text-xs text-slate-700">
                  <li>매출 거래: <strong>{result.totals.supabaseSales}건</strong></li>
                  <li>매입(비용): <strong>{result.totals.supabasePurchases}건</strong></li>
                  <li>경비: <strong>{result.totals.supabaseExpenses}건</strong></li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 일자별 상세 */}
      {result?.details && result.details.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">일자별 결과</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 text-left">날짜</th>
                    <th className="py-2 text-center">v1.0 매출</th>
                    <th className="py-2 text-center">v1.0 비용</th>
                    <th className="py-2 text-center">v1.0 매입</th>
                    <th className="py-2 text-center">v1.0 AR</th>
                    <th className="py-2 text-center">v1.1 매출</th>
                    <th className="py-2 text-center">v1.1 비용</th>
                    <th className="py-2 text-center">v1.1 매입</th>
                    <th className="py-2 text-left">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {result.details.map((d) => (
                    <tr key={d.date} className="border-b last:border-0">
                      <td className="py-1.5 font-medium text-slate-700">{d.date}</td>
                      <td className="text-center tabular-nums">{d.prisma.salesCount}</td>
                      <td className="text-center tabular-nums">{d.prisma.expenseCount}</td>
                      <td className="text-center tabular-nums">{d.prisma.purchaseCount}</td>
                      <td className="text-center tabular-nums">{d.prisma.arCount}</td>
                      <td className="text-center tabular-nums">{d.supabase.salesCount}</td>
                      <td className="text-center tabular-nums">{d.supabase.expenseCount}</td>
                      <td className="text-center tabular-nums">{d.supabase.purchaseCount}</td>
                      <td className="text-[11px] text-slate-500">
                        {d.prisma.message || d.prisma.error || ''}
                        {d.prisma.message && d.supabase.message && ' / '}
                        {d.supabase.message || d.supabase.error || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 도움말 */}
      <Card className="border-slate-200 bg-slate-50">
        <CardContent>
          <div className="flex items-start gap-3 text-xs text-slate-600">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="space-y-1">
              <p>
                <strong>처음 사용하는 거래처</strong>는 Supabase에 자동 등록되며 24셀 매핑은
                기본값(<code>인테리어 프로젝트 × 소파원단</code>)으로 시작합니다. 추후 거래처
                관리 페이지에서 정확하게 매핑할 수 있습니다.
              </p>
              <p>
                <strong>같은 날짜 재업로드</strong>는 자동 스킵됩니다 (중복 방지).
              </p>
              <p>
                v1.0의 일일결산·거래·미수금 메뉴와 v1.1의 재무 대시보드 둘 다에서 같은 데이터를
                보실 수 있습니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
