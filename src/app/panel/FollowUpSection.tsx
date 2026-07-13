'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, UserMinus, RefreshCw, WalletCards, Gift } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const ICONS = { AlertTriangle, UserMinus, RefreshCw, WalletCards, Gift } as const
type IconName = keyof typeof ICONS

export type FollowUpStatus = 'sin_contactar' | 'contactado' | 'convertido' | 'descartado'

export type FollowUpItem = {
  id: string | null
  member_id: string
  member_name: string
  family_name?: string | null
  type: string
  period: string
  status: FollowUpStatus
  notes: string | null
  meta: string   // line shown below the name (e.g. "2 sesiones restantes")
  metaColor?: string
}

const STATUS_CONFIG: Record<FollowUpStatus, { label: string; color: string; bg: string }> = {
  sin_contactar: { label: 'Sin contactar', color: 'text-amber', bg: 'bg-amber/15' },
  contactado:    { label: 'Contactado',    color: 'text-iris',  bg: 'bg-iris/15'  },
  convertido:    { label: 'Convertido',    color: 'text-lime',  bg: 'bg-lime/15'  },
  descartado:    { label: 'Descartado',    color: 'text-fog',   bg: 'bg-fog/15'   },
}

const ALL_STATUSES: FollowUpStatus[] = ['sin_contactar', 'contactado', 'convertido', 'descartado']

export function FollowUpSection({
  title, description, icon, iconColor, items: initialItems, tenantId, emptyText,
}: {
  title: string
  description: string
  icon: IconName
  iconColor: string
  items: FollowUpItem[]
  tenantId: string
  emptyText: string
}) {
  const [items, setItems] = useState(initialItems)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const toggle = (key: string) => setExpanded(p => p === key ? null : key)

  const updateStatus = async (item: FollowUpItem, status: FollowUpStatus, notes: string) => {
    const key = `${item.member_id}-${item.type}`
    setSaving(key)
    const payload = {
      tenant_id: tenantId,
      member_id: item.member_id,
      type: item.type,
      period: item.period,
      status,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }
    if (item.id) {
      await supabase.from('follow_up_leads').update({ status, notes: notes || null, updated_at: payload.updated_at }).eq('id', item.id)
    } else {
      const { data } = await supabase.from('follow_up_leads').insert(payload).select('id').single()
      item.id = data?.id ?? null
    }
    setItems(prev => prev.map(i =>
      i.member_id === item.member_id ? { ...i, status, notes: notes || null, id: item.id } : i
    ))
    setSaving(null)
    setExpanded(null)
    toast.success(`${item.member_name} · estado actualizado`)
  }

  const pending = items.filter(i => i.status === 'sin_contactar').length
  const converted = items.filter(i => i.status === 'convertido').length
  const Icon = ICONS[icon]

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon size={15} className={iconColor} />
          <p className="text-sm font-semibold text-snow">{title}</p>
        </div>
        <div className="flex gap-2">
          {converted > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-lime/15 text-lime">{converted} convertidos</span>}
          {pending > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber/15 text-amber">{pending} sin contactar</span>}
        </div>
      </div>
      <p className="text-xs text-mist mb-4">{description}</p>

      {items.length === 0 ? (
        <p className="text-sm text-mist text-center py-4">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const key = `${item.member_id}-${item.type}`
            const cfg = STATUS_CONFIG[item.status]
            const isOpen = expanded === key
            return (
              <div key={key} className="rounded-xl bg-surface2 overflow-hidden">
                <button
                  onClick={() => toggle(key)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-line transition-colors"
                >
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-snow truncate">{item.member_name}</p>
                    <p className={`text-xs truncate ${item.metaColor ?? 'text-mist'}`}>{item.meta}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    {isOpen ? <ChevronUp size={14} className="text-fog" /> : <ChevronDown size={14} className="text-fog" />}
                  </div>
                </button>
                {isOpen && (
                  <EditPanel item={item} onSave={updateStatus} saving={saving === key} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EditPanel({ item, onSave, saving }: {
  item: FollowUpItem
  onSave: (item: FollowUpItem, status: FollowUpStatus, notes: string) => void
  saving: boolean
}) {
  const [status, setStatus] = useState<FollowUpStatus>(item.status)
  const [notes, setNotes] = useState(item.notes ?? '')

  return (
    <div className="px-3 pb-3 border-t border-line pt-3 space-y-3">
      <div>
        <p className="text-xs text-mist mb-2">Estado de seguimiento</p>
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s]
            return (
              <button key={s} onClick={() => setStatus(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  status === s ? `${cfg.bg} ${cfg.color} border-transparent` : 'border-line text-fog hover:text-snow'
                }`}
              >{cfg.label}</button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="text-xs text-mist mb-1.5">Notas</p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Ej: Interesado, llamar el lunes..."
          rows={2}
          className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-snow placeholder:text-mist resize-none focus:outline-none focus:border-line2"
        />
      </div>
      <button onClick={() => onSave(item, status, notes)} disabled={saving}
        className="w-full py-2 rounded-xl border border-lime bg-lime/10 text-lime text-sm font-semibold hover:bg-lime/20 transition-colors disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}
