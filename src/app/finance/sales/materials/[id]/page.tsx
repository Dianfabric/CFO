/**
 * 영업자료 결과 보기 (#9)
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  ChevronLeft,
  FileText,
  Video,
  Brain,
  History,
  Clock,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ResultActions from '@/components/v11/sales-materials/ResultActions'
import type { Slide, VideoScript } from '@/lib/v11-sales-materials/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TIER_BG: Record<string, string> = {
  value: 'bg-blue-50 border-blue-200',
  mid: 'bg-slate-50 border-slate-200',
  premium: 'bg-amber-50 border-amber-200',
  luxury: 'bg-stone-900 border-stone-700 text-stone-100',
}

async function loadData(id: number) {
  const supabase = await createClient()
  const [matQ, fwQ, versionsQ, assetsQ, clientQ] = await Promise.all([
    supabase.from('sales_materials').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('sales_psychology_frameworks')
      .select('key, name, summary')
      .eq('active', true),
    supabase
      .from('sales_material_versions')
      .select('id, version_number, framework_ids, created_at')
      .eq('material_id', id)
      .order('version_number', { ascending: false }),
    supabase
      .from('sales_material_uses_assets')
      .select(
        'asset_id, sales_material_assets(id, kind, title, source, external_url)',
      )
      .eq('material_id', id),
    Promise.resolve({ data: null }),
  ])

  if (!matQ.data) return null

  let client = null
  if (matQ.data.target_client_id) {
    const c = await supabase
      .from('clients')
      .select('id, name, tier, occupation')
      .eq('id', matQ.data.target_client_id)
      .maybeSingle()
    client = c.data
  }

  return {
    material: matQ.data,
    frameworks: fwQ.data ?? [],
    versions: versionsQ.data ?? [],
    assets: (assetsQ.data ?? [])
      .map((u) => u.sales_material_assets)
      .filter(Boolean) as unknown as Array<{
      id: number
      kind: string
      title: string | null
      source: string
      external_url: string | null
    }>,
    client,
  }
}

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numId = Number(id)
  if (Number.isNaN(numId)) notFound()

  const data = await loadData(numId)
  if (!data) notFound()
  const m = data.material

  const slides = (m.slides ?? []) as Slide[]
  const videoScripts = (m.video_scripts ?? []) as VideoScript[]
  const fwNameByKey = Object.fromEntries(
    data.frameworks.map((f) => [f.key, f.name]),
  )

  return (
    <div className="space-y-6">
      <Link
        href="/finance/sales/materials"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        영업자료 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #9 영업자료 · ID {m.id}
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <FileText className="h-5 w-5 text-slate-500" />
          {m.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          제품: <strong>{m.product_name_input}</strong>
          {data.client && (
            <>
              {' '}
              · 거래처: <strong>{data.client.name}</strong>
              {data.client.tier && ` [${data.client.tier}]`}
            </>
          )}
        </p>
      </div>

      {/* 메타 정보 */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] font-semibold uppercase text-slate-500">상태</p>
            <p className="mt-1 text-sm font-bold">
              {m.status === 'generating' && '⏳ 생성 중...'}
              {m.status === 'generated' && '✓ 생성 완료'}
              {m.status === 'published' && '📤 발송됨'}
              {m.status === 'failed' && '⚠ 실패'}
              {m.status === 'draft' && '— 초안'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] font-semibold uppercase text-slate-500">티어</p>
            <p className="mt-1 text-sm font-bold">{m.target_tier ?? '미지정'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] font-semibold uppercase text-slate-500">
              슬라이드 / 영상
            </p>
            <p className="mt-1 text-sm font-bold">
              {slides.length}장 · {(m.video_durations as number[])?.join('/')}초
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] font-semibold uppercase text-slate-500">생성일시</p>
            <p className="mt-1 text-sm font-bold">
              {new Date(m.created_at).toLocaleString('ko-KR', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 액션 버튼 */}
      <Card>
        <CardContent className="py-4">
          <ResultActions materialId={numId} status={m.status} />
        </CardContent>
      </Card>

      {m.status === 'generating' && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="py-4 text-center">
            <p className="text-sm text-amber-800">
              ⏳ Claude 가 자료를 생성 중입니다. 완료되면 페이지를 새로고침하세요.
            </p>
          </CardContent>
        </Card>
      )}

      {m.status === 'failed' && m.generation_error && (
        <Card className="border-rose-200 bg-rose-50/30">
          <CardContent className="py-3">
            <div className="flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="font-semibold">생성 실패</p>
                <p className="mt-1 font-mono text-[11px]">{m.generation_error}</p>
                <p className="mt-2 text-rose-700">
                  ※ 위 &quot;재생성&quot; 버튼을 눌러 다시 시도하세요.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 적용 프레임워크 */}
      {(m.framework_ids as string[])?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-slate-500" />
              적용된 프레임워크
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {(m.framework_ids as string[]).map((k) => (
                <li
                  key={k}
                  className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900"
                >
                  {fwNameByKey[k] ?? k}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 슬라이드 미리보기 */}
      {slides.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-slate-500" />
              슬라이드 미리보기 ({slides.length}장)
            </CardTitle>
            <CardDescription className="text-xs">
              실제 PPT 다운로드는 위 버튼 사용. 이 화면은 콘텐츠 검수용.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {slides.map((s, i) => (
                <li
                  key={i}
                  className={`rounded-lg border p-4 ${
                    TIER_BG[m.target_tier as string] ?? 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        m.target_tier === 'luxury'
                          ? 'bg-stone-700 text-stone-100'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] ${
                        m.target_tier === 'luxury'
                          ? 'bg-stone-800 text-stone-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.kind}
                    </span>
                  </div>
                  <h3
                    className={`mt-2 text-base font-bold ${
                      m.target_tier === 'luxury' ? 'text-stone-50' : 'text-slate-900'
                    }`}
                  >
                    {s.headline}
                  </h3>
                  {s.subhead && (
                    <p
                      className={`mt-1 text-sm italic ${
                        m.target_tier === 'luxury' ? 'text-stone-300' : 'text-slate-600'
                      }`}
                    >
                      {s.subhead}
                    </p>
                  )}
                  {s.body && (
                    <p
                      className={`mt-2 whitespace-pre-wrap text-sm ${
                        m.target_tier === 'luxury' ? 'text-stone-200' : 'text-slate-700'
                      }`}
                    >
                      {s.body}
                    </p>
                  )}
                  {s.bullets && s.bullets.length > 0 && (
                    <ul
                      className={`mt-2 list-disc pl-5 text-sm ${
                        m.target_tier === 'luxury' ? 'text-stone-200' : 'text-slate-700'
                      }`}
                    >
                      {s.bullets.map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {s.image_brief && (
                    <div
                      className={`mt-3 flex items-start gap-2 rounded-md border border-dashed p-2 text-xs italic ${
                        m.target_tier === 'luxury'
                          ? 'border-stone-700 text-stone-300'
                          : 'border-slate-300 bg-white/60 text-slate-500'
                      }`}
                    >
                      <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>이미지: {s.image_brief}</span>
                    </div>
                  )}
                  {s.caption && (
                    <p
                      className={`mt-2 text-right text-[10px] italic ${
                        m.target_tier === 'luxury' ? 'text-stone-400' : 'text-slate-500'
                      }`}
                    >
                      {s.caption}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* 영상 스크립트 */}
      {videoScripts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4 text-slate-500" />
              영상 스크립트 ({videoScripts.length}종)
            </CardTitle>
            <CardDescription className="text-xs">
              직원이 Canva·CapCut·Premiere 등에서 이 스크립트로 영상 제작
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {videoScripts.map((v, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    🎬 {v.duration_sec}초 버전
                  </h3>
                  {v.bgm_mood && (
                    <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-800">
                      🎵 {v.bgm_mood}
                    </span>
                  )}
                </div>
                <ol className="mt-3 space-y-2">
                  {v.cuts?.map((c, j) => (
                    <li
                      key={j}
                      className="rounded-md bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-white">
                          {c.time_range}s
                        </span>
                        {c.image_brief && (
                          <span className="text-slate-500 italic">
                            컷: {c.image_brief}
                          </span>
                        )}
                      </div>
                      {c.subtitle && (
                        <p className="mt-1 font-semibold text-slate-900">
                          자막: &quot;{c.subtitle}&quot;
                        </p>
                      )}
                      {c.voiceover && (
                        <p className="mt-1 text-slate-600">
                          🎤 내레이션: {c.voiceover}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
                {v.closing_text && (
                  <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-center text-sm font-bold text-amber-900">
                    ✨ {v.closing_text}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 사용한 자산 */}
      {data.assets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-slate-500" />
              참고한 자산 ({data.assets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs">
              {data.assets.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">
                    {a.kind}
                  </span>
                  <span className="text-[10px]">
                    {a.source === 'overseas' ? '🌍' : '🇰🇷'}
                  </span>
                  <span className="text-slate-700">{a.title ?? '(제목 없음)'}</span>
                  {a.external_url && (
                    <a
                      href={a.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 버전 히스토리 */}
      {data.versions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-slate-500" />
              버전 히스토리 ({data.versions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-200">
              {data.versions.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span className="font-semibold text-slate-700">
                      v{v.version_number}
                    </span>
                    <span className="text-slate-500">
                      프레임워크{' '}
                      {(v.framework_ids as string[])
                        .map((k) => fwNameByKey[k] ?? k)
                        .slice(0, 2)
                        .join(', ')}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(v.created_at).toLocaleString('ko-KR', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
