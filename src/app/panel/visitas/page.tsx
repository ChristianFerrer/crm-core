'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PanelNav } from '@/components/PanelNav'
import { memberMatchesQuery } from '@/lib/searchMembers'
import { Search, History } from 'lucide-react'

const FALLBACK_HOURLY_RATE = 5

type VisitType = 'entrada' | 'custodia'

type ServiceRates = {
  adult: number       // entrada adulto €/hora
  child: number       // entrada niño €/hora
  custodia: number    // custodia €/hora por niño
}

type HistoryVisit = {
  id: string
  checked_in_at: string
  checked_out_at: string | null
  membership_id: string | null
  visit_type: VisitType
  children_present: { name: string }[] | null
  paid_amount: number | null
  members: { id: string; name: string; phone: string | null } | null
}

function fmtDuration(minutes: number) {
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function fmtCost(cost: number) {
  return cost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function calcDurationMin(from: string, to?: string | null) {
  const end = to ? new Date(to).getTime() : Date.now()
  return Math.max(0, Math.floor((end - new Date(from).getTime()) / 60000))
}

function calcCost(minutes: number, numChildren: number, visitType: VisitType, rates: ServiceRates) {
  const fractions = Math.ceil(minutes / 60) // por hora o fracción
  if (visitType === 'custodia') {
    // Custodia: tarifa/hora × niños (el adulto acompañante no se cobra aparte)
    return fractions * rates.custodia * Math.max(1, numChildren)
  }
  // Entrada: adulto + cada niño, por hora o fracción
  return fractions * (rates.adult + numChildren * rates.child)
}

// Format a Date as YYYY-MM-DD in local time
function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Tab: Historial ──────────────────────────────────────────────────────────

function HistorialTab({ rates }: { rates: ServiceRates }) {
  const todayStr = toLocalDate(new Date())
  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo, setDateTo] = useState(todayStr)
  const [query, setQuery] = useState('')
  const [visits, setVisits] = useState<HistoryVisit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchVisits()
  }, [dateFrom, dateTo])

  async function fetchVisits() {
    setLoading(true)
    // Normaliza el rango (permite «desde» y «hasta» en cualquier orden)
    const lo = dateFrom <= dateTo ? dateFrom : dateTo
    const hi = dateFrom <= dateTo ? dateTo : dateFrom

    const { data } = await supabase
      .from('visits')
      .select('id, checked_in_at, checked_out_at, membership_id, visit_type, children_present, paid_amount, members(id, name, phone)')
      .gte('checked_in_at', `${lo}T00:00:00`)
      .lte('checked_in_at', `${hi}T23:59:59`)
      .order('checked_in_at', { ascending: false })

    setVisits((data as unknown as HistoryVisit[]) ?? [])
    setLoading(false)
  }

  const filteredVisits = query.trim().length > 0
    ? visits.filter(v => memberMatchesQuery(query, v.members ?? {}))
    : visits

  return (
    <div className="space-y-4">
      {/* Filtro de rango de fechas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">Desde</label>
          <input type="date" value={dateFrom} max={todayStr} onChange={e => setDateFrom(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className="w-full bg-surface2 border border-line rounded-xl px-4 py-2 text-sm text-snow outline-none focus:border-line2" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">Hasta</label>
          <input type="date" value={dateTo} max={todayStr} onChange={e => setDateTo(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className="w-full bg-surface2 border border-line rounded-xl px-4 py-2 text-sm text-snow outline-none focus:border-line2" />
        </div>
      </div>

      {/* Búsqueda por nombre o teléfono */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-10 pr-4 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors" />
      </div>

      {/* Visit count */}
      <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide">
        <History size={13} className="text-lime" />
        {loading ? 'Cargando...' : `${filteredVisits.length} visitas`}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-surface border border-line animate-pulse" />)}
        </div>
      ) : filteredVisits.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-mist">
          {query.trim().length > 0 ? 'Sin resultados para la búsqueda' : 'Sin visitas en este período'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredVisits.map(v => {
            const dmin = v.checked_out_at ? calcDurationMin(v.checked_in_at, v.checked_out_at) : null
            // Muestra el importe realmente cobrado si existe; si no, estima (solo visitas cerradas sin bono)
            const numChildren = Math.max(1, v.children_present?.length ?? 0)
            const estimated = (!v.membership_id && dmin != null) ? calcCost(Math.max(30, dmin), numChildren, v.visit_type, rates) : null
            const cost = v.paid_amount != null ? v.paid_amount : estimated
            const entryTime = new Date(v.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            const exitTime = v.checked_out_at ? new Date(v.checked_out_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null
            const dateStr = new Date(v.checked_in_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

            return (
              <div key={v.id} className="rounded-xl border border-line bg-surface px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-snow truncate">{v.members?.name ?? '—'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-mist capitalize">{dateStr} ·</span>
                    <span className="text-xs text-fog">{entryTime}{exitTime ? ` → ${exitTime}` : ' → en curso'}</span>
                    {dmin != null && <span className="text-xs text-mist">· {fmtDuration(dmin)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {v.paid_amount == null && v.membership_id ? (
                    <div>
                      <span className="text-xs text-iris font-medium">Bono</span>
                      {v.visit_type === 'custodia' && <p className="text-[10px] text-mint">Custodia</p>}
                    </div>
                  ) : cost != null ? (
                    <div>
                      <span className="text-xs font-bold text-lime">{fmtCost(cost)}</span>
                      {v.visit_type === 'custodia' && <p className="text-[10px] text-mint">Custodia</p>}
                    </div>
                  ) : (
                    <span className="text-xs text-amber">En curso</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function VisitasPage() {
  const [rates, setRates] = useState<ServiceRates>({ adult: FALLBACK_HOURLY_RATE, child: FALLBACK_HOURLY_RATE, custodia: FALLBACK_HOURLY_RATE })

  useEffect(() => {
    // Load service rates
    supabase
      .from('services')
      .select('name, category, price, price_unit')
      .in('category', ['entrada', 'custodia'])
      .eq('active', true)
      .then(({ data }) => {
        const rows = data ?? []
        const adult = rows.find(s => s.category === 'entrada' && /adulto/i.test(s.name))
        const child = rows.find(s => s.category === 'entrada' && /ni[ñn]/i.test(s.name))
        const custodiaHour = rows.find(s => s.category === 'custodia' && s.price_unit === 'hora')
        setRates({
          adult: adult?.price ?? FALLBACK_HOURLY_RATE,
          child: child?.price ?? FALLBACK_HOURLY_RATE,
          custodia: custodiaHour?.price ?? FALLBACK_HOURLY_RATE,
        })
      })
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">Histórico de visitas</h1>
        <p className="text-sm text-fog mt-0.5">Consulta el registro de entradas y salidas</p>
      </div>

      <PanelNav />

      <HistorialTab rates={rates} />
    </div>
  )
}
