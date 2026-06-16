import { supabase } from '@/lib/supabase'
import { Users, TrendingUp, AlertTriangle, UserMinus, Crown, Baby } from 'lucide-react'

export const revalidate = 0

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Users; label: string; value: string | number; sub: string; accent: 'lime' | 'iris' | 'amber' | 'rose' | 'mint'
}) {
  const colors = {
    lime: ['text-lime', 'bg-lime/10'],
    iris: ['text-iris', 'bg-iris/10'],
    amber: ['text-amber', 'bg-amber/10'],
    rose: ['text-rose', 'bg-rose/10'],
    mint: ['text-mint', 'bg-mint/10'],
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
            <div
              className="w-full rounded-t-lg bg-lime transition-all"
              style={{ height: `${Math.max(4, (d.v / max) * 80)}px` }}
            />
          </div>
          <span className="text-[10px] text-mist">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export default async function PanelPage() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const since7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
  since7.setHours(0, 0, 0, 0)
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: allFamilies },
    { count: todayCount },
    { count: monthCount },
    { count: expiringCount },
    { data: recentVisits },
    { data: atRiskFamilies },
    { data: topFamilies },
  ] = await Promise.all([
    supabase.from('families').select('id, name, children(name, birth_date), memberships(sessions_remaining, membership_types(name))'),
    supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', startOfDay),
    supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', startOfMonth),
    supabase.from('memberships').select('id', { count: 'exact', head: true }).lte('sessions_remaining', 2).not('sessions_remaining', 'is', null),
    supabase.from('visits').select('checked_in_at').gte('checked_in_at', since7.toISOString()),
    supabase.from('families').select('id, name, children(name)').not('id', 'in',
      `(${(await supabase.from('visits').select('family_id').gte('checked_in_at', tenDaysAgo)).data?.map(v => `"${v.family_id}"`).join(',') || '"00000000-0000-0000-0000-000000000000"'})`
    ).limit(5),
    supabase.from('visits').select('family_id, families(name)').gte('checked_in_at', startOfMonth).limit(200),
  ])

  // Build 7-day chart
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

  // Top families by visits this month
  const tally: Record<string, { name: string; count: number }> = {}
  ;(topFamilies as any[] ?? []).forEach((v: any) => {
    const fid = v.family_id; const name = v.families?.name
    if (!fid || !name) return
    tally[fid] = { name, count: (tally[fid]?.count ?? 0) + 1 }
  })
  const top5 = Object.values(tally).sort((a, b) => b.count - a.count).slice(0, 5)

  const totalFamilies = allFamilies?.length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-snow">Dashboard</h1>
        <p className="text-fog mt-1 text-sm">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Familias totales" value={totalFamilies} sub="registradas" accent="lime" />
        <StatCard icon={TrendingUp} label="Visitas hoy" value={todayCount ?? 0} sub="entradas registradas" accent="iris" />
        <StatCard icon={Baby} label="Visitas este mes" value={monthCount ?? 0} sub="sesiones consumidas" accent="mint" />
        <StatCard icon={AlertTriangle} label="Bonos bajos" value={expiringCount ?? 0} sub="≤2 sesiones restantes" accent="amber" />
      </div>

      {/* Chart + At risk */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm font-semibold text-snow mb-5">Visitas · últimos 7 días</p>
          <MiniBar data={buckets} />
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-snow mb-4">
            <UserMinus size={15} className="text-rose" /> Sin visitar en +10 días
          </div>
          {!atRiskFamilies?.length ? (
            <p className="text-sm text-mist py-4 text-center">Ninguna familia en riesgo</p>
          ) : (
            <div className="space-y-2">
              {(atRiskFamilies as any[]).map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-snow">{f.name}</p>
                    <p className="text-xs text-mist">{f.children?.map((c: any) => c.name).join(', ')}</p>
                  </div>
                  <a href={`/familias/${f.id}`} className="text-xs text-lime hover:underline shrink-0 ml-2">Ver →</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top families */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-snow mb-4">
          <Crown size={15} className="text-lime" /> Familias más activas este mes
        </div>
        {!top5.length ? (
          <p className="text-sm text-mist text-center py-4">Sin datos este mes</p>
        ) : (
          <div className="space-y-2">
            {top5.map((f, i) => (
              <div key={f.name} className="flex items-center gap-3 rounded-xl bg-surface2 px-3 py-2.5">
                <span className="w-6 h-6 rounded-full bg-carbon border border-line flex items-center justify-center text-xs font-bold text-lime shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm text-snow font-medium">{f.name}</span>
                <span className="text-sm font-semibold text-fog">{f.count} vis.</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All families with low bonos */}
      {(expiringCount ?? 0) > 0 && (
        <div className="rounded-2xl border border-amber/30 bg-surface p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-snow mb-4">
            <AlertTriangle size={15} className="text-amber" /> Familias con bono bajo
          </div>
          <div className="space-y-2">
            {(allFamilies as any[] ?? [])
              .filter(f => f.memberships?.[0]?.sessions_remaining != null && f.memberships[0].sessions_remaining <= 2)
              .map((f: any) => (
                <div key={f.id} className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-snow">{f.name}</p>
                    <p className="text-xs text-mist">{f.memberships[0].membership_types?.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-amber">{f.memberships[0].sessions_remaining}</span>
                    <a href={`/familias/${f.id}`} className="text-xs text-fog hover:text-snow">Ver →</a>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
