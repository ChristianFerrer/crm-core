import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Users, TrendingUp, AlertTriangle, BarChart2, Tag, Building2 } from 'lucide-react'
import { MemberGrowthChart, BonoDistChart } from './PanelCharts'
import { FollowUpItem } from './FollowUpSection'
import { OpportunityDashboard } from './OpportunityDashboard'

export const revalidate = 0

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Users; label: string; value: string | number; sub: string; accent: 'lime' | 'iris' | 'amber' | 'rose' | 'mint'
}) {
  const colors = {
    lime:  ['text-lime',  'bg-lime/10'],
    iris:  ['text-iris',  'bg-iris/10'],
    amber: ['text-amber', 'bg-amber/10'],
    rose:  ['text-rose',  'bg-rose/10'],
    mint:  ['text-mint',  'bg-mint/10'],
  }
  const [text, bg] = colors[accent]
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className={`w-10 h-10 rounded-2xl ${bg} flex items-center justify-center mb-4`}>
        <Icon size={20} className={text} />
      </div>
      <div className="font-display text-3xl font-semibold text-snow">{value}</div>
      <div className="text-sm font-semibold text-snow mt-1">{label}</div>
      <div className="text-xs text-mist mt-0.5">{sub}</div>
    </div>
  )
}

function MiniBar({ data }: { data: { label: string; v: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.v))
  return (
    <div className="flex items-end justify-between gap-2 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-fog">{d.v || ''}</span>
          <div className="w-full flex items-end" style={{ height: 80 }}>
            <div className="w-full rounded-t-lg bg-lime transition-all" style={{ height: `${Math.max(4, (d.v / max) * 80)}px` }} />
          </div>
          <span className="text-[10px] text-mist">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export default async function PanelPage() {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const since7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
  since7.setHours(0, 0, 0, 0)
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
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
  ] = await Promise.all([
    supabase.from('members').select('id', { count: 'exact', head: true }),
    supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', startOfDay),
    supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', startOfMonth),
    supabase.from('memberships').select('id', { count: 'exact', head: true }).lte('sessions_remaining', 2).not('sessions_remaining', 'is', null),
    supabase.from('visits').select('checked_in_at').gte('checked_in_at', since7.toISOString()),
    recentVisitedIds.length > 0
      ? supabase.from('members').select('id, name, families(name)').not('id', 'in', `(${recentVisitedIds.map(id => `"${id}"`).join(',')})`).limit(5)
      : supabase.from('members').select('id, name, families(name)').limit(5),
    supabase.from('visits').select('member_id, members(name)').gte('checked_in_at', startOfMonth).limit(200),
    supabase.from('memberships').select('id, sessions_remaining, membership_types(name), members(id, name, families(name))').lte('sessions_remaining', 2).not('sessions_remaining', 'is', null).limit(10),
    supabase.from('members').select('id, name, created_at, children'),
    supabase.from('memberships').select('member_id, sessions_remaining').or('sessions_remaining.is.null,sessions_remaining.gt.0').gte('expires_at', todayStr),
    supabase.from('tenants').select('id').limit(1).single(),
    supabase.from('birthday_leads').select('*').eq('year', now.getFullYear()),
    supabase.from('memberships').select('member_id, expires_at, membership_types(name), members(id, name)').lt('expires_at', todayStr).gte('expires_at', thirtyDaysAgo).limit(20),
    supabase.from('follow_up_leads').select('*').eq('period', currentPeriod),
    supabase.from('visits').select('member_id').gte('checked_in_at', startOfMonth).limit(500),
  ])

  // ── 7-day visit chart ──────────────────────────────────────────────────────
  const DAY = ['D','L','M','X','J','V','S']
  const buckets = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6 - i))
    return { label: i === 6 ? 'Hoy' : DAY[d.getDay()], v: 0, date: d.getTime() }
  })
  ;(recentVisits ?? []).forEach((row: any) => {
    const t = new Date(row.checked_in_at); t.setHours(0,0,0,0)
    const b = buckets.find(x => x.date === t.getTime())
    if (b) b.v++
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

  // ── Top 5 this month ───────────────────────────────────────────────────────
  const tally: Record<string, { name: string; count: number }> = {}
  ;(topVisits as any[] ?? []).forEach((v: any) => {
    const mid = v.member_id; const name = (v.members as any)?.name
    if (!mid || !name) return
    tally[mid] = { name, count: (tally[mid]?.count ?? 0) + 1 }
  })
  const top5 = Object.values(tally).sort((a, b) => b.count - a.count).slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-snow">Panel</h1>
        <p className="text-fog mt-1 text-sm">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="flex lg:inline-flex gap-1 bg-surface rounded-xl p-1 border border-line mb-6">
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-surface2 text-snow">
          <BarChart2 size={13} /> Resumen
        </div>
        <Link href="/panel/servicios" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <Tag size={13} /> Servicios
        </Link>
        <Link href="/panel/perfil" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <Building2 size={13} /> Perfil
        </Link>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
        <MemberGrowthChart data={growthBuckets} lastMonthAdults={lastMonthAdults} lastMonthChildren={lastMonthChildren} newThisMonth={newThisMonth} />
        <BonoDistChart withFullBono={withFullBono} withLowBono={withLowBono} withoutBono={withoutBono} />
        <div className="rounded-2xl border border-line bg-surface p-5 min-w-[220px]">
          <p className="text-sm font-semibold text-snow mb-5">Visitas · últimos 7 días</p>
          <MiniBar data={buckets} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Miembros totales" value={totalMembers ?? 0} sub="registrados" accent="lime" />
        <StatCard icon={TrendingUp} label="Visitas hoy" value={todayCount ?? 0} sub="entradas registradas" accent="iris" />
        <StatCard icon={TrendingUp} label="Visitas este mes" value={monthCount ?? 0} sub="sesiones consumidas" accent="mint" />
        <StatCard icon={AlertTriangle} label="Bonos bajos" value={expiringCount ?? 0} sub="≤2 sesiones restantes" accent="amber" />
      </div>

      {/* Opportunity indicators */}
      <OpportunityDashboard
        birthdayLeads={birthdayLeads}
        bonosBajosItems={bonosBajosItems}
        inactivosItems={inactivosItems}
        expiredBonosItems={expiredBonosItems}
        sinBonoItems={sinBonoItems}
        top5={top5}
        tenantId={tenantId}
      />
    </div>
  )
}
