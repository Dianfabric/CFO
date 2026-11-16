'use client'

/**
 * 납품 확인서 품목 표 + 인수 확인란 (대표 지시 2026-11-16)
 * 기본은 금액 없이 품목·수량만, showAmounts 로 단가·금액·합계까지 표시.
 * DocumentLayout 의 table 슬롯에 들어가는 공문용 표 (작성 폼·저장본 재현 공용).
 */
import {
  PaymentItem,
  VatMode,
  itemAmount,
  paymentTotals,
} from './PaymentRequestTable'

interface Props {
  items: PaymentItem[]
  vatMode: VatMode
  showAmounts: boolean
  /** 인수 확인 문구의 구분 (납품/설치) */
  completeKind?: string
}

const th: React.CSSProperties = {
  padding: '7px 6px',
  fontSize: 11.5,
  fontWeight: 700,
  color: '#1a1a2e',
  background: '#f4f5f7',
  border: '1px solid #c9cdd4',
  textAlign: 'center',
  letterSpacing: 1,
}

const td: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 12,
  color: '#222',
  border: '1px solid #d9dde3',
  textAlign: 'center',
}

const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

export default function DeliveryConfirmTable({ items, vatMode, showAmounts, completeKind }: Props) {
  const rows = items.filter((it) => it.name.trim() || it.qty.trim())
  const { supply, vat, grand } = paymentTotals(rows, vatMode)
  const kind = completeKind?.trim() || '납품'

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 30 }}>NO</th>
            <th style={th}>품목</th>
            <th style={{ ...th, width: 90 }}>규격</th>
            <th style={{ ...th, width: 56 }}>수량</th>
            <th style={{ ...th, width: 46 }}>단위</th>
            {showAmounts && <th style={{ ...th, width: 84 }}>단가</th>}
            {showAmounts && <th style={{ ...th, width: 92 }}>금액</th>}
            <th style={{ ...th, width: showAmounts ? 92 : 150 }}>비고</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it, i) => (
            <tr key={i}>
              <td style={td}>{i + 1}</td>
              <td style={{ ...td, textAlign: 'left' }}>
                {it.name}
                {it.color ? ` (${it.color})` : ''}
              </td>
              <td style={td}>{it.spec}</td>
              <td style={tdNum}>{it.qty}</td>
              <td style={td}>{it.unit}</td>
              {showAmounts && (
                <td style={tdNum}>{(Number(String(it.price).replace(/,/g, '')) || 0).toLocaleString('ko-KR')}</td>
              )}
              {showAmounts && <td style={tdNum}>{itemAmount(it).toLocaleString('ko-KR')}</td>}
              <td style={{ ...td, fontSize: 11, color: '#555' }}>{it.remark}</td>
            </tr>
          ))}
          {showAmounts && (
            <>
              <tr>
                <td colSpan={6} style={{ ...td, textAlign: 'right', paddingRight: 14, letterSpacing: 2, background: '#fafafa', fontWeight: 600 }}>
                  공 급 가 액
                </td>
                <td style={{ ...tdNum, fontWeight: 600 }}>{supply.toLocaleString('ko-KR')}</td>
                <td style={td}></td>
              </tr>
              <tr>
                <td colSpan={6} style={{ ...td, textAlign: 'right', paddingRight: 14, letterSpacing: 2, background: '#fcfcfc', color: '#666' }}>
                  부 가 세 ( 1 0 % )
                </td>
                <td style={{ ...tdNum, color: '#666' }}>{vat.toLocaleString('ko-KR')}</td>
                <td style={td}></td>
              </tr>
              <tr>
                <td colSpan={6} style={{ ...td, textAlign: 'right', paddingRight: 14, letterSpacing: 3, background: '#f4f5f7', fontWeight: 700 }}>
                  합 계 ( V A T 포 함 )
                </td>
                <td style={{ ...tdNum, fontWeight: 700, borderColor: '#111' }}>{grand.toLocaleString('ko-KR')}</td>
                <td style={td}></td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* 인수 확인란 — 거래처가 서명(날인)해 회신 */}
      <div style={{ marginTop: 18, border: '1.5px solid #111' }}>
        <div
          style={{
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 3,
            color: '#1a1a2e',
            background: '#f4f5f7',
            borderBottom: '1px solid #c9cdd4',
            textAlign: 'center',
          }}
        >
          인 수 확 인
        </div>
        <div style={{ padding: '12px 16px', fontSize: 12, color: '#222', lineHeight: 2 }}>
          <div>위와 같이 {kind} 완료되었음을 확인합니다.</div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 6 }}>
            <span>확인일자 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;년&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;일</span>
            <span>
              인수자 (소속/성명) : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <span style={{ color: '#666' }}>(서명 또는 인)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
