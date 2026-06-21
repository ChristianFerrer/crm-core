'use client'

import { useState } from 'react'
import { Gift, AlertTriangle, UserMinus, RefreshCw, WalletCards, ChevronDown, ChevronUp } from 'lucide-react'
import { BirthdayLeads } from './BirthdayLeads'
import { FollowUpSection, FollowUpItem } from './FollowUpSection'

type BirthdayLead = {
  id: string | null
  member_id: string
  member_name: string
  child_name: string
  child_birth_date: string
  year: number
  status: 'sin_contactar' | 'contactado' | 'reservado' | 'descartado'
  notes: string | null
  age: number
  birthday_day: number
}

type Section = 'cumpleanos' | 'bonos_bajos' | 'inactivos' | 'caducados' | 'sin_bono'

const SECTIONS: {
  id: Section
  label: string
  sub: string
  icon: React.ElementType
  accent: string
  iconColor: string
  bg: string
  border: string
}[] = [
  {
    id: 'cumpleanos',
    label: 'Cumpleaños',
    sub: 'este mes',
    icon: Gift,
    accent: 'text-iris',
    iconColor: 'text-iris',
    bg: 'bg-iris/10',
    border: 'border-iris/40',
  },
  {
    id: 'bonos_bajos',
    label: 'Bonos bajos',
    sub: '≤2 sesiones',
    icon: AlertTriangle,
    accent: 'text-amber',
    iconColor: 'text-amber',
    bg: 'bg-amber/10',
    border: 'border-amber/40',
  },
  {
    id: 'inactivos',
    label: 'Inactivos',
    sub: '+10 días sin visitar',
    icon: UserMinus,
    accent: 'text-rose',
    iconColor: 'text-rose',
    bg: 'bg-rose/10',
    border: 'border-rose/40',
  },
  {
    id: 'caducados',
    label: 'Bonos caducados',
    sub: 'sin renovar',
    icon: RefreshCw,
    accent: 'text-iris',
    iconColor: 'text-iris',
    bg: 'bg-iris/10',
    border: 'border-iris/40',
  },
  {
    id: 'sin_bono',
    label: 'Sin bono',
    sub: 'visitan este mes',
    icon: WalletCards,
    accent: 'text-lime',
    iconColor: 'text-lime',
    bg: 'bg-lime/10',
    border: 'border-lime/40',
  },
]

export function OpportunityDashboard({
  birthdayLeads,
  bonosBajosItems,
  inactivosItems,
  expiredBonosItems,
  sinBonoItems,
  tenantId,
}: {
  birthdayLeads: BirthdayLead[]
  bonosBajosItems: FollowUpItem[]
  inactivosItems: FollowUpItem[]
  expiredBonosItems: FollowUpItem[]
  sinBonoItems: FollowUpItem[]
  tenantId: string
}) {
  const [open, setOpen] = useState<Section | null>(null)

  const counts: Record<Section, number> = {
    cumpleanos: birthdayLeads.length,
    bonos_bajos: bonosBajosItems.length,
    inactivos: inactivosItems.length,
    caducados: expiredBonosItems.length,
    sin_bono: sinBonoItems.length,
  }

  const toggle = (id: Section) => setOpen(prev => prev === id ? null : id)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {SECTIONS.map(s => {
          const Icon = s.icon
          const isOpen = open === s.id
          const count = counts[s.id]
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`rounded-2xl border bg-surface p-4 text-left transition-all hover:border-line2 ${
                isOpen ? `${s.border} ring-1 ring-inset ${s.border}` : 'border-line'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <Icon size={18} className={s.iconColor} />
              </div>
              <div className={`font-display text-2xl font-semibold ${count > 0 ? s.accent : 'text-fog'}`}>
                {count}
              </div>
              <div className="text-xs font-semibold text-snow mt-0.5 leading-tight">{s.label}</div>
              <div className="text-xs text-mist mt-0.5">{s.sub}</div>
              <div className={`mt-2 flex items-center gap-1 text-xs ${isOpen ? s.accent : 'text-fog'}`}>
                {isOpen ? <><ChevronUp size={12} /> Cerrar</> : <><ChevronDown size={12} /> Ver detalle</>}
              </div>
            </button>
          )
        })}
      </div>

      {open === 'cumpleanos' && (
        <BirthdayLeads leads={birthdayLeads} tenantId={tenantId} />
      )}
      {open === 'bonos_bajos' && (
        <FollowUpSection
          title="Bonos a punto de agotarse"
          description="Contacta antes de que se queden sin sesiones y dejen de venir"
          icon="AlertTriangle"
          iconColor="text-amber"
          items={bonosBajosItems}
          tenantId={tenantId}
          emptyText="No hay bonos bajos en este momento"
        />
      )}
      {open === 'inactivos' && (
        <FollowUpSection
          title="Clientes inactivos"
          description="No han visitado en más de 10 días — recupera el hábito"
          icon="UserMinus"
          iconColor="text-rose"
          items={inactivosItems}
          tenantId={tenantId}
          emptyText="Todos los clientes han visitado recientemente"
        />
      )}
      {open === 'caducados' && (
        <FollowUpSection
          title="Bonos caducados sin renovar"
          description="El bono venció en los últimos 30 días — momento ideal para llamar"
          icon="RefreshCw"
          iconColor="text-iris"
          items={expiredBonosItems}
          tenantId={tenantId}
          emptyText="No hay bonos caducados sin renovar"
        />
      )}
      {open === 'sin_bono' && (
        <FollowUpSection
          title="Visitan sin bono activo"
          description="Clientes habituales que pagan al contado — candidatos a contratar bono"
          icon="WalletCards"
          iconColor="text-lime"
          items={sinBonoItems}
          tenantId={tenantId}
          emptyText="Todos los visitantes tienen bono activo"
        />
      )}
    </div>
  )
}
