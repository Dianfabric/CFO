/**
 * 시각 정체성 PDF / 브랜드 가이드 (Phase 9 #2b)
 * brand_identity 데이터를 PDF로 출력하기 위한 프린트 미리보기
 */
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
  Sparkles,
  ChevronLeft,
  Download,
  FileText,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function loadData() {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('brand_identity')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    return { brand: data }
  } catch {
    return { brand: null }
  }
}

export default async function BrandPDFPage() {
  const { brand } = await loadData()

  return (
    <div className="space-y-6">
      <Link
        href="/finance/marketing"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 print:hidden"
      >
        <ChevronLeft className="h-3 w-3" />
        마케팅 허브
      </Link>

      <div className="print:hidden">
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            v1.1 · #2b 시각 정체성 PDF
          </span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <FileText className="h-5 w-5 text-slate-500" />
          브랜드 가이드 (인쇄용)
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          브랜드 정체성을 한 페이지로 정리한 인쇄용 가이드 — 외주·협업사에 공유
        </p>
      </div>

      <div className="flex gap-2 print:hidden">
        <Link
          href="/finance/marketing/brand"
          className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <FileText className="mr-1 h-3.5 w-3.5" />
          정체성 편집
        </Link>
        <Button variant="outline" size="sm" disabled>
          <Download className="mr-1 h-3.5 w-3.5" />
          PDF 자동 생성 (예정)
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/30 print:hidden">
        <CardContent className="py-3">
          <p className="text-xs text-amber-900">
            💡 <strong>현재는 브라우저 인쇄 기능 활용</strong>. Cmd/Ctrl + P → 대상: PDF로 저장
            → A4 권장. 자동 PDF 생성은 다음 단계 (puppeteer/pdfkit 통합).
          </p>
        </CardContent>
      </Card>

      {/* === 인쇄 대상 영역 === */}
      <div className="space-y-6 print:space-y-4 bg-white">
        {/* 표지 */}
        <Card className="print:break-inside-avoid">
          <CardContent className="py-12 text-center print:py-8">
            <div className="text-[10px] uppercase tracking-widest text-amber-600">
              디안 (Dian) — 브랜드 가이드
            </div>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">
              {brand?.big_idea ?? '빅 아이디어 미설정'}
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              {new Date().toLocaleDateString('ko-KR')} 기준
            </p>
          </CardContent>
        </Card>

        {/* 페르소나 */}
        <Card className="print:break-inside-avoid">
          <CardHeader>
            <CardTitle>1. 브랜드 페르소나</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Section label="페르소나" value={brand?.brand_persona} />
            <Section label="톤·매너" value={brand?.voice_tone} />
          </CardContent>
        </Card>

        {/* 스토리 */}
        <Card className="print:break-inside-avoid">
          <CardHeader>
            <CardTitle>2. 브랜드 스토리 3막</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Section label="기원 (Origin)" value={brand?.story_origin} />
            <Section label="사명 (Mission)" value={brand?.story_mission} />
            <Section label="비전 (Vision)" value={brand?.story_vision} />
          </CardContent>
        </Card>

        {/* 타겟 */}
        <Card className="print:break-inside-avoid">
          <CardHeader>
            <CardTitle>3. 타겟 페르소나</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Section label="1차 타겟" value={brand?.target_persona_primary} />
            <Section label="2차 타겟" value={brand?.target_persona_secondary} />
          </CardContent>
        </Card>

        {/* 시각 정체성 */}
        <Card className="print:break-inside-avoid">
          <CardHeader>
            <CardTitle>4. 시각 정체성</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {/* 컬러 팔레트 */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                컬러 팔레트
              </div>
              <div className="flex gap-3">
                {[
                  { label: '주', color: brand?.visual_primary_color },
                  { label: '보조', color: brand?.visual_secondary_color },
                  { label: '강조', color: brand?.visual_accent_color },
                ]
                  .filter((c) => c.color)
                  .map((c) => (
                    <div key={c.label} className="text-center">
                      <div
                        className="h-20 w-32 rounded-md border border-slate-200 print:border-slate-400"
                        style={{ backgroundColor: c.color! }}
                      />
                      <div className="mt-1 text-[10px] text-slate-600">
                        {c.label} · {c.color}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Section label="제목 폰트" value={brand?.visual_font_heading} />
              <Section label="본문 폰트" value={brand?.visual_font_body} />
            </div>

            <Section label="이미지 스타일" value={brand?.visual_image_style} />
          </CardContent>
        </Card>

        {/* 푸터 */}
        <Card className="print:break-inside-avoid">
          <CardContent className="py-3 text-center text-[11px] text-slate-500">
            디안 — 인테리어 원단 큐레이터 · v1.1 시스템 자동 생성
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Section({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <p
        className={`mt-1 ${
          value ? 'text-slate-700' : 'italic text-slate-400'
        }`}
      >
        {value ?? '미작성'}
      </p>
    </div>
  )
}
