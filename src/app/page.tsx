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
    <div className="space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-semibold text-snow">El Bosc Màgic</h1>
        <p className="text-sm text-fog capitalize mt-0.5">{dateLabel}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: 'Familias hoy', value: uniqueFamiliesHoy, color: 'text-lime' },
          { icon: Calendar, label: 'Visitas mes', value: monthCount ?? 0, color: 'text-iris' },
          { icon: AlertTriangle, label: 'Bonos bajos', value: expiringCount ?? 0, color: 'text-amber' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-3 text-center">
            <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
            <div className="text-2xl font-bold text-snow">{value}</div>
            <div className="text-[10px] text-fog leading-tight mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <Link
        href="/checkin"
        className="flex items-center justify-center gap-2 bg-lime text-ink font-semibold rounded-2xl py-4 text-sm w-full active:scale-95 transition-transform"
        style={{ boxShadow: 'var(--shadow-lime)' }}
      >
        <LogIn size={18} strokeWidth={2.4} />
        Registrar entrada
      </Link>

      <div>
        <h2 className="text-sm font-semibold text-fog mb-3 uppercase tracking-wide">Entradas de hoy</h2>
        {!todayVisits?.length ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-mist">
            Sin entradas todavía
          </div>
        ) : (
          <div className="space-y-2">
            {(todayVisits as any[]).map((visit) => (
              <div key={visit.id} className="rounded-2xl border border-line bg-surface px-4 py-3 flex items-center justify-between">
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
  )
}
