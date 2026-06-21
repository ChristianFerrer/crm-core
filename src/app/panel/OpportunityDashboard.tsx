'use client'

import { useState, useRef, useEffect } from 'react'
import { Gift, AlertTriangle, UserMinus, RefreshCw, WalletCards, Crown, ChevronDown, ChevronUp } from 'lucide-react'
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

type Top5Member = { name: string; count: number }

type Section = 'cumpleanos' | 'bonos_bajos' | 'inactivos' | 'caducados' | 'sin_bono' | 'top_activos'

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
  inactivosItems,
  expiredBonosItems,
  sinBonoItems,
  top5,
  tenantId,
}: {
  birthdayLeads: BirthdayLead[]
  bonosBajosItems: FollowUpItem[]
  inactivosItems: FollowUpItem[]
  expiredBonosItems: FollowUpItem[]
  sinBonoItems: FollowUpItem[]
  top5: Top5Member[]
  tenantId: string
}) {
  const [open, setOpen] = useState<Section | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [open])

  const counts: Record<Section, number> = {
    cumpleanos: birthdayLeads.length,
    bonos_bajos: bonosBajosItems.length,
    inactivos: inactivosItems.length,
    caducados: expiredBonosItems.length,
    sin_bono: sinBonoItems.length,
    top_activos: top5.length,
  }

  const toggle = (id: Section) => setOpen(prev => prev === id ? null : id)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {SECTIONS.map(s => {
          const Icon = s.icon
          const isOpen = open === s.id
          const count = counts[s.id]
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`aspect-square rounded-2xl border bg-surface p-3 grid grid-cols-2 grid-rows-2 text-left transition-all hover:border-line2 ${
                isOpen ? `${s.border} ring-1 ring-inset ${s.border}` : 'border-line'
              }`}
            >
              {/* Q1: icon */}
              <div className="flex items-start">
                <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon size={14} className={s.iconColor} />
                </div>
              </div>
              {/* Q2: number */}
              <div className="flex items-start justify-end">
                <span className={`font-display text-4xl font-bold leading-none ${count > 0 ? s.accent : 'text-fog'}`}>
                  {count}
                </span>
              </div>
              {/* Q3+Q4: label + sub */}
              <div className="col-span-2 flex flex-col justify-start pt-1">
                <div className="flex items-center gap-1">
                  {isOpen
                    ? <ChevronUp size={10} className={s.accent} />
                    : <ChevronDown size={10} className="text-fog" />
                  }
                  <span className="text-[11px] font-semibold text-snow leading-tight">{s.label}</span>
                </div>
                <div className="text-[10px] text-mist mt-0.5 pl-[14px]">{s.sub}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div ref={detailRef} />

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
                <div key={m.name} className="flex items-center gap-3 rounded-xl bg-surface2 px-3 py-2.5">
                  <span className="w-6 h-6 rounded-full bg-carbon border border-line flex items-center justify-center text-xs font-bold text-lime shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm text-snow font-medium">{m.name}</span>
                  <span className="text-sm font-semibold text-fog">{m.count} vis.</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
