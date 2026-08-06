import { createServerSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { Users, TrendingUp, BarChart2, Tag, Building2, LineChart } from 'lucide-react'
import { FollowUpItem } from './FollowUpSection'
import { OpportunityDashboard } from './OpportunityDashboard'
import { UrgentAlerts } from './UrgentAlerts'
import { PulseSection } from './PulseSection'
import { SegmentMap } from './SegmentMap'
import { ActionsSection } from './ActionsSection'
import { getT } from '@/lib/i18n-server'
import { revenue, delta, repeatRate, bonoRenewalRate, pendingRevenue, monthPeriod, lastYearPeriod } from '@/lib/metrics'
import { buildMemberStats, countBySegment, avgLtv } from '@/lib/segments'
import { suggestedActions, inicioSemana, proximaRevision, type BirthdayLead, type BonoLead, type ContactLog } from '@/lib/campaigns'

export const revalidate = 0



export default async function PanelPage() {
  const t = await getT()
  const supabase = await createServerSupabase()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const since7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
  since7.setHours(0, 0, 0, 0)
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const recentVisitedIds = (await supabase.from('visits').select('member_id').gte('checked_in_at', tenDaysAgo)).data?.map(v => v.member_id) ?? []

  const [
    { count: totalMembers },
    { count: expiringCount },
    { data: atRiskMembers },
    { data: topVisits },
    { data: lowBonoMembers },
    { data: allMembers },
    { data: tenant },
    { data: birthdayLeadsData },
    { data: expiredBonos },
    { data: followUpLeadsData },
    { data: monthVisits },
    { data: bonosSemanaRaw },
    { data: paidVisits },
    { data: allBookings },
    { data: allMemberships },
    { data: membershipTypes },
    { data: closedChecks },
    { data: membersForStats },
    { data: doneSends },
  ] = await Promise.all([
    supabase.from('members').select('id', { count: 'exact', head: true }),
    supabase.from('memberships').select('id', { count: 'exact', head: true }).lte('sessions_remaining', 2).not('sessions_remaining', 'is', null),
    recentVisitedIds.length > 0
      ? supabase.from('members').select('id, name, families(name)').not('id', 'in', `(${recentVisitedIds.map(id => `"${id}"`).join(',')})`).limit(5)
      : supabase.from('members').select('id, name, families(name)').limit(5),
    supabase.from('visits').select('member_id, members(name)').gte('checked_in_at', startOfMonth).limit(200),
    supabase.from('memberships').select('id, sessions_remaining, membership_types(name), members(id, name, families(name))').lte('sessions_remaining', 2).not('sessions_remaining', 'is', null).limit(10),
    supabase.from('members').select('id, name, created_at, children'),
    supabase.from('tenants').select('id, capacity').limit(1).single(),
    supabase.from('birthday_leads').select('*').eq('year', now.getFullYear()),
    supabase.from('memberships').select('member_id, expires_at, membership_types(name), members(id, name)').lt('expires_at', todayStr).gte('expires_at', thirtyDaysAgo).limit(20),
    supabase.from('follow_up_leads').select('*').eq('period', currentPeriod),
    supabase.from('visits').select('member_id').gte('checked_in_at', startOfMonth).limit(500),
    supabase.from('memberships').select('member_id, expires_at, membership_types(name), members(id, name)').gte('expires_at', todayStr).lte('expires_at', weekFromNow).limit(20),
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
  ;((membersForStats ?? []) as any[]).forEach(() => {})
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

  const acciones = suggestedActions({
    stats: memberStats,
    birthdays: accionBirthdays,
    bonos: accionBonos,
    ticketMedio: revActual.ticketMedio || 12,
    precioCumple: 130,
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

  const tenantId = tenant?.id ?? ''
  const capacity: number | null = (tenant as any)?.capacity ?? null

  // ── Birthday leads ─────────────────────────────────────────────────────────
  const thisMonth = now.getMonth() + 1
  const thisYear = now.getFullYear()
  const birthdayLeadsMap = new Map<string, any>()
  ;(birthdayLeadsData ?? []).forEach((l: any) => birthdayLeadsMap.set(`${l.member_id}-${l.child_name}`, l))
  const birthdayLeads: any[] = []
  const seenChildren = new Set<string>()
  ;(allMembers ?? []).forEach((m: any) => {
    ;((m.children as any[]) ?? []).forEach((c: any) => {
      if (!c.birth_date) return
      const dob = new Date(c.birth_date)
      if (dob.getUTCMonth() + 1 !== thisMonth) return
      const dedupeKey = `${c.name}-${c.birth_date}`
      if (seenChildren.has(dedupeKey)) return
      seenChildren.add(dedupeKey)
      const leadKey = `${m.id}-${c.name}`
      const lead = birthdayLeadsMap.get(leadKey)
      birthdayLeads.push({
        id: lead?.id ?? null, member_id: m.id, member_name: m.name,
        child_name: c.name, child_birth_date: c.birth_date, year: thisYear,
        status: lead?.status ?? 'sin_contactar', notes: lead?.notes ?? null,
        age: thisYear - dob.getUTCFullYear(), birthday_day: dob.getUTCDate(),
      })
    })
  })
  birthdayLeads.sort((a, b) => a.birthday_day - b.birthday_day)

  // ── Follow-up leads map ────────────────────────────────────────────────────
  const fuMap = new Map<string, any>()
  ;(followUpLeadsData ?? []).forEach((l: any) => fuMap.set(`${l.member_id}-${l.type}`, l))

  const fuItem = (member_id: string, member_name: string, type: string, meta: string, metaColor?: string): FollowUpItem => {
    const lead = fuMap.get(`${member_id}-${type}`)
    return {
      id: lead?.id ?? null, member_id, member_name, type, period: currentPeriod,
      status: lead?.status ?? 'sin_contactar', notes: lead?.notes ?? null,
      meta, metaColor,
    }
  }

  // ── 1. Bonos bajos (≤2 sesiones) ──────────────────────────────────────────
  const bonosBajosItems: FollowUpItem[] = (lowBonoMembers as any[] ?? []).map((b: any) =>
    fuItem(b.members?.id, b.members?.name, 'bono_bajo',
      `${b.sessions_remaining} sesión${b.sessions_remaining === 1 ? '' : 'es'} restante${b.sessions_remaining === 1 ? '' : 's'} · ${b.membership_types?.name ?? ''}`,
      'text-amber')
  )

  // ── 2. Clientes inactivos (+10 días sin visitar) ───────────────────────────
  const inactivosItems: FollowUpItem[] = (atRiskMembers as any[] ?? []).map((m: any) =>
    fuItem(m.id, m.name, 'inactivo', 'Sin visitar en más de 10 días', 'text-rose')
  )

  // ── 3. Bonos caducados (últimos 30 días, sin renovación) ──────────────────
  // Bonos vigentes, a partir de las membresías ya cargadas para las métricas
  const activeMemberIds = new Set(
    ((allMemberships ?? []) as any[])
      .filter(m => (m.sessions_remaining == null || m.sessions_remaining > 0)
        && (!m.expires_at || m.expires_at >= todayStr))
      .map(m => m.member_id)
  )
  const expiredBonosItems: FollowUpItem[] = (expiredBonos as any[] ?? [])
    .filter((b: any) => !activeMemberIds.has(b.member_id))
    .map((b: any) => {
      const daysAgo = Math.floor((now.getTime() - new Date(b.expires_at).getTime()) / 86400000)
      return fuItem(b.member_id, (b.members as any)?.name, 'bono_caducado',
        `Caducó hace ${daysAgo} día${daysAgo === 1 ? '' : 's'} · ${(b.membership_types as any)?.name ?? ''}`,
        'text-rose')
    })

  // ── 4. Sin bono pero visitan este mes ─────────────────────────────────────
  const monthVisitorIds = new Set((monthVisits ?? []).map((v: any) => v.member_id))
  const memberMap = new Map<string, string>()
  ;(allMembers ?? []).forEach((m: any) => memberMap.set(m.id, m.name))
  const sinBonoItems: FollowUpItem[] = []
  monthVisitorIds.forEach(mid => {
    if (!activeMemberIds.has(mid) && memberMap.has(mid)) {
      sinBonoItems.push(fuItem(mid, memberMap.get(mid)!, 'sin_bono',
        'Visita sin bono activo — candidato a contratar', 'text-iris'))
    }
  })

  // ── 5. Bonos que vencen esta semana ───────────────────────────────────────
  const bonosSemanaItems: FollowUpItem[] = (bonosSemanaRaw as any[] ?? []).map((b: any) => {
    const expiresDate = new Date(b.expires_at + 'T00:00:00')
    const diffDays = Math.round((expiresDate.getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000)
    const whenLabel = diffDays === 0 ? 'hoy' : diffDays === 1 ? 'mañana' : `en ${diffDays} días`
    return fuItem(
      (b.members as any)?.id,
      (b.members as any)?.name,
      'bono_semana',
      `Vence ${whenLabel} · ${new Date(b.expires_at + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${(b.membership_types as any)?.name ?? ''}`,
      'text-amber',
    )
  })

  // ── Top 5 this month ───────────────────────────────────────────────────────
  const tally: Record<string, { name: string; count: number }> = {}
  ;(topVisits as any[] ?? []).forEach((v: any) => {
    const mid = v.member_id; const name = (v.members as any)?.name
    if (!mid || !name) return
    tally[mid] = { name, count: (tally[mid]?.count ?? 0) + 1 }
  })
  const top5: { id: string; name: string; count: number }[] = Object.entries(tally).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count).slice(0, 5)

  // ── Urgent alerts ──────────────────────────────────────────────────────────
  const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const urgentAlerts: { id: string; type: 'bono' | 'birthday'; message: string }[] = []
  bonosBajosItems.filter(i => {
    const sessions = parseInt(i.meta)
    return sessions === 1
  }).forEach(i => urgentAlerts.push({
    id: `bono-1-${i.member_id}`,
    type: 'bono',
    message: t('panelres_alerta_bono_1', { name: i.member_name }),
  }))
  ;(expiredBonos as any[] ?? []).forEach((b: any) => {
    if (b.expires_at === todayStr || b.expires_at === tomorrowStr) {
      urgentAlerts.push({
        id: `caducado-${b.member_id}`,
        type: 'bono',
        message: b.expires_at === todayStr
          ? t('panelres_alerta_bono_caduca_hoy', { name: (b.members as any)?.name })
          : t('panelres_alerta_bono_caduca_manana', { name: (b.members as any)?.name }),
      })
    }
  })
  birthdayLeads.filter(l => {
    const next = new Date(now.getFullYear(), now.getMonth(), l.birthday_day)
    return next >= now && next <= in7days
  }).forEach(l => urgentAlerts.push({
    id: `bday-${l.member_id}-${l.child_name}`,
    type: 'birthday',
    message: t('panelres_alerta_cumple', { child: l.child_name, age: l.age + 1, day: l.birthday_day, member: l.member_name }),
  }))

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


      {/* Opportunity indicators */}
      <OpportunityDashboard
        birthdayLeads={birthdayLeads}
        bonosBajosItems={bonosBajosItems}
        bonosSemanaItems={bonosSemanaItems}
        inactivosItems={inactivosItems}
        expiredBonosItems={expiredBonosItems}
        sinBonoItems={sinBonoItems}
        top5={top5}
        tenantId={tenantId}
      />
    </div>
  )
}
