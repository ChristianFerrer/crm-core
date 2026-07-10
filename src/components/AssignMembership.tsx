'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { CreditCard, Plus, X } from 'lucide-react'

type MembershipType = { id: string; name: string; sessions: number | null; price: number; validity_days: number }

export function AssignMembership({ memberId }: { memberId: string }) {
  const router = useRouter()
  const [types, setTypes] = useState<MembershipType[]>([])
  const [open, setOpen] = useState(false)
  const [selectedType, setSelectedType] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('membership_types').select('*').eq('active', true).order('price')
      .then(({ data }) => setTypes((data as MembershipType[]) ?? []))
  }, [])

  const type = types.find(t => t.id === selectedType)

  async function handleAssign() {
    if (!type) return
    setSaving(true)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + type.validity_days)

    await supabase.from('memberships').insert({
      member_id: memberId,
      membership_type_id: type.id,
      sessions_remaining: type.sessions,
      expires_at: expiresAt.toISOString().split('T')[0],
    })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line2 py-3 text-sm font-semibold text-fog hover:text-snow hover:border-lime/40 transition-colors"
      >
        <Plus size={15} /> Asignar bono
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-line2 bg-surface2 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
          <CreditCard size={12} /> Nuevo bono
        </p>
        <button onClick={() => setOpen(false)} className="text-mist hover:text-fog">
          <X size={14} />
        </button>
      </div>

      <select
        value={selectedType}
        onChange={e => setSelectedType(e.target.value)}
        className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm text-snow outline-none focus:border-line2"
      >
        <option value="">Selecciona un tipo de bono</option>
        {types.map(t => (
          <option key={t.id} value={t.id}>
            {t.name} — {t.sessions != null ? `${t.sessions} sesiones` : 'Ilimitado'} · {t.price}€ · {t.validity_days}d
          </option>
        ))}
      </select>

      {type && (
        <div className="rounded-lg bg-surface border border-line px-3 py-2 text-xs text-fog space-y-0.5">
          <p>Sesiones: <span className="text-snow font-semibold">{type.sessions ?? '∞ ilimitadas'}</span></p>
          <p>Precio: <span className="text-lime font-semibold">{type.price}€</span></p>
          <p>Validez: <span className="text-snow font-semibold">{type.validity_days} días</span></p>
        </div>
      )}

      <button
        onClick={handleAssign}
        disabled={!selectedType || saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-2.5 text-sm font-semibold text-ink disabled:opacity-50 hover:bg-lime-deep transition-colors"
      >
        {saving ? 'Asignando...' : 'Confirmar bono'}
      </button>
    </div>
  )
}
