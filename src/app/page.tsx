import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Users, Calendar, AlertTriangle, LogIn, TrendingUp, Euro } from 'lucide-react'

export const revalidate = 0

export default async function DashboardPage() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 6)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekFromNow = new Date(todayStart)
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  const [
    { data: todayVisits },
    { count: weekCount },
    { count: monthCount },
    { count: expiringCount },
    { data: expiringMembers },
    { data: recentMemberships },
  ] = await Promise.all([
    supabase
      .from('visits')
      .select('id, checked_in_at, member_id, membership_id, members(name), memberships(sessions_remaining)')
      .gte('checked_in_at', todayStart.toISOString())
      .order('checked_in_at', { ascending: false }),
    supabase.from('visits').select('id', { count: 'exact', head: true })
      .gte('checked_in_at', weekStart.toISOString()),
    supabase.from('visits').select('id', { count: 'exact', head: true })
      .gte('checked_in_at', monthStart.toISOString()),
    supabase.from('memberships').select('id', { count: 'exact', head: true })
      .lte('sessions_remaining', 2).not('sessions_remaining', 'is', null),
    supabase
      .from('memberships')
      .select('id, expires_at, sessions_remaining, membership_types(name), members(id, name)')
      .lte('expires_at', weekFromNow.toISOString().split('T')[0])
      .gte('expires_at', todayStart.toISOString().split('T')[0])
      .limit(5),
    supabase
      .from('memberships')
      .select('membership_types(price)')
      .gte('created_at', monthStart.toISOString()),
  ])

  const uniqueToday = new Set(todayVisits?.map(v => v.member_id) ?? []).size
  const monthRevenue = (recentMemberships ?? []).reduce((sum: number, m: any) => sum + (m.membership_types?.price ?? 0), 0)
  const dateLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">El Bosc Màgic</h1>
        <p className="text-sm text-fog capitalize mt-0.5">{dateLabel}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Users, label: 'Entradas hoy', value: uniqueToday, color: 'text-lime', bg: 'bg-lime/10' },
          { icon: TrendingUp, label: 'Esta semana', value: weekCount ?? 0, color: 'text-iris', bg: 'bg-iris/10' },
          { icon: Calendar, label: 'Este mes', value: monthCount ?? 0, color: 'text-mint', bg: 'bg-mint/10' },
          { icon: AlertTriangle, label: 'Bonos bajos', value: expiringCount ?? 0, color: 'text-amber', bg: 'bg-amber/10' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 lg:w-5 lg:h-5 ${color}`} />
            </div>
            <div className="font-display text-2xl lg:text-3xl font-semibold text-snow">{value}</div>
            <div className="text-xs lg:text-sm text-fog mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Revenue */}
      <div className="rounded-2xl border border-line bg-surface px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-lime/10 flex items-center justify-center">
            <Euro className="w-4 h-4 text-lime" />
          </div>
          <div>
            <p className="text-sm font-semibold text-snow">Ingresos este mes</p>
            <p className="text-xs text-mist mt-0.5">Bonos asignados en {now.toLocaleDateString('es-ES', { month: 'long' })}</p>
          </div>
        </div>
        <p className="font-display text-2xl font-semibold text-lime">{monthRevenue}€</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <div className="space-y-3">
          <Link
            href="/checkin"
            className="flex items-center justify-center gap-2 bg-lime text-ink font-semibold rounded-2xl py-4 text-sm w-full active:scale-95 transition-transform"
            style={{ boxShadow: 'var(--shadow-lime)' }}
          >
            <LogIn size={18} strokeWidth={2.4} />
            Registrar entrada
          </Link>
          <Link
            href="/panel"
            className="flex items-center justify-center gap-2 border border-line bg-surface text-fog font-semibold rounded-2xl py-3 text-sm w-full hover:text-snow hover:border-line2 transition-colors"
          >
            Ver panel completo →
          </Link>

          {/* Expiring memberships this week */}
          {(expiringMembers?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-amber/30 bg-surface p-4">
              <p className="text-xs font-semibold text-amber uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <AlertTriangle size={11} /> Bonos vencen esta semana
              </p>
              <div className="space-y-2">
                {(expiringMembers as any[]).map((b) => (
                  <Link key={b.id} href={`/miembros/${(b.members as any)?.id}`} className="flex items-center justify-between rounded-lg hover:bg-surface2 -mx-1 px-1 py-1.5 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-snow">{(b.members as any)?.name}</p>
                      <p className="text-xs text-mist">{(b.membership_types as any)?.name}</p>
                    </div>
                    <span className="text-xs text-amber font-semibold shrink-0 ml-2">
                      {new Date(b.expires_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Today's entries */}
        <div>
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-3">Entradas de hoy</h2>
          {!todayVisits?.length ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-mist">Sin entradas todavía</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {(todayVisits as any[]).map((visit) => (
                <Link key={visit.id} href={`/miembros/${visit.member_id}`} className="rounded-xl border border-line bg-surface px-4 py-3 flex items-center justify-between hover:border-line2 transition-colors">
                  <div>
                    <p className="font-semibold text-sm text-snow">{(visit.members as any)?.name}</p>
                    <p className="text-xs text-mist">{new Date(visit.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {(visit.memberships as any)?.sessions_remaining != null && (
                    <span className={`text-sm font-bold ${(visit.memberships as any).sessions_remaining <= 2 ? 'text-rose' : 'text-lime'}`}>
                      {(visit.memberships as any).sessions_remaining} ses.
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
