'use client'

/** 샘플대여관리 공용 타입·헬퍼·소형 컴포넌트 */

export type BookRow = {
  id: string
  code: string
  brand: string | null
  book_type: string | null
  first_fabric: string | null
  manager: string | null
  barcode: string | null
  note: string | null
  rental_count: number
  image_url: string | null
  extra_image_urls: string[] | null
  status: '대여가능' | '대여중' | '연체중'
  overdue_days: number
  active_rental_id: string | null
  active_client_id: string | null
  active_client_name: string | null
  active_client_phone: string | null
  active_rented_at: string | null
  active_due_at: string | null
}

export type ClientRow = {
  id: string
  name: string
  phone: string | null
  email: string | null
  job_types: string[]
  note: string | null
  active?: number
  overdue?: number
}

export type RentalRow = {
  id: string
  book_id: string | null
  book_code: string | null
  client_name: string | null
  rented_at: string
  due_at: string
  returned_at: string | null
  manager?: string | null
  source: string
}

export const MANAGERS = ['유대현 과장', '팀장님', '부장님', '사장님', '조승경', '전새로미']

const MGR_COLORS: Record<string, [string, string]> = {
  '유대현 과장': ['rgba(8,145,178,.13)', '#0891B2'],
  '팀장님': ['rgba(37,99,235,.12)', '#2563EB'],
  '부장님': ['rgba(202,138,4,.14)', '#A16207'],
  '사장님': ['rgba(22,163,74,.13)', '#16A34A'],
  '조승경': ['rgba(124,58,237,.12)', '#7C3AED'],
  '전새로미': ['rgba(219,39,119,.12)', '#DB2777'],
}

export function MgrBadge({ m }: { m: string | null | undefined }) {
  if (!m) return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-400 whitespace-nowrap">담당 미지정</span>
  const [bg, fg] = MGR_COLORS[m] || ['#F1F5F9', '#64748B']
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ background: bg, color: fg }}>
      👤 {m}
    </span>
  )
}

export function StatusBadge({ status, od }: { status: string; od?: number }) {
  if (status === '대여가능') return <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700 whitespace-nowrap">대여가능</span>
  if (status === '대여중') return <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 whitespace-nowrap">대여중</span>
  return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600 whitespace-nowrap">🚨 연체{od ? ` ${od}일` : '중'}</span>
}

/** M/D 표기 */
export function fmtD(iso: string | null | undefined): string {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || `요청 실패 (${res.status})`)
  return json as T
}

/** 카메라/갤러리 이미지 → 1200px JPEG Blob (업로드 용량 절감) */
export async function resizeImage(file: Blob, maxW = 1200, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxW / bitmap.width)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))), 'image/jpeg', quality))
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

/** 샘플북 카드 (2열 규격: 사진 → 코드+담당자 → 첫원단명 → 브랜드 → 기간 → 상태) */
export function BookCard({ b, right, footer, onClick, selected }: {
  b: BookRow
  right?: React.ReactNode
  footer?: React.ReactNode
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`overflow-hidden rounded-xl border bg-white text-left transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${selected ? 'ring-2 ring-slate-900' : 'border-slate-200'}`}
    >
      <div className="relative aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-200">
        {b.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.image_url} alt={b.code} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">사진 없음</div>
        )}
        {right}
      </div>
      <div className="flex flex-col gap-1 p-2.5 text-[12.5px]">
        <div className="flex items-start justify-between gap-1">
          <span className="min-w-0 truncate font-mono font-bold">{b.code}</span>
          {b.active_rental_id ? (
            <div className="flex max-w-[62%] flex-col items-end gap-1">
              <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700" title={b.active_client_name || ''}>
                🏢 {b.active_client_name}
              </span>
              <MgrBadge m={b.manager} />
            </div>
          ) : null}
        </div>
        {b.first_fabric ? <span className="truncate font-semibold">{b.first_fabric}</span> : null}
        <span className="truncate text-slate-500">{b.brand}{b.book_type ? ` · ${b.book_type}` : ''}</span>
        {b.active_rented_at ? (
          <span className="text-slate-500">대여 {fmtD(b.active_rented_at)} ~ {fmtD(b.active_due_at)}</span>
        ) : null}
        <span><StatusBadge status={b.status} od={b.overdue_days} /></span>
        {footer}
      </div>
    </div>
  )
}
