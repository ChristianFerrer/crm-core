'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { LogIn, CreditCard, UserX, Users, CalendarClock, Cake, ChevronDown, ChevronUp, BarChart2, Activity, X } from 'lucide-react'
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
  Cell,
  LabelList,
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

type TodayBooking = {
  id: string
  type: 'birthday' | 'custodia' | 'other'
  start_time: string | null
  end_time: string | null
  guests: number | null
  executed_at: string | null
}

type HomeClientProps = {
  todayVisits: TodayVisit[]
  todayCustodias: TodayVisit[]
  monthCount: number
  dateLabel: string
  capacity: number | null
  todayBirthdays: BirthdayMember[]
  todayBookings: TodayBooking[]
}

type DrawerKey = 'ninos' | 'entradasHoy' | 'conBono' | 'sinBono' | 'custodias' | 'cumpleanos' | null

function StackedBar({ x, y, width, height, fill, roundTop }: {
  x?: number; y?: number; width?: number; height?: number; fill?: string; roundTop?: boolean
}) {
  const _x = x ?? 0, _y = y ?? 0, _w = width ?? 0, _h = height ?? 0
  if (_h <= 0 || _w <= 0) return null
  const r = roundTop ? Math.min(4, _w / 2, _h) : 0
  const d = r === 0
    ? `M${_x},${_y+_h} L${_x},${_y} L${_x+_w},${_y} L${_x+_w},${_y+_h} Z`
    : `M${_x},${_y+_h} L${_x},${_y+r} Q${_x},${_y} ${_x+r},${_y} L${_x+_w-r},${_y} Q${_x+_w},${_y} ${_x+_w},${_y+r} L${_x+_w},${_y+_h} Z`
  return <path d={d} fill={fill} />
}

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

export default function HomeClient({ todayVisits, todayCustodias, monthCount, dateLabel, capacity, todayBirthdays, todayBookings }: HomeClientProps) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey>(null)
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

  // Ocupación planificada por hora separada por tipo
  const planByBirthday = Array(24).fill(0)
  const planByCustodia = Array(24).fill(0)
  const planByOther    = Array(24).fill(0)
  for (const b of todayBookings) {
    if (!b.start_time) continue
    // Already executed custodia/other → real visit already counted, don't show as planificado
    if (b.executed_at && (b.type === 'custodia' || b.type === 'other')) continue
    const startH = parseInt(b.start_time.split(':')[0])
    const endH = b.end_time ? parseInt(b.end_time.split(':')[0]) : startH + 2
    const expected = b.type === 'birthday' ? (b.guests ?? 10) : 2
    const arr = b.type === 'birthday' ? planByBirthday : b.type === 'custodia' ? planByCustodia : planByOther
    for (let h = startH; h < Math.min(endH, 24); h++) {
      arr[h] += expected
    }
  }

  const currentHour = new Date().getHours()
  const currentHourLabel = `${String(currentHour).padStart(2, '0')}h`

  const buckets = Array.from({ length: 24 }, (_, h) => {
    // Ocupación real: visitas activas DURANTE la hora h (no solo las que entraron en h)
    const hourVisits = todayVisits.filter(v => {
      const inH = new Date(v.checked_in_at).getHours()
      const outH = v.checked_out_at ? new Date(v.checked_out_at).getHours() : 25
      return inH <= h && outH > h
    })
    const adultos = hourVisits.reduce((s, v) => s + (v.adults_count ?? 1), 0)
    const ninos = hourVisits.reduce((s, v) => s + (v.children_count ?? 0), 0)
    return {
      hour: `${String(h).padStart(2, '0')}h`,
      adultos,
      ninos,
      conBono: hourVisits.filter(v => v.membership_id).reduce((s, v) => s + persons(v), 0),
      sinBono: hourVisits.filter(v => !v.membership_id).reduce((s, v) => s + persons(v), 0),
      planBirthday: planByBirthday[h] || null,
      planCustodia: planByCustodia[h] || null,
      planOther:    planByOther[h]    || null,
    }
  })
  const chartData = buckets.slice(7, 24).map((b, i) => {
    const h = i + 7
    const isFuture = h > currentHour
    const adultos = isFuture ? 0 : b.adultos
    const ninos   = isFuture ? 0 : b.ninos
    const alcanzado = isFuture ? null : ((adultos + ninos) || null)
    const pb = isFuture ? (b.planBirthday ?? 0) : 0
    const pc = isFuture ? (b.planCustodia ?? 0) : 0
    const po = isFuture ? (b.planOther ?? 0) : 0
    const reservado = isFuture ? ((pb + pc + po) || null) : null
    return {
      hour: b.hour,
      alcanzado,
      reservado,
      conBono: isFuture ? null : b.conBono,
      sinBono: isFuture ? null : b.sinBono,
      // detail fields for click panel
      adultos: isFuture ? null : adultos,
      ninos:   isFuture ? null : ninos,
      planBirthday: pb || null,
      planCustodia: pc || null,
      planOther:    po || null,
      _alcanzadoLabel: !isFuture && (adultos + ninos) > 0 ? adultos + ninos : null,
      _reservadoLabel: isFuture && (pb + pc + po) > 0 ? pb + pc + po : null,
    }
  })

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

      {/* Top row: Aforo por hora | Afluencia bono/sin bono */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Aforo por hora */}
        <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-4 flex items-center gap-1.5">
            <BarChart2 size={13} /> Aforo por hora
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="#1e2530" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="hour" tick={({ x, y, payload }: any) => (
                <text x={x} y={y + 10} textAnchor="middle"
                  fontSize={payload.value === currentHourLabel ? 13 : 10}
                  fill={payload.value === currentHourLabel ? '#c6f24e' : '#6b7280'}
                  fontWeight={payload.value === currentHourLabel ? 700 : 400}>
                  {payload.value}
                </text>
              )} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={({ active, label }: any) => {
                  if (!active) return null
                  const entry = chartData.find(d => d.hour === label)
                  if (!entry) return null
                  return (
                    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, padding: '10px 14px', fontSize: 11 }}>
                      <p style={{ color: '#9ca3af', marginBottom: 6 }}>{label}</p>
                      {entry.alcanzado != null ? (
                        <>
                          <p style={{ color: '#38bdf8', fontWeight: 600 }}>Alcanzado: {entry.alcanzado}</p>
                          <p style={{ color: '#6b7280', marginTop: 4 }}>
                            {entry.adultos} adulto{entry.adultos !== 1 ? 's' : ''} · {entry.ninos} niño{entry.ninos !== 1 ? 's' : ''}
                          </p>
                        </>
                      ) : entry.reservado != null ? (
                        <>
                          <p style={{ color: '#fb923c', fontWeight: 600 }}>Reservado: {entry.reservado}</p>
                          {entry.planBirthday ? <p style={{ color: '#6b7280', marginTop: 4 }}>Cumpleaños: {entry.planBirthday}</p> : null}
                          {entry.planCustodia ? <p style={{ color: '#6b7280', marginTop: 2 }}>Custodias: {entry.planCustodia}</p> : null}
                          {entry.planOther    ? <p style={{ color: '#6b7280', marginTop: 2 }}>Otros: {entry.planOther}</p>         : null}
                        </>
                      ) : (
                        <p style={{ color: '#6b7280' }}>Sin datos</p>
                      )}
                    </div>
                  )
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                align="left"
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(v) => <span style={{ color: '#9ca3af' }}>{v}</span>}
              />
              <Bar dataKey="alcanzado" stackId="a" fill="#38bdf8" name="Alcanzado"
                shape={(p: any) => <StackedBar {...p} roundTop={!p.reservado} />}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i + 7 === currentHour ? '#38bdf8' : 'rgba(56,189,248,0.6)'} />
                ))}
                <LabelList dataKey="_alcanzadoLabel" position="top" style={{ fill: '#9ca3af', fontSize: 9, fontWeight: 600 }} />
              </Bar>
              <Bar dataKey="reservado" stackId="a" fill="#fb923c" name="Reservado"
                shape={(p: any) => <StackedBar {...p} roundTop />}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i + 7 === currentHour ? '#fb923c' : 'rgba(251,146,60,0.6)'} />
                ))}
                <LabelList dataKey="_reservadoLabel" position="top" style={{ fill: '#9ca3af', fontSize: 9, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Afluencia bono/sin bono */}
        <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-4 flex items-center gap-1.5">
            <Activity size={13} /> Afluencia por hora · bono / sin bono
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 0, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="#1e2530" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: '12px' }}
                labelStyle={{ color: '#6b7280', fontSize: 11 }}
                itemStyle={{ color: '#f0f4f8', fontSize: 11 }}
                cursor={{ stroke: '#1e2530' }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                align="left"
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(v) => <span style={{ color: '#9ca3af' }}>{v === 'conBono' ? 'Con bono' : 'Sin bono'}</span>}
              />
              <Line type="monotone" dataKey="conBono" stroke="#8b8bff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sinBono" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Aforo en tiempo real — debajo de los charts */}
      {capacity != null && (
        <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Users size={13} /> Aforo en tiempo real
            <span className="relative flex h-3 w-3 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-90" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-lime" />
            </span>
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


    </div>
  )
}
