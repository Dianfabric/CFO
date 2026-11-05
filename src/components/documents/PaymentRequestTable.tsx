'use client'

/**
 * 대금 청구서 품목 표 — 견적서에서 불러온 품목 + 공급가액/부가세/청구금액.
 * DocumentLayout 의 table 슬롯에 들어가는 공문용 표 (작성 폼·저장본 재현 공용).
 */

export interface PaymentItem {
  name: string
  color: string
  spec: string
  qty: string
  unit: string
  price: string
  remark: string
}

export type VatMode = 'excl' | 'incl' // excl: 단가가 VAT 별도 / incl: 단가가 VAT 포함

export function itemAmount(it: PaymentItem): number {
  const qty = Number(String(it.qty).replace(/,/g, '')) || 0
  const price = Number(String(it.price).replace(/,/g, '')) || 0
  return Math.round(qty * price)
}

/** 합계 계산 — 견적서 생성기와 동일 규칙 (excl: Σ=공급가액 / incl: Σ=합계) */
export function paymentTotals(items: PaymentItem[], vatMode: VatMode) {
  const sum = items.reduce((s, it) => s + itemAmount(it), 0)
  if (vatMode === 'excl') {
    const vat = Math.round(sum * 0.1)
    return { supply: sum, vat, grand: sum + vat }
  }
  const supply = Math.round(sum / 1.1)
  return { supply, vat: sum - supply, grand: sum }
}

/** 금액 → 한글 (일금 ...원정) */
export function numKor(n: number): string {
  if (n === 0) return '영원정'
  const d = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const u = ['', '만', '억', '조']
  let res = ''
  let ui = 0
  while (n > 0) {
    const ch = n % 10000
    if (ch) {
      let s = ''
      const t = Math.floor(ch / 1000)
      const h = Math.floor((ch % 1000) / 100)
      const ten = Math.floor((ch % 100) / 10)
      const one = ch % 10
      if (t) s += (t > 1 ? d[t] : '') + '천'
      if (h) s += (h > 1 ? d[h] : '') + '백'
      if (ten) s += (ten > 1 ? d[ten] : '') + '십'
      if (one) s += d[one]
      res = s + u[ui] + res
    }
    n = Math.floor(n / 10000)
    ui++
  }
  return res + '원정'
}

interface Props {
  items: PaymentItem[]
  vatMode: VatMode
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

export default function PaymentRequestTable({ items, vatMode }: Props) {
  const rows = items.filter((it) => it.name.trim() || itemAmount(it) > 0)
  const { supply, vat, grand } = paymentTotals(rows, vatMode)

  return (
    <div>
      {/* 청구금액 강조 줄 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          border: '1.5px solid #111',
          padding: '10px 14px',
          marginBottom: 12,
          background: '#fafafa',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: '#1a1a2e' }}>
          청 구 금 액
        </span>
        <span style={{ fontSize: 12, color: '#555' }}>
          一金 {numKor(grand).replace('원정', '')}원整 (₩{grand.toLocaleString('ko-KR')}, VAT 포함)
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 30 }}>NO</th>
            <th style={th}>품목</th>
            <th style={{ ...th, width: 86 }}>규격</th>
            <th style={{ ...th, width: 48 }}>수량</th>
            <th style={{ ...th, width: 42 }}>단위</th>
            <th style={{ ...th, width: 84 }}>단가</th>
            <th style={{ ...th, width: 92 }}>금액</th>
            <th style={{ ...th, width: 92 }}>비고</th>
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
              <td style={tdNum}>{(Number(String(it.price).replace(/,/g, '')) || 0).toLocaleString('ko-KR')}</td>
              <td style={tdNum}>{itemAmount(it).toLocaleString('ko-KR')}</td>
              <td style={{ ...td, fontSize: 11, color: '#555' }}>{it.remark}</td>
            </tr>
          ))}
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
              청 구 금 액 ( V A T 포 함 )
            </td>
            <td style={{ ...tdNum, fontWeight: 700, borderColor: '#111' }}>{grand.toLocaleString('ko-KR')}</td>
            <td style={td}></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
