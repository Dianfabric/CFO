/**
 * 거래처 관리 (Phase 1.5)
 *
 * - 모든 Supabase 거래처 표시
 * - 24셀 매핑(직업군 × 제품군) 편집
 * - 등급, 결제조건, 연락처, 메모 편집
 * - 거래 건수·매출 합계 표시 (transactions 집계)
 *
 * Server Component → 데이터 fetch → ClientList(Client Component)에 전달
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Users, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ClientList, { type ClientWithStats } from '@/components/v11/clients/ClientList'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadClients(): Promise<{ clients: ClientWithStats[]; error: string | null }> {
  try {
    const supabase = await createClient()

    // 거래처 + 거래 합계
    // (집계는 매번 계산 — 거래처 수가 수천을 넘으면 view로 옮길 것)
    const { data: clientsData, error: clientsErr } = await supabase
      .from('clients')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true })

    if (clientsErr) return { clients: [], error: clientsErr.message }

    const { data: txData, error: txErr } = await supabase
      .from('transactions')
      .select('client_id, total_amount')

    if (txErr) return { clients: [], error: txErr.message }

    // 클라이언트별 합계
    const stats = new Map<number, { count: number; revenue: number }>()
    for (const t of txData ?? []) {
      const cid = t.client_id as number | null
      if (!cid) continue
      const cur = stats.get(cid) ?? { count: 0, revenue: 0 }
      cur.count++
      cur.revenue += Number(t.total_amount) || 0
      stats.set(cid, cur)
    }

    const clients: ClientWithStats[] = (clientsData ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      occupation: c.occupation,
      primary_division: c.primary_division,
      tier: c.tier,
      contact_person: c.contact_person,
      contact_phone: c.contact_phone,
      contact_email: c.contact_email,
      payment_terms_days: c.payment_terms_days,
      notes: c.notes,
      transaction_count: stats.get(c.id)?.count ?? 0,
      total_revenue: stats.get(c.id)?.revenue ?? 0,
    }))

    return { clients, error: null }
  } catch (e) {
    return { clients: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export default async function ClientsPage() {
  const { clients, error } = await loadClients()

  const totalClients = clients.length
  const mappedCount = clients.filter((c) => c.occupation && c.primary_division).length
  const mappingRatio = totalClients > 0 ? Math.round((mappedCount / totalClients) * 100) : 0

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
              v1.1 신규 · Phase 1.5
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">거래처 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            거래처를 24셀(직업군 × 제품군)에 정확히 매핑하면 매출 분해와 영업 전략이 의미 있어집니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
            <Users className="h-4 w-4 text-slate-500" />
            <div>
              <div className="font-semibold tabular-nums text-slate-700">{totalClients}건</div>
              <div className="text-[10px] text-slate-400">전체 거래처</div>
            </div>
          </div>
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
              mappingRatio >= 80
                ? 'border-emerald-200 bg-emerald-50'
                : mappingRatio >= 50
                ? 'border-amber-200 bg-amber-50'
                : 'border-rose-200 bg-rose-50'
            }`}
          >
            <Sparkles
              className={`h-4 w-4 ${
                mappingRatio >= 80 ? 'text-emerald-600' : mappingRatio >= 50 ? 'text-amber-600' : 'text-rose-500'
              }`}
            />
            <div>
              <div
                className={`font-semibold tabular-nums ${
                  mappingRatio >= 80
                    ? 'text-emerald-700'
                    : mappingRatio >= 50
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {mappingRatio}%
              </div>
              <div className="text-[10px] text-slate-500">24셀 매핑 완료</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent>
            <div className="flex items-start gap-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">거래처를 불러오지 못했습니다.</p>
                <p className="mt-1 text-xs text-rose-800">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ClientList clients={clients} />

      {/* 사용 안내 */}
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-sm">📌 매핑 가이드</CardTitle>
          <CardDescription className="text-xs">
            새 거래처는 일계표 업로드 시 자동 등록되고 기본값(인테리어 프로젝트 × 소파원단)으로
            시작합니다. 정확한 매핑은 이 페이지에서.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-600">
            <li>
              <strong>직업군</strong>: 거래처가 주로 어떤 일을 하는지 — 인테리어 프로젝트 / 브랜드 가구 / 프로젝트 가구 / 업소용 천갈이 / 커튼 스타일링 / 디스플레이
            </li>
            <li>
              <strong>주력 제품군</strong>: 그 거래처가 디안에서 가장 많이 사는 원단 — 소파원단 / 커튼원단 / 벽원단 / 소품원단
            </li>
            <li>
              <strong>등급</strong>: VIP / 일반 / 소형 / 성장 가능 / 비효율 — 매출 규모와 향후 잠재력에 따른 우선순위 분류
            </li>
            <li>
              <strong>결제 조건</strong>: 일반적인 외상 결제 일수 (예: 30일, 60일). 미수금 페이지의 위험 지수 계산에 사용됩니다.
            </li>
          </ul>
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
            ℹ️ 24셀 매핑을 변경하면 <strong>이후</strong> 거래부터 새 매핑이 적용됩니다.
            과거 거래의 매핑을 일괄 갱신하려면 별도 백필 스크립트가 필요합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
