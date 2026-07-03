'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { LogIn, CreditCard, UserX, Users, CalendarClock, Cake, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react'
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
  children_present: { name: string; age?: number; birth_date?: string }[] | null
  adults_count: number
  children_count: number
  members: { name: string } | null
}

type BirthdayMember = {
  name: string
  birth_date: string
  titularName: string
  booking: { start_time: string | null; end_time: string | null; guests: number | null; title: string } | null
}

type HomeClientProps = {
  todayVisits: TodayVisit[]
  todayCustodias: TodayVisit[]
  monthCount: number
  dateLabel: string
  capacity: number | null
  todayBirthdays: BirthdayMember[]
}

type DrawerKey = 'ninos' | 'entradasHoy' | 'conBono' | 'sinBono' | 'custodias' | 'cumpleanos' | null

function fmtChildAge(birth_date?: string, fallbackAge?: number): string {
  if (birth_date) {
    const now = new Date()
    const dob = new Date(birth_date)
    let years = now.getFullYear() - dob.getFullYear()
    let months = now.getMonth() - dob.getMonth()
    if (now.getDate() < dob.getDate()) months--
    if (months < 0) { years--; months += 12 }
    if (years === 0) return `${months}m`
    if (months === 0) return `${years}a`
    return `${years}a ${months}m`
  }
  if (fallbackAge != null) return `${fallbackAge}a`
  return ''
}

function fmtElapsed(checkedInAt: string): string {
  const mins = Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60000)
  const h = Math.floor(mins / 60), m = mins % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

type ChildInSala = { name: string; age?: number; birth_date?: string; memberName: string }

export default function HomeClient({ todayVisits, todayCustodias, monthCount, dateLabel, capacity, todayBirthdays }: HomeClientProps) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey>(null)
  const [showCharts, setShowCharts] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  const persons = (v: TodayVisit) => (v.adults_count ?? 1) + (v.children_count ?? 0)

  const activeVisits = todayVisits.filter(v => !v.checked_out_at)
  const activeAdults = activeVisits.reduce((s, v) => s + (v.adults_count ?? 1), 0)
  const activeChildren = activeVisits.reduce((s, v) => s + (v.children_count ?? 0), 0)
  const activeTotal = activeAdults + activeChildren
  const childrenInSala: ChildInSala[] = activeVisits.flatMap(v =>
    (v.children_present ?? []).map(c => ({ ...c, memberName: v.members?.name ?? '—' }))
  )

  const conBonoVisits = todayVisits.filter(v => v.membership_id)
  const sinBonoVisits = todayVisits.filter(v => !v.membership_id)

  const buckets = Array.from({ length: 24 }, (_, h) => {
    const hourVisits = todayVisits.filter(v => new Date(v.checked_in_at).getHours() === h)
    const adultos = hourVisits.reduce((s, v) => s + (v.adults_count ?? 1), 0)
    const ninos = hourVisits.reduce((s, v) => s + (v.children_count ?? 0), 0)
    return {
      hour: `${String(h).padStart(2, '0')}h`,
      adultos,
      ninos,
      conBono: hourVisits.filter(v => v.membership_id).reduce((s, v) => s + persons(v), 0),
      sinBono: hourVisits.filter(v => !v.membership_id).reduce((s, v) => s + persons(v), 0),
    }
  })
  const chartData = buckets.slice(7, 23)

  const stats: { key: DrawerKey; label: string; value: number; accent: string; border: string; bg: string; visits: TodayVisit[]; icon: React.ReactNode }[] = [
    { key: 'ninos',       label: 'Niños en sala', value: activeChildren,                                         accent: 'text-cyan-300', border: 'border-cyan-300/40', bg: 'bg-cyan-300/10', visits: [],             icon: <Users size={13} /> },
    { key: 'entradasHoy', label: 'Entradas hoy',  value: todayVisits.reduce((s, v) => s + persons(v), 0),       accent: 'text-lime',     border: 'border-lime/40',     bg: 'bg-lime/10',     visits: todayVisits,    icon: <LogIn size={13} /> },
    { key: 'conBono',     label: 'Con bono',       value: conBonoVisits.reduce((s, v) => s + persons(v), 0),     accent: 'text-iris',     border: 'border-iris/40',     bg: 'bg-iris/10',     visits: conBonoVisits,  icon: <CreditCard size={13} /> },
    { key: 'sinBono',     label: 'Sin bono',       value: sinBonoVisits.reduce((s, v) => s + persons(v), 0),     accent: 'text-amber',    border: 'border-amber/40',    bg: 'bg-amber/10',    visits: sinBonoVisits,  icon: <UserX size={13} /> },
    { key: 'custodias',   label: 'Custodias',      value: todayCustodias.reduce((s, v) => s + persons(v), 0),   accent: 'text-mint',     border: 'border-mint/40',     bg: 'bg-mint/10',     visits: todayCustodias, icon: <CalendarClock size={13} /> },
    { key: 'cumpleanos',  label: 'Cumpleaños',     value: todayBirthdays.length,                                 accent: 'text-rose',     border: 'border-rose/40',     bg: 'bg-rose/10',     visits: [],             icon: <Cake size={13} /> },
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
        <div className="min-w-0">
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow truncate">{tenantName ?? 'Mi establecimiento'}</h1>
          <p className="text-sm text-fog capitalize mt-0.5">{dateLabel}</p>
        </div>
        <Link
          href="/checkin"
          className="flex items-center gap-1.5 bg-lime text-ink font-semibold rounded-xl px-4 py-2.5 text-sm shrink-0 active:scale-95 transition-transform"
          style={{ boxShadow: 'var(--shadow-lime)' }}
        >
          <LogIn size={15} strokeWidth={2.4} />
          Registrar visita
        </Link>
      </div>

      {/* Aforo — primero, es lo más urgente */}
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
          <div className="h-3 w-full rounded-full bg-line overflow-hidden mb-3 flex">
            <div className="h-full bg-lime transition-all duration-500" style={{ width: `${capacity ? Math.min(100, (activeAdults / capacity) * 100) : 0}%` }} />
            <div className="h-full bg-cyan-300 transition-all duration-500" style={{ width: `${capacity ? Math.min(100, (activeChildren / capacity) * 100) : 0}%` }} />
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-lime shrink-0" />
              <span className="text-xs text-fog"><span className="text-lime font-semibold">{activeAdults}</span> adulto{activeAdults !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-300 shrink-0" />
              <span className="text-xs text-fog"><span className="text-cyan-300 font-semibold">{activeChildren}</span> niño{activeChildren !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      )}

      {/* Stat boxes */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ key, label, value, accent, border, bg, icon }) => {
          const isOpen = activeDrawer === key
          return (
            <button
              key={key}
              onClick={() => handleStatClick(key)}
              className={`group rounded-2xl border bg-surface p-3 flex flex-col gap-2 text-left transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${
                isOpen
                  ? `${border} ring-1 ring-inset ${border} bg-surface2`
                  : 'border-line hover:border-line2 hover:bg-surface2'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center transition-transform group-hover:scale-110 ${accent}`}>
                  {icon}
                </div>
                {isOpen
                  ? <ChevronUp size={10} className={accent} />
                  : <ChevronDown size={10} className="text-fog group-hover:text-snow transition-colors" />
                }
              </div>
              <div>
                <div className={`font-display text-3xl font-bold leading-none ${value > 0 ? accent : 'text-fog'}`}>{value}</div>
                <div className="text-[11px] font-semibold text-snow mt-1 leading-tight">{label}</div>
              </div>
            </button>
          )
        })}
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
                {todayBirthdays.map((m, i) => (
                  <Link key={i} href="/calendario"
                    className="flex items-start justify-between rounded-xl border border-line bg-carbon px-4 py-3 hover:border-line2 transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-cyan-300">{m.name} · {fmtChildAge(m.birth_date)}</p>
                      <p className="text-xs text-fog mt-0.5">{m.titularName}</p>
                      <p className="text-[10px] text-lime mt-1 font-medium">→ Ver en agenda</p>
                    </div>
                    <div className="text-right shrink-0">
                      {m.booking ? (
                        <>
                          <p className="text-xs text-mist">
                            {m.booking.start_time?.slice(0, 5) ?? '—'}
                            {m.booking.end_time ? ` → ${m.booking.end_time.slice(0, 5)}` : ''}
                          </p>
                          {m.booking.guests && (
                            <p className="text-[11px] text-fog">{m.booking.guests} invitados</p>
                          )}
                        </>
                      ) : (
                        <p className="text-[11px] text-fog">Sin reserva</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : activeDrawer === 'ninos' ? (
            childrenInSala.length === 0 ? (
              <p className="text-sm text-mist">Sin niños en sala</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeVisits.filter(v => (v.children_present?.length ?? 0) > 0).map(visit => (
                    <div key={visit.id} className="rounded-xl border border-line bg-carbon px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-1">
                            {(visit.children_present ?? []).map((c, i) => (
                              <span key={i} className="text-[11px] font-semibold text-cyan-300">
                                {c.name}{fmtChildAge(c.birth_date, c.age) ? ` · ${fmtChildAge(c.birth_date, c.age)}` : ''}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-fog">{visit.members?.name ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                          <div className="text-right">
                            <p className="text-xs text-mist">{fmtTime(visit.checked_in_at)}</p>
                            <p className="text-[11px] text-fog">{fmtElapsed(visit.checked_in_at)}</p>
                          </div>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${visit.membership_id ? 'bg-iris' : 'bg-amber'}`} />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )
          ) : activeDrawer === 'custodias' ? (
            drawerVisits.length === 0 ? (
              <p className="text-sm text-mist">Sin custodias hoy</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {drawerVisits.map(visit => {
                  const kids = visit.children_present ?? []
                  const isActive = !visit.checked_out_at
                  return (
                    <div key={visit.id} className="rounded-xl border border-line bg-carbon px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {kids.length > 0 && (
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-1">
                              {kids.map((c, i) => (
                                <span key={i} className="text-[11px] font-semibold text-cyan-300">
                                  {c.name}{fmtChildAge(c.birth_date, c.age) ? ` · ${fmtChildAge(c.birth_date, c.age)}` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-fog">{visit.members?.name ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                          <div className="text-right">
                            <p className="text-xs text-mist">
                              {fmtTime(visit.checked_in_at)}
                              {visit.checked_out_at ? ` → ${fmtTime(visit.checked_out_at)}` : ' → en curso'}
                            </p>
                            {isActive && <p className="text-[11px] text-fog">{fmtElapsed(visit.checked_in_at)}</p>}
                          </div>
                          <span className={`w-2 h-2 rounded-full ${visit.membership_id ? 'bg-iris' : 'bg-amber'}`} />
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
                const isActive = !visit.checked_out_at
                return (
                  <Link
                    key={visit.id}
                    href="/checkin?tab=dentro"
                    className="flex items-start justify-between rounded-xl border border-line bg-carbon px-4 py-3 hover:border-line2 transition-colors gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      {kids.length > 0 && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-1">
                          {kids.map((c, i) => (
                            <span key={i} className="text-[11px] font-semibold text-cyan-300">
                              {c.name}{fmtChildAge(c.birth_date, c.age) ? ` · ${fmtChildAge(c.birth_date, c.age)}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-fog">{visit.members?.name ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <div className="text-right">
                        <p className="text-xs text-mist">{fmtTime(visit.checked_in_at)}</p>
                        {isActive && <p className="text-[11px] text-fog">{fmtElapsed(visit.checked_in_at)}</p>}
                      </div>
                      <span className={`w-2 h-2 rounded-full ${visit.membership_id ? 'bg-iris' : 'bg-amber'}`} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Charts — collapsible on mobile */}
      <button
        onClick={() => setShowCharts(v => !v)}
        className="flex items-center gap-2 text-xs font-semibold text-fog hover:text-snow transition-colors md:hidden"
      >
        <BarChart2 size={13} />
        Gráficas del día
        {showCharts ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${showCharts ? '' : 'hidden md:grid'}`}>
        <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-4">Afluencia por hora · bono / sin bono</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 0, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="#1e2530" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: '12px', color: '#f0f4f8' }} labelStyle={{ color: '#6b7280', fontSize: 11 }} cursor={{ stroke: '#1e2530' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 8 }} formatter={(value) => value === 'conBono' ? 'Con bono' : 'Sin bono'} />
              <Line type="monotone" dataKey="conBono" stroke="#8b8bff" strokeWidth={2} dot={false} />
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

    </div>
  )
}
