'use client'

/**
 * 색동 신사업 비전·미션 — 사장님이 직접 작성·수정.
 * 보기 모드(줄바꿈 유지) ↔ 수정 모드(textarea) 토글. Supabase 저장.
 */
import { useState } from 'react'
import { Compass, Flag, Pencil, Check, X, Loader2 } from 'lucide-react'
import { upsertSaekdongVision } from './actions'

interface Props {
  initialVision: string | null
  initialMission: string | null
}

export default function SaekdongVision({ initialVision, initialMission }: Props) {
  const [vision, setVision] = useState(initialVision ?? '')
  const [mission, setMission] = useState(initialMission ?? '')
  const [editing, setEditing] = useState(false)
  const [draftVision, setDraftVision] = useState('')
  const [draftMission, setDraftMission] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    setDraftVision(vision)
    setDraftMission(mission)
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    const res = await upsertSaekdongVision({
      vision: draftVision.trim() || null,
      mission: draftMission.trim() || null,
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? '저장 실패')
      return
    }
    setVision(draftVision.trim())
    setMission(draftMission.trim())
    setEditing(false)
  }

  return (
    <div
      className="bg-white p-5 sm:p-6"
      style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px' }}
    >
      {/* 헤더 + 수정 버튼 */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--nv-primary)' }}
        >
          비전 · 미션
        </span>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="ml-auto h-7 px-2 text-[11px] font-bold inline-flex items-center gap-1 bg-white transition-colors"
            style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px', color: 'var(--nv-mute)' }}
          >
            <Pencil className="w-3 h-3" />
            수정
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-7 px-3 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
              style={{ backgroundColor: 'var(--nv-primary)', color: '#000', borderRadius: '2px' }}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              저장
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="h-7 px-2 text-[11px] font-bold inline-flex items-center gap-1 bg-white transition-colors"
              style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px', color: 'var(--nv-mute)' }}
            >
              <X className="w-3 h-3" />
              취소
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          className="mb-3 px-3 py-2 text-[12px]"
          style={{ border: '1px solid var(--nv-error)', backgroundColor: '#fef2f2', color: 'var(--nv-error)', borderRadius: '2px' }}
        >
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 비전 */}
        <Block
          icon={<Compass className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />}
          title="비전 (Vision)"
          subtitle="우리가 도달하려는 미래상"
          editing={editing}
          value={editing ? draftVision : vision}
          onChange={setDraftVision}
          placeholder="예) 한국 전통 색동을 세계 인테리어의 언어로 만든다."
        />
        {/* 미션 */}
        <Block
          icon={<Flag className="w-4 h-4" style={{ color: 'var(--nv-primary)' }} />}
          title="미션 (Mission)"
          subtitle="그 미래를 위해 매일 하는 일"
          editing={editing}
          value={editing ? draftMission : mission}
          onChange={setDraftMission}
          placeholder="예) 장인의 색동 원단을 합리적인 가격으로 전문가에게 전한다."
        />
      </div>
    </div>
  )
}

function Block({
  icon, title, subtitle, editing, value, onChange, placeholder,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  editing: boolean
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <h3 className="text-[13px] font-bold" style={{ color: 'var(--nv-ink)' }}>
          {title}
        </h3>
      </div>
      <p className="text-[11px] mb-2" style={{ color: 'var(--nv-stone)' }}>
        {subtitle}
      </p>
      {editing ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className="w-full resize-y p-3 text-[13px] leading-relaxed outline-none"
          style={{ border: '1px solid var(--nv-hairline)', borderRadius: '2px', color: 'var(--nv-ink)' }}
        />
      ) : value ? (
        <p
          className="text-[14px] leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--nv-ink)' }}
        >
          {value}
        </p>
      ) : (
        <p className="text-[13px] italic" style={{ color: 'var(--nv-stone)' }}>
          아직 작성되지 않았습니다. ‘수정’을 눌러 작성하세요.
        </p>
      )}
    </div>
  )
}
