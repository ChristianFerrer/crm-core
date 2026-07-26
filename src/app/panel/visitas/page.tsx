'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PanelNav } from '@/components/PanelNav'
import { memberMatchesQuery } from '@/lib/searchMembers'
import { resolveRates, calcHourlyCost, FALLBACK_RATE, type Rates } from '@/lib/pricing'
import { History } from 'lucide-react'
import { TableFilterBar } from '@/components/TableFilterBar'
import { DatePickerModal } from '@/components/DatePickerModal'

type VisitType = 'entrada' | 'custodia'

type ServiceRates = Rates

type HistoryVisit = {
  id: string
  checked_in_at: string
  checked_out_at: string | null
  membership_id: string | null
  visit_type: VisitType
  adults_count: number | null
  children_count: number | null
  children_present: { name: string }[] | null
  paid_amount: number | null
  payment_method: string | null
  members: { id: string; name: string; phone: string | null } | null
  memberships: { membership_types: { name: string } | null } | null
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

const calcCost = calcHourlyCost

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
  const [exporting, setExporting] = useState(false)

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
      .select('id, checked_in_at, checked_out_at, membership_id, visit_type, adults_count, children_count, children_present, paid_amount, payment_method, members(id, name, phone), memberships(membership_types(name))')
      .gte('checked_in_at', `${lo}T00:00:00`)
      .lte('checked_in_at', `${hi}T23:59:59`)
      .order('checked_in_at', { ascending: false })

    setVisits((data as unknown as HistoryVisit[]) ?? [])
    setLoading(false)
  }

  const filteredVisits = query.trim().length > 0
    ? visits.filter(v => memberMatchesQuery(query, v.members ?? {}))
    : visits

  function rowData(v: HistoryVisit) {
    const dmin = v.checked_out_at ? calcDurationMin(v.checked_in_at, v.checked_out_at) : null
    const numChildren = Math.max(1, v.children_present?.length ?? v.children_count ?? 0)
    const estimated = (!v.membership_id && dmin != null) ? calcCost(Math.max(30, dmin), numChildren, v.visit_type, rates) : null
    const cost = v.paid_amount != null ? v.paid_amount : estimated
    const entryTime = new Date(v.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    const exitTime = v.checked_out_at ? new Date(v.checked_out_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null
    const dateStr = new Date(v.checked_in_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const bonoName = v.membership_id ? (v.memberships?.membership_types?.name ?? 'Bono') : null
    const estado = v.paid_amount != null ? 'Cobrado' : bonoName ? 'Bono' : v.checked_out_at ? 'Pendiente' : 'En curso'
    return { dmin, entryTime, exitTime, dateStr, bonoName, estado, cost }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const rows = filteredVisits.map(v => {
        const { dmin, entryTime, exitTime, dateStr, bonoName, estado, cost } = rowData(v)
        return {
          'Fecha': dateStr,
          'Titular': v.members?.name ?? '—',
          'Teléfono': v.members?.phone ?? '',
          'Tipo': v.visit_type === 'custodia' ? 'Custodia' : 'Entrada libre',
          'Adultos': v.adults_count ?? '',
          'Niños': v.children_count ?? (v.children_present?.length ?? ''),
          'Hora entrada': entryTime,
          'Hora salida': exitTime ?? 'En curso',
          'Duración': dmin != null ? fmtDuration(dmin) : '',
          'Bono': bonoName ?? '',
          'Importe': cost != null ? cost : '',
          'Método de pago': v.payment_method ?? '',
          'Estado': estado,
        }
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [
        { wch: 11 }, { wch: 22 }, { wch: 14 }, { wch: 13 }, { wch: 8 }, { wch: 8 },
        { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 11 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Visitas')
      const suffix = dateFrom === dateTo ? dateFrom : `${dateFrom}_a_${dateTo}`
      XLSX.writeFile(wb, `historico-visitas_${suffix}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  const isDefaultRange = dateFrom === todayStr && dateTo === todayStr

  return (
    <div className="space-y-4">
      {/* Búsqueda + filtros (rango de fechas) + exportar */}
      <TableFilterBar
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Buscar por nombre o teléfono..."
        activeFilterCount={isDefaultRange ? 0 : 1}
        onExport={handleExport}
        exporting={exporting}
        exportDisabled={filteredVisits.length === 0}
        filters={
          <div>
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">Rango de fechas</p>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] text-mist mb-1">Desde</label>
                <DatePickerModal
                  title="Desde"
                  value={dateFrom}
                  onChange={v => setDateFrom(v > todayStr ? todayStr : v)}
                />
              </div>
              <div>
                <label className="block text-[10px] text-mist mb-1">Hasta</label>
                <DatePickerModal
                  title="Hasta"
                  value={dateTo}
                  onChange={v => setDateTo(v > todayStr ? todayStr : v)}
                />
              </div>
            </div>
          </div>
        }
      />

      {/* Visit count */}
      <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide">
        <History size={13} className="text-lime" />
        {loading ? 'Cargando...' : `${filteredVisits.length} visitas`}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-surface border border-line animate-pulse" />)}
        </div>
      ) : filteredVisits.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-mist">
          {query.trim().length > 0 ? 'Sin resultados para la búsqueda' : 'Sin visitas en este período'}
        </div>
      ) : (
        <>
          {/* ── MÓVIL/TABLET: tarjetas (< lg) ── */}
          <div className="lg:hidden space-y-2">
            {filteredVisits.map(v => {
              const { dmin, entryTime, exitTime, dateStr, bonoName, estado, cost } = rowData(v)
              const estadoCls = estado === 'Cobrado' ? 'text-lime' : estado === 'Bono' ? 'text-iris' : estado === 'En curso' ? 'text-amber' : 'text-rose'
              const numChildren = v.children_count ?? v.children_present?.length ?? 0
              return (
                <div key={v.id} className="rounded-xl border border-line bg-surface px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-snow truncate">{v.members?.name ?? '—'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-mist">{dateStr} ·</span>
                        <span className="text-xs text-fog">{entryTime}{exitTime ? ` → ${exitTime}` : ' → en curso'}</span>
                        {dmin != null && <span className="text-xs text-mist">· {fmtDuration(dmin)}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {cost != null && <p className="text-sm font-bold text-snow">{fmtCost(cost)}</p>}
                      <p className={`text-xs font-semibold ${estadoCls}`}>{estado}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px] text-mist">
                    <span>{v.visit_type === 'custodia' ? 'Custodia' : 'Entrada libre'}</span>
                    <span className="text-line2">·</span>
                    <span>{v.adults_count ?? 0} adulto{v.adults_count !== 1 ? 's' : ''}, {numChildren} niño{numChildren !== 1 ? 's' : ''}</span>
                    {v.members?.phone && <><span className="text-line2">·</span><span>{v.members.phone}</span></>}
                    {bonoName && <><span className="text-line2">·</span><span className="text-iris">{bonoName}</span></>}
                    {v.payment_method && <><span className="text-line2">·</span><span className="capitalize">{v.payment_method}</span></>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── ESCRITORIO: tabla (lg+) ── */}
          <div className="hidden lg:block rounded-2xl border border-line bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    {['Fecha', 'Titular', 'Teléfono', 'Tipo', 'Adultos', 'Niños', 'Entrada', 'Salida', 'Duración', 'Bono', 'Importe', 'Método', 'Estado'].map(col => (
                      <th key={col} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap text-mist first:pl-4 last:pr-4">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredVisits.map(v => {
                    const { dmin, entryTime, exitTime, dateStr, bonoName, estado, cost } = rowData(v)
                    const estadoCls = estado === 'Cobrado' ? 'text-lime' : estado === 'Bono' ? 'text-iris' : estado === 'En curso' ? 'text-amber' : 'text-rose'
                    return (
                      <tr key={v.id} className="hover:bg-surface2/40 transition-colors">
                        <td className="pl-4 pr-3 py-2.5 text-xs text-mist whitespace-nowrap">{dateStr}</td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-snow whitespace-nowrap">{v.members?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-mist whitespace-nowrap">{v.members?.phone ?? '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-fog whitespace-nowrap">{v.visit_type === 'custodia' ? 'Custodia' : 'Entrada libre'}</td>
                        <td className="px-3 py-2.5 text-xs text-fog whitespace-nowrap">{v.adults_count ?? '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-fog whitespace-nowrap">{v.children_count ?? v.children_present?.length ?? '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-fog whitespace-nowrap">{entryTime}</td>
                        <td className="px-3 py-2.5 text-xs text-fog whitespace-nowrap">{exitTime ?? '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-fog whitespace-nowrap">{dmin != null ? fmtDuration(dmin) : '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-iris whitespace-nowrap">{bonoName ?? '—'}</td>
                        <td className="px-3 py-2.5 text-xs font-bold text-snow whitespace-nowrap">{cost != null ? fmtCost(cost) : '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-fog whitespace-nowrap capitalize">{v.payment_method ?? '—'}</td>
                        <td className={`px-3 pr-4 py-2.5 text-xs font-semibold whitespace-nowrap ${estadoCls}`}>{estado}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function VisitasPage() {
  const [rates, setRates] = useState<ServiceRates>({ adult: FALLBACK_RATE, child: FALLBACK_RATE, custodia: FALLBACK_RATE })

  useEffect(() => {
    // Load service rates
    supabase
      .from('services')
      .select('name, price, price_unit, tipo, flujo')
      .eq('active', true)
      .then(({ data }) => setRates(resolveRates(data)))
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
