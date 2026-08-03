'use client'

import { useState, useRef, useEffect } from 'react'
import { Gift, AlertTriangle, UserMinus, RefreshCw, WalletCards, Crown, CalendarClock, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
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

type Top5Member = { id: string; name: string; count: number }

type Section = 'cumpleanos' | 'bonos_bajos' | 'bonos_semana' | 'inactivos' | 'caducados' | 'sin_bono' | 'top_activos'

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
    id: 'bonos_semana',
    label: 'Bonos vencen',
    sub: 'esta semana',
    icon: CalendarClock,
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
  {
    id: 'top_activos',
    label: 'Más activos',
    sub: 'este mes',
    icon: Crown,
    accent: 'text-lime',
    iconColor: 'text-lime',
    bg: 'bg-lime/10',
    border: 'border-lime/40',
  },
]

export function OpportunityDashboard({
  birthdayLeads,
  bonosBajosItems,
  bonosSemanaItems,
  inactivosItems,
  expiredBonosItems,
  sinBonoItems,
  top5,
  tenantId,
}: {
  birthdayLeads: BirthdayLead[]
  bonosBajosItems: FollowUpItem[]
  bonosSemanaItems: FollowUpItem[]
  inactivosItems: FollowUpItem[]
  expiredBonosItems: FollowUpItem[]
  sinBonoItems: FollowUpItem[]
  top5: Top5Member[]
  tenantId: string
}) {
  const [open, setOpen] = useState<Section | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [open])

  const counts: Record<Section, number> = {
    cumpleanos: birthdayLeads.length,
    bonos_bajos: bonosBajosItems.length,
    bonos_semana: bonosSemanaItems.length,
    inactivos: inactivosItems.length,
    caducados: expiredBonosItems.length,
    sin_bono: sinBonoItems.length,
    top_activos: top5.length,
  }

  const toggle = (id: Section) => setOpen(prev => prev === id ? null : id)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {SECTIONS.map(s => {
          const Icon = s.icon
          const isOpen = open === s.id
          const count = counts[s.id]
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`group rounded-2xl border bg-surface p-3 flex flex-col gap-2 text-left transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${
                isOpen
                  ? `${s.border} ring-1 ring-inset ${s.border} bg-surface2`
                  : 'border-line hover:border-line2 hover:bg-surface2'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-6 h-6 rounded-lg ${s.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <Icon size={12} className={s.iconColor} />
                </div>
                {isOpen
                  ? <ChevronUp size={10} className={s.accent} />
                  : <ChevronDown size={10} className="text-fog group-hover:text-snow transition-colors" />
                }
              </div>
              <div>
                <div className={`font-display text-3xl font-bold leading-none ${count > 0 ? s.accent : 'text-fog'}`}>
                  {count}
                </div>
                <div className="text-xs font-semibold text-snow mt-1 leading-tight">{s.label}</div>
                <div className="text-xs text-mist mt-0.5">{s.sub}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div ref={detailRef} />

      {open === 'cumpleanos' && (
        <BirthdayLeads leads={birthdayLeads} tenantId={tenantId} />
      )}
      {open === 'bonos_semana' && (
        <FollowUpSection
          title="Bonos que vencen esta semana"
          description="Contacta ahora para que renueven antes de quedarse sin bono"
          icon="AlertTriangle"
          iconColor="text-amber"
          items={bonosSemanaItems}
          tenantId={tenantId}
          emptyText="No hay bonos que venzan esta semana"
        />
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
          title="Miembros inactivos"
          description="No han visitado en más de 10 días — recupera el hábito"
          icon="UserMinus"
          iconColor="text-rose"
          items={inactivosItems}
          tenantId={tenantId}
          emptyText="Todos los miembros han visitado recientemente"
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
          description="Miembros habituales que pagan al contado — candidatos a contratar bono"
          icon="WalletCards"
          iconColor="text-lime"
          items={sinBonoItems}
          tenantId={tenantId}
          emptyText="Todos los visitantes tienen bono activo"
        />
      )}
      {open === 'top_activos' && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-snow mb-4">
            <Crown size={15} className="text-lime" /> Más activos este mes
          </div>
          {!top5.length ? (
            <p className="text-sm text-mist text-center py-4">Sin datos este mes</p>
          ) : (
            <div className="space-y-2">
              {top5.map((m, i) => (
                <a key={m.id} href={`/miembros/${m.id}`} className="flex items-center gap-3 rounded-xl bg-surface2 px-3 py-2.5 hover:bg-surface transition-colors">
                  <span className="w-6 h-6 rounded-full bg-lime border-2 border-surface2 flex items-center justify-center text-xs font-bold text-white shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm text-snow font-medium">{m.name}</span>
                  <span className="text-sm font-medium text-fog">{m.count} vis.</span>
                  <ChevronRight size={13} className="text-mist shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
