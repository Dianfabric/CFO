'use client'

import { ReactNode } from 'react'

export interface DocumentHeaderInfo {
  documentNumber: string
  recipient: string
  ccLine?: string
  sender: string
  title: string
  issueDate?: string // YYYY. MM. DD.
}

export interface CompanyFooterInfo {
  name: string
  representative?: string | null
  businessNumber?: string | null
  address?: string | null
  phone?: string | null
  fax?: string | null
  email?: string | null
  website?: string | null
  logoPath?: string | null
  sealPath?: string | null
}

interface Props {
  header: DocumentHeaderInfo
  body: string // 본문 텍스트 (제목과 표 사이)
  bodyLineHeight?: number // 줄간격 (품목 수에 따라 자동 조정)
  table?: ReactNode // 표 (선택)
  footer: CompanyFooterInfo
}

/**
 * 미니멀 정장형 A4 공문 레이아웃.
 * 794px 너비 (A4 96dpi)로 고정. html2canvas 변환 시 그대로 PDF/JPG.
 */
export default function DocumentLayout({ header, body, bodyLineHeight = 1.9, table, footer }: Props) {
  const issueDate = header.issueDate || formatKoreanDate(new Date())
  const { mainBody, scheduleLines } = splitHighlightedSchedule(body)

  return (
    <div
      id="document-print-area"
      className="document-paper"
      style={{
        width: 794,
        minHeight: 1123,
        background: '#ffffff',
        color: '#1a1a1a',
        fontFamily: '"Malgun Gothic", "맑은 고딕", -apple-system, BlinkMacSystemFont, sans-serif',
        padding: '104px 64px 20px 64px',
        boxSizing: 'border-box',
        position: 'relative',
        fontSize: 13,
        lineHeight: 1.7,
        letterSpacing: '-0.01em',
        display: 'flex',
        flexDirection: 'column',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {/* ===== 상단 헤더 ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          {footer.logoPath ? (
            <img src={footer.logoPath} alt="logo" style={{ maxHeight: 56, maxWidth: 220, objectFit: 'contain' }} />
          ) : (
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 4, color: '#1a1a2e' }}>
              {footer.name || 'COMPANY'}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#666' }}>
          <div>문서번호 : <span style={{ color: '#1a1a2e', fontWeight: 600, letterSpacing: 1 }}>{header.documentNumber}</span></div>
          <div style={{ marginTop: 2 }}>발행일자 : {issueDate}</div>
        </div>
      </div>

      <div style={{ borderBottom: '2px solid #111', marginBottom: 16 }} />

      {/* ===== 수신/참조/발신 ===== */}
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 6 }}>
        <tbody>
          <tr>
            <td style={addressCellLabel}>수　　신</td>
            <td style={addressCellValue}>{header.recipient || '○○○ 귀하'}</td>
          </tr>
          {header.ccLine ? (
            <tr>
              <td style={addressCellLabel}>참　　조</td>
              <td style={addressCellValue}>{header.ccLine}</td>
            </tr>
          ) : null}
          <tr>
            <td style={addressCellLabel}>발　　신</td>
            <td style={addressCellValue}>{header.sender}</td>
          </tr>
        </tbody>
      </table>

      {/* ===== 제목 ===== */}
      <div style={{
        textAlign: 'center',
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: 6,
        padding: '18px 0 14px 0',
        borderTop: '1px solid #111',
        borderBottom: '1px solid #111',
        margin: '4px 0 22px 0',
        color: '#111',
      }}>
        {header.title || '제　목'}
      </div>

      {/* ===== 본문 (제목과 표 사이) ===== */}
      {mainBody ? (
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: bodyLineHeight, color: '#222', marginBottom: scheduleLines.length ? 22 : table ? 24 : 40 }}>
          {mainBody}
        </div>
      ) : null}

      {scheduleLines.length ? <ScheduleHighlightBox lines={scheduleLines} /> : null}

      {/* ===== 표 ===== */}
      {table ? (
        <div style={{ marginBottom: 32 }}>{table}</div>
      ) : null}

      {/* ===== 스페이서: 남은 공간을 채워 footer를 항상 하단으로 ===== */}
      <div style={{ flex: 1 }} />

      {/* ===== 하단 회사정보 + 직인 ===== */}
      <div style={{ paddingBottom: 80 }}>
        <div style={{ borderTop: '1px solid #111', paddingTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 11, color: '#444', lineHeight: 1.7 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', letterSpacing: 2, marginBottom: 4 }}>
              {footer.name}
            </div>
            {footer.representative && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                대표자 : {footer.representative}&nbsp;
                <span style={{ position: 'relative', display: 'inline-block', lineHeight: 1.4, overflow: 'visible' }}>
                  (인)
                  {footer.sealPath && (
                    <img
                      src={footer.sealPath}
                      alt="seal"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 40,
                        height: 40,
                        maxWidth: 'none',   /* Tailwind preflight 덮어쓰기 */
                        objectFit: 'contain',
                        opacity: 0.95,
                        mixBlendMode: 'multiply',
                        pointerEvents: 'none',
                        zIndex: 10,
                      }}
                    />
                  )}
                </span>
              </div>
            )}
            {footer.businessNumber && <div>사업자등록번호 : {footer.businessNumber}</div>}
            {footer.address && <div>주소 : {footer.address}</div>}
            <div>
              {footer.phone && <span>TEL {footer.phone}</span>}
              {footer.phone && footer.fax && <span>　/　</span>}
              {footer.fax && <span>FAX {footer.fax}</span>}
            </div>
            <div>
              {footer.email && <span>{footer.email}</span>}
              {footer.email && footer.website && <span>　/　</span>}
              {footer.website && <span>{footer.website}</span>}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

const addressCellLabel: React.CSSProperties = {
  width: 72,
  padding: '4px 0',
  fontSize: 12,
  color: '#666',
  fontWeight: 600,
  letterSpacing: 2,
  verticalAlign: 'top',
}

const addressCellValue: React.CSSProperties = {
  padding: '4px 0',
  fontSize: 13,
  color: '#222',
  fontWeight: 500,
}

function splitHighlightedSchedule(body: string) {
  const raw = body || ''
  const markerMatch = raw.match(/\n?\s*※\s*핵심\s*일정\s*\n?/)
  if (!markerMatch || markerMatch.index === undefined) {
    return { mainBody: raw, scheduleLines: [] as string[] }
  }

  const mainBody = raw.slice(0, markerMatch.index).trimEnd()
  const scheduleText = raw.slice(markerMatch.index + markerMatch[0].length).trim()
  const scheduleLines = scheduleText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return { mainBody, scheduleLines }
}

function ScheduleHighlightBox({ lines }: { lines: string[] }) {
  return (
    <div style={scheduleBoxStyle}>
      <div style={scheduleHeaderStyle}>
        <div>
          <div style={scheduleEyebrowStyle}>OFFICIAL NOTICE</div>
          <div style={scheduleTitleStyle}>핵심 일정 안내</div>
        </div>
        <div style={scheduleStampStyle}>DIAN</div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {lines.map((line, idx) => {
          const cleaned = line.replace(/^■\s*/, '')
          const [label, ...rest] = cleaned.split(':')
          const value = rest.join(':').trim()
          return (
            <div key={`${line}-${idx}`} style={scheduleRowStyle}>
              <div style={scheduleLabelStyle}>{label.trim()}</div>
              <div style={scheduleValueStyle}>{value || cleaned}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const scheduleBoxStyle: React.CSSProperties = {
  margin: '4px 0 36px 0',
  padding: '22px 24px 24px 24px',
  border: '1.5px solid #1f2a44',
  borderLeft: '8px solid #1f2a44',
  borderRadius: 4,
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.10)',
}

const scheduleHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  paddingBottom: 14,
  marginBottom: 14,
  borderBottom: '1px solid #cbd5e1',
}

const scheduleEyebrowStyle: React.CSSProperties = {
  marginBottom: 5,
  color: '#64748b',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 2.2,
}

const scheduleTitleStyle: React.CSSProperties = {
  fontSize: 21,
  lineHeight: 1.2,
  fontWeight: 800,
  color: '#0f172a',
  letterSpacing: 0.2,
}

const scheduleStampStyle: React.CSSProperties = {
  minWidth: 58,
  padding: '7px 9px',
  border: '1px solid #94a3b8',
  color: '#334155',
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 2,
}

const scheduleRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  alignItems: 'center',
  gap: 16,
  padding: '11px 0',
  borderBottom: '1px solid #e2e8f0',
}

const scheduleLabelStyle: React.CSSProperties = {
  color: '#475569',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.8,
}

const scheduleValueStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: 19,
  lineHeight: 1.25,
  fontWeight: 800,
  letterSpacing: -0.15,
}

function formatKoreanDate(d: Date) {
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}.`
}
