'use client'
/**
 * AI 콘텐츠 어시스턴트 (Phase 3.5 #2b ⑧)
 * Claude로 Hook·Story·Offer·CTA 후보 3개 생성.
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  ChevronLeft,
  Wand2,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react'
import { generateHSO, type HSOCandidate } from '@/app/finance/marketing/ai/actions'

const CHANNELS = [
  { value: 'instagram', label: '인스타그램 피드' },
  { value: 'instagram_reels', label: '인스타 릴스' },
  { value: 'blog', label: '블로그 포스트' },
  { value: 'youtube', label: '유튜브' },
  { value: 'newsletter', label: '뉴스레터' },
  { value: 'lookbook', label: '룩북' },
]

export default function AIAssistantPage() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState('instagram')
  const [topic, setTopic] = useState('')
  const [target, setTarget] = useState('')
  const [candidates, setCandidates] = useState<HSOCandidate[]>([])

  function handleGenerate() {
    if (!topic.trim()) {
      setError('주제·테마를 입력해 주세요.')
      return
    }
    setError(null)
    setCandidates([])
    startTransition(async () => {
      const res = await generateHSO({
        channel,
        topic: topic.trim(),
        target_segment: target.trim() || undefined,
      })
      if (!res.ok) {
        setError(res.error ?? '생성 실패')
        return
      }
      setCandidates(res.candidates ?? [])
    })
  }

  return (
    <div className="space-y-6">
      <Link
        href="/finance/marketing"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-3 w-3" />
        마케팅 허브
      </Link>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2b ⑧ AI 어시스턴트
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">AI 콘텐츠 어시스턴트</h1>
        <p className="mt-1 text-sm text-slate-500">
          Claude Sonnet 4.5가 디안 브랜드 정체성을 컨텍스트로 Hook·Story·Offer·CTA 후보 3가지를
          생성합니다.
        </p>
      </div>

      {/* 입력 폼 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">주제 입력</CardTitle>
          <CardDescription>
            브랜드 정체성(빅 아이디어·페르소나)이 자동으로 컨텍스트에 포함됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>채널·포맷</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v ?? 'instagram')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>타겟 (선택)</Label>
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="예: 30-45세 인테리어 디자이너"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>주제·테마 *</Label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder={`예: 봄 시즌 베이지 톤 큐레이션\n또는: 마틴데일 5만회 이상 내구성 강조 — 럭셔리 라인 신제품\n또는: 디자이너 협업 사례 — '카레클린트' 호텔 프로젝트`}
            />
          </div>

          <Button onClick={handleGenerate} disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Claude 생성 중... (10-15초)
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                <Sparkles className="mr-1 h-3 w-3" />
                3가지 후보 생성
              </>
            )}
          </Button>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 후보 결과 */}
      {candidates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">
            ✨ 생성된 후보 ({candidates.length}개)
          </h2>
          {candidates.map((c, i) => (
            <CandidateCard key={i} candidate={c} index={i + 1} />
          ))}
        </div>
      )}

      {/* 가이드 */}
      <Card className="border-amber-100 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="text-sm">📌 AI 어시스턴트 활용</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc space-y-1 text-xs text-slate-700">
            <li>
              먼저 <Link href="/finance/marketing/brand" className="text-blue-600 hover:underline">브랜드 정체성</Link>을
              채워야 AI가 디안 톤·페르소나를 반영합니다
            </li>
            <li>
              <strong>주제는 구체적으로</strong> — &quot;봄 베이지 큐레이션&quot;이 &quot;봄 콘텐츠&quot;보다 좋은 결과
            </li>
            <li>
              3가지 후보는 톤이 서로 다르게 (감성·논리·직설 등) — 디안에 맞는 것 선택
            </li>
            <li>
              마음에 드는 후보를{' '}
              <Link href="/finance/marketing/scripts" className="text-blue-600 hover:underline">HSO 라이브러리</Link>나{' '}
              <Link href="/finance/marketing/content" className="text-blue-600 hover:underline">콘텐츠 캘린더</Link>에 저장
            </li>
            <li>
              <strong>비용</strong>: 1회 생성 약 USD $0.03. 월 50회 사용 시 USD $1.5
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function CandidateCard({
  candidate,
  index,
}: {
  candidate: HSOCandidate
  index: number
}) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(label: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const fullText = `[Hook]\n${candidate.hook}\n\n[Story]\n${candidate.story}\n\n[Offer]\n${candidate.offer}\n\n[CTA]\n${candidate.cta}`

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            후보 {index} <span className="text-amber-600">· {candidate.tone_label}</span>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copy('full', fullText)}
            className="h-7 text-xs"
          >
            {copied === 'full' ? (
              <>
                <Check className="mr-1 h-3 w-3" />
                복사됨
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3" />
                전체 복사
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field
          label="🎣 Hook"
          color="text-amber-700"
          text={candidate.hook}
          onCopy={() => copy(`hook-${index}`, candidate.hook)}
          copied={copied === `hook-${index}`}
        />
        <Field
          label="📖 Story"
          color="text-purple-700"
          text={candidate.story}
          onCopy={() => copy(`story-${index}`, candidate.story)}
          copied={copied === `story-${index}`}
        />
        <Field
          label="💎 Offer"
          color="text-emerald-700"
          text={candidate.offer}
          onCopy={() => copy(`offer-${index}`, candidate.offer)}
          copied={copied === `offer-${index}`}
        />
        <Field
          label="📞 CTA"
          color="text-blue-700"
          text={candidate.cta}
          onCopy={() => copy(`cta-${index}`, candidate.cta)}
          copied={copied === `cta-${index}`}
        />
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  color,
  text,
  onCopy,
  copied,
}: {
  label: string
  color: string
  text: string
  onCopy: () => void
  copied: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className={`text-[10px] font-bold uppercase ${color}`}>{label}</div>
        <button
          type="button"
          onClick={onCopy}
          className="text-[10px] text-slate-400 hover:text-slate-700"
        >
          {copied ? '복사됨 ✓' : '복사'}
        </button>
      </div>
      <p className="mt-0.5 text-xs text-slate-700 whitespace-pre-wrap">{text}</p>
    </div>
  )
}
