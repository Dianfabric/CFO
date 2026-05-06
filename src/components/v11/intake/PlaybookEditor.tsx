'use client'
/**
 * 플레이북 편집기 (24셀 × 4티어)
 * 행: 직업군 × 제품군 (24개)
 * 열: 4티어
 * 셀 클릭 → 편집 다이얼로그 → 추천 액션 + 메모
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Save,
  Loader2,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { upsertPlaybook } from '@/app/finance/operations/intake/actions'
import type { Division, Occupation, Tier } from '@/lib/v11-intake/types'

interface PlaybookRow {
  id: number
  occupation: string
  division: string
  tier: string
  recommended_actions: string[]
  notes: string | null
  active: boolean
}

const OCCUPATIONS: { key: Occupation; label: string }[] = [
  { key: 'interior_project', label: '인테리어 프로젝트' },
  { key: 'brand_furniture', label: '브랜드 가구' },
  { key: 'project_furniture', label: '프로젝트 가구' },
  { key: 'commercial_reupholster', label: '천갈이' },
  { key: 'curtain_styling', label: '커튼 스타일링' },
  { key: 'display', label: '디스플레이' },
]

const DIVISIONS: { key: Division; label: string }[] = [
  { key: 'sofa', label: '소파' },
  { key: 'curtain', label: '커튼' },
  { key: 'wall', label: '벽' },
  { key: 'accessory', label: '소품' },
]

const TIERS: { key: Tier; label: string; bg: string }[] = [
  { key: 'value', label: '저가', bg: 'bg-blue-50' },
  { key: 'mid', label: '중가', bg: 'bg-slate-50' },
  { key: 'premium', label: '프리미엄', bg: 'bg-amber-50' },
  { key: 'luxury', label: '럭셔리', bg: 'bg-stone-100' },
]

interface Props {
  rows: PlaybookRow[]
}

export default function PlaybookEditor({ rows }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<{
    occupation: Occupation
    division: Division
    tier: Tier
    actions: string[]
    notes: string
  } | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const findRow = (occ: string, div: string, tier: string) =>
    rows.find((r) => r.occupation === occ && r.division === div && r.tier === tier)

  const startEdit = (occ: Occupation, div: Division, tier: Tier) => {
    const existing = findRow(occ, div, tier)
    setEditing({
      occupation: occ,
      division: div,
      tier,
      actions: existing?.recommended_actions ?? [''],
      notes: existing?.notes ?? '',
    })
  }

  const updateAction = (i: number, value: string) => {
    if (!editing) return
    setEditing({
      ...editing,
      actions: editing.actions.map((a, idx) => (idx === i ? value : a)),
    })
  }

  const addAction = () => {
    if (!editing) return
    setEditing({ ...editing, actions: [...editing.actions, ''] })
  }

  const removeAction = (i: number) => {
    if (!editing) return
    setEditing({
      ...editing,
      actions: editing.actions.filter((_, idx) => idx !== i),
    })
  }

  const handleSave = () => {
    if (!editing) return
    setMsg(null)
    const filteredActions = editing.actions.map((a) => a.trim()).filter(Boolean)
    startTransition(async () => {
      const res = await upsertPlaybook({
        occupation: editing.occupation,
        division: editing.division,
        tier: editing.tier,
        recommended_actions: filteredActions,
        notes: editing.notes.trim() || undefined,
      })
      setMsg({
        ok: res.ok,
        text: res.ok ? '저장 완료' : res.error ?? '저장 실패',
      })
      if (res.ok) {
        setEditing(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
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

      {/* 편집 다이얼로그 */}
      {editing && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {OCCUPATIONS.find((o) => o.key === editing.occupation)?.label} ×{' '}
                {DIVISIONS.find((d) => d.key === editing.division)?.label} ×{' '}
                {TIERS.find((t) => t.key === editing.tier)?.label}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(null)}
                className="h-7 px-2"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div>
              <Label className="text-xs">표준 추천 액션 (목록)</Label>
              <div className="mt-1 space-y-2">
                {editing.actions.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="mt-2 text-xs text-slate-400">{i + 1}.</span>
                    <Input
                      value={a}
                      onChange={(e) => updateAction(i, e.target.value)}
                      placeholder={`예: 디자이너 5명에게 우선 발송`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 shrink-0 px-0"
                      onClick={() => removeAction(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={addAction}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  액션 추가
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">메모 (왜 이 액션이 필요한지)</Label>
              <Textarea
                value={editing.notes}
                onChange={(e) =>
                  setEditing({ ...editing, notes: e.target.value })
                }
                rows={2}
                placeholder="예: 럭셔리 라인은 한정성·여백·스토리가 핵심"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm" disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1 h-3.5 w-3.5" />
                )}
                저장
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(null)}
              >
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 매트릭스 — 직업군 × 제품군 = 24행, 티어 = 4열 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white p-2 text-left font-semibold text-slate-700 border-b border-slate-200">
                직업군 × 제품군
              </th>
              {TIERS.map((t) => (
                <th
                  key={t.key}
                  className={`p-2 text-center font-semibold text-slate-700 border-b border-slate-200 ${t.bg}`}
                >
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OCCUPATIONS.map((occ) =>
              DIVISIONS.map((div) => (
                <tr key={`${occ.key}-${div.key}`}>
                  <td className="sticky left-0 bg-white p-2 border-b border-slate-100 align-top">
                    <p className="font-medium text-slate-800">{occ.label}</p>
                    <p className="text-[10px] text-slate-500">× {div.label}</p>
                  </td>
                  {TIERS.map((tier) => {
                    const row = findRow(occ.key, div.key, tier.key)
                    return (
                      <td
                        key={tier.key}
                        className={`p-1.5 border-b border-slate-100 align-top cursor-pointer hover:opacity-80 transition ${tier.bg}`}
                        onClick={() => startEdit(occ.key, div.key, tier.key)}
                      >
                        {row ? (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-emerald-700">
                              ✓ {row.recommended_actions.length}개 액션
                            </p>
                            {row.recommended_actions.slice(0, 2).map((a, i) => (
                              <p
                                key={i}
                                className="text-[10px] text-slate-600 line-clamp-1"
                              >
                                · {a}
                              </p>
                            ))}
                            {row.recommended_actions.length > 2 && (
                              <p className="text-[9px] text-slate-400">
                                + {row.recommended_actions.length - 2} 더
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] italic text-slate-400 text-center py-2">
                            + 추가
                          </p>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
