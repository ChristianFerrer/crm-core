'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, LogIn } from 'lucide-react'
import { supabase } from '@/lib/supabase'

async function resolveTenantName(email: string): Promise<string | null> {
  const stored = localStorage.getItem('viewingAsTenant')
  if (stored) {
    try { return JSON.parse(stored).name } catch {}
  }
  const { data } = await supabase
    .from('tenants')
    .select('name')
    .ilike('admin_email', email.trim())
    .limit(1)
    .maybeSingle()
  return data?.name ?? null
}
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type TodayVisit = {
  id: string
  checked_in_at: string
  checked_out_at: string | null
  membership_id: string | null
  member_id: string
  members: { name: string } | null
}

type ExpiringMembership = {
  id: string
  expires_at: string
  membership_types: { name: string } | null
  members: { id: string; name: string } | null
}

type HomeClientProps = {
  todayVisits: TodayVisit[]
  expiringMembers: ExpiringMembership[]
  monthCount: number
  dateLabel: string
}

type DrawerKey = 'enSala' | 'entradasHoy' | 'conBono' | 'sinBono' | null

export default function HomeClient({ todayVisits, expiringMembers, monthCount, dateLabel }: HomeClientProps) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey>(null)

  const activeVisits = todayVisits.filter(v => !v.checked_out_at)
  const conBonoVisits = todayVisits.filter(v => v.membership_id)
  const sinBonoVisits = todayVisits.filter(v => !v.membership_id)

  const buckets = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, '0')}h`,
    conBono: todayVisits.filter(v => v.membership_id && new Date(v.checked_in_at).getHours() === h).length,
    sinBono: todayVisits.filter(v => !v.membership_id && new Date(v.checked_in_at).getHours() === h).length,
  }))
  const chartData = buckets.slice(7, 23)

  const stats: { key: DrawerKey; label: string; value: number; accent: string; border: string; visits: TodayVisit[] }[] = [
    { key: 'enSala', label: 'En sala', value: activeVisits.length, accent: 'text-iris', border: 'border-iris/30', visits: activeVisits },
    { key: 'entradasHoy', label: 'Entradas hoy', value: todayVisits.length, accent: 'text-lime', border: 'border-lime/30', visits: todayVisits },
    { key: 'conBono', label: 'Con bono', value: conBonoVisits.length, accent: 'text-mint', border: 'border-mint/30', visits: conBonoVisits },
    { key: 'sinBono', label: 'Sin bono', value: sinBonoVisits.length, accent: 'text-amber', border: 'border-amber/30', visits: sinBonoVisits },
  ]

  const drawerVisits = activeDrawer ? (stats.find(s => s.key === activeDrawer)?.visits ?? []) : []

  const [tenantName, setTenantName] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      const email = user?.email
      if (email) {
        const name = await resolveTenantName(email)
        setTenantName(name)
      }
    })
  }, [])

  function handleStatClick(key: DrawerKey) {
    setActiveDrawer(prev => (prev === key ? null : key))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">{tenantName ?? 'El Bosc Màgic'}</h1>
        <p className="text-sm text-fog capitalize mt-0.5">{dateLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ key, label, value, accent, border }) => (
          <button
            key={key}
            onClick={() => handleStatClick(key)}
            className={`rounded-2xl border bg-surface p-4 lg:p-5 text-left transition-colors ${activeDrawer === key ? border + ' bg-surface2' : 'border-line hover:border-line2'}`}
          >
            <div className="font-display text-2xl lg:text-3xl font-semibold text-snow">{value}</div>
            <div className={`text-xs lg:text-sm mt-0.5 ${activeDrawer === key ? accent : 'text-fog'}`}>{label}</div>
          </button>
        ))}
      </div>

      {activeDrawer && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h3 className="text-xs font-semibold text-fog uppercase tracking-wide mb-3">
            {stats.find(s => s.key === activeDrawer)?.label}
          </h3>
          {drawerVisits.length === 0 ? (
            <p className="text-sm text-mist">Sin entradas</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {drawerVisits.map(visit => (
                <Link
                  key={visit.id}
                  href={`/miembros/${visit.member_id}`}
                  className="flex items-center justify-between rounded-xl border border-line bg-carbon px-4 py-3 hover:border-line2 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-sm text-snow">{visit.members?.name ?? '—'}</p>
                    <p className="text-xs text-mist">
                      {new Date(visit.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${visit.membership_id ? 'bg-lime' : 'bg-amber'}`} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
        <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-4">Afluencia hoy por hora</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 0, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid stroke="#1e2530" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: '12px', color: '#f0f4f8' }}
              labelStyle={{ color: '#6b7280', fontSize: 11 }}
              cursor={{ stroke: '#1e2530' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#6b7280', paddingTop: 8 }}
              formatter={(value) => value === 'conBono' ? 'Con bono' : 'Sin bono'}
            />
            <Line type="monotone" dataKey="conBono" stroke="#84cc16" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sinBono" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/checkin"
          className="flex items-center justify-center gap-2 bg-lime text-ink font-semibold rounded-2xl py-4 text-sm flex-1 active:scale-95 transition-transform"
          style={{ boxShadow: 'var(--shadow-lime)' }}
        >
          <LogIn size={18} strokeWidth={2.4} />
          Registrar entrada
        </Link>
        <Link
          href="/panel"
          className="flex items-center justify-center gap-2 border border-line bg-surface text-fog font-semibold rounded-2xl py-3 text-sm flex-1 hover:text-snow hover:border-line2 transition-colors"
        >
          Ver panel →
        </Link>
      </div>

      {expiringMembers.length > 0 && (
        <div className="rounded-2xl border border-amber/30 bg-surface p-4">
          <p className="text-xs font-semibold text-amber uppercase tracking-wide flex items-center gap-1.5 mb-3">
            <AlertTriangle size={11} /> Bonos vencen esta semana
          </p>
          <div className="space-y-2">
            {expiringMembers.map(b => (
              <Link
                key={b.id}
                href={`/miembros/${b.members?.id}`}
                className="flex items-center justify-between rounded-lg hover:bg-surface2 -mx-1 px-1 py-1.5 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-snow">{b.members?.name}</p>
                  <p className="text-xs text-mist">{b.membership_types?.name}</p>
                </div>
                <span className="text-xs text-amber font-semibold shrink-0 ml-2">
                  {new Date(b.expires_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-3">Entradas de hoy</h2>
        {todayVisits.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-mist">Sin entradas todavía</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {todayVisits.map(visit => (
              <Link
                key={visit.id}
                href={`/miembros/${visit.member_id}`}
                className="rounded-xl border border-line bg-surface px-4 py-3 flex items-center justify-between hover:border-line2 transition-colors"
              >
                <div>
                  <p className="font-semibold text-sm text-snow">{visit.members?.name ?? '—'}</p>
                  <p className="text-xs text-mist">
                    {new Date(visit.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 ${visit.membership_id ? 'bg-lime' : 'bg-amber'}`} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
