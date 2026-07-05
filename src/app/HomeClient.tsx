'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogIn, CreditCard, UserX, Users, CalendarClock, Cake, ChevronDown, ChevronUp, BarChart2, Activity, X, LogOut, MoreHorizontal } from 'lucide-react'
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
  title: string
  start_time: string | null
  end_time: string | null
  guests: number | null
  executed_at: string | null
  member_id: string | null
  members: { name: string } | null
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

type DrawerKey = 'enSala' | 'conBono' | 'sinBono' | 'custodias' | 'cumpleanos' | 'otros' | null

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
    const parts: string[] = []
    if (years > 0) parts.push(`${years} año${years !== 1 ? 's' : ''}`)
    if (months > 0) parts.push(`${months} mes${months !== 1 ? 'es' : ''}`)
    return parts.length > 0 ? parts.join(' ') : 'recién nacido'
  }
  if (fallbackAge != null) return `${fallbackAge} año${fallbackAge !== 1 ? 's' : ''}`
  return ''
}

function fmtVisitType(type: string): string {
  if (type === 'custodia') return 'Custodia'
  if (type === 'birthday') return 'Cumpleaños'
  return 'Libre'
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

export default function HomeClient({ todayVisits, todayCustodias, monthCount, dateLabel, capacity, todayBirthdays, todayBookings }: HomeClientProps) {
  const router = useRouter()
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const persons = (v: TodayVisit) => (v.adults_count ?? 1) + (v.children_count ?? 0)

  const activeVisits = todayVisits.filter(v => !v.checked_out_at)
  const activeAdults = activeVisits.reduce((s, v) => s + (v.adults_count ?? 1), 0)
  const activeChildren = activeVisits.reduce((s, v) => s + (v.children_count ?? 0), 0)
  const activeTotal = activeAdults + activeChildren

  const conBonoActive = activeVisits.filter(v => v.membership_id)
  const sinBonoActive = activeVisits.filter(v => !v.membership_id)
  const custodiasActive = activeVisits.filter(v => v.visit_type === 'custodia')
  const otrosActive = activeVisits.filter(v => v.visit_type !== 'custodia' && v.visit_type !== 'birthday')

  async function handleCheckout(visitId: string) {
    setCheckingOut(visitId)
    await supabase.from('visits').update({ checked_out_at: new Date().toISOString() }).eq('id', visitId)
    setCheckingOut(null)
    router.refresh()
  }

  // Reservas de agenda por categoría (para boxes)
  const custodiaBookings = todayBookings.filter(b => b.type === 'custodia')
  const birthdayBookings2 = todayBookings.filter(b => b.type === 'birthday')
  const otherBookings = todayBookings.filter(b => b.type === 'other')

  // Ocupación planificada por hora — incluye TODAS las reservas confirmadas
  // El chart ya diferencia horas pasadas (actuals) vs futuras (plan), sin double-counting
  const planByBirthday = Array(24).fill(0)
  const planByCustodia = Array(24).fill(0)
  const planByOther    = Array(24).fill(0)
  for (const b of todayBookings) {
    if (!b.start_time) continue
    const startH = parseInt(b.start_time.split(':')[0])
    const endH = b.end_time ? parseInt(b.end_time.split(':')[0]) : startH + 2
    const expected = b.type === 'birthday' ? (b.guests ?? 10) : (b.guests ?? 2)
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
  // Para la hora actual, usar siempre los conteos en tiempo real (coincide con "En sala" y "Aforo en tiempo real")
  const activeConBono = activeVisits.filter(v => v.membership_id).reduce((s, v) => s + persons(v), 0)
  const activeSinBono = activeVisits.filter(v => !v.membership_id).reduce((s, v) => s + persons(v), 0)

  const chartData = buckets.slice(7, 24).map((b, i) => {
    const h = i + 7
    const isCurrent = h === currentHour
    const isFuture = h > currentHour
    // Hora actual → usar conteo en vivo; horas pasadas → usar bucket histórico
    const adultos = isFuture ? 0 : (isCurrent ? activeAdults : b.adultos)
    const ninos   = isFuture ? 0 : (isCurrent ? activeChildren : b.ninos)
    const alcanzado = isFuture ? null : ((adultos + ninos) || null)
    const pb = isFuture ? (b.planBirthday ?? 0) : 0
    const pc = isFuture ? (b.planCustodia ?? 0) : 0
    const po = isFuture ? (b.planOther ?? 0) : 0
    const reservado = isFuture ? ((pb + pc + po) || null) : null
    return {
      hour: b.hour,
      alcanzado,
      reservado,
      conBono: isFuture ? null : (isCurrent ? activeConBono : b.conBono),
      sinBono: isFuture ? null : (isCurrent ? activeSinBono : b.sinBono),
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
    { key: 'enSala',     label: 'En sala',    value: activeTotal,                                          accent: 'text-cyan-300', border: 'border-cyan-300/40', bg: 'bg-cyan-300/10', visits: activeVisits,    icon: <Users size={13} /> },
    { key: 'conBono',    label: 'Con bono',   value: conBonoActive.reduce((s, v) => s + persons(v), 0),   accent: 'text-iris',     border: 'border-iris/40',     bg: 'bg-iris/10',     visits: conBonoActive,   icon: <CreditCard size={13} /> },
    { key: 'sinBono',    label: 'Sin bono',   value: sinBonoActive.reduce((s, v) => s + persons(v), 0),   accent: 'text-amber',    border: 'border-amber/40',    bg: 'bg-amber/10',    visits: sinBonoActive,   icon: <UserX size={13} /> },
    { key: 'custodias',  label: 'Custodias',  value: custodiaBookings.length,                             accent: 'text-mint',     border: 'border-mint/40',     bg: 'bg-mint/10',     visits: custodiasActive, icon: <CalendarClock size={13} /> },
    { key: 'otros',      label: 'Otros',      value: otherBookings.length || otrosActive.reduce((s, v) => s + persons(v), 0), accent: 'text-lime', border: 'border-lime/40', bg: 'bg-lime/10', visits: otrosActive, icon: <MoreHorizontal size={13} /> },
    { key: 'cumpleanos', label: 'Cumpleaños', value: birthdayBookings2.length || todayBirthdays.length,   accent: 'text-rose',     border: 'border-rose/40',     bg: 'bg-rose/10',     visits: [],              icon: <Cake size={13} /> },
  ]

  const drawerVisits = activeDrawer && activeDrawer !== 'cumpleanos'
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
              <BarChart2 size={13} /> Aforo por hora
            </h2>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-fog">
                <span className="w-2 h-2 rounded-full bg-[#38bdf8] shrink-0" /> Alcanzado
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-fog">
                <span className="w-2 h-2 rounded-full bg-[#fb923c] shrink-0" /> Reservado
              </span>
            </div>
          </div>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
              <Activity size={13} /> Afluencia por hora
            </h2>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-fog">
                <span className="w-2 h-2 rounded-full bg-[#8b8bff] shrink-0" /> Con bono
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-fog">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0" /> Sin bono
              </span>
            </div>
          </div>
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
              <Line type="monotone" dataKey="conBono" name="Con bono" stroke="#8b8bff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sinBono" name="Sin bono" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Aforo en tiempo real — debajo de los charts */}
      {capacity != null && (
        <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-3 flex items-center gap-2">
            <Users size={13} /> Aforo
            <span className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white animate-pulse" />
              </span>
              En vivo
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
                          {m.booking.guests && <p className="text-[11px] text-fog">{m.booking.guests} invitados</p>}
                        </>
                      ) : (
                        <p className="text-[11px] text-fog">Sin reserva</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : (activeDrawer === 'custodias' || activeDrawer === 'otros') ? (
            /* Drawer de custodias/otros: muestra reservas del día */
            (() => {
              const bookings = activeDrawer === 'custodias' ? custodiaBookings : otherBookings
              if (bookings.length === 0 && drawerVisits.length === 0) return <p className="text-sm text-mist">Sin reservas ni visitas hoy</p>
              return (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {bookings.map(b => {
                    const executed = !!b.executed_at
                    return (
                      <Link key={b.id} href="/calendario"
                        className="flex items-start justify-between rounded-xl border border-line bg-carbon px-4 py-3 hover:border-line2 transition-colors gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-xs font-semibold text-snow">{b.title}</p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${executed ? 'bg-mint/10 text-mint border-mint/30' : 'bg-surface2 text-fog border-line'}`}>
                              {executed ? 'Ejecutado' : 'Pendiente'}
                            </span>
                          </div>
                          {b.members?.name && <p className="text-[11px] text-fog">{b.members.name}</p>}
                          {b.guests != null && <p className="text-[11px] text-fog mt-0.5">{b.guests} {activeDrawer === 'custodias' ? 'niño' + (b.guests !== 1 ? 's' : '') : 'persona' + (b.guests !== 1 ? 's' : '')}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-mist">{b.start_time?.slice(0, 5) ?? '—'}{b.end_time ? ` → ${b.end_time.slice(0, 5)}` : ''}</p>
                          <p className="text-[10px] text-lime mt-1">→ Ver agenda</p>
                        </div>
                      </Link>
                    )
                  })}
                  {/* Visitas activas adicionales no vinculadas a reserva */}
                  {drawerVisits.filter(v => !custodiaBookings.some(() => false)).map(visit => {
                    const kids = visit.children_present ?? []
                    const bono = visit.membership_id
                    return (
                      <div key={visit.id} className="rounded-xl border border-line bg-carbon px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-xs font-semibold text-snow">{visit.members?.name ?? '—'}</p>
                              <span className={`text-[10px] font-medium ${bono ? 'text-iris' : 'text-amber'}`}>{bono ? 'Con bono' : 'Sin bono'}</span>
                            </div>
                            {kids.map((c, i) => <p key={i} className="text-[11px] text-cyan-300">{c.name}{fmtChildAge(c.birth_date, c.age) ? ` · ${fmtChildAge(c.birth_date, c.age)}` : ''}</p>)}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <p className="text-xs text-mist">{fmtTime(visit.checked_in_at)}</p>
                            <p className="text-[11px] text-fog">{fmtElapsed(visit.checked_in_at)}</p>
                            <button onClick={() => handleCheckout(visit.id)} disabled={checkingOut === visit.id}
                              className="flex items-center gap-1 text-[10px] font-medium text-rose bg-rose/10 border border-rose/30 rounded-lg px-2 py-1 hover:bg-rose/20 transition-colors disabled:opacity-50">
                              <LogOut size={10} />{checkingOut === visit.id ? '...' : 'Salida'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()
          ) : drawerVisits.length === 0 ? (
            <p className="text-sm text-mist">Sin personas en sala</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {drawerVisits.map(visit => {
                const kids = visit.children_present ?? []
                const bono = visit.membership_id
                return (
                  <div key={visit.id} className="rounded-xl border border-line bg-carbon px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-xs font-semibold text-snow">{visit.members?.name ?? '—'}</p>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-surface2 text-fog border border-line">
                            {fmtVisitType(visit.visit_type)}
                          </span>
                          <span className={`text-[10px] font-medium ${bono ? 'text-iris' : 'text-amber'}`}>
                            {bono ? 'Con bono' : 'Sin bono'}
                          </span>
                        </div>
                        {kids.length > 0 && (
                          <div className="space-y-0.5 mt-1">
                            {kids.map((c, i) => {
                              const age = fmtChildAge(c.birth_date, c.age)
                              return <p key={i} className="text-[11px] text-cyan-300">{c.name}{age ? ` · ${age}` : ''}</p>
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <p className="text-xs text-mist">{fmtTime(visit.checked_in_at)}</p>
                        <p className="text-[11px] text-fog">{fmtElapsed(visit.checked_in_at)}</p>
                        <button onClick={() => handleCheckout(visit.id)} disabled={checkingOut === visit.id}
                          className="flex items-center gap-1 text-[10px] font-medium text-rose bg-rose/10 border border-rose/30 rounded-lg px-2 py-1 hover:bg-rose/20 transition-colors disabled:opacity-50">
                          <LogOut size={10} />{checkingOut === visit.id ? '...' : 'Salida'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}


    </div>
  )
}
