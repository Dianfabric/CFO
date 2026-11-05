'use client'

/**
 * 납품·설치 결과보고서 — 공문 1쪽(DocumentLayout) + 현장 사진 붙임 쪽.
 *
 * 전체를 #document-print-area 로 감싸 기존 JPG·PDF·이미지 복사 경로를 그대로 쓴다.
 * 사진 쪽 높이를 A4(1123px)로 고정해 downloadPDF 의 자동 분할이 쪽 경계와 일치한다.
 * 작성 폼과 저장본 재현이 함께 사용.
 */
import DocumentLayout, { CompanyFooterInfo, DocumentHeaderInfo } from './DocumentLayout'
import PaymentRequestTable, { PaymentItem, VatMode } from './PaymentRequestTable'

export interface ReportPhoto {
  url: string
  title: string
  /** 줄바꿈으로 구분. '품목 : 복주머니 140ea' 처럼 쓰면 라벨·값으로 정렬된다 */
  detail: string
}

export const COVER_ELEMENT_ID = 'result-report-cover'
export const PAGE_HEIGHT = 1123
const PHOTOS_PER_PAGE = 3
const PHOTO_SIZE = 284

const FONT_FAMILY = '"Malgun Gothic", "맑은 고딕", -apple-system, BlinkMacSystemFont, sans-serif'

function PhotoDetail({ text }: { text: string }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid #111', paddingTop: 12 }}>
      {lines.map((line, i) => {
        const m = line.match(/^(.{1,6}?)\s*:\s*(.+)$/)
        return (
          <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12.5, lineHeight: 1.7, color: '#222', marginBottom: 6 }}>
            {m ? (
              <>
                <span style={{ width: 34, flexShrink: 0, color: '#777', fontWeight: 600 }}>{m[1]}</span>
                <span style={{ flex: 1 }}>{m[2]}</span>
              </>
            ) : (
              <span style={{ flex: 1 }}>{line}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface PhotoPageProps {
  photos: ReportPhoto[]
  firstNumber: number
  pageNumber: number
  totalPages: number
  documentNumber: string
  heading: string
  companyName: string
}

function PhotoPage({ photos, firstNumber, pageNumber, totalPages, documentNumber, heading, companyName }: PhotoPageProps) {
  return (
    <div
      style={{
        width: 794,
        height: PAGE_HEIGHT,
        boxSizing: 'border-box',
        padding: '56px 64px 40px 64px',
        background: '#ffffff',
        color: '#1a1a1a',
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        letterSpacing: '-0.01em',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: 1 }}>
          붙임. {heading}
        </div>
        <div style={{ fontSize: 11, color: '#666' }}>
          문서번호 : <span style={{ color: '#1a1a2e', fontWeight: 600, letterSpacing: 1 }}>{documentNumber}</span>
        </div>
      </div>
      <div style={{ borderBottom: '2px solid #111', marginTop: 10 }} />

      <div style={{ flex: 1 }}>
        {photos.map((photo, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 26,
              padding: '16px 0',
              borderBottom: i === photos.length - 1 ? 'none' : '1px solid #e3e5e9',
            }}
          >
            {/* html2canvas 가 object-fit 을 무시하므로 폼에서 정사각형으로 맞춘 사진만 들어온다 */}
            <img
              src={photo.url}
              alt={photo.title}
              style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, display: 'block', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 2 }}>
                사진 {String(firstNumber + i).padStart(2, '0')}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginTop: 4 }}>{photo.title}</div>
              <PhotoDetail text={photo.detail} />
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid #111',
          paddingTop: 8,
          fontSize: 10.5,
          color: '#666',
        }}
      >
        <span>{companyName}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pageNumber} / {totalPages}</span>
      </div>
    </div>
  )
}

interface Props {
  header: DocumentHeaderInfo
  body: string
  bodyLineHeight?: number
  items: PaymentItem[]
  vatMode: VatMode
  /** 완료 내용 — 예: '납품 및 디스플레이' */
  resultLabel: string
  notes?: string
  photos: ReportPhoto[]
  footer: CompanyFooterInfo
}

export default function ResultReportDocument({
  header,
  body,
  bodyLineHeight,
  items,
  vatMode,
  resultLabel,
  notes,
  photos,
  footer,
}: Props) {
  const filled = photos.filter((p) => p.url)
  const pages: ReportPhoto[][] = []
  for (let i = 0; i < filled.length; i += PHOTOS_PER_PAGE) {
    pages.push(filled.slice(i, i + PHOTOS_PER_PAGE))
  }

  return (
    <div id="document-print-area" style={{ width: 794, background: '#ffffff' }}>
      <DocumentLayout
        printId={COVER_ELEMENT_ID}
        compact
        header={header}
        body={body}
        bodyLineHeight={bodyLineHeight}
        table={
          <>
            <PaymentRequestTable items={items} vatMode={vatMode} report={{ result: `${resultLabel} 완료` }} />
            {notes?.trim() ? (
              <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.65, color: '#555', whiteSpace: 'pre-wrap' }}>
                {notes.trim()}
              </div>
            ) : null}
          </>
        }
        footer={footer}
      />
      {pages.map((pagePhotos, i) => (
        <PhotoPage
          key={i}
          photos={pagePhotos}
          firstNumber={i * PHOTOS_PER_PAGE + 1}
          pageNumber={i + 2}
          totalPages={pages.length + 1}
          documentNumber={header.documentNumber}
          heading={`${resultLabel} 현장 사진`}
          companyName={footer.name}
        />
      ))}
    </div>
  )
}
