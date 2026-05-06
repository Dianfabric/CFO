/**
 * PPT 빌더 — pptxgenjs 로 .pptx 파일 생성
 * - 디안 시각 정체성 자동 적용
 * - 티어별 레이아웃 분리
 */
import 'server-only'
import PptxGenJS from 'pptxgenjs'
import type { Slide, BrandIdentity, Tier } from './types'

interface BuildOptions {
  title: string
  slides: Slide[]
  brand?: BrandIdentity | null
  tier?: Tier
  productName?: string
  authorLabel?: string // 예: "디안 — 인테리어 원단 큐레이터"
}

const TIER_DEFAULTS: Record<Tier, { primary: string; bg: string; text: string; accent: string }> = {
  value: { primary: '2563EB', bg: 'FFFFFF', text: '1E293B', accent: 'F97316' },
  mid: { primary: '0F172A', bg: 'F8FAFC', text: '1E293B', accent: 'D97706' },
  premium: { primary: '78350F', bg: 'FEF6E9', text: '292524', accent: '92400E' },
  luxury: { primary: '0A0A0A', bg: '1A1A1A', text: 'FAFAFA', accent: 'A78B5F' },
}

function hexClean(c?: string | null): string | null {
  if (!c) return null
  return c.replace(/^#/, '').toUpperCase()
}

export function buildPptx(opts: BuildOptions): PptxGenJS {
  const tier: Tier = opts.tier ?? 'mid'
  const defaults = TIER_DEFAULTS[tier]
  const primary = hexClean(opts.brand?.visual_primary_color) ?? defaults.primary
  const accent = hexClean(opts.brand?.visual_accent_color) ?? defaults.accent
  const bg = tier === 'luxury' ? defaults.bg : 'FFFFFF'
  const text = tier === 'luxury' ? defaults.text : defaults.text
  const subtle = tier === 'luxury' ? '999999' : '64748B'

  const headingFont = opts.brand?.visual_font_heading ?? 'Pretendard'
  const bodyFont = opts.brand?.visual_font_body ?? 'Pretendard'

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches (16:9)
  pptx.author = opts.authorLabel ?? '디안 (Dian)'
  pptx.company = '디안 (Dian)'
  pptx.title = opts.title
  pptx.subject = opts.productName ?? '영업자료'

  // 마스터 — 공통 배경
  pptx.defineSlideMaster({
    title: 'DIAN_MASTER',
    background: { color: bg },
    objects: [
      // 좌하단 디안 로고 자리 (텍스트로 대체 — 로고 URL 있으면 추후)
      {
        text: {
          text: '디안 (Dian)',
          options: {
            x: 0.4,
            y: 7.0,
            w: 3.0,
            h: 0.3,
            fontFace: headingFont,
            fontSize: 9,
            color: subtle,
            bold: false,
          },
        },
      },
    ],
    slideNumber: { x: 12.6, y: 7.05, fontFace: bodyFont, fontSize: 9, color: subtle },
  })

  for (const s of opts.slides) {
    const slide = pptx.addSlide({ masterName: 'DIAN_MASTER' })
    renderSlide(slide, s, { primary, accent, text, subtle, bg, headingFont, bodyFont, tier })
  }

  return pptx
}

interface RenderCtx {
  primary: string
  accent: string
  text: string
  subtle: string
  bg: string
  headingFont: string
  bodyFont: string
  tier: Tier
}

function renderSlide(slide: PptxGenJS.Slide, s: Slide, ctx: RenderCtx) {
  const luxury = ctx.tier === 'luxury'

  switch (s.kind) {
    case 'cover': {
      // 표지 — 빅 비주얼 자리표시자 + 제품명
      slide.addShape('rect', {
        x: 0,
        y: 0,
        w: 13.33,
        h: 4.5,
        fill: { color: ctx.primary },
        line: { color: ctx.primary, width: 0 },
      })
      slide.addText(s.headline ?? '제품명', {
        x: 0.6,
        y: 4.7,
        w: 12.13,
        h: 1.2,
        fontFace: ctx.headingFont,
        fontSize: luxury ? 44 : 36,
        bold: !luxury,
        color: ctx.text,
      })
      if (s.subhead) {
        slide.addText(s.subhead, {
          x: 0.6,
          y: 5.95,
          w: 12.13,
          h: 0.6,
          fontFace: ctx.bodyFont,
          fontSize: 14,
          color: ctx.subtle,
          italic: luxury,
        })
      }
      slide.addText(`[ 비주얼: ${s.image_brief ?? '제품 빅 비주얼'} ]`, {
        x: 1.0,
        y: 1.5,
        w: 11.33,
        h: 1.5,
        fontFace: ctx.bodyFont,
        fontSize: 12,
        color: 'FFFFFF',
        align: 'center',
        italic: true,
      })
      break
    }

    case 'closing':
    case 'cta': {
      // CTA — 강한 마무리
      slide.addShape('rect', {
        x: 0,
        y: 0,
        w: 13.33,
        h: 7.5,
        fill: { color: ctx.primary },
        line: { color: ctx.primary, width: 0 },
      })
      slide.addText(s.headline ?? '함께 만들어가요', {
        x: 0.8,
        y: 2.5,
        w: 11.73,
        h: 1.5,
        fontFace: ctx.headingFont,
        fontSize: luxury ? 40 : 32,
        bold: !luxury,
        color: 'FFFFFF',
        align: 'center',
      })
      if (s.body) {
        slide.addText(s.body, {
          x: 1.5,
          y: 4.0,
          w: 10.33,
          h: 2,
          fontFace: ctx.bodyFont,
          fontSize: 16,
          color: 'FFFFFF',
          align: 'center',
        })
      }
      if (s.bullets?.length) {
        slide.addText(
          s.bullets.map((b) => ({ text: b, options: { bullet: true } })),
          {
            x: 4.0,
            y: 4.5,
            w: 5.33,
            h: 2.5,
            fontFace: ctx.bodyFont,
            fontSize: 14,
            color: 'FFFFFF',
          },
        )
      }
      break
    }

    default: {
      // 일반 슬라이드 — 헤드라인 + 이미지 자리 + 본문
      slide.addText(s.headline ?? '', {
        x: 0.6,
        y: 0.5,
        w: 12.13,
        h: 0.9,
        fontFace: ctx.headingFont,
        fontSize: 28,
        bold: !luxury,
        color: ctx.primary,
      })
      if (s.subhead) {
        slide.addText(s.subhead, {
          x: 0.6,
          y: 1.4,
          w: 12.13,
          h: 0.5,
          fontFace: ctx.bodyFont,
          fontSize: 14,
          color: ctx.subtle,
          italic: true,
        })
      }

      // 이미지 자리표시자 (좌측)
      slide.addShape('rect', {
        x: 0.6,
        y: 2.1,
        w: 6.0,
        h: 4.5,
        fill: { color: 'F1F5F9' },
        line: { color: ctx.subtle, width: 0.5, dashType: 'dash' },
      })
      slide.addText(`[ 이미지 ]\n${s.image_brief ?? ''}`, {
        x: 0.7,
        y: 2.2,
        w: 5.8,
        h: 4.3,
        fontFace: ctx.bodyFont,
        fontSize: 11,
        color: ctx.subtle,
        align: 'center',
        valign: 'middle',
        italic: true,
      })

      // 본문 (우측)
      let bodyY = 2.1
      if (s.body) {
        slide.addText(s.body, {
          x: 7.0,
          y: bodyY,
          w: 5.73,
          h: 2.0,
          fontFace: ctx.bodyFont,
          fontSize: 14,
          color: ctx.text,
        })
        bodyY += 2.1
      }
      if (s.bullets?.length) {
        slide.addText(
          s.bullets.map((b) => ({ text: b, options: { bullet: { type: 'bullet' } } })),
          {
            x: 7.0,
            y: bodyY,
            w: 5.73,
            h: Math.min(4.0, 6.6 - bodyY),
            fontFace: ctx.bodyFont,
            fontSize: 13,
            color: ctx.text,
            paraSpaceAfter: 6,
          },
        )
      }

      if (s.caption) {
        slide.addText(s.caption, {
          x: 0.6,
          y: 6.7,
          w: 12.13,
          h: 0.3,
          fontFace: ctx.bodyFont,
          fontSize: 10,
          color: ctx.subtle,
          italic: true,
          align: 'right',
        })
      }
      break
    }
  }
}

export async function buildPptxBuffer(opts: BuildOptions): Promise<Buffer> {
  const pptx = buildPptx(opts)
  // pptxgenjs에서 nodebuffer 출력
  const out = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
  return out
}
