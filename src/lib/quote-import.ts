/**
 * 견적서 불러오기 공용 도구 — 대금 청구서·결과보고서가 함께 사용.
 * 견적서 생성기 .json 파싱과, 견적서 이미지를 AI 판독 API로 보내기 위한 base64 변환.
 */
import type { PaymentItem, VatMode } from '@/components/documents/PaymentRequestTable'

export interface ParsedQuote {
  items: PaymentItem[]
  vatMode: VatMode | null
  clientName: string
  siteName: string
  quoteDate: string
  notes: string[]
}

/** 견적서 JSON 텍스트 → 품목·수신처·현장명. 형식이 틀리면 JSON.parse 예외가 그대로 던져진다. */
export function parseQuoteJson(text: string): ParsedQuote {
  const parsed = JSON.parse(text) as Record<string, unknown>
  const data = (parsed.data ?? parsed) as Record<string, unknown>
  const qItems = Array.isArray(data.items) ? (data.items as Partial<PaymentItem>[]) : []
  const items: PaymentItem[] = qItems
    .map((it) => ({
      name: String(it.name ?? ''),
      color: String(it.color ?? ''),
      spec: String(it.spec ?? ''),
      qty: String(it.qty ?? ''),
      unit: String(it.unit ?? 'Y'),
      price: String(it.price ?? ''),
      remark: String(it.remark ?? ''),
    }))
    .filter((it) => it.name.trim() || it.qty.trim() || it.price.trim())
  return {
    items,
    vatMode: data.vatMode === 'incl' || data.vatMode === 'excl' ? data.vatMode : null,
    clientName: String(data.clientName ?? '').trim(),
    siteName: String(data.siteName ?? '').trim(),
    quoteDate: String(data.quoteDate ?? '').trim(),
    notes: Array.isArray(data.notes) ? data.notes.map((n) => String(n).trim()).filter(Boolean) : [],
  }
}

/** 견적서 이미지 → base64 (너무 크면 캔버스로 축소해 API 한도 내로) */
export async function imageToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const readAsDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(new Error('파일 읽기 실패'))
      r.readAsDataURL(blob)
    })

  const MAX_BYTES = 2_500_000
  const MAX_DIM = 2200
  let dataUrl: string
  if (file.size <= MAX_BYTES) {
    dataUrl = await readAsDataUrl(file)
    const bitmap = await createImageBitmap(file).catch(() => null)
    if (!bitmap || Math.max(bitmap.width, bitmap.height) <= MAX_DIM) {
      const [head, data] = dataUrl.split(',')
      const mediaType = head.match(/data:([^;]+)/)?.[1] ?? file.type
      return { data, mediaType }
    }
  }
  // 축소 경로
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스 생성 실패')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const scaled = canvas.toDataURL('image/jpeg', 0.92)
  return { data: scaled.split(',')[1], mediaType: 'image/jpeg' }
}
