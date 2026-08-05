'use client'

import { useState } from 'react'
import { Gift, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

type Status = 'sin_contactar' | 'contactado' | 'reservado' | 'descartado'

type Lead = {
  id: string | null
  member_id: string
  member_name: string
  child_name: string
  child_birth_date: string
  year: number
  status: Status
  notes: string | null
  age: number
  birthday_day: number
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  sin_contactar: { label: 'Sin contactar', color: 'text-amber',  bg: 'bg-amber/15' },
  contactado:    { label: 'Contactado',    color: 'text-iris',   bg: 'bg-iris/15' },
  reservado:     { label: 'Reservado',     color: 'text-lime',   bg: 'bg-lime/15' },
  descartado:    { label: 'Descartado',    color: 'text-fog',    bg: 'bg-fog/15' },
}

const ALL_STATUSES: Status[] = ['sin_contactar', 'contactado', 'reservado', 'descartado']

export function BirthdayLeads({ leads: initialLeads, tenantId }: { leads: Lead[]; tenantId: string }) {
  const [leads, setLeads] = useState(initialLeads)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const toggle = (key: string) => setExpanded(prev => prev === key ? null : key)

  const updateStatus = async (lead: Lead, status: Status, notes: string) => {
    const key = `${lead.member_id}-${lead.child_name}`
    setSaving(key)
    const payload = {
      tenant_id: tenantId,
      member_id: lead.member_id,
      child_name: lead.child_name,
      child_birth_date: lead.child_birth_date,
      year: lead.year,
      status,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }
    if (lead.id) {
      await supabase.from('birthday_leads').update({ status, notes: notes || null, updated_at: payload.updated_at }).eq('id', lead.id)
    } else {
      const { data } = await supabase.from('birthday_leads').insert(payload).select('id').single()
      lead.id = data?.id ?? null
    }
    setLeads(prev => prev.map(l =>
      l.member_id === lead.member_id && l.child_name === lead.child_name
        ? { ...l, status, notes: notes || null, id: lead.id }
        : l
    ))
    setSaving(null)
    setExpanded(null)
    toast.success(`${lead.child_name} · estado actualizado`)
  }

  const pending = leads.filter(l => l.status === 'sin_contactar').length
  const reserved = leads.filter(l => l.status === 'reservado').length

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <Gift size={15} className="text-iris" />
          <p className="text-sm font-semibold text-snow">Cumpleaños este mes</p>
        </div>
        <div className="flex gap-2">
          {reserved > 0 && (
            <span className="text-xs font-bold text-lime">{reserved} reservados</span>
          )}
          {pending > 0 && (
            <span className="text-xs font-bold text-amber">{pending} sin contactar</span>
          )}
        </div>
      </div>
      <p className="text-xs text-mist mb-4">Niños de miembros que cumplen años este mes</p>

      {leads.length === 0 ? (
        <p className="text-sm text-mist text-center py-4">No hay cumpleaños registrados este mes</p>
      ) : (
        <div className="space-y-2">
          {leads.map(lead => {
            const key = `${lead.member_id}-${lead.child_name}`
            const cfg = STATUS_CONFIG[lead.status]
            const isOpen = expanded === key
            const isSaving = saving === key
            return (
              <div key={key} className="rounded-xl bg-surface2 overflow-hidden">
                <button
                  onClick={() => toggle(key)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-line transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col items-center justify-center w-8 h-8 rounded-lg bg-iris/15 shrink-0">
                      <span className="text-xs font-bold text-grape leading-none">{lead.birthday_day}</span>
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-snow truncate">{lead.child_name} · <span className="text-fog font-normal">{lead.age} años</span></p>
                      <p className="text-xs text-mist truncate">
                        {lead.member_name} · {new Date(lead.child_birth_date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    {isOpen ? <ChevronUp size={14} className="text-fog" /> : <ChevronDown size={14} className="text-fog" />}
                  </div>
                </button>

                {isOpen && (
                  <EditPanel
                    lead={lead}
                    onSave={updateStatus}
                    saving={isSaving}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EditPanel({ lead, onSave, saving }: {
  lead: Lead
  onSave: (lead: Lead, status: Status, notes: string) => void
  saving: boolean
}) {
  const [status, setStatus] = useState<Status>(lead.status)
  const [notes, setNotes] = useState(lead.notes ?? '')

  return (
    <div className="px-3 pb-3 border-t border-line pt-3 space-y-3">
      <div>
        <p className="text-xs text-mist mb-2">Estado de seguimiento</p>
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s]
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  status === s
                    ? `${cfg.bg} ${cfg.color} border-transparent`
                    : 'border-line text-fog hover:text-snow'
                }`}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="text-xs text-mist mb-1.5">Notas</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ej: Interesados, llamar la próxima semana..."
          rows={2}
          className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-snow placeholder:text-mist resize-none focus:outline-none focus:border-line2"
        />
      </div>
      <button
        onClick={() => onSave(lead, status, notes)}
        disabled={saving}
        className="w-full py-2 rounded-xl border border-lime bg-lime/10 text-lime text-sm font-semibold hover:bg-lime/20 transition-colors disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}
