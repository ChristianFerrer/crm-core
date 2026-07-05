'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LogIn, Users, CalendarClock, Cake, ChevronDown, ChevronUp,
  BarChart2, Activity, LogOut, AlertTriangle, Play, Clock,
  Check, ShoppingCart, Plus, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant, loadAndStoreTenant } from '@/lib/tenant'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LabelList,
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

type Product = {
  id: string
  name: string
  category: string
  price: number
  emoji: string
}

type CheckItem = {
  id: string
  product_id: string | null
  name: string
  quantity: number
  unit_price: number
}

type OpenCheck = {
  id: string
  items: CheckItem[]
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

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function HomeClient({ todayVisits, monthCount, dateLabel, capacity, todayBirthdays, todayBookings }: HomeClientProps) {
  const router = useRouter()
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [confirmCheckout, setConfirmCheckout] = useState<string | null>(null)
  const [executingBooking, setExecutingBooking] = useState<string | null>(null)
  const [chartsOpen, setChartsOpen] = useState(false)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [openChecks, setOpenChecks] = useState<Map<string, OpenCheck>>(new Map())
  const [consumosVisitId, setConsumosVisitId] = useState<string | null>(null)
  const [addingProduct, setAddingProduct] = useState<string | null>(null)

  const persons = (v: TodayVisit) => (v.adults_count ?? 1) + (v.children_count ?? 0)
  const activeVisits = todayVisits.filter(v => !v.checked_out_at)
  const activeAdults = activeVisits.reduce((s, v) => s + (v.adults_count ?? 1), 0)
  const activeChildren = activeVisits.reduce((s, v) => s + (v.children_count ?? 0), 0)
  const activeTotal = activeAdults + activeChildren
  const conBonoCount = activeVisits.filter(v => v.membership_id).reduce((s, v) => s + persons(v), 0)
  const sinBonoCount = activeVisits.filter(v => !v.membership_id).reduce((s, v) => s + persons(v), 0)

  const aforoPct = capacity ? Math.min(100, (activeTotal / capacity) * 100) : 0
  const aforoTextColor = aforoPct < 70 ? 'text-lime' : aforoPct <= 90 ? 'text-amber' : 'text-rose-500'

  // Load products & open checks
  useEffect(() => {
    supabase.from('products').select('id, name, category, price, emoji').eq('active', true).order('category').order('name')
      .then(({ data }) => { if (data) setProducts(data as Product[]) })
  }, [])

  const loadOpenChecks = useCallback(async () => {
    const visitIds = activeVisits.map(v => v.id)
    if (visitIds.length === 0) { setOpenChecks(new Map()); return }
    const { data } = await supabase
      .from('open_checks')
      .select('id, visit_id, open_check_items(id, product_id, name, quantity, unit_price)')
      .in('visit_id', visitIds)
      .eq('status', 'open')
    if (!data) return
    const map = new Map<string, OpenCheck>()
    for (const c of data as any[]) {
      if (c.visit_id) map.set(c.visit_id, { id: c.id, items: c.open_check_items ?? [] })
    }
    setOpenChecks(map)
  }, [activeVisits.map(v => v.id).join(',')])

  useEffect(() => { loadOpenChecks() }, [loadOpenChecks])

  // Tenant name
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

  // Alerts
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()

  const alertLongStay = activeVisits.filter(v =>
    (Date.now() - new Date(v.checked_in_at).getTime()) / 60000 > 180
  )
  const alertBirthdaySoon = todayBookings.filter(b => {
    if (b.type !== 'birthday' || b.executed_at || !b.start_time) return false
    const startMins = timeToMins(b.start_time)
    return startMins > nowMins && startMins - nowMins <= 60
  })
  const alertCustodiaSoon = todayBookings.filter(b => {
    if (b.type !== 'custodia' || !b.end_time) return false
    const endMins = timeToMins(b.end_time)
    return endMins > nowMins && endMins - nowMins <= 30
  })
  const totalAlerts = alertLongStay.length + alertBirthdaySoon.length + alertCustodiaSoon.length

  // Timeline
  const timeline = [...todayBookings].sort((a, b) =>
    (a.start_time ?? '00:00').localeCompare(b.start_time ?? '00:00')
  )

  function getBookingStatus(b: TodayBooking): 'ejecutado' | 'en_curso' | 'pendiente' | 'pasado' {
    if (b.executed_at) return 'ejecutado'
    if (!b.start_time) return 'pendiente'
    const startMins = timeToMins(b.start_time)
    const endMins = b.end_time ? timeToMins(b.end_time) : startMins + 120
    if (nowMins >= startMins && nowMins < endMins) return 'en_curso'
    if (nowMins >= endMins) return 'pasado'
    return 'pendiente'
  }

  async function handleCheckout(visitId: string) {
    setCheckingOut(visitId)
    const now = new Date().toISOString()
    // Close any open check for this visit
    const check = openChecks.get(visitId)
    if (check) {
      await supabase.from('open_checks').update({ closed_at: now, status: 'closed' }).eq('id', check.id)
    }
    await supabase.from('visits').update({ checked_out_at: now }).eq('id', visitId)
    setCheckingOut(null)
    setConfirmCheckout(null)
    setConsumosVisitId(null)
    router.refresh()
  }

  async function handleExecuteBooking(booking: TodayBooking) {
    setExecutingBooking(booking.id)
    const now = new Date().toISOString()
    await supabase.from('bookings').update({ executed_at: now }).eq('id', booking.id)
    if (booking.member_id) {
      // Calculate counts so that aforo is updated correctly
      let adultsCount = 1
      let childrenCount = 0
      if (booking.type === 'custodia') {
        adultsCount = 0
        childrenCount = booking.guests ?? 1
      } else if (booking.type === 'birthday') {
        adultsCount = 1
        childrenCount = booking.guests ?? 0
      } else {
        // other: guests are adults
        adultsCount = booking.guests ?? 1
        childrenCount = 0
      }
      await supabase.from('visits').insert({
        member_id: booking.member_id,
        visit_type: booking.type === 'custodia' ? 'custodia' : 'entrada',
        checked_in_at: now,
        adults_count: adultsCount,
        children_count: childrenCount,
        children_present: [],
        booking_id: booking.id,
      })
    }
    setExecutingBooking(null)
    router.refresh()
  }

  async function handleAddProduct(visitId: string, product: Product) {
    setAddingProduct(product.id + visitId)
    const tenantId = getStoredTenant()?.id
    const visit = activeVisits.find(v => v.id === visitId)

    let checkId = openChecks.get(visitId)?.id
    if (!checkId) {
      const { data: newCheck } = await supabase.from('open_checks').insert({
        tenant_id: tenantId,
        visit_id: visitId,
        member_id: visit?.member_id,
        member_name: visit?.members?.name ?? '',
        status: 'open',
        visit_type: visit?.visit_type ?? 'entrada',
      }).select('id').single()
      if (!newCheck) { setAddingProduct(null); return }
      checkId = (newCheck as any).id
    }

    const { data: newItem } = await supabase.from('open_check_items').insert({
      check_id: checkId,
      product_id: product.id,
      name: product.name,
      quantity: 1,
      unit_price: product.price,
      total: product.price,
    }).select('id, product_id, name, quantity, unit_price').single()

    if (newItem) {
      setOpenChecks(prev => {
        const next = new Map(prev)
        const existing = next.get(visitId) ?? { id: checkId!, items: [] }
        next.set(visitId, { ...existing, id: checkId!, items: [...existing.items, newItem as CheckItem] })
        return next
      })
    }
    setAddingProduct(null)
  }

  async function handleRemoveItem(visitId: string, itemId: string) {
    await supabase.from('open_check_items').delete().eq('id', itemId)
    setOpenChecks(prev => {
      const next = new Map(prev)
      const existing = next.get(visitId)
      if (existing) next.set(visitId, { ...existing, items: existing.items.filter(i => i.id !== itemId) })
      return next
    })
  }

  // Chart data
  const planByBirthday = Array(24).fill(0)
  const planByCustodia = Array(24).fill(0)
  const planByOther    = Array(24).fill(0)
  for (const b of todayBookings) {
    if (!b.start_time) continue
    const startH = parseInt(b.start_time.split(':')[0])
    const endH = b.end_time ? parseInt(b.end_time.split(':')[0]) : startH + 2
    const expected = b.type === 'birthday' ? (b.guests ?? 10) : (b.guests ?? 2)
    const arr = b.type === 'birthday' ? planByBirthday : b.type === 'custodia' ? planByCustodia : planByOther
    for (let h = startH; h < Math.min(endH, 24); h++) { arr[h] += expected }
  }

  const currentHour = new Date().getHours()
  const currentHourLabel = `${String(currentHour).padStart(2, '0')}h`
  const activeConBono = activeVisits.filter(v => v.membership_id).reduce((s, v) => s + persons(v), 0)
  const activeSinBono = activeVisits.filter(v => !v.membership_id).reduce((s, v) => s + persons(v), 0)

  const buckets = Array.from({ length: 24 }, (_, h) => {
    const hourVisits = todayVisits.filter(v => {
      const inH = new Date(v.checked_in_at).getHours()
      const outH = v.checked_out_at ? new Date(v.checked_out_at).getHours() : 25
      return inH <= h && outH > h
    })
    return {
      hour: `${String(h).padStart(2, '0')}h`,
      adultos: hourVisits.reduce((s, v) => s + (v.adults_count ?? 1), 0),
      ninos: hourVisits.reduce((s, v) => s + (v.children_count ?? 0), 0),
      conBono: hourVisits.filter(v => v.membership_id).reduce((s, v) => s + persons(v), 0),
      sinBono: hourVisits.filter(v => !v.membership_id).reduce((s, v) => s + persons(v), 0),
      planBirthday: planByBirthday[h] || null,
      planCustodia: planByCustodia[h] || null,
      planOther:    planByOther[h]    || null,
    }
  })

  const chartData = buckets.slice(7, 24).map((b, i) => {
    const h = i + 7
    const isCurrent = h === currentHour
    const isFuture = h > currentHour
    const adultos = isFuture ? 0 : (isCurrent ? activeAdults : b.adultos)
    const ninos   = isFuture ? 0 : (isCurrent ? activeChildren : b.ninos)
    const pb = isFuture ? (b.planBirthday ?? 0) : 0
    const pc = isFuture ? (b.planCustodia ?? 0) : 0
    const po = isFuture ? (b.planOther ?? 0) : 0
    return {
      hour: b.hour,
      alcanzado: isFuture ? null : ((adultos + ninos) || null),
      reservado: isFuture ? ((pb + pc + po) || null) : null,
      conBono: isFuture ? null : (isCurrent ? activeConBono : b.conBono),
      sinBono: isFuture ? null : (isCurrent ? activeSinBono : b.sinBono),
      adultos: isFuture ? null : adultos,
      ninos:   isFuture ? null : ninos,
      planBirthday: pb || null,
      planCustodia: pc || null,
      planOther:    po || null,
      _alcanzadoLabel: !isFuture && (adultos + ninos) > 0 ? adultos + ninos : null,
      _reservadoLabel: isFuture && (pb + pc + po) > 0 ? pb + pc + po : null,
    }
  })

  const bookingTypeStyle = {
    birthday: { bar: 'bg-rose', badge: 'bg-rose/10 text-rose border-rose/30', label: 'Cumpleaños' },
    custodia: { bar: 'bg-mint', badge: 'bg-mint/10 text-mint border-mint/30', label: 'Custodia' },
    other:    { bar: 'bg-lime', badge: 'bg-lime/10 text-lime border-lime/30', label: 'Otro' },
  }

  // Group products by category for the picker
  const productsByCategory = products.reduce<Record<string, Product[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  const consumosVisit = consumosVisitId ? activeVisits.find(v => v.id === consumosVisitId) : null

  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* ZONA 1 — Alertas */}
      {totalAlerts > 0 && (
        <div className="space-y-2">
          {alertLongStay.map(v => (
            <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle size={14} className="text-amber shrink-0" />
                <span className="text-xs font-semibold text-snow truncate">{v.members?.name ?? '—'}</span>
                <span className="text-xs text-fog shrink-0">lleva {fmtElapsed(v.checked_in_at)} en sala</span>
              </div>
              <button
                onClick={() => setConfirmCheckout(v.id)}
                className="flex items-center gap-1 text-[10px] font-medium text-rose bg-rose/10 border border-rose/30 rounded-lg px-2 py-1 hover:bg-rose/20 transition-colors shrink-0"
              >
                <LogOut size={10} /> Salida
              </button>
            </div>
          ))}
          {alertBirthdaySoon.map(b => (
            <div key={b.id} className="flex items-center gap-2 rounded-xl border border-rose/40 bg-rose/10 px-4 py-3">
              <Cake size={14} className="text-rose shrink-0" />
              <span className="text-xs font-semibold text-snow">{b.title}</span>
              <span className="text-xs text-fog">empieza a las {b.start_time?.slice(0, 5)}</span>
            </div>
          ))}
          {alertCustodiaSoon.map(b => (
            <div key={b.id} className="flex items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3">
              <CalendarClock size={14} className="text-amber shrink-0" />
              <span className="text-xs font-semibold text-snow">{b.title}</span>
              <span className="text-xs text-fog">custodia termina a las {b.end_time?.slice(0, 5)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ZONA 2 — En sala ahora (tabla) */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        {/* Stats header */}
        <div className="px-4 pt-4 pb-3 border-b border-line">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-2">
              <Users size={13} />
              En sala ahora
              <span className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white animate-pulse" />
                </span>
                En vivo
              </span>
            </h2>
            {capacity != null && (
              <span className={`text-sm font-bold ${aforoTextColor}`}>{activeTotal}/{capacity}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="text-fog"><span className="text-snow font-semibold">{activeTotal}</span> total</span>
            <span className="text-fog"><span className="text-lime font-semibold">{activeAdults}</span> adulto{activeAdults !== 1 ? 's' : ''}</span>
            <span className="text-fog"><span className="text-cyan-300 font-semibold">{activeChildren}</span> niño{activeChildren !== 1 ? 's' : ''}</span>
            <span className="text-fog"><span className="text-iris font-semibold">{conBonoCount}</span> con bono</span>
            <span className="text-fog"><span className="text-amber font-semibold">{sinBonoCount}</span> sin bono</span>
          </div>
          {capacity != null && (
            <div className="h-1.5 w-full rounded-full bg-line overflow-hidden mt-3 flex">
              <div className="h-full bg-lime transition-all duration-500" style={{ width: `${capacity ? Math.min(100, (activeAdults / capacity) * 100) : 0}%` }} />
              <div className="h-full bg-cyan-300 transition-all duration-500" style={{ width: `${capacity ? Math.min(100, (activeChildren / capacity) * 100) : 0}%` }} />
            </div>
          )}
        </div>

        {/* Table */}
        {activeVisits.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-mist">Sin personas en sala</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left border-collapse">
              <thead>
                <tr className="border-b border-line">
                  {['Titular', 'Niños', 'Tipo', 'Bono', 'Entrada', 'Tiempo', 'Consumos', 'Salida'].map(col => (
                    <th key={col} className="px-3 py-2 text-[10px] font-semibold text-mist uppercase tracking-wide whitespace-nowrap first:pl-4 last:pr-4">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {activeVisits.map(visit => {
                  const kids = visit.children_present ?? []
                  const bono = visit.membership_id
                  const elapsedMins = (Date.now() - new Date(visit.checked_in_at).getTime()) / 60000
                  const isLong = elapsedMins > 180
                  const check = openChecks.get(visit.id)
                  const isConfirming = confirmCheckout === visit.id
                  const isShowingConsumos = consumosVisitId === visit.id

                  return (
                    <>
                      <tr key={visit.id} className={isLong ? 'bg-amber/5' : ''}>
                        {/* Titular */}
                        <td className="pl-4 pr-3 py-3 align-top">
                          <p className="text-xs font-semibold text-snow whitespace-nowrap">{visit.members?.name ?? '—'}</p>
                        </td>
                        {/* Niños */}
                        <td className="px-3 py-3 align-top">
                          {kids.length === 0 ? (
                            <span className="text-[11px] text-mist">—</span>
                          ) : (
                            <div className="space-y-0.5">
                              {kids.map((c, i) => {
                                const age = fmtChildAge(c.birth_date, c.age)
                                return (
                                  <p key={i} className="text-[11px] text-cyan-300 whitespace-nowrap">
                                    {c.name}{age ? ` · ${age}` : ''}
                                  </p>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        {/* Tipo */}
                        <td className="px-3 py-3 align-top">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-surface2 text-fog border border-line whitespace-nowrap">
                            {fmtVisitType(visit.visit_type)}
                          </span>
                        </td>
                        {/* Bono */}
                        <td className="px-3 py-3 align-top">
                          <span className={`text-[10px] font-semibold whitespace-nowrap ${bono ? 'text-iris' : 'text-amber'}`}>
                            {bono ? 'Con bono' : 'Sin bono'}
                          </span>
                        </td>
                        {/* Entrada */}
                        <td className="px-3 py-3 align-top">
                          <span className="text-xs text-mist whitespace-nowrap">{fmtTime(visit.checked_in_at)}</span>
                        </td>
                        {/* Tiempo */}
                        <td className="px-3 py-3 align-top">
                          <span className={`text-xs font-semibold whitespace-nowrap ${isLong ? 'text-amber' : 'text-fog'}`}>
                            {fmtElapsed(visit.checked_in_at)}
                          </span>
                        </td>
                        {/* Consumos */}
                        <td className="px-3 py-3 align-middle">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className={`text-xs font-semibold ${check && check.items.length > 0 ? 'text-snow' : 'text-mist'}`}>
                              {check && check.items.length > 0
                                ? `${check.items.reduce((s, i) => s + i.unit_price * i.quantity, 0).toFixed(2)}€`
                                : '—'}
                            </span>
                            <button
                              onClick={() => setConsumosVisitId(isShowingConsumos ? null : visit.id)}
                              className={`flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${
                                isShowingConsumos
                                  ? 'bg-iris/20 text-iris border-iris/40'
                                  : 'bg-surface2 text-fog border-line hover:border-iris/40 hover:text-iris'
                              }`}
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </td>
                        {/* Salida */}
                        <td className="pl-3 pr-4 py-3 align-top">
                          {isConfirming ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleCheckout(visit.id)}
                                disabled={checkingOut === visit.id}
                                className="flex items-center gap-0.5 text-[10px] font-semibold text-ink bg-rose rounded px-2 py-1 hover:brightness-110 transition-all disabled:opacity-50 whitespace-nowrap"
                              >
                                <Check size={9} />{checkingOut === visit.id ? '...' : 'Sí'}
                              </button>
                              <button
                                onClick={() => setConfirmCheckout(null)}
                                className="text-[10px] font-medium text-fog bg-surface2 border border-line rounded px-2 py-1 hover:text-snow transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmCheckout(visit.id)}
                              className="flex items-center gap-1 text-[10px] font-medium text-rose bg-rose/10 border border-rose/30 rounded-lg px-2 py-1 hover:bg-rose/20 transition-colors whitespace-nowrap"
                            >
                              <LogOut size={10} /> Salida
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Confirm message row */}
                      {isConfirming && (
                        <tr key={`confirm-${visit.id}`} className="bg-rose/5">
                          <td colSpan={8} className="pl-4 pr-4 py-2">
                            <p className="text-[11px] text-rose font-medium">
                              ¿Confirmar salida de <span className="font-bold">{visit.members?.name ?? '—'}</span>?
                              {check && check.items.length > 0 && (
                                <span className="text-fog font-normal"> · El ticket de {check.items.length} consumo{check.items.length !== 1 ? 's' : ''} se cerrará.</span>
                              )}
                            </p>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ZONA 3 — Agenda de hoy */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-line flex items-center gap-2">
          <CalendarClock size={13} className="text-fog" />
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide">Agenda de hoy</h2>
          <span className="ml-auto text-[11px] text-mist">{todayBookings.length} reserva{todayBookings.length !== 1 ? 's' : ''}</span>
        </div>

        {timeline.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-mist">Sin reservas hoy</div>
        ) : (
          <div className="divide-y divide-line">
            {timeline.map(b => {
              const status = getBookingStatus(b)
              const style = bookingTypeStyle[b.type]
              const canExecute = status === 'pendiente' || status === 'en_curso'
              return (
                <div key={b.id} className={`flex gap-0 ${status === 'pasado' ? 'opacity-50' : ''}`}>
                  <div className={`w-1 shrink-0 ${style.bar}`} />
                  <div className="flex-1 px-4 py-3 flex items-start gap-3">
                    <div className="shrink-0 text-right w-14">
                      <p className="text-xs font-semibold text-snow">{b.start_time?.slice(0, 5) ?? '—'}</p>
                      {b.end_time && <p className="text-[10px] text-mist">{b.end_time.slice(0, 5)}</p>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-xs font-semibold text-snow">{b.title}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${style.badge}`}>{style.label}</span>
                        {status === 'ejecutado' && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-mint/10 text-mint border-mint/30 flex items-center gap-0.5">
                            <Check size={9} />Ejecutado
                          </span>
                        )}
                        {status === 'en_curso' && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-lime/10 text-lime border-lime/30 flex items-center gap-0.5">
                            <Clock size={9} />En curso
                          </span>
                        )}
                      </div>
                      {b.members?.name && <p className="text-[11px] text-fog">{b.members.name}</p>}
                      {b.guests != null && (
                        <p className="text-[11px] text-mist">
                          {b.guests} {b.type === 'custodia' ? `niño${b.guests !== 1 ? 's' : ''}` : `invitado${b.guests !== 1 ? 's' : ''}`}
                        </p>
                      )}
                    </div>
                    {canExecute && (
                      <button
                        onClick={() => handleExecuteBooking(b)}
                        disabled={executingBooking === b.id}
                        className="flex items-center gap-1 text-[10px] font-semibold text-ink bg-lime border border-lime/50 rounded-lg px-2.5 py-1.5 hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
                      >
                        <Play size={9} fill="currentColor" />
                        {executingBooking === b.id ? '...' : 'Ejecutar'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ZONA 4 — Métricas (colapsable) */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <button
          onClick={() => setChartsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface2 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart2 size={13} className="text-fog" />
            <span className="text-xs font-semibold text-fog uppercase tracking-wide">Métricas del día</span>
            <span className="text-[11px] text-mist">{monthCount} visitas este mes</span>
          </div>
          {chartsOpen ? <ChevronUp size={14} className="text-fog" /> : <ChevronDown size={14} className="text-fog" />}
        </button>

        {chartsOpen && (
          <div className="border-t border-line">
            <div className="grid gap-0 grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line">
              {/* Aforo por hora */}
              <div className="p-4 lg:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
                    <BarChart2 size={13} /> Aforo por hora
                  </h3>
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
                                <p style={{ color: '#6b7280', marginTop: 4 }}>{entry.adultos} adultos · {entry.ninos} niños</p>
                              </>
                            ) : entry.reservado != null ? (
                              <>
                                <p style={{ color: '#fb923c', fontWeight: 600 }}>Reservado: {entry.reservado}</p>
                                {entry.planBirthday ? <p style={{ color: '#6b7280', marginTop: 4 }}>Cumpleaños: {entry.planBirthday}</p> : null}
                                {entry.planCustodia ? <p style={{ color: '#6b7280', marginTop: 2 }}>Custodias: {entry.planCustodia}</p> : null}
                                {entry.planOther    ? <p style={{ color: '#6b7280', marginTop: 2 }}>Otros: {entry.planOther}</p> : null}
                              </>
                            ) : (
                              <p style={{ color: '#6b7280' }}>Sin datos</p>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="alcanzado" stackId="a" fill="#38bdf8"
                      shape={(p: any) => <StackedBar {...p} roundTop={!p.reservado} />}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={i + 7 === currentHour ? '#38bdf8' : 'rgba(56,189,248,0.6)'} />
                      ))}
                      <LabelList dataKey="_alcanzadoLabel" position="top" style={{ fill: '#9ca3af', fontSize: 9, fontWeight: 600 }} />
                    </Bar>
                    <Bar dataKey="reservado" stackId="a" fill="#fb923c"
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
              <div className="p-4 lg:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
                    <Activity size={13} /> Afluencia por hora
                  </h3>
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
          </div>
        )}
      </div>

      {/* Modal de consumos */}
      {consumosVisitId && consumosVisit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setConsumosVisitId(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Panel */}
          <div
            className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={15} className="text-iris shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-snow">{consumosVisit.members?.name ?? '—'}</p>
                  <p className="text-[11px] text-fog">Consumos de la visita</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(openChecks.get(consumosVisitId)?.items.length ?? 0) > 0 && (
                  <span className="text-base font-bold text-iris">
                    {openChecks.get(consumosVisitId)!.items.reduce((s, i) => s + i.unit_price * i.quantity, 0).toFixed(2)}€
                  </span>
                )}
                <button onClick={() => setConsumosVisitId(null)} className="text-fog hover:text-snow transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {/* Items consumidos */}
              {(openChecks.get(consumosVisitId)?.items.length ?? 0) > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">Consumido</p>
                  <div className="space-y-1">
                    {openChecks.get(consumosVisitId)!.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between rounded-xl bg-surface2 border border-line px-3 py-2">
                        <span className="text-xs text-snow">{item.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-fog">{Number(item.unit_price).toFixed(2)}€</span>
                          <button
                            onClick={() => handleRemoveItem(consumosVisitId, item.id)}
                            className="text-mist hover:text-rose transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2">
                    <p className="text-xs text-fog">
                      Total: <span className="text-snow font-bold">
                        {openChecks.get(consumosVisitId)!.items.reduce((s, i) => s + i.unit_price * i.quantity, 0).toFixed(2)}€
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-mist">Sin consumos registrados aún.</p>
              )}

              {/* Selector de productos */}
              <div>
                <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-3">Añadir producto</p>
                {Object.entries(productsByCategory).map(([cat, prods]) => (
                  <div key={cat} className="mb-4 last:mb-0">
                    <p className="text-[10px] font-semibold text-fog capitalize mb-2">{cat}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {prods.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleAddProduct(consumosVisitId, p)}
                          disabled={addingProduct === p.id + consumosVisitId}
                          className="flex items-center gap-2 text-xs font-medium text-snow bg-surface2 border border-line rounded-xl px-3 py-2.5 hover:border-iris/50 hover:bg-iris/5 transition-colors disabled:opacity-50 text-left"
                        >
                          <span className="text-base shrink-0">{p.emoji}</span>
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="text-mist shrink-0">{Number(p.price).toFixed(2)}€</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
