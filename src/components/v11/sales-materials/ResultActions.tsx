'use client'
/**
 * 결과 페이지 — PPT 다운로드 + 재생성 + 삭제
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Download,
  RotateCw,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import {
  buildMaterialPptx,
  regenerateMaterial,
  deleteMaterial,
} from '@/app/finance/sales/materials/actions'

interface Props {
  materialId: number
  status: string
}

export default function ResultActions({ materialId, status }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [downloading, setDownloading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleDownload = () => {
    setMsg(null)
    setDownloading(true)
    ;(async () => {
      try {
        const res = await buildMaterialPptx(materialId)
        if (!res.ok || !res.base64 || !res.filename) {
          setMsg({ ok: false, text: res.error ?? 'PPT 생성 실패' })
          setDownloading(false)
          return
        }
        // base64 → Blob → 다운로드
        const binary = atob(res.base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes.buffer as ArrayBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = res.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setMsg({ ok: true, text: `${res.filename} 다운로드 완료` })
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
      } finally {
        setDownloading(false)
      }
    })()
  }

  const handleRegenerate = () => {
    setMsg(null)
    if (!confirm('현재 결과를 새 버전으로 재생성합니다. 기존 결과는 버전 히스토리에 남습니다. 계속할까요?')) return
    startTransition(async () => {
      const res = await regenerateMaterial({ material_id: materialId })
      setMsg({
        ok: res.ok,
        text: res.ok ? '재생성 완료' : res.error ?? '재생성 실패',
      })
      if (res.ok) router.refresh()
    })
  }

  const handleDelete = () => {
    if (!confirm('자료를 영구 삭제합니다. 되돌릴 수 없습니다. 계속할까요?')) return
    startTransition(async () => {
      const res = await deleteMaterial(materialId)
      if (res.ok) router.push('/finance/sales/materials')
      else setMsg({ ok: false, text: res.error ?? '삭제 실패' })
    })
  }

  const canDownload = status === 'generated' || status === 'published'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleDownload} disabled={!canDownload || downloading} size="sm">
          {downloading ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1 h-3.5 w-3.5" />
          )}
          PPT 다운로드 (.pptx)
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={pending || downloading}
        >
          {pending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCw className="mr-1 h-3.5 w-3.5" />
          )}
          재생성
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={pending}
          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          삭제
        </Button>
      </div>

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
            msg.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  )
}
