import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Users, Calendar, AlertTriangle, LogIn } from 'lucide-react'

export const revalidate = 0

export default async function DashboardPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  const [{ data: todayVisits }, { count: monthCount }, { count: expiringCount }] = await Promise.all([
    supabase
      .from('visits')
      .select('id, checked_in_at, family_id, membership_id, families(name), memberships(sessions_remaining)')
      .gte('checked_in_at', todayIso)
      .order('checked_in_at', { ascending: false }),
    supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', firstOfMonth),
    supabase.from('memberships').select('id', { count: 'exact', head: true }).lte('sessions_remaining', 2).not('sessions_remaining', 'is', null),
  ])

  const uniqueFamiliesHoy = new Set(todayVisits?.map(v => v.family_id) ?? []).size
  const dateLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">El Bosc Màgic</h1>
        <p className="text-sm text-fog capitalize mt-0.5">{dateLabel}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        {[
          { icon: Users, label: 'Familias hoy', value: uniqueFamiliesHoy, color: 'text-lime', bg: 'bg-lime/10' },
          { icon: Calendar, label: 'Visitas mes', value: monthCount ?? 0, color: 'text-iris', bg: 'bg-iris/10' },
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

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Check-in CTA */}
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
        </div>

        {/* Today checkins */}
        <div>
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-3">Entradas de hoy</h2>
          {!todayVisits?.length ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-mist">
              Sin entradas todavía
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(todayVisits as any[]).map((visit) => (
                <div key={visit.id} className="rounded-xl border border-line bg-surface px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-snow">{visit.families?.name}</p>
                    <p className="text-xs text-mist">
                      {new Date(visit.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {visit.memberships?.sessions_remaining != null && (
                    <span className={`text-sm font-bold ${visit.memberships.sessions_remaining <= 2 ? 'text-rose' : 'text-lime'}`}>
                      {visit.memberships.sessions_remaining} ses.
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
