'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { AlertTriangle, LogIn, CreditCard, UserX, Users, CalendarClock, Cake } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant, loadAndStoreTenant } from '@/lib/tenant'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts'

type TodayVisit = {
  id: string
  checked_in_at: string
  checked_out_at: string | null
  membership_id: string | null
  member_id: string
  visit_type: string
  children_present: { name: string; age: number }[] | null
  members: { name: string } | null
}

type ExpiringMembership = {
  id: string
  expires_at: string
  membership_types: { name: string } | null
  members: { id: string; name: string } | null
}

type BirthdayMember = { id: string; name: string; birth_date: string }

type HomeClientProps = {
  todayVisits: TodayVisit[]
  todayCustodias: TodayVisit[]
  expiringMembers: ExpiringMembership[]
  monthCount: number
  dateLabel: string
  capacity: number | null
  todayBirthdays: BirthdayMember[]
}

type DrawerKey = 'ninos' | 'entradasHoy' | 'conBono' | 'sinBono' | 'custodias' | 'cumpleanos' | null

type ChildInSala = { name: string; age: number; memberName: string }

export default function HomeClient({ todayVisits, todayCustodias, expiringMembers, monthCount, dateLabel, capacity, todayBirthdays }: HomeClientProps) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const persons = (v: TodayVisit) => 1 + (v.children_present?.length ?? 0)

  const activeVisits = todayVisits.filter(v => !v.checked_out_at)
  const activeAdults = activeVisits.length
  const childrenInSala: ChildInSala[] = activeVisits.flatMap(v =>
    (v.children_present ?? []).map(c => ({ ...c, memberName: v.members?.name ?? '—' }))
  )
  const activeChildren = childrenInSala.length
  const activeTotal = activeAdults + activeChildren

  const conBonoVisits = todayVisits.filter(v => v.membership_id)
  const sinBonoVisits = todayVisits.filter(v => !v.membership_id)

  const buckets = Array.from({ length: 24 }, (_, h) => {
    const hourVisits = todayVisits.filter(v => new Date(v.checked_in_at).getHours() === h)
    const adultos = hourVisits.length
    const ninos = hourVisits.reduce((s, v) => s + (v.children_present?.length ?? 0), 0)
    return {
      hour: `${String(h).padStart(2, '0')}h`,
      adultos,
      ninos,
      conBono: hourVisits.filter(v => v.membership_id).reduce((s, v) => s + persons(v), 0),
      sinBono: hourVisits.filter(v => !v.membership_id).reduce((s, v) => s + persons(v), 0),
    }
  })
  const chartData = buckets.slice(7, 23)

  const stats: { key: DrawerKey; label: string; value: number; accent: string; border: string; visits: TodayVisit[]; icon: React.ReactNode }[] = [
    { key: 'ninos', label: 'Niños en sala', value: activeChildren, accent: 'text-mint', border: 'border-mint/30', visits: [], icon: <Users size={16} /> },
    { key: 'entradasHoy', label: 'Entradas hoy', value: todayVisits.reduce((s, v) => s + persons(v), 0), accent: 'text-lime', border: 'border-lime/30', visits: todayVisits, icon: <LogIn size={16} /> },
    { key: 'conBono', label: 'Con bono', value: conBonoVisits.reduce((s, v) => s + persons(v), 0), accent: 'text-mint', border: 'border-mint/30', visits: conBonoVisits, icon: <CreditCard size={16} /> },
    { key: 'sinBono', label: 'Sin bono', value: sinBonoVisits.reduce((s, v) => s + persons(v), 0), accent: 'text-amber', border: 'border-amber/30', visits: sinBonoVisits, icon: <UserX size={16} /> },
    { key: 'custodias', label: 'Custodias', value: todayCustodias.reduce((s, v) => s + persons(v), 0), accent: 'text-iris', border: 'border-iris/30', visits: todayCustodias, icon: <CalendarClock size={16} /> },
    { key: 'cumpleanos', label: 'Cumpleaños', value: todayBirthdays.length, accent: 'text-rose', border: 'border-rose/30', visits: [], icon: <Cake size={16} /> },
  ]

  const drawerVisits = activeDrawer && activeDrawer !== 'ninos' && activeDrawer !== 'cumpleanos'
    ? (stats.find(s => s.key === activeDrawer)?.visits ?? [])
    : []

  const [tenantName, setTenantName] = useState<string | null>(null)
  useEffect(() => {
    const impersonating = localStorage.getItem('viewingAsTenant')
    if (impersonating) {
      try { setTenantName(JSON.parse(impersonating).name); return } catch {}
    }
    const cached = getStoredTenant()
    if (cached) { setTenantName(cached.name); return }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const email = session?.user?.email
      if (email) {
        const tenant = await loadAndStoreTenant(email)
        if (tenant) setTenantName(tenant.name)
      }
    })
  }, [])

  function handleStatClick(key: DrawerKey) {
    setActiveDrawer(prev => {
      const next = prev === key ? null : key
      if (next) setTimeout(() => drawerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
      return next
    })
  }

  const aforoPct = capacity ? Math.min(100, (activeTotal / capacity) * 100) : 0
  const aforoColor = aforoPct < 70 ? 'bg-lime' : aforoPct <= 90 ? 'bg-amber' : 'bg-rose-500'
  const aforoTextColor = aforoPct < 70 ? 'text-lime' : aforoPct <= 90 ? 'text-amber' : 'text-rose-500'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">{tenantName ?? 'Mi establecimiento'}</h1>
          <p className="text-sm text-fog capitalize mt-0.5">{dateLabel}</p>
        </div>
        <Link
          href="/checkin"
          className="flex items-center gap-1.5 bg-lime text-ink font-semibold rounded-xl px-4 py-2.5 text-sm shrink-0 active:scale-95 transition-transform"
          style={{ boxShadow: 'var(--shadow-lime)' }}
        >
          <LogIn size={15} strokeWidth={2.4} />
          Registrar entrada
        </Link>
      </div>

      {/* Charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-4">Afluencia por hora · bono / sin bono</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 0, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="#1e2530" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: '12px', color: '#f0f4f8' }} labelStyle={{ color: '#6b7280', fontSize: 11 }} cursor={{ stroke: '#1e2530' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 8 }} formatter={(value) => value === 'conBono' ? 'Con bono' : 'Sin bono'} />
              <Line type="monotone" dataKey="conBono" stroke="#84cc16" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sinBono" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-4">Adultos y niños por hora</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 0, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="#1e2530" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: '12px', color: '#f0f4f8' }} labelStyle={{ color: '#6b7280', fontSize: 11 }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v, name) => [v, name === 'adultos' ? 'Adultos' : 'Niños']} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 8 }} formatter={(v) => v === 'adultos' ? 'Adultos' : 'Niños'} />
              <Bar dataKey="adultos" stackId="a" fill="#c6f24e" />
              <Bar dataKey="ninos" stackId="a" fill="#67e8f9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Aforo */}
      {capacity != null && (
        <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Users size={13} /> Aforo
          </h2>
          <div className="flex items-end justify-between mb-3">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-semibold text-snow">{activeTotal}</span>
              <span className="text-xs text-fog">de {capacity} plazas</span>
            </div>
            <span className={`text-sm font-bold ${aforoTextColor}`}>{Math.round(aforoPct)}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-line overflow-hidden mb-3">
            <div className={`h-full rounded-full transition-all duration-500 ${aforoColor}`} style={{ width: `${aforoPct}%` }} />
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-lime shrink-0" />
              <span className="text-xs text-fog">{activeAdults} adulto{activeAdults !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-300 shrink-0" />
              <span className="text-xs text-fog">{activeChildren} niño{activeChildren !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      )}

      {/* Stat boxes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ key, label, value, accent, border, icon }) => (
          <button
            key={key}
            onClick={() => handleStatClick(key)}
            className={`rounded-2xl border bg-surface p-4 lg:p-5 text-left transition-colors ${activeDrawer === key ? border + ' bg-surface2' : 'border-line hover:border-line2'}`}
          >
            <div className={`mb-1.5 ${activeDrawer === key ? accent : 'text-fog'}`}>{icon}</div>
            <div className="font-display text-2xl lg:text-3xl font-semibold text-snow">{value}</div>
            <div className={`text-xs lg:text-sm mt-0.5 ${activeDrawer === key ? accent : 'text-fog'}`}>{label}</div>
          </button>
        ))}
      </div>

      {activeDrawer && (
        <div ref={drawerRef} className="rounded-2xl border border-line bg-surface p-4">
          <h3 className="text-xs font-semibold text-fog uppercase tracking-wide mb-3">
            {stats.find(s => s.key === activeDrawer)?.label}
          </h3>
          {activeDrawer === 'cumpleanos' ? (
            todayBirthdays.length === 0 ? (
              <p className="text-sm text-mist">Sin cumpleaños hoy</p>
            ) : (
              <div className="space-y-2">
                {todayBirthdays.map(m => {
                  const age = new Date().getFullYear() - new Date(m.birth_date).getFullYear()
                  return (
                    <Link key={m.id} href={`/miembros/${m.id}`}
                      className="flex items-center justify-between rounded-xl border border-line bg-carbon px-4 py-3 hover:border-line2 transition-colors"
                    >
                      <p className="font-semibold text-sm text-snow">{m.name}</p>
                      <span className="text-sm font-bold text-rose">{age} años 🎂</span>
                    </Link>
                  )
                })}
              </div>
            )
          ) : activeDrawer === 'ninos' ? (
            childrenInSala.length === 0 ? (
              <p className="text-sm text-mist">Sin niños en sala</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeVisits.filter(v => (v.children_present?.length ?? 0) > 0).map(visit => {
                  const checkinTime = new Date(visit.checked_in_at)
                  const elapsedMin = Math.floor((Date.now() - checkinTime.getTime()) / 60000)
                  const elapsed = elapsedMin < 60
                    ? `${elapsedMin} min`
                    : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}min`
                  return (
                    <div key={visit.id} className="rounded-xl border border-line bg-carbon px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {(visit.children_present ?? []).map((c, i) => (
                              <span key={i} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-lime text-ink">
                                {c.name} · {c.age}a
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-fog">{visit.members?.name ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                          <div className="text-right">
                            <p className="text-xs text-mist">{checkinTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                            <p className="text-[11px] text-fog">{elapsed}</p>
                          </div>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${visit.membership_id ? 'bg-lime' : 'bg-amber'}`} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : drawerVisits.length === 0 ? (
            <p className="text-sm text-mist">Sin entradas</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {drawerVisits.map(visit => {
                const kids = visit.children_present ?? []
                return (
                  <Link
                    key={visit.id}
                    href="/checkin?tab=dentro"
                    className="flex items-start justify-between rounded-xl border border-line bg-carbon px-4 py-3 hover:border-line2 transition-colors gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      {kids.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {kids.map((c, i) => (
                            <span key={i} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-lime text-ink">
                              {c.name} · {c.age}a
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-fog">{visit.members?.name ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <span className="text-xs text-mist">
                        {new Date(visit.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${visit.membership_id ? 'bg-lime' : 'bg-amber'}`} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}


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

    </div>
  )
}
