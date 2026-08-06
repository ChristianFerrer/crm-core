import { createServerSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { LineChart } from 'lucide-react'
import { UrgentAlerts } from './UrgentAlerts'
import { PulseSection } from './PulseSection'
import { SegmentMap } from './SegmentMap'
import { ActionsSection } from './ActionsSection'
import { getT } from '@/lib/i18n-server'
import { revenue, delta, repeatRate, bonoRenewalRate, pendingRevenue, monthPeriod, lastYearPeriod } from '@/lib/metrics'
import { buildMemberStats, countBySegment, avgLtv } from '@/lib/segments'
import {
  suggestedActions, inicioSemana, proximaRevision, buildCaducados, buildSinBono,
  type BirthdayLead, type BonoLead, type ContactLog,
} from '@/lib/campaigns'

export const revalidate = 0



export default async function PanelPage() {
  const t = await getT()
  const supabase = await createServerSupabase()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const [
    { data: allMembers },
    { data: paidVisits },
    { data: allBookings },
    { data: allMemberships },
    { data: membershipTypes },
    { data: closedChecks },
    { data: membersForStats },
    { data: doneSends },
  ] = await Promise.all([
    supabase.from('members').select('id, name, created_at, children'),
    // ── Fase 1 y 2: dinero y segmentación ──
    // Historial de cobros y visitas de los últimos 14 meses: da para comparar
    // con el mismo mes del año pasado y para calcular el ritmo de cada familia.
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
    supabase.from('members').select('id, name, phone, created_at, families(name)').limit(5000),
    // Fase 3: lo ya contactado, para no volver a proponerlo
    supabase.from('campaign_sends')
      .select('member_id, estado, enviado_at, created_at, campaigns(plantilla)')
      .neq('estado', 'pendiente').limit(5000),
  ])

  // ── Fase 1: pulso económico del mes ───────────────────────────────────────
  const mesActual = monthPeriod(now)
  const mesAnterior = monthPeriod(now, -1)
  const mesAnoPasado = lastYearPeriod(now)

  const typePrices: Record<string, number> = Object.fromEntries(
    ((membershipTypes ?? []) as any[]).map(t => [t.id, Number(t.price ?? 0)])
  )
  const vRows = (paidVisits ?? []) as any[]
  const bRows = (allBookings ?? []) as any[]
  const mRows = (allMemberships ?? []) as any[]
  const cRows = (closedChecks ?? []) as any[]

  const revActual = revenue(vRows, bRows, mRows, cRows, typePrices, mesActual)
  const revAnterior = revenue(vRows, bRows, mRows, cRows, typePrices, mesAnterior)
  const revAnoPasado = revenue(vRows, bRows, mRows, cRows, typePrices, mesAnoPasado)

  const repeticion = repeatRate(vRows, now, 30)
  const renovacion = bonoRenewalRate(mRows, now, 30)
  const pendiente = pendingRevenue(bRows, mesActual)

  // ── Fase 2: segmentación por ritmo propio ─────────────────────────────────
  const memberStats = buildMemberStats((membersForStats ?? []) as any[], vRows, now)
  const segCounts = countBySegment(memberStats)
  const ltvMedio = avgLtv(memberStats)
  const familiasActivas = memberStats.filter(
    s => s.diasDesdeUltima != null && s.diasDesdeUltima <= 60
  ).length

  // ── Fase 3: qué hacer hoy ─────────────────────────────────────────────────
  const in45 = new Date(now.getTime() + 45 * 86_400_000)
  const accionBirthdays: BirthdayLead[] = []
  const vistosCumple = new Set<string>()
  ;((allMembers ?? []) as any[]).forEach((m: any) => {
    ;((m.children as any[]) ?? []).forEach((c: any) => {
      if (!c.birth_date) return
      const dob = new Date(c.birth_date)
      const next = new Date(now.getFullYear(), dob.getUTCMonth(), dob.getUTCDate())
      if (next < now) next.setFullYear(next.getFullYear() + 1)
      if (next > in45) return
      const key = `${m.id}-${c.name}`
      if (vistosCumple.has(key)) return
      vistosCumple.add(key)
      accionBirthdays.push({ member_id: m.id, member_name: m.name, child_name: c.name, birthday_day: dob.getUTCDate() })
    })
  })

  const nombrePorId = new Map(((membersForStats ?? []) as any[]).map(m => [m.id, m.name]))
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000).toISOString().split('T')[0]
  const accionBonos: BonoLead[] = mRows
    .filter(b => {
      const pocas = b.sessions_remaining != null && b.sessions_remaining <= 2 && b.sessions_remaining > 0
      const caduca = !!b.expires_at && b.expires_at >= todayStr && b.expires_at <= weekAhead
      return pocas || caduca
    })
    .map(b => ({
      member_id: b.member_id,
      member_name: nombrePorId.get(b.member_id) ?? '—',
      sessions: b.sessions_remaining,
      expires_at: b.expires_at,
    }))

  // Fecha del último contacto por plantilla y familia: cada campaña tiene su
  // ventana de reintento, así que no basta con saber SI se contactó.
  const contactLog: ContactLog = {}
  for (const s2 of ((doneSends ?? []) as any[])) {
    const key = `${s2.campaigns?.plantilla ?? ''}:${s2.member_id}`
    const fecha = s2.enviado_at ?? s2.created_at
    if (!fecha) continue
    if (!contactLog[key] || fecha > contactLog[key]) contactLog[key] = fecha
  }

  // Precio medio real de los bonos: valorar la renovación y el upsell con un
  // múltiplo inventado del ticket daba cifras que no eran de nadie.
  const preciosBono = ((membershipTypes ?? []) as any[])
    .map(t => Number(t.price ?? 0)).filter(p => p > 0)
  const precioBono = preciosBono.length
    ? preciosBono.reduce((s, p) => s + p, 0) / preciosBono.length
    : 0

  const miembrosBasicos = ((allMembers ?? []) as any[]).map(m => ({ id: m.id, name: m.name }))

  const acciones = suggestedActions({
    stats: memberStats,
    birthdays: accionBirthdays,
    bonos: accionBonos,
    caducados: buildCaducados(mRows, miembrosBasicos, now),
    sinBono: buildSinBono(mRows, vRows, miembrosBasicos, now),
    ticketMedio: revActual.ticketMedio || 12,
    precioCumple: 130,
    precioBono,
  }, contactLog, now)

  // Contexto de la revisión semanal
  const desdeLunes = inicioSemana(now)
  const contactadosEstaSemana = ((doneSends ?? []) as any[]).filter(s2 => {
    const f = s2.enviado_at ?? s2.created_at
    return f && new Date(f) >= desdeLunes
  }).length

  const pulse = {
    ingresos: revActual.total,
    ingresosDeltaMes: delta(revActual.total, revAnterior.total),
    ingresosDeltaAno: delta(revActual.total, revAnoPasado.total),
    desglose: {
      visitas: revActual.visitas,
      consumos: revActual.consumos,
      adelantos: revActual.adelantos,
      bonos: revActual.bonos,
    },
    ticketMedio: revActual.ticketMedio,
    numVisitas: revActual.numVisitas,
    repeticion: { rate: repeticion.rate, base: repeticion.base },
    renovacion: { rate: renovacion.rate, base: renovacion.base },
    pendiente,
    familiasActivas,
    enRiesgo: segCounts.en_riesgo,
  }

  // ── Alertas urgentes ───────────────────────────────────────────────────────
  // Lo que pasa hoy o mañana y no admite esperar a la revisión semanal.
  const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const nombreMiembro = new Map(((allMembers ?? []) as any[]).map(m => [m.id, m.name]))
  const urgentAlerts: { id: string; type: 'bono' | 'birthday'; message: string }[] = []

  for (const b of mRows) {
    const nombre = nombreMiembro.get(b.member_id)
    if (!nombre) continue
    if (b.sessions_remaining === 1) {
      urgentAlerts.push({
        id: `bono-1-${b.member_id}`,
        type: 'bono',
        message: t('panelres_alerta_bono_1', { name: nombre }),
      })
    }
    if (b.expires_at === todayStr || b.expires_at === tomorrowStr) {
      urgentAlerts.push({
        id: `caducado-${b.member_id}`,
        type: 'bono',
        message: b.expires_at === todayStr
          ? t('panelres_alerta_bono_caduca_hoy', { name: nombre })
          : t('panelres_alerta_bono_caduca_manana', { name: nombre }),
      })
    }
  }

  const cumplesVistos = new Set<string>()
  for (const m of ((allMembers ?? []) as any[])) {
    for (const c of ((m.children as any[]) ?? [])) {
      if (!c.birth_date) continue
      const dob = new Date(c.birth_date)
      const next = new Date(now.getFullYear(), dob.getUTCMonth(), dob.getUTCDate())
      if (next < now || next > in7days) continue
      const key = `${m.id}-${c.name}`
      if (cumplesVistos.has(key)) continue
      cumplesVistos.add(key)
      urgentAlerts.push({
        id: `bday-${key}`,
        type: 'birthday',
        message: t('panelres_alerta_cumple', {
          child: c.name,
          age: now.getFullYear() - dob.getUTCFullYear(),
          day: dob.getUTCDate(),
          member: m.name,
        }),
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">{t('panelres_titulo')}</h1>
          <p className="text-sm text-fog mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <UrgentAlerts alerts={urgentAlerts} />
      </div>

      {/* Los gráficos viven en Tendencias: aquí se decide, allí se explora */}
      <div className="flex justify-end -mt-2">
        <Link
          href="/panel/tendencias"
          className="flex items-center gap-1.5 text-xs font-semibold text-fog hover:text-snow transition-colors"
        >
          <LineChart size={13} /> {t('panelres_ver_tendencias')} →
        </Link>
      </div>


      {/* Fase 1: el dinero primero */}
      <PulseSection data={pulse} />

      {/* Fase 3: de aquí se sale contactando */}
      <ActionsSection
        actions={acciones}
        contactadosEstaSemana={contactadosEstaSemana}
        proximaRevision={proximaRevision(now).toISOString()}
      />

      {/* Fase 2: a quién tienes y qué hacer con cada grupo */}
      <SegmentMap stats={memberStats} avgLtv={ltvMedio} />
    </div>
  )
}
