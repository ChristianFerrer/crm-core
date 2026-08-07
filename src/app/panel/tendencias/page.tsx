import { createServerSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CustomizableDashboard } from '../CustomizableDashboard'
import { IngresosDelMes } from './IngresosDelMes'
import { revenue, delta, pendingRevenue, monthPeriod, lastYearPeriod } from '@/lib/metrics'
import { getT } from '@/lib/i18n-server'

export const revalidate = 0

/**
 * Tendencias: los gráficos de exploración, separados del Resumen.
 *
 * El Resumen es para decidir a diario; esto es para entender la evolución de
 * vez en cuando. Por eso vive aparte y aquí sí tiene sentido que el tablero
 * sea personalizable: quien entra a explorar quiere ordenar sus gráficos.
 */
export default async function TendenciasPage() {
  const t = await getT()
  const supabase = await createServerSupabase()
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const todayStr = now.toISOString().split('T')[0]
  const since7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
  since7.setHours(0, 0, 0, 0)

  const [
    { count: totalMembers },
    { count: todayCount },
    { count: monthCount },
    { data: recentVisits },
    { data: allMembers },
    { data: activeBonoMembers },
    { data: tenant },
    { data: visitTimes },
    { data: yearVisits },
    { data: cobros },
    { data: reservas },
    { data: bonos },
    { data: tiposBono },
    { data: cuentas },
  ] = await Promise.all([
    supabase.from('members').select('id', { count: 'exact', head: true }),
    supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', startOfDay),
    supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', startOfMonth),
    supabase.from('visits').select('checked_in_at, children_present').gte('checked_in_at', since7.toISOString()),
    supabase.from('members').select('id, created_at, children'),
    supabase.from('memberships').select('member_id, sessions_remaining').or('sessions_remaining.is.null,sessions_remaining.gt.0').gte('expires_at', todayStr),
    supabase.from('tenants').select('id, capacity').limit(1).single(),
    supabase.from('visits').select('checked_in_at').gte('checked_in_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()).limit(5000),
    supabase.from('visits').select('checked_in_at').gte('checked_in_at', new Date(now.getFullYear(), 0, 1).toISOString()).limit(20000),
    // ── Ingresos ──
    // Vivían en el Resumen y se han traído aquí: son la única cifra del panel
    // que depende de que el cobro se haya registrado en la aplicación, y una
    // cifra de caja equivocada en la pantalla de cada mañana arrastra la
    // credibilidad de todo lo demás. Aquí se entra a propósito y con aviso.
    supabase.from('visits')
      .select('id, member_id, checked_in_at, paid_at, paid_amount, adults_count, children_count')
      .gte('checked_in_at', new Date(now.getFullYear() - 1, now.getMonth() - 1, 1).toISOString())
      .limit(20000),
    supabase.from('bookings')
      .select('id, date, status, amount, deposit_amount, deposit_paid_at, payment_status')
      .gte('date', new Date(now.getFullYear() - 1, now.getMonth() - 1, 1).toISOString().split('T')[0])
      .limit(5000),
    supabase.from('memberships')
      .select('id, member_id, created_at, expires_at, sessions_remaining, membership_type_id')
      .limit(5000),
    supabase.from('membership_types').select('id, price'),
    supabase.from('open_checks').select('id, closed_at, products_cost').not('closed_at', 'is', null).limit(5000),
  ])

  // ── Ingresos del mes ───────────────────────────────────────────────────────
  const typePrices: Record<string, number> = Object.fromEntries(
    ((tiposBono ?? []) as any[]).map(x => [x.id, Number(x.price ?? 0)])
  )
  const vRows = (cobros ?? []) as any[]
  const bRows = (reservas ?? []) as any[]
  const mRows = (bonos ?? []) as any[]
  const cRows = (cuentas ?? []) as any[]

  const revActual = revenue(vRows, bRows, mRows, cRows, typePrices, monthPeriod(now))
  const revAnterior = revenue(vRows, bRows, mRows, cRows, typePrices, monthPeriod(now, -1))
  const revAnoPasado = revenue(vRows, bRows, mRows, cRows, typePrices, lastYearPeriod(now))

  const ingresos = {
    total: revActual.total,
    deltaMes: delta(revActual.total, revAnterior.total),
    deltaAno: delta(revActual.total, revAnoPasado.total),
    desglose: {
      visitas: revActual.visitas,
      consumos: revActual.consumos,
      adelantos: revActual.adelantos,
      bonos: revActual.bonos,
    },
    ticketMedio: revActual.ticketMedio,
    numVisitas: revActual.numVisitas,
    pendiente: pendingRevenue(bRows, monthPeriod(now)),
  }

  // ── Visitas por mes (todo el año) ──────────────────────────────────────────
  const visitsByMonth = Array(12).fill(0)
  ;(yearVisits ?? []).forEach((v: any) => {
    const d = new Date(v.checked_in_at)
    if (d.getFullYear() === now.getFullYear()) visitsByMonth[d.getMonth()]++
  })

  // ── Horas pico de visitas (últimos 30 días, hora local España) ─────────────
  const hourCounts = Array(24).fill(0)
  ;(visitTimes ?? []).forEach((v: any) => {
    const h = parseInt(new Date(v.checked_in_at).toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'Europe/Madrid' }))
    if (h >= 0 && h < 24) hourCounts[h % 24]++
  })
  const anyHour = hourCounts.findIndex(c => c > 0)
  let firstH = anyHour === -1 ? 8 : anyHour
  let lastH = anyHour === -1 ? 21 : (23 - [...hourCounts].reverse().findIndex(c => c > 0))
  firstH = Math.min(firstH, 8)
  lastH = Math.max(lastH, 21)
  const peakHourBuckets = Array.from({ length: lastH - firstH + 1 }, (_, i) => ({
    hour: `${firstH + i}h`,
    visitas: hourCounts[firstH + i],
  }))

  // ── Visitas de los últimos 7 días ──────────────────────────────────────────
  const DAY = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
  const buckets = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i))
    return { label: i === 6 ? 'Hoy' : DAY[d.getDay()], adultos: 0, ninos: 0, date: d.getTime() }
  })
  ;(recentVisits ?? []).forEach((row: any) => {
    const t2 = new Date(row.checked_in_at); t2.setHours(0, 0, 0, 0)
    const b = buckets.find(x => x.date === t2.getTime())
    if (b) {
      b.adultos++
      b.ninos += (row.children_present as any[])?.length ?? 0
    }
  })

  // ── Crecimiento de miembros (acumulado por mes) ────────────────────────────
  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString()
  const membersBeforeYear = (allMembers ?? []).filter((m: any) => m.created_at < startOfYear)
  const lastMonthAdults = membersBeforeYear.length
  const lastMonthChildren = membersBeforeYear.reduce((s: number, m: any) => s + ((m.children as any[])?.length ?? 0), 0)
  const newThisMonth = (allMembers ?? []).filter((m: any) => m.created_at >= startOfYear).length
  const monthlyAdults = Array(12).fill(0)
  const monthlyChildren = Array(12).fill(0)
  ;(allMembers ?? []).forEach((m: any) => {
    const d = new Date(m.created_at)
    if (d.getFullYear() === now.getFullYear()) {
      monthlyAdults[d.getMonth()]++
      monthlyChildren[d.getMonth()] += (m.children as any[])?.length ?? 0
    }
  })
  const currentMonth = now.getMonth()
  let runAdults = lastMonthAdults, runChildren = lastMonthChildren
  const growthBuckets = MONTHS.map((label, i) => {
    runAdults += monthlyAdults[i]; runChildren += monthlyChildren[i]
    return i <= currentMonth
      ? { label, adultos: runAdults, ninos: runChildren }
      : { label, adultos: null, ninos: null }
  })
  const visitsMonthBuckets = MONTHS.map((label, i) => ({ label, visitas: i <= currentMonth ? visitsByMonth[i] : null }))

  // ── Distribución de bonos ──────────────────────────────────────────────────
  const bonoByMember = new Map<string, number | null>()
  ;(activeBonoMembers ?? []).forEach((m: any) => {
    const existing = bonoByMember.get(m.member_id)
    const sessions: number | null = m.sessions_remaining
    if (existing === undefined) { bonoByMember.set(m.member_id, sessions) }
    else if (existing !== null && (sessions === null || sessions > existing)) { bonoByMember.set(m.member_id, sessions) }
  })
  let withFullBono = 0, withLowBono = 0
  bonoByMember.forEach(s => { if (s === null || s > 2) withFullBono++; else if (s > 0) withLowBono++ })
  const withoutBono = Math.max(0, (totalMembers ?? 0) - withFullBono - withLowBono)

  const capacity: number | null = (tenant as any)?.capacity ?? null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/panel"
          aria-label={t('panelres_titulo')}
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-line bg-surface2 text-fog hover:text-snow transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">{t('shared_nav_tendencias')}</h1>
          <p className="text-sm text-fog mt-0.5">{t('tendencias_subtitulo')}</p>
        </div>
      </div>

      <IngresosDelMes data={ingresos} />

      <CustomizableDashboard
        data={{
          stats: { totalMembers: totalMembers ?? 0, todayCount: todayCount ?? 0, monthCount: monthCount ?? 0 },
          growth: { data: growthBuckets, lastMonthAdults, lastMonthChildren, newThisMonth },
          bono: { withFullBono, withLowBono, withoutBono },
          visit7: { data: buckets, capacity },
          peak: { data: peakHourBuckets },
          visitsYear: { data: visitsMonthBuckets },
        }}
      />
    </div>
  )
}
