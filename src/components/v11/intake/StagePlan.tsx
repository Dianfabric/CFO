'use client'
/**
 * Stage 3 — 기획 폼
 * 평가 결과를 바탕으로 타겟·전략·KPI 설정 → Stage 4 진입
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  Save,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { savePlan } from '@/app/finance/operations/intake/actions'
import type { Division, Occupation } from '@/lib/v11-intake/types'

interface ClientRow {
  id: number
  name: string
  occupation: string | null
  tier: string | null
}

interface SampleRow {
  id: number
  recommended_occupations: string[] | null
  division: string | null
  target_occupations: string[] | null
  target_divisions: string[] | null
  pricing_strategy: string | null
  marketing_angle: string | null
  priority_client_ids: number[] | null
  revenue_target_30d: number | null
  revenue_target_90d: number | null
}

const DIVISIONS: { key: Division; label: string }[] = [
  { key: 'sofa', label: '소파' },
  { key: 'curtain', label: '커튼' },
  { key: 'wall', label: '벽' },
  { key: 'accessory', label: '소품' },
]

const OCCUPATIONS: { key: Occupation; label: string }[] = [
  { key: 'interior_project', label: '인테리어 프로젝트' },
  { key: 'brand_furniture', label: '브랜드 가구' },
  { key: 'project_furniture', label: '프로젝트 가구' },
  { key: 'commercial_reupholster', label: '천갈이' },
  { key: 'curtain_styling', label: '커튼 스타일링' },
  { key: 'display', label: '디스플레이' },
]

interface Props {
  sample: SampleRow
  recommendedClients: ClientRow[]
  allClients: ClientRow[]
}

export default function StagePlan({ sample, recommendedClients, allClients }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [targetOccs, setTargetOccs] = useState<Occupation[]>(
    ((sample.target_occupations as Occupation[]) ??
      (sample.recommended_occupations as Occupation[]) ??
      []) as Occupation[],
  )
  const [targetDivs, setTargetDivs] = useState<Division[]>(
    ((sample.target_divisions as Division[]) ??
      (sample.division ? [sample.division as Division] : [])) as Division[],
  )
  const [pricing, setPricing] = useState(sample.pricing_strategy ?? '')
  const [angle, setAngle] = useState(sample.marketing_angle ?? '')
  const [clientIds, setClientIds] = useState<number[]>(
    (sample.priority_client_ids as number[]) ??
      recommendedClients.slice(0, 5).map((c) => c.id),
  )
  const [target30d, setTarget30d] = useState(sample.revenue_target_30d?.toString() ?? '')
  const [target90d, setTarget90d] = useState(sample.revenue_target_90d?.toString() ?? '')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [search, setSearch] = useState('')

  const toggleOcc = (k: Occupation) =>
    setTargetOccs((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
  const toggleDiv = (k: Division) =>
    setTargetDivs((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))

  const toggleClient = (id: number) =>
    setClientIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const filteredClients = allClients
    .filter((c) =>
      search ? c.name.toLowerCase().includes(search.toLowerCase()) : true,
    )
    .slice(0, 50)

  const selectedClients = allClients.filter((c) => clientIds.includes(c.id))

  const handleSubmit = (goNext: boolean) => {
    setMsg(null)
    if (targetOccs.length === 0) {
      setMsg({ ok: false, text: '타겟 직업군을 1개 이상 선택하세요.' })
      return
    }
    if (targetDivs.length === 0) {
      setMsg({ ok: false, text: '타겟 제품군을 1개 이상 선택하세요.' })
      return
    }
    if (clientIds.length === 0) {
      setMsg({ ok: false, text: '우선 거래처를 1곳 이상 선택하세요.' })
      return
    }

    startTransition(async () => {
      const res = await savePlan({
        sample_id: sample.id,
        target_occupations: targetOccs,
        target_divisions: targetDivs,
        pricing_strategy: pricing.trim() || undefined,
        marketing_angle: angle.trim() || undefined,
        priority_client_ids: clientIds,
        revenue_target_30d: target30d ? Number(target30d) : null,
        revenue_target_90d: target90d ? Number(target90d) : null,
        go_next: goNext,
      })
      setMsg({
        ok: res.ok,
        text: res.ok
          ? goNext
            ? '기획 저장 + Stage 4 (실행) 으로 이동...'
            : '기획 저장 완료'
          : res.error ?? '저장 실패',
      })
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-slate-900">Stage 3 · 기획</h3>

      <div>
        <Label className="text-xs">타겟 직업군 (다중 선택) *</Label>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OCCUPATIONS.map((o) => {
            const checked = targetOccs.includes(o.key)
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => toggleOcc(o.key)}
                className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                  checked
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {checked && '✓ '}
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <Label className="text-xs">타겟 제품군 (다중 선택) *</Label>
        <div className="mt-1 grid grid-cols-4 gap-2">
          {DIVISIONS.map((d) => {
            const checked = targetDivs.includes(d.key)
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDiv(d.key)}
                className={`rounded-md border py-2 text-xs font-medium transition ${
                  checked
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {checked && '✓ '}
                {d.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <Label className="text-xs">가격 전략 (한 줄)</Label>
        <Input
          value={pricing}
          onChange={(e) => setPricing(e.target.value)}
          placeholder="예: 프리미엄 포지션, 3개월 할인 금지"
        />
      </div>

      <div>
        <Label className="text-xs">마케팅 앵글 / 빅 아이디어 (한 줄)</Label>
        <Input
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          placeholder="예: 장인의 손으로 짠 침묵"
        />
      </div>

      <div>
        <Label className="text-xs">
          우선 거래처 (Top 5 자동 추천 + 직접 선택) *
        </Label>
        <div className="mt-1 space-y-2">
          {selectedClients.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs italic text-slate-400">
              아래 &quot;거래처 추가&quot; 버튼으로 선택하세요.
            </p>
          ) : (
            <ul className="space-y-1">
              {selectedClients.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5"
                >
                  <span className="text-xs">
                    <strong>{c.name}</strong>
                    {c.tier && (
                      <span className="ml-2 text-[10px] text-slate-500">
                        [{c.tier}]
                      </span>
                    )}
                    {c.occupation && (
                      <span className="ml-1 text-[10px] text-slate-500">
                        · {c.occupation}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleClient(c.id)}
                    className="text-[10px] text-rose-600 hover:underline"
                  >
                    제거
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setClientPickerOpen(!clientPickerOpen)}
            className="text-xs"
          >
            거래처 추가/검색 ({clientIds.length}곳 선택됨)
          </Button>

          {clientPickerOpen && (
            <Card>
              <CardContent className="py-3 space-y-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="거래처 검색..."
                  className="text-xs"
                />
                {recommendedClients.length > 0 && !search && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-amber-700">
                      ⭐ 추천 거래처 (24셀 매칭)
                    </p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {recommendedClients.map((c) => (
                        <li key={c.id}>
                          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50 text-xs">
                            <input
                              type="checkbox"
                              checked={clientIds.includes(c.id)}
                              onChange={() => toggleClient(c.id)}
                            />
                            <span className="flex-1">
                              <strong>{c.name}</strong>
                              <span className="ml-1 text-[10px] text-slate-500">
                                {c.tier ? `[${c.tier}] ` : ''}
                                {c.occupation ? `· ${c.occupation}` : ''}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500">
                    전체 거래처 ({filteredClients.length})
                  </p>
                  <ul className="space-y-1 max-h-60 overflow-y-auto">
                    {filteredClients.map((c) => (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50 text-xs">
                          <input
                            type="checkbox"
                            checked={clientIds.includes(c.id)}
                            onChange={() => toggleClient(c.id)}
                          />
                          <span className="flex-1">
                            <strong>{c.name}</strong>
                            <span className="ml-1 text-[10px] text-slate-500">
                              {c.tier ? `[${c.tier}] ` : ''}
                              {c.occupation ? `· ${c.occupation}` : ''}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">30일 매출 목표 (원)</Label>
          <Input
            type="number"
            value={target30d}
            onChange={(e) => setTarget30d(e.target.value)}
            placeholder="예: 5000000"
            step={100000}
          />
        </div>
        <div>
          <Label className="text-xs">90일 매출 목표 (원)</Label>
          <Input
            type="number"
            value={target90d}
            onChange={(e) => setTarget90d(e.target.value)}
            placeholder="예: 20000000"
            step={1000000}
          />
        </div>
      </div>

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
            msg.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSubmit(false)}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1 h-3.5 w-3.5" />
          )}
          저장만
        </Button>
        <Button onClick={() => handleSubmit(true)} disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="mr-1 h-3.5 w-3.5" />
          )}
          저장 + Stage 4 (실행) 으로 — 체크리스트 자동 생성
        </Button>
      </div>
    </div>
  )
}
