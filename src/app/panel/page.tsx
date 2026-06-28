import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Users, TrendingUp, BarChart2, Tag, Building2, ShoppingBag } from 'lucide-react'
import { MemberGrowthChart, BonoDistChart, VisitMiniChart } from './PanelCharts'
import { FollowUpItem } from './FollowUpSection'
import { OpportunityDashboard } from './OpportunityDashboard'
import { UrgentAlerts } from './UrgentAlerts'

export const revalidate = 0



export default async function PanelPage() {
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
    { count: todayCount },
    { count: monthCount },
    { count: expiringCount },
    { data: recentVisits },
    { data: atRiskMembers },
    { data: topVisits },
    { data: lowBonoMembers },
    { data: allMembers },
    { data: activeBonoMembers },
    { data: tenant },
    { data: birthdayLeadsData },
    { data: expiredBonos },
    { data: followUpLeadsData },
    { data: monthVisits },
    { data: bonosSemanaRaw },
  ] = await Promise.all([
    supabase.from('members').select('id', { count: 'exact', head: true }),
    supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', startOfDay),
    supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', startOfMonth),
    supabase.from('memberships').select('id', { count: 'exact', head: true }).lte('sessions_remaining', 2).not('sessions_remaining', 'is', null),
    supabase.from('visits').select('checked_in_at, children_present').gte('checked_in_at', since7.toISOString()),
    recentVisitedIds.length > 0
      ? supabase.from('members').select('id, name, families(name)').not('id', 'in', `(${recentVisitedIds.map(id => `"${id}"`).join(',')})`).limit(5)
      : supabase.from('members').select('id, name, families(name)').limit(5),
    supabase.from('visits').select('member_id, members(name)').gte('checked_in_at', startOfMonth).limit(200),
    supabase.from('memberships').select('id, sessions_remaining, membership_types(name), members(id, name, families(name))').lte('sessions_remaining', 2).not('sessions_remaining', 'is', null).limit(10),
    supabase.from('members').select('id, name, created_at, children'),
    supabase.from('memberships').select('member_id, sessions_remaining').or('sessions_remaining.is.null,sessions_remaining.gt.0').gte('expires_at', todayStr),
    supabase.from('tenants').select('id, capacity').limit(1).single(),
    supabase.from('birthday_leads').select('*').eq('year', now.getFullYear()),
    supabase.from('memberships').select('member_id, expires_at, membership_types(name), members(id, name)').lt('expires_at', todayStr).gte('expires_at', thirtyDaysAgo).limit(20),
    supabase.from('follow_up_leads').select('*').eq('period', currentPeriod),
    supabase.from('visits').select('member_id').gte('checked_in_at', startOfMonth).limit(500),
    supabase.from('memberships').select('member_id, expires_at, membership_types(name), members(id, name)').gte('expires_at', todayStr).lte('expires_at', weekFromNow).limit(20),
  ])

  // ── 7-day visit chart ──────────────────────────────────────────────────────
  const DAY = ['D','L','M','X','J','V','S']
  const buckets = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6 - i))
    return { label: i === 6 ? 'Hoy' : DAY[d.getDay()], adultos: 0, ninos: 0, date: d.getTime() }
  })
  ;(recentVisits ?? []).forEach((row: any) => {
    const t = new Date(row.checked_in_at); t.setHours(0,0,0,0)
    const b = buckets.find(x => x.date === t.getTime())
    if (b) {
      b.adultos++
      b.ninos += (row.children_present as any[])?.length ?? 0
    }
  })

  // ── Member growth chart ────────────────────────────────────────────────────
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const membersThisMonth = (allMembers ?? []).filter((m: any) => m.created_at >= startOfMonth)
  const membersBeforeMonth = (allMembers ?? []).filter((m: any) => m.created_at < startOfMonth)
  const lastMonthAdults = membersBeforeMonth.length
  const lastMonthChildren = membersBeforeMonth.reduce((s: number, m: any) => s + ((m.children as any[])?.length ?? 0), 0)
  const newThisMonth = membersThisMonth.length
  const dailyAdults = Array(daysInMonth).fill(0)
  const dailyChildren = Array(daysInMonth).fill(0)
  membersThisMonth.forEach((m: any) => {
    const d = new Date(m.created_at).getDate() - 1
    if (d >= 0 && d < daysInMonth) {
      dailyAdults[d]++
      dailyChildren[d] += (m.children as any[])?.length ?? 0
    }
  })
  let runAdults = lastMonthAdults, runChildren = lastMonthChildren
  const growthBuckets = Array.from({ length: daysInMonth }, (_, i) => {
    runAdults += dailyAdults[i]; runChildren += dailyChildren[i]
    return { label: `${i + 1}`, adultos: runAdults, ninos: runChildren }
  })

  // ── Bono distribution ──────────────────────────────────────────────────────
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
  const activeMemberIds = new Set((activeBonoMembers ?? []).map((m: any) => m.member_id))
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
    message: `${i.member_name} — le queda solo 1 sesión de bono`,
  }))
  ;(expiredBonos as any[] ?? []).forEach((b: any) => {
    if (b.expires_at === todayStr || b.expires_at === tomorrowStr) {
      urgentAlerts.push({
        id: `caducado-${b.member_id}`,
        type: 'bono',
        message: `${(b.members as any)?.name} — el bono caduca ${b.expires_at === todayStr ? 'hoy' : 'mañana'}`,
      })
    }
  })
  birthdayLeads.filter(l => {
    const next = new Date(now.getFullYear(), now.getMonth(), l.birthday_day)
    return next >= now && next <= in7days
  }).forEach(l => urgentAlerts.push({
    id: `bday-${l.member_id}-${l.child_name}`,
    type: 'birthday',
    message: `${l.child_name} cumple ${l.age + 1} años el día ${l.birthday_day} — cliente: ${l.member_name}`,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-snow">Panel</h1>
        <p className="text-fog mt-1 text-sm">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {urgentAlerts.length > 0 && <UrgentAlerts alerts={urgentAlerts} />}

      <div className="flex lg:inline-flex gap-1 bg-surface rounded-xl p-1 border border-line mb-6 overflow-x-auto">
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-lime text-ink">
          <BarChart2 size={13} /> Resumen
        </div>
        <Link href="/panel/servicios" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <Tag size={13} /> Servicios
        </Link>
        <Link href="/panel/tienda" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <ShoppingBag size={13} /> Tienda
        </Link>
        <Link href="/panel/perfil" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <Building2 size={13} /> Perfil
        </Link>
      </div>

      {/* Charts + Stat cards grouped */}
      <div className="rounded-3xl border border-line bg-surface/40 p-4 space-y-4">
        {/* Compact stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Users,      label: 'Miembros', value: totalMembers ?? 0, accent: 'text-lime', bg: 'bg-lime/10' },
            { icon: TrendingUp, label: 'Hoy',      value: todayCount ?? 0,   accent: 'text-iris', bg: 'bg-iris/10' },
            { icon: TrendingUp, label: 'Este mes',  value: monthCount ?? 0,   accent: 'text-mint', bg: 'bg-mint/10' },
          ].map(({ icon: Icon, label, value, accent, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-surface p-3 flex flex-col gap-2">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon size={13} className={accent} />
              </div>
              <div>
                <div className={`font-display text-2xl font-bold leading-none ${accent}`}>{value}</div>
                <div className="text-[11px] text-fog mt-1 leading-tight">{label}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr]">
          <MemberGrowthChart data={growthBuckets} lastMonthAdults={lastMonthAdults} lastMonthChildren={lastMonthChildren} newThisMonth={newThisMonth} />
          <BonoDistChart withFullBono={withFullBono} withLowBono={withLowBono} withoutBono={withoutBono} />
          <VisitMiniChart data={buckets} capacity={capacity} />
        </div>
      </div>

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
