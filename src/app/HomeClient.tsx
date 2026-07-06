'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LogIn, Users, CalendarClock, Cake, ChevronDown, ChevronUp,
  BarChart2, Activity, LogOut, AlertTriangle, Play, Clock,
  Check, ShoppingCart, Plus, X, ChevronLeft, ChevronRight, Receipt, UserPlus, Bell,
  Search, QrCode, RotateCcw, User,
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
  children_present: { name: string; age?: number; birth_date?: string; is_adult?: boolean }[] | null
  adults_count: number
  children_count: number
  booking_id: string | null
  paid_at: string | null
  bookings: { type: string } | null
  members: { name: string } | null
  memberships: {
    sessions_remaining: number
    membership_types: { name: string; sessions: number; price: number } | null
  } | null
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

type MemberData = {
  id: string
  name: string
  phone: string | null
  family_id: string | null
  children: { name: string; birth_date?: string; age?: number }[]
}

type FullMember = {
  id: string
  name: string
  phone: string | null
  memberships: {
    id: string
    sessions_remaining: number | null
    expires_at: string
    membership_types: { name: string } | null
  }[]
  children: { name: string; birth_date: string }[]
}

function getBonoInfo(m: FullMember) {
  const bono = m.memberships?.[0]
  if (!bono) return null
  const isUnlimited = bono.membership_types?.name?.toLowerCase().includes('ilimitado')
  if (isUnlimited) return { ok: true, unlimited: true, label: 'Bono ilimitado', sessions: null }
  if ((bono.sessions_remaining ?? 0) <= 0) return { ok: false, unlimited: false, label: 'Bono agotado', sessions: 0 }
  return { ok: true, unlimited: false, label: bono.membership_types?.name ?? 'Bono', sessions: bono.sessions_remaining }
}

function CheckinPanel({
  checkinMembers,
  activeVisits,
  rates,
  onCheckedIn,
  onClose,
}: {
  checkinMembers: FullMember[]
  activeVisits: TodayVisit[]
  rates: { adult: number; child: number; custodia: number }
  onCheckedIn: () => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'manual' | 'qr'>('manual')
  const [scanning, setScanning] = useState(true)
  const [selectedMember, setSelectedMember] = useState<FullMember | null>(null)
  const [registering, setRegistering] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [visitType, setVisitType] = useState<'entrada' | 'custodia'>('entrada')
  const [childrenPresent, setChildrenPresent] = useState<{ name: string; birth_date?: string }[]>([])
  const [extraChildren, setExtraChildren] = useState<string[]>([])
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (mode !== 'qr' || !scanning) return
    let html5Qr: any, stopped = false
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return
      html5Qr = new Html5Qrcode('qr-reader-modal')
      html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decoded: string) => {
          await html5Qr.stop().catch(() => {})
          setScanning(false)
          const { data } = await supabase.from('members')
            .select('id, name, phone, memberships(id, sessions_remaining, expires_at, membership_types(name)), children')
            .eq('qr_code', decoded).single()
          if (!data) { setCamError('Código QR no reconocido'); return }
          doSelectMember(data as unknown as FullMember)
        },
        () => {}
      ).catch(() => setCamError('No se puede acceder a la cámara'))
    })
    return () => { stopped = true; html5Qr?.stop().catch(() => {}) }
  }, [mode, scanning])

  function reset() {
    setSelectedMember(null); setFlash(null); setCamError(null); setScanning(true)
    setVisitType('entrada'); setChildrenPresent([]); setExtraChildren([])
  }

  function doSelectMember(m: FullMember) {
    setSelectedMember(m)
    setChildrenPresent((m.children ?? []).map(c => ({ name: c.name, birth_date: c.birth_date ?? undefined })))
    setExtraChildren([])
    setFlash(null)
  }

  const filteredMembers = query.trim().length > 0
    ? checkinMembers.filter(m => {
        const q = query.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        const mName = m.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        const qd = q.replace(/\D/g, '')
        return mName.includes(q) || (qd.length > 0 && (m.phone ?? '').replace(/\D/g, '').includes(qd))
      })
    : checkinMembers

  const bono = selectedMember ? getBonoInfo(selectedMember) : null
  const alreadyInside = selectedMember ? activeVisits.some(v => v.member_id === selectedMember.id && !v.checked_out_at) : false

  async function handleCheckIn() {
    if (!selectedMember || registering) return
    setRegistering(true)
    const b = getBonoInfo(selectedMember)
    const m = selectedMember.memberships?.[0]

    const allChildren = [
      ...childrenPresent,
      ...extraChildren.filter(n => n.trim()).map(n => ({ name: n.trim() })),
    ]
    const numChildren = allChildren.length

    await supabase.from('visits').insert({
      member_id: selectedMember.id,
      membership_id: (b?.ok && m) ? m.id : null,
      checked_in_at: new Date().toISOString(),
      visit_type: visitType,
      children_present: allChildren,
      adults_count: 1,
      children_count: numChildren,
    })

    if (b?.ok && !b.unlimited && m?.sessions_remaining != null) {
      await supabase.from('memberships')
        .update({ sessions_remaining: Math.max(0, m.sessions_remaining - 1) })
        .eq('id', m.id)
    }

    const typeLabel = visitType === 'custodia' ? 'Custodia' : 'Entrada'
    clearTimeout(flashTimer.current)
    if (b?.ok) {
      setFlash(
        b.unlimited
          ? `✓ ${typeLabel} registrada · bono ilimitado · ${numChildren} niño${numChildren !== 1 ? 's' : ''}`
          : `✓ ${typeLabel} registrada · quedan ${Math.max(0, (m?.sessions_remaining ?? 1) - 1)} sesiones`
      )
    } else {
      const rateLabel = visitType === 'custodia'
        ? `${rates.custodia}€/h × ${numChildren} niño${numChildren !== 1 ? 's' : ''}`
        : `${rates.adult}€ adulto + ${numChildren} × ${rates.child}€ niño/h`
      setFlash(`✓ ${typeLabel} registrada · sin bono — ${rateLabel}`)
    }
    flashTimer.current = setTimeout(() => setFlash(null), 6000)
    setRegistering(false)
    onCheckedIn()

    // Refresh member data
    const { data } = await supabase.from('members')
      .select('id, name, phone, memberships(id, sessions_remaining, expires_at, membership_types(name)), children')
      .eq('id', selectedMember.id).single()
    if (data) {
      const refreshed = data as unknown as FullMember
      setSelectedMember(refreshed)
      setChildrenPresent((refreshed.children ?? []).map(c => ({ name: c.name })))
      setExtraChildren([])
    }
  }

  return (
    <div>
      {/* ── Paso 2: confirmación ── */}
      {selectedMember ? (
        <div className="rounded-2xl border border-line bg-surface overflow-hidden">
          {/* Header: volver + nombre + estado bono */}
          <div className={`flex items-center gap-3 px-4 py-3 border-b ${
            alreadyInside ? 'bg-iris/10 border-iris/20' :
            bono?.ok ? 'bg-lime/10 border-lime/20' :
            'bg-amber/10 border-amber/20'
          }`}>
            <button onClick={reset} className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 bg-surface/60 text-fog hover:text-snow transition-colors shrink-0">
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-snow truncate">{selectedMember.name}</p>
              {selectedMember.phone && <p className="text-xs text-mist">{selectedMember.phone}</p>}
            </div>
            <div className="shrink-0 text-right">
              {alreadyInside ? (
                <span className="text-xs font-semibold text-iris">Ya dentro</span>
              ) : bono?.ok ? (
                <span className={`text-sm font-bold ${bono.unlimited ? 'text-iris' : bono.sessions! <= 2 ? 'text-amber' : 'text-lime'}`}>
                  {bono.unlimited ? '∞' : bono.sessions}
                  {!bono.unlimited && <span className="text-[10px] font-normal text-mist ml-1">ses.</span>}
                </span>
              ) : (
                <span className="text-xs font-semibold text-amber">Sin bono</span>
              )}
            </div>
          </div>

          <div className="p-4 space-y-3">
            {alreadyInside ? (
              <div className="rounded-xl bg-iris/10 border border-iris/20 px-4 py-3 text-sm text-iris font-medium text-center">
                Este miembro ya tiene una entrada activa
              </div>
            ) : (
              <>
                {/* Tipo de visita */}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setVisitType('entrada')}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      visitType === 'entrada' ? 'bg-lime/15 border-lime/30 text-lime' : 'bg-surface2 border-line text-fog hover:text-snow'
                    }`}>
                    Entrada
                  </button>
                  <button type="button" onClick={() => setVisitType('custodia')}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      visitType === 'custodia' ? 'bg-cyan-300/15 border-cyan-300/30 text-cyan-300' : 'bg-surface2 border-line text-fog hover:text-snow'
                    }`}>
                    Custodia
                  </button>
                </div>

                {/* Niños registrados */}
                {selectedMember.children && selectedMember.children.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMember.children.map((child, i) => {
                      const sel = childrenPresent.some(c => c.name === child.name)
                      return (
                        <button key={i} type="button"
                          onClick={() => setChildrenPresent(prev =>
                            sel ? prev.filter(c => c.name !== child.name) : [...prev, { name: child.name }]
                          )}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                            sel ? 'bg-lime/15 border-lime/30 text-lime' : 'bg-surface2 border-line text-fog'
                          }`}>
                          {child.name}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Niños extra */}
                {extraChildren.length > 0 && (
                  <div className="space-y-1.5">
                    {extraChildren.map((name, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={name} onChange={e => setExtraChildren(prev => prev.map((n, j) => j === i ? e.target.value : n))}
                          placeholder="Nombre del niño/a"
                          className="flex-1 rounded-xl border border-line bg-surface2 px-3 py-2 text-sm text-snow placeholder:text-mist outline-none focus:border-line2" />
                        <button type="button" onClick={() => setExtraChildren(prev => prev.filter((_, j) => j !== i))}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-line bg-surface2 text-fog hover:text-rose hover:border-rose/30 transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button type="button" onClick={() => setExtraChildren(prev => [...prev, ''])}
                  className="flex items-center gap-1.5 text-xs text-mist hover:text-fog transition-colors">
                  <span className="w-5 h-5 rounded-full border border-line bg-surface2 flex items-center justify-center font-bold text-fog">+</span>
                  Añadir niño/a
                </button>

                {/* Aviso sin bono inline */}
                {!bono?.ok && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber/10 border border-amber/20 px-3 py-2">
                    <AlertTriangle size={13} className="text-amber shrink-0 mt-0.5" />
                    <p className="text-xs text-amber/90">
                      {bono ? 'Bono agotado.' : 'Sin bono.'}{' '}
                      {visitType === 'custodia' ? `${rates.custodia} €/h × niños` : `${rates.adult} €/h adulto · ${rates.child} €/h niño`}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleCheckIn}
                  disabled={registering}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold text-sm transition active:scale-[0.99] disabled:opacity-60 ${
                    bono?.ok ? 'bg-lime text-ink hover:brightness-105' : 'bg-amber/20 text-amber border border-amber/30 hover:bg-amber/30'
                  }`}
                  style={bono?.ok ? { boxShadow: 'var(--shadow-lime)' } : {}}
                >
                  <LogIn size={17} strokeWidth={2.2} />
                  {registering ? 'Registrando...' : 'Registrar entrada'}
                </button>

                {flash && (
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-mint text-center">
                    <Check size={14} strokeWidth={2.5} /> {flash}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Paso 1: búsqueda / QR ── */
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex rounded-xl border border-line bg-surface2 overflow-hidden">
              <button onClick={() => { setMode('manual'); reset() }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${mode === 'manual' ? 'bg-lime/15 text-lime' : 'text-mist hover:text-fog'}`}>
                <Search size={13} /> Manual
              </button>
              <button onClick={() => { setMode('qr'); reset() }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${mode === 'qr' ? 'bg-lime/15 text-lime' : 'text-mist hover:text-fog'}`}>
                <QrCode size={13} /> QR
              </button>
            </div>
            <Link href="/miembros/nuevo" onClick={onClose}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors">
              <UserPlus size={13} /> Nuevo miembro
            </Link>
          </div>

          {mode === 'qr' ? (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
                <QrCode size={13} className="text-lime" /> Escáner QR
              </div>
              {scanning && !camError ? (
                <div id="qr-reader-modal" className="w-full rounded-xl overflow-hidden [&>*]:rounded-xl" />
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  {camError && <p className="text-sm text-rose text-center">{camError}</p>}
                  <button onClick={reset}
                    className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-fog hover:text-snow hover:border-line2 transition-colors">
                    <RotateCcw size={14} /> Volver a escanear
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface overflow-hidden">
              <div className="p-3 border-b border-line">
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
                  <input value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Nombre o teléfono..." autoFocus
                    className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-10 pr-4 text-sm text-snow placeholder:text-mist outline-none focus:border-line2" />
                </div>
              </div>
              <div className="divide-y divide-line/50 max-h-72 overflow-y-auto min-h-[10rem]">
                {filteredMembers.length > 0 ? filteredMembers.map(m => {
                  const b = getBonoInfo(m)
                  const inside = activeVisits.some(v => v.member_id === m.id && !v.checked_out_at)
                  return (
                    <button key={m.id} onClick={() => { doSelectMember(m); setQuery('') }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface2 transition-colors">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${inside ? 'bg-iris' : !b ? 'bg-rose' : !b.ok ? 'bg-amber' : b.unlimited ? 'bg-iris' : (b.sessions ?? 99) <= 2 ? 'bg-amber' : 'bg-mint'}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium text-snow">{m.name}</span>
                        {inside && <span className="block text-xs text-iris">Dentro ahora</span>}
                      </span>
                      {b?.unlimited ? <span className="text-xs font-semibold text-iris shrink-0">∞</span>
                        : b?.sessions != null ? <span className="text-xs font-semibold text-mist shrink-0">{b.sessions} ses.</span>
                        : <span className="text-xs text-rose shrink-0">sin bono</span>}
                    </button>
                  )
                }) : (
                  <p className="py-10 text-center text-sm text-fog">Sin resultados</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type HomeClientProps = {
  todayVisits: TodayVisit[]
  todayCustodias: TodayVisit[]
  monthCount: number
  dateLabel: string
  capacity: number | null
  todayBirthdays: BirthdayMember[]
  todayBookings: TodayBooking[]
  selectedDate: string
  todayStr: string
  allMembers: MemberData[]
}

function ColFilter({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const active = value !== 'all'
  const current = options.find(o => o.value === value)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
          active ? 'bg-iris/10 text-iris border-iris/40' : 'text-mist border-line hover:text-fog hover:border-line2'
        }`}
      >
        {active ? current?.label : label}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 bg-surface border border-line rounded-xl shadow-2xl z-50 min-w-[150px] overflow-hidden py-1">
            {options.map(opt => (
              <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface2 ${
                  value === opt.value ? 'text-iris font-semibold' : 'text-fog'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
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

function fmtVisitType(visit: { visit_type: string; bookings?: { type: string } | null }): string {
  if (visit.visit_type === 'custodia') return 'Custodia'
  if (visit.bookings?.type === 'birthday') return 'Cumpleaños'
  if (visit.bookings?.type === 'custodia') return 'Custodia'
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

export default function HomeClient({ todayVisits, monthCount, dateLabel, capacity, todayBirthdays, todayBookings, selectedDate, todayStr, allMembers }: HomeClientProps) {
  const router = useRouter()
  const isToday = selectedDate === todayStr

  function navigateDate(delta: number) {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const newDate = d.toISOString().split('T')[0]
    router.push(newDate === todayStr ? '/' : `/?date=${newDate}`)
  }

  const [alertsOpen, setAlertsOpen] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTipo, setFilterTipo] = useState('all')
  const [filterBono, setFilterBono] = useState('all')
  const [filterSesiones, setFilterSesiones] = useState('all')
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [confirmCheckout, setConfirmCheckout] = useState<string | null>(null)
  const [executingBooking, setExecutingBooking] = useState<string | null>(null)
  const [chartsOpen, setChartsOpen] = useState(false)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [openChecks, setOpenChecks] = useState<Map<string, OpenCheck>>(new Map())
  const [consumosVisitId, setConsumosVisitId] = useState<string | null>(null)
  const [addingProduct, setAddingProduct] = useState<string | null>(null)
  const [importeVisitId, setImporteVisitId] = useState<string | null>(null)
  const [totalVisitId, setTotalVisitId] = useState<string | null>(null)
  const [acompVisitId, setAcompVisitId] = useState<string | null>(null)
  const [acompCoTitulares, setAcompCoTitulares] = useState<{ id: string; name: string; selected: boolean }[]>([])
  const [acompChildren, setAcompChildren] = useState<{ name: string; birth_date?: string; isGuest?: boolean }[]>([])
  const [acompGuestAdults, setAcompGuestAdults] = useState(0)
  const [acompGuestChildren, setAcompGuestChildren] = useState(0)
  const [acompTitularPresent, setAcompTitularPresent] = useState(true)
  const [savedAcomp, setSavedAcomp] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextSave = useRef(false)
  const [savingAcomp, setSavingAcomp] = useState(false)
  const [rateAdult, setRateAdult] = useState(3)
  const [rateChild, setRateChild] = useState(7)
  const [rateCustodia, setRateCustodia] = useState(8)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [checkinMembers, setCheckinMembers] = useState<FullMember[]>([])
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const persons = (v: TodayVisit) => (v.adults_count ?? 1) + (v.children_count ?? 0)
  const activeVisits = todayVisits.filter(v => !v.checked_out_at)

  const filteredVisits = activeVisits.filter(v => {
    if (filterBono === 'con_bono' && !v.membership_id) return false
    if (filterBono === 'sin_bono' && v.membership_id) return false
    if (filterTipo !== 'all') {
      const tipo = fmtVisitType(v)
      if (filterTipo === 'libre' && tipo !== 'Libre') return false
      if (filterTipo === 'birthday' && tipo !== 'Cumpleaños') return false
      if (filterTipo === 'custodia' && tipo !== 'Custodia') return false
    }
    if (filterSesiones !== 'all') {
      const s = v.memberships?.sessions_remaining
      if (filterSesiones === 'critical' && (s == null || s > 2)) return false
      if (filterSesiones === 'low' && (s == null || s <= 2 || s > 5)) return false
      if (filterSesiones === 'ok' && (s == null || s <= 5)) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const nameMatch = (v.members?.name ?? '').toLowerCase().includes(q)
      const member = allMembers.find(m => m.id === v.member_id)
      const phoneMatch = (member?.phone ?? '').toLowerCase().includes(q)
      if (!nameMatch && !phoneMatch) return false
    }
    return true
  })
  const activeAdults = activeVisits.reduce((s, v) => s + (v.adults_count ?? 1), 0)
  const activeChildren = activeVisits.reduce((s, v) => s + (v.children_count ?? 0), 0)
  const activeTotal = activeAdults + activeChildren
  const conBonoCount = activeVisits.filter(v => v.membership_id).reduce((s, v) => s + persons(v), 0)
  const sinBonoCount = activeVisits.filter(v => !v.membership_id).reduce((s, v) => s + persons(v), 0)

  const aforoPct = capacity ? (activeTotal / capacity) * 100 : 0
  const aforoTextColor = aforoPct < 70 ? 'text-lime' : aforoPct <= 90 ? 'text-amber' : 'text-rose-500'

  // Load products, services rates & open checks
  useEffect(() => {
    supabase.from('products').select('id, name, category, price, emoji').eq('active', true).order('category').order('name')
      .then(({ data }) => { if (data) setProducts(data as Product[]) })
    supabase.from('services').select('name, category, price, price_unit').eq('active', true)
      .then(({ data }) => {
        if (!data) return
        const adult = (data as any[]).find(r => r.category === 'entrada' && r.name === 'Adulto')
        const child = (data as any[]).find(r => r.category === 'entrada' && r.name === 'Niño')
        const cust  = (data as any[]).find(r => r.category === 'custodia' && r.price_unit === 'hora')
        if (adult) setRateAdult(Number(adult.price))
        if (child) setRateChild(Number(child.price))
        if (cust)  setRateCustodia(Number(cust.price))
      })
  }, [])

  useEffect(() => {
    if (!checkinOpen || checkinMembers.length > 0) return
    supabase.from('members')
      .select('id, name, phone, memberships(id, sessions_remaining, expires_at, membership_types(name)), children')
      .order('name')
      .then(({ data }) => { if (data) setCheckinMembers(data as unknown as FullMember[]) })
  }, [checkinOpen])

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

  function openAcompPopup(visit: TodayVisit) {
    const member = allMembers.find(m => m.id === visit.member_id)
    const registeredChildren = member?.children ?? []
    const presentEntries = visit.children_present ?? []

    // Split children_present into adults (co-titulares saved before) and children
    const presentAdultNames = new Set(presentEntries.filter(e => e.is_adult).map(e => e.name))
    const presentChildNames = new Set(presentEntries.filter(e => !e.is_adult).map(e => e.name))

    // Co-titulares: other members in the same family
    const coTitulares = allMembers
      .filter(m => m.id !== visit.member_id && m.family_id && m.family_id === member?.family_id)
      .map(m => ({ id: m.id, name: m.name, selected: presentAdultNames.has(m.name) }))

    // Children: registered (with check state) + guest children
    const regChildren = registeredChildren.map(c => ({ ...c, isGuest: false }))
    const guestKids = presentEntries
      .filter(e => !e.is_adult && !registeredChildren.some(r => r.name === e.name))
      .map(e => ({ name: e.name, birth_date: e.birth_date, isGuest: true }))

    // If children_present is empty but children_count > 0 (e.g. just executed from booking),
    // pre-select registered children up to children_count so the popup isn't blank
    const noPresenceData = presentEntries.filter(e => !e.is_adult).length === 0
    const selectedChildren = noPresenceData && (visit.children_count ?? 0) > 0
      ? regChildren.slice(0, visit.children_count)
      : [
          ...regChildren.filter(c => presentChildNames.has(c.name)),
          ...guestKids,
        ]

    // Titular present = adults_count >= 1
    const titularPresent = (visit.adults_count ?? 1) >= 1

    // Guest adults = total adults - titular(0 or 1) - co-titulares selected
    const coTitSelected = coTitulares.filter(c => c.selected).length
    const guestAdults = Math.max(0, (visit.adults_count ?? 1) - (titularPresent ? 1 : 0) - coTitSelected)

    // Guest children = total children_count minus those identified by name (registered or named guests)
    const guestChildrenCount = Math.max(0, (visit.children_count ?? 0) - selectedChildren.length)

    skipNextSave.current = true
    setAcompTitularPresent(titularPresent)
    setAcompCoTitulares(coTitulares)
    setAcompChildren(selectedChildren)
    setAcompGuestAdults(guestAdults)
    setAcompGuestChildren(guestChildrenCount)
    setAcompVisitId(visit.id)
  }

  async function saveAcompData(
    visitId: string,
    titularPresent: boolean,
    coTitulares: { id: string; name: string; selected: boolean }[],
    children: { name: string; birth_date?: string; isGuest?: boolean }[],
    guestAdults: number,
    guestChildren: number,
  ) {
    setSavingAcomp(true)
    const selectedCo = coTitulares.filter(c => c.selected)
    const totalAdults = (titularPresent ? 1 : 0) + selectedCo.length + guestAdults
    const totalChildren = children.length + guestChildren
    const adultEntries = selectedCo.map(c => ({ name: c.name, is_adult: true }))
    const childEntries = children.map(({ isGuest: _, ...rest }) => rest)
    await supabase.from('visits').update({
      adults_count: totalAdults,
      children_count: totalChildren,
      children_present: [...adultEntries, ...childEntries],
    }).eq('id', visitId)
    setSavingAcomp(false)
    setSavedAcomp(true)
    setTimeout(() => setSavedAcomp(false), 2000)
    router.refresh()
  }

  // Auto-save: skip first run when popup opens (state initialisation), then debounce on each change
  useEffect(() => {
    if (!acompVisitId) return
    if (skipNextSave.current) { skipNextSave.current = false; return }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      saveAcompData(acompVisitId, acompTitularPresent, acompCoTitulares, acompChildren, acompGuestAdults, acompGuestChildren)
    }, 700)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acompTitularPresent, acompCoTitulares, acompChildren, acompGuestAdults, acompGuestChildren])

  async function handlePayVisit(visitId: string) {
    await supabase.from('visits').update({ paid_at: new Date().toISOString() }).eq('id', visitId)
    setTotalVisitId(null)
    router.refresh()
  }

  async function handleCheckout(visitId: string) {
    setCheckingOut(visitId)
    const now = new Date().toISOString()
    // Close any open check for this visit
    const check = openChecks.get(visitId)
    if (check) {
      await supabase.from('open_checks').update({ closed_at: now, status: 'closed' }).eq('id', check.id)
    }
    await supabase.from('visits').update({ checked_out_at: now, paid_at: now }).eq('id', visitId)
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

  function calcImporte(visit: TodayVisit): {
    titular: number; ninos: number; regular: number
    bonoPrecioSesion: number | null; ahorro: number; total: number
  } {
    const elapsedMins = (Date.now() - new Date(visit.checked_in_at).getTime()) / 60000
    const hours = elapsedMins / 60
    let titular = 0, ninos = 0
    if (visit.visit_type === 'custodia') {
      ninos = visit.children_count * rateCustodia * hours
    } else {
      titular = visit.adults_count * rateAdult * hours
      ninos   = visit.children_count * rateChild * hours
    }
    const regular = titular + ninos
    // Bono: cost per session = type.price / type.sessions
    let bonoPrecioSesion: number | null = null
    const mt = visit.memberships?.membership_types
    if (visit.membership_id && mt && mt.sessions > 0) {
      bonoPrecioSesion = mt.price / mt.sessions
    }
    const total  = bonoPrecioSesion !== null ? bonoPrecioSesion : regular
    const ahorro = bonoPrecioSesion !== null ? Math.max(0, regular - bonoPrecioSesion) : 0
    return { titular, ninos, regular, bonoPrecioSesion, ahorro, total }
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
    birthday: { bar: 'bg-iris', badge: 'bg-iris/10 text-iris border-iris/30', label: 'Cumpleaños' },
    custodia: { bar: 'bg-cyan-300', badge: 'bg-cyan-300/10 text-cyan-300 border-cyan-300/30', label: 'Custodia' },
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
          {/* Date navigation */}
          <div className="flex items-center gap-1 mt-1.5">
            <button
              onClick={() => navigateDate(-1)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm text-fog capitalize px-1">{dateLabel}</span>
            <button
              onClick={() => navigateDate(1)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
            {!isToday && (
              <button
                onClick={() => router.push('/')}
                className="ml-1 text-[10px] font-semibold text-lime bg-lime/10 border border-lime/30 rounded-lg px-2 py-0.5 hover:bg-lime/20 transition-colors"
              >
                Hoy
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isToday && totalAlerts > 0 && (
            <button
              onClick={() => { setDismissedAlerts(new Set()); setAlertsOpen(true) }}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-amber/40 bg-amber/10 text-amber hover:bg-amber/20 transition-colors"
            >
              <Bell size={16} />
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-rose text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {totalAlerts}
              </span>
            </button>
          )}
          <button
            onClick={() => setCheckinOpen(true)}
            className="flex items-center justify-center bg-lime text-ink font-semibold rounded-xl w-10 h-10 active:scale-95 transition-transform"
            style={{ boxShadow: 'var(--shadow-lime)' }}
          >
            <LogIn size={18} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {/* ZONA 2 — En sala ahora (tabla) */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        {/* Stats header */}
        <div className="px-4 pt-4 pb-3 border-b border-line space-y-3">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-2">
              <Users size={13} />
              {isToday ? 'En sala ahora' : 'Visitas del día'}
              {isToday && (
                <span className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white animate-pulse" />
                  </span>
                  En vivo
                </span>
              )}
            </h2>
          </div>

          {/* Aforo bar */}
          {capacity != null && (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-bold leading-none ${aforoTextColor}`}>{activeTotal}</span>
                  <span className="text-xs text-fog">de {capacity} plazas</span>
                </div>
                <span className={`text-sm font-bold ${aforoTextColor}`}>{Math.round(aforoPct)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-line overflow-hidden flex">
                <div className="h-full bg-lime transition-all duration-500 rounded-l-full" style={{ width: `${Math.min(100, (activeAdults / capacity) * 100)}%` }} />
                <div className="h-full bg-cyan-300 transition-all duration-500" style={{ width: `${Math.min(100, (activeChildren / capacity) * 100)}%` }} />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-fog">
                  <span className="w-2 h-2 rounded-full bg-lime shrink-0" />
                  <span className="font-semibold text-snow">{activeAdults}</span> adulto{activeAdults !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1.5 text-fog">
                  <span className="w-2 h-2 rounded-full bg-cyan-300 shrink-0" />
                  <span className="font-semibold text-snow">{activeChildren}</span> niño{activeChildren !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
          {capacity == null && (
            <div className="flex gap-4 text-xs">
              <span className="text-fog"><span className="text-snow font-semibold">{activeTotal}</span> en sala</span>
              <span className="text-fog"><span className="text-lime font-semibold">{activeAdults}</span> adulto{activeAdults !== 1 ? 's' : ''}</span>
              <span className="text-fog"><span className="text-cyan-300 font-semibold">{activeChildren}</span> niño{activeChildren !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Search + column filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mist pointer-events-none">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o teléfono..."
                className="w-full pl-8 pr-3 py-1.5 bg-surface2 border border-line rounded-xl text-xs text-snow placeholder-mist focus:outline-none focus:border-iris/50 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist hover:text-snow transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0 flex-wrap">
              <ColFilter
                label="Tipo"
                value={filterTipo}
                onChange={setFilterTipo}
                options={[
                  { value: 'all', label: 'Tipo: Todos' },
                  { value: 'libre', label: 'Libre' },
                  { value: 'birthday', label: 'Cumpleaños' },
                  { value: 'custodia', label: 'Custodia' },
                ]}
              />
              <ColFilter
                label="Bono"
                value={filterBono}
                onChange={setFilterBono}
                options={[
                  { value: 'all', label: 'Bono: Todos' },
                  { value: 'con_bono', label: 'Con bono' },
                  { value: 'sin_bono', label: 'Sin bono' },
                ]}
              />
              <ColFilter
                label="Sesiones"
                value={filterSesiones}
                onChange={setFilterSesiones}
                options={[
                  { value: 'all', label: 'Sesiones: Todas' },
                  { value: 'critical', label: 'Críticas (≤2)' },
                  { value: 'low', label: 'Bajas (≤5)' },
                  { value: 'ok', label: 'OK (>5)' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Empty states */}
        {activeVisits.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-mist">Sin personas en sala</div>
        ) : filteredVisits.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-mist">Sin resultados para la búsqueda</div>
        ) : (
          <>
            {/* ── MOBILE: expandable cards (< md) ──────────────────────── */}
            <div className="md:hidden px-3 py-3 space-y-2.5">
              {filteredVisits.map(visit => {
                const bono = visit.membership_id
                const elapsedMins = (Date.now() - new Date(visit.checked_in_at).getTime()) / 60000
                const isLong = elapsedMins > 180
                const check = openChecks.get(visit.id)
                const imp = calcImporte(visit)
                const consumosTotal = (check?.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
                const grandTotal = imp.total + consumosTotal
                const numChildren = visit.children_count ?? 0
                const tipo = fmtVisitType(visit)
                const tipoColor = tipo === 'Cumpleaños' ? 'text-iris' : tipo === 'Custodia' ? 'text-cyan-300' : 'text-mist'
                const isExpanded = expandedCards.has(visit.id)
                const toggleExpand = () => setExpandedCards(prev => {
                  const next = new Set(prev)
                  next.has(visit.id) ? next.delete(visit.id) : next.add(visit.id)
                  return next
                })

                return (
                  <div
                    key={visit.id}
                    className={`rounded-2xl border bg-surface overflow-hidden ${
                      isLong ? 'border-amber/40' : 'border-line'
                    }`}
                  >
                    {/* Alerta de estancia larga: borde izquierdo ámbar */}
                    <div className={`flex ${isLong ? 'border-l-[3px] border-amber' : ''}`}>
                      <div className="flex-1 min-w-0">

                        {/* ── Collapsed: 2 líneas ── */}
                        {/* Línea 1: nombre + badge + acciones */}
                        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                          <button onClick={toggleExpand} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                            <span className="text-sm font-bold text-snow leading-tight truncate">{visit.members?.name ?? '—'}</span>
                            <span className="text-line2 shrink-0">·</span>
                            <span className={`text-[10px] font-semibold shrink-0 ${tipoColor}`}>{tipo}</span>
                          </button>
                          <button
                            onClick={() => setConfirmCheckout(visit.id)}
                            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-rose/10 border border-rose/30 text-rose hover:bg-rose/20 active:scale-[0.98] transition-all"
                          >
                            <LogOut size={14} strokeWidth={2.2} />
                          </button>
                          <button
                            onClick={toggleExpand}
                            className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border transition-colors ${
                              isExpanded
                                ? 'bg-surface2 border-line2 text-snow'
                                : 'bg-surface2 border-line text-fog'
                            }`}
                          >
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>

                        {/* Línea 2: stats inline */}
                        <button onClick={toggleExpand} className="w-full text-left px-3 pb-2.5">
                          <div className="flex items-center gap-1.5 text-xs text-mist">
                            <span className="font-semibold text-snow">{visit.adults_count + numChildren}</span>
                            <span>en sala</span>
                            <span className="text-line2">·</span>
                            <span className={`font-semibold ${isLong ? 'text-amber' : 'text-snow'}`}>{fmtElapsed(visit.checked_in_at)}</span>
                            {isLong && <span className="text-amber">⚠</span>}
                            <span className="text-line2">·</span>
                            <span className="font-semibold text-lime">{grandTotal.toFixed(2)}€</span>
                          </div>
                        </button>

                        {/* ── Expanded detail ── */}
                        {isExpanded && (
                          <div className="border-t border-line bg-surface2/40 px-3 py-2.5 space-y-2">
                            {/* Fila 1: info (adultos · niños · hora · bono) */}
                            <div className="flex items-center gap-1.5 flex-wrap text-xs text-mist">
                              <span className="font-semibold text-lime">{visit.adults_count}</span>
                              <span>ad.</span>
                              <span className="text-line2">·</span>
                              <span className="font-semibold text-cyan-300">{numChildren}</span>
                              <span>niños</span>
                              <span className="text-line2">·</span>
                              <span>Entrada {fmtTime(visit.checked_in_at)}</span>
                              <span className="text-line2">·</span>
                              <span className={`font-semibold ${bono ? 'text-iris' : 'text-amber'}`}>
                                {bono ? (visit.memberships?.membership_types?.name ?? 'Con bono') : 'Sin bono'}
                              </span>
                              {bono && visit.memberships != null && (
                                <span className={`font-semibold ${
                                  visit.memberships.sessions_remaining <= 2 ? 'text-rose' :
                                  visit.memberships.sessions_remaining <= 5 ? 'text-amber' : 'text-fog'
                                }`}>
                                  ({visit.memberships.sessions_remaining} ses.)
                                </span>
                              )}
                            </div>

                            {/* Fila 2: acciones secundarias horizontales */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setImporteVisitId(visit.id)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-line bg-surface hover:border-lime/40 transition-colors"
                              >
                                <Receipt size={12} className="text-lime" />
                                <span className="text-xs font-semibold text-lime">{imp.total.toFixed(2)}€</span>
                              </button>
                              <button
                                onClick={() => setConsumosVisitId(consumosVisitId === visit.id ? null : visit.id)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border transition-colors ${
                                  consumosVisitId === visit.id
                                    ? 'bg-iris/10 border-iris/40'
                                    : 'border-line bg-surface hover:border-iris/40'
                                }`}
                              >
                                <Plus size={12} className={consumosVisitId === visit.id ? 'text-iris' : 'text-fog'} />
                                <span className={`text-xs font-semibold ${consumosTotal > 0 ? 'text-lime' : 'text-mist'}`}>
                                  {consumosTotal > 0 ? `${consumosTotal.toFixed(2)}€` : 'Consumos'}
                                </span>
                              </button>
                              <button
                                onClick={() => openAcompPopup(visit)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-line bg-surface hover:border-iris/40 transition-colors"
                              >
                                <UserPlus size={12} className="text-fog" />
                                <span className="text-xs font-semibold text-fog">
                                  {Math.max(0, visit.adults_count - 1) + numChildren || '0'} acomp.
                                </span>
                              </button>
                            </div>

                            {/* Fila 3: total a pagar */}
                            <button
                              onClick={() => setTotalVisitId(visit.id)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-lime/5 border border-lime/20 hover:bg-lime/10 transition-colors"
                            >
                              <span className="text-xs font-semibold text-fog">Total a pagar</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-base font-bold text-lime">{grandTotal.toFixed(2)}€</span>
                                <Receipt size={12} className="text-lime/60" />
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── DESKTOP: table (md+) ─────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[820px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    {(['Titular', 'Acomp.', 'Total', 'Tipo', 'Bono', 'Sesiones', 'Entrada', 'Tiempo', 'Importe', 'Consumos', 'Total a pagar', 'Salida'] as const).map(col => {
                      const isFiltered =
                        (col === 'Tipo' && filterTipo !== 'all') ||
                        (col === 'Bono' && filterBono !== 'all') ||
                        (col === 'Sesiones' && filterSesiones !== 'all')
                      return (
                        <th key={col} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap first:pl-4 last:pr-4">
                          <span className={`flex items-center gap-1 ${isFiltered ? 'text-iris' : 'text-mist'}`}>
                            {col}
                            {isFiltered && <span className="w-1.5 h-1.5 rounded-full bg-iris shrink-0" />}
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredVisits.map(visit => {
                    const bono = visit.membership_id
                    const elapsedMins = (Date.now() - new Date(visit.checked_in_at).getTime()) / 60000
                    const isLong = elapsedMins > 180
                    const check = openChecks.get(visit.id)
                    const isShowingConsumos = consumosVisitId === visit.id
                    const imp = calcImporte(visit)
                    return (
                      <Fragment key={visit.id}>
                        <tr className={isLong ? 'bg-amber/5' : ''}>
                          {/* Titular */}
                          <td className="pl-4 pr-3 py-3 align-top">
                            <p className="text-xs font-semibold text-snow whitespace-nowrap">{visit.members?.name ?? '—'}</p>
                          </td>
                          {/* Acompañantes */}
                          <td className="px-3 py-3 align-middle">
                            {(() => {
                              const extraAdults = Math.max(0, (visit.adults_count ?? 1) - 1)
                              const numChildren = visit.children_count ?? 0
                              const hasAcomp = extraAdults > 0 || numChildren > 0
                              return (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center gap-1">
                                    {extraAdults > 0 && (
                                      <span className="text-[11px] font-bold text-lime flex items-center gap-0.5">
                                        {extraAdults} <span className="text-[10px] font-normal">adulto{extraAdults !== 1 ? 's' : ''}</span>
                                      </span>
                                    )}
                                    {extraAdults > 0 && numChildren > 0 && (
                                      <span className="text-mist text-[10px]">·</span>
                                    )}
                                    {numChildren > 0 && (
                                      <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-0.5">
                                        {numChildren} <span className="text-[10px] font-normal">niño{numChildren !== 1 ? 's' : ''}</span>
                                      </span>
                                    )}
                                    {!hasAcomp && <span className="text-xs text-mist">—</span>}
                                  </div>
                                  <button
                                    onClick={() => openAcompPopup(visit)}
                                    className="w-6 h-6 flex items-center justify-center rounded-md border border-line text-fog hover:text-iris hover:border-iris/40 transition-colors"
                                  >
                                    <UserPlus size={11} />
                                  </button>
                                </div>
                              )
                            })()}
                          </td>
                          {/* Total en sala */}
                          <td className="px-3 py-3 align-middle">
                            <span className="text-xs font-bold text-snow">{visit.adults_count + visit.children_count}</span>
                          </td>
                          {/* Tipo */}
                          <td className="px-3 py-3 align-top">
                            {(() => {
                              const tipo = fmtVisitType(visit)
                              const cls = tipo === 'Cumpleaños'
                                ? 'bg-iris/10 text-iris border-iris/30'
                                : tipo === 'Custodia'
                                ? 'bg-cyan-300/10 text-cyan-300 border-cyan-300/30'
                                : 'bg-surface2 text-fog border-line'
                              return (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border whitespace-nowrap ${cls}`}>
                                  {tipo}
                                </span>
                              )
                            })()}
                          </td>
                          {/* Bono */}
                          <td className="px-3 py-3 align-top">
                            <span className={`text-[10px] font-semibold whitespace-nowrap ${bono ? 'text-iris' : 'text-amber'}`}>
                              {bono ? (visit.memberships?.membership_types?.name ?? 'Con bono') : 'Sin bono'}
                            </span>
                          </td>
                          {/* Sesiones restantes */}
                          <td className="px-3 py-3 align-top">
                            {bono && visit.memberships != null ? (
                              <span className={`text-xs font-semibold whitespace-nowrap ${
                                visit.memberships.sessions_remaining <= 2 ? 'text-rose' :
                                visit.memberships.sessions_remaining <= 5 ? 'text-amber' : 'text-fog'
                              }`}>
                                {visit.memberships.sessions_remaining}
                              </span>
                            ) : (
                              <span className="text-[11px] text-mist">—</span>
                            )}
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
                          {/* Importe por tiempo */}
                          <td className="px-3 py-3 align-middle">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="text-xs font-bold text-lime">{imp.total.toFixed(2)}€</span>
                              <button
                                onClick={() => setImporteVisitId(visit.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-md border border-line text-fog hover:text-lime hover:border-lime/40 transition-colors"
                              >
                                <Receipt size={11} />
                              </button>
                            </div>
                          </td>
                          {/* Consumos */}
                          <td className="px-3 py-3 align-middle">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <span className={`text-xs font-semibold ${check && check.items.length > 0 ? 'text-lime' : 'text-mist'}`}>
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
                          {/* Total a pagar */}
                          <td className="px-3 py-3 align-middle">
                            {(() => {
                              const consumosTotal = (openChecks.get(visit.id)?.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
                              const grandTotal = imp.total + consumosTotal
                              return (
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <span className="text-xs font-bold text-lime">{grandTotal.toFixed(2)}€</span>
                                  <button
                                    onClick={() => setTotalVisitId(visit.id)}
                                    className="w-6 h-6 flex items-center justify-center rounded-md border border-line text-fog hover:text-lime hover:border-lime/40 transition-colors"
                                  >
                                    <Receipt size={11} />
                                  </button>
                                </div>
                              )
                            })()}
                          </td>
                          {/* Salida */}
                          <td className="pl-3 pr-4 py-3 align-top">
                            <button
                              onClick={() => setConfirmCheckout(visit.id)}
                              className="flex items-center justify-center text-rose bg-rose/10 border border-rose/30 rounded-lg w-7 h-7 hover:bg-rose/20 transition-colors"
                            >
                              <LogOut size={12} />
                            </button>
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
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
                    {isToday && canExecute && (
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

      {/* Modal de alertas */}
      {alertsOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-end p-4 pt-16 sm:pt-4" onClick={() => setAlertsOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl border border-amber/30 bg-surface shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-amber" />
                <span className="text-sm font-semibold text-snow">Alertas activas</span>
                <span className="text-[10px] font-bold bg-rose text-white px-1.5 py-0.5 rounded-full">{totalAlerts - dismissedAlerts.size}</span>
              </div>
              <button onClick={() => setAlertsOpen(false)} className="text-fog hover:text-snow transition-colors p-1">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {alertLongStay.filter(v => !dismissedAlerts.has('long-' + v.id)).map(v => {
                const imp = calcImporte(v)
                const consumosTotal = (openChecks.get(v.id)?.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
                const grandTotal = imp.total + consumosTotal
                return (
                  <div key={v.id} className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle size={13} className="text-amber shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-snow truncate">{v.members?.name ?? '—'}</p>
                          <p className="text-[11px] text-fog">Lleva {fmtElapsed(v.checked_in_at)} en sala</p>
                        </div>
                      </div>
                      <button onClick={() => setDismissedAlerts(prev => new Set([...prev, 'long-' + v.id]))} className="text-mist hover:text-fog transition-colors p-1 shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-surface2 text-fog border border-line">{fmtVisitType(v)}</span>
                        <span className="text-xs font-bold text-lime">{grandTotal.toFixed(2)}€</span>
                      </div>
                      <button
                        onClick={() => { setConfirmCheckout(v.id); setAlertsOpen(false) }}
                        className="flex items-center gap-1 text-[10px] font-medium text-rose bg-rose/10 border border-rose/30 rounded-lg px-2 py-1 hover:bg-rose/20 transition-colors shrink-0"
                      >
                        <LogOut size={10} /> Salida
                      </button>
                    </div>
                  </div>
                )
              })}
              {alertBirthdaySoon.filter(b => !dismissedAlerts.has('bday-' + b.id)).map(b => {
                const linkedVisit = activeVisits.find(v => v.booking_id === b.id)
                const grandTotal = linkedVisit
                  ? calcImporte(linkedVisit).total + (openChecks.get(linkedVisit.id)?.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
                  : null
                return (
                  <div key={b.id} className="rounded-xl border border-rose/40 bg-rose/10 px-3 py-2.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Cake size={13} className="text-rose shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-snow truncate">{b.title}</p>
                          <p className="text-[11px] text-fog">Empieza a las {b.start_time?.slice(0, 5)}</p>
                        </div>
                      </div>
                      <button onClick={() => setDismissedAlerts(prev => new Set([...prev, 'bday-' + b.id]))} className="text-mist hover:text-fog transition-colors p-1 shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-iris/10 text-iris border border-iris/30">Cumpleaños</span>
                      {grandTotal !== null && <span className="text-xs font-bold text-lime">{grandTotal.toFixed(2)}€</span>}
                    </div>
                  </div>
                )
              })}
              {alertCustodiaSoon.filter(b => !dismissedAlerts.has('cust-' + b.id)).map(b => {
                const linkedVisit = activeVisits.find(v => v.booking_id === b.id)
                const grandTotal = linkedVisit
                  ? calcImporte(linkedVisit).total + (openChecks.get(linkedVisit.id)?.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
                  : null
                return (
                  <div key={b.id} className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CalendarClock size={13} className="text-amber shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-snow truncate">{b.title}</p>
                          <p className="text-[11px] text-fog">Custodia termina a las {b.end_time?.slice(0, 5)}</p>
                        </div>
                      </div>
                      <button onClick={() => setDismissedAlerts(prev => new Set([...prev, 'cust-' + b.id]))} className="text-mist hover:text-fog transition-colors p-1 shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-cyan-300/10 text-cyan-300 border border-cyan-300/30">Custodia</span>
                      {grandTotal !== null && <span className="text-xs font-bold text-lime">{grandTotal.toFixed(2)}€</span>}
                    </div>
                  </div>
                )
              })}
              {totalAlerts - dismissedAlerts.size === 0 && (
                <p className="text-xs text-mist text-center py-4">Todas las alertas cerradas</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de total a pagar */}
      {totalVisitId && (() => {
        const visit = activeVisits.find(v => v.id === totalVisitId)
        if (!visit) return null
        const imp = calcImporte(visit)
        const mt = visit.memberships?.membership_types
        const elapsedMins = (Date.now() - new Date(visit.checked_in_at).getTime()) / 60000
        const hours = elapsedMins / 60
        const hourRate = visit.visit_type === 'custodia' ? rateCustodia : rateAdult
        const childRate = visit.visit_type === 'custodia' ? rateCustodia : rateChild
        const fmtH = (mins: number) => {
          const h = Math.floor(mins / 60), m = Math.round(mins % 60)
          return h > 0 ? `${h}h ${m}min` : `${m}min`
        }
        const check = openChecks.get(totalVisitId)
        const items = check?.items ?? []
        const grouped = Object.values(
          items.reduce<Record<string, { name: string; unit_price: number; ids: string[] }>>((acc, item) => {
            const key = item.product_id ?? item.name
            if (!acc[key]) acc[key] = { name: item.name, unit_price: item.unit_price, ids: [] }
            acc[key].ids.push(item.id)
            return acc
          }, {})
        )
        const consumosTotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
        const grandTotal = imp.total + consumosTotal
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setTotalVisitId(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-sm rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
                <div className="flex items-center gap-2">
                  <Receipt size={15} className="text-lime shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-snow">{visit.members?.name ?? '—'}</p>
                    <p className="text-[11px] text-fog">Total a pagar</p>
                  </div>
                </div>
                <button onClick={() => setTotalVisitId(null)} className="text-fog hover:text-snow transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                {/* Sección importe por tiempo */}
                <div>
                  <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">Importe por tiempo</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-fog">
                      <span>Tiempo en sala</span><span className="text-snow">{fmtH(elapsedMins)}</span>
                    </div>
                    {visit.adults_count > 0 && imp.titular > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-fog">{visit.adults_count} adulto{visit.adults_count !== 1 ? 's' : ''} × {hourRate}€/h × {hours.toFixed(2)}h</span>
                        <span className="text-snow">{imp.titular.toFixed(2)}€</span>
                      </div>
                    )}
                    {visit.children_count > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-fog">{visit.children_count} niño{visit.children_count !== 1 ? 's' : ''} × {childRate}€/h × {hours.toFixed(2)}h</span>
                        <span className="text-snow">{imp.ninos.toFixed(2)}€</span>
                      </div>
                    )}
                    {imp.bonoPrecioSesion !== null && mt ? (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-fog line-through">Subtotal regular</span>
                          <span className="text-mist line-through">{imp.regular.toFixed(2)}€</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-iris">{mt.name} ({mt.price}€ ÷ {mt.sessions} ses.)</span>
                          <span className="text-iris font-semibold">{imp.bonoPrecioSesion.toFixed(2)}€</span>
                        </div>
                        {imp.ahorro > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-fog">Ahorro aplicado</span>
                            <span className="text-mint">−{imp.ahorro.toFixed(2)}€</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-fog">Subtotal tiempo</span>
                        <span className="text-snow">{imp.total.toFixed(2)}€</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-semibold pt-1 border-t border-line">
                      <span className="text-fog">Subtotal tiempo</span>
                      <span className="text-lime">{imp.total.toFixed(2)}€</span>
                    </div>
                  </div>
                </div>

                {/* Sección consumos */}
                <div>
                  <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">Consumos</p>
                  {grouped.length === 0 ? (
                    <p className="text-xs text-mist">Sin consumos</p>
                  ) : (
                    <div className="space-y-1.5">
                      {grouped.map(g => {
                        const qty = g.ids.length
                        return (
                          <div key={g.name} className="flex justify-between text-xs">
                            <span className="text-fog">{g.name} × {qty}</span>
                            <span className="text-snow">{(g.unit_price * qty).toFixed(2)}€</span>
                          </div>
                        )
                      })}
                      <div className="flex justify-between text-xs font-semibold pt-1 border-t border-line">
                        <span className="text-fog">Subtotal consumos</span>
                        <span className="text-lime">{consumosTotal.toFixed(2)}€</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Total */}
              <div className="px-5 py-4 border-t border-line shrink-0 flex items-center justify-between">
                <span className="text-sm font-bold text-snow">Total a pagar</span>
                <span className="text-2xl font-bold text-lime">{grandTotal.toFixed(2)}€</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de confirmación de salida */}
      {confirmCheckout && (() => {
        const visit = activeVisits.find(v => v.id === confirmCheckout)
        if (!visit) return null
        const check = openChecks.get(confirmCheckout)
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setConfirmCheckout(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-sm rounded-2xl border border-line bg-surface shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line">
                <div className="flex items-center gap-2">
                  <LogOut size={15} className="text-rose shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-snow">{visit.members?.name ?? '—'}</p>
                    <p className="text-[11px] text-fog">Confirmar salida</p>
                  </div>
                </div>
                <button onClick={() => setConfirmCheckout(null)} className="text-fog hover:text-snow transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-fog">
                  ¿Registrar la salida de <span className="font-semibold text-snow">{visit.members?.name ?? '—'}</span>?
                </p>
                {check && check.items.length > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-amber/10 border border-amber/30 px-3 py-2.5">
                    <ShoppingCart size={13} className="text-amber shrink-0" />
                    <p className="text-xs text-amber">
                      Hay {check.items.length} consumo{check.items.length !== 1 ? 's' : ''} abierto{check.items.length !== 1 ? 's' : ''} por <span className="font-bold text-lime">{check.items.reduce((s, i) => s + i.unit_price * i.quantity, 0).toFixed(2)}€</span> — se cerrarán al salir.
                    </p>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setConfirmCheckout(null)}
                    className="flex-1 text-sm font-medium text-fog bg-surface2 border border-line rounded-xl py-2.5 hover:text-snow transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleCheckout(visit.id)}
                    disabled={checkingOut === visit.id}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-rose rounded-xl py-2.5 hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    <LogOut size={14} />
                    {checkingOut === visit.id ? 'Registrando...' : 'Confirmar salida'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de acompañantes */}
      {acompVisitId && (() => {
        const visit = activeVisits.find(v => v.id === acompVisitId)
        if (!visit) return null
        const member = allMembers.find(m => m.id === visit.member_id)
        const registeredChildren = member?.children ?? []
        const selectedNames = new Set(acompChildren.filter(c => !c.isGuest).map(c => c.name))

        function toggleChild(child: { name: string; birth_date?: string }) {
          setAcompChildren(prev => {
            const exists = prev.some(c => c.name === child.name && !c.isGuest)
            if (exists) return prev.filter(c => !(c.name === child.name && !c.isGuest))
            return [...prev, { ...child, isGuest: false }]
          })
        }

        const coTitSelected = acompCoTitulares.filter(c => c.selected).length
        const totalAcomp = coTitSelected + acompGuestAdults + acompChildren.length + acompGuestChildren

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setAcompVisitId(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-md rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-iris shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-snow">{visit.members?.name ?? '—'}</p>
                    <p className="text-[11px] text-fog">{totalAcomp} acompañante{totalAcomp !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <button onClick={() => setAcompVisitId(null)} className="text-fog hover:text-snow transition-colors p-1">
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
                {/* Titular */}
                <div>
                  <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">Titular</p>
                  <button
                    onClick={() => setAcompTitularPresent(p => !p)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors text-left ${
                      acompTitularPresent ? 'bg-iris/10 border-iris/40' : 'bg-surface2 border-line hover:border-iris/30'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      acompTitularPresent ? 'bg-iris border-iris' : 'border-line2'
                    }`}>
                      {acompTitularPresent && <Check size={10} className="text-ink" strokeWidth={3} />}
                    </span>
                    <span className="text-xs font-medium text-snow flex-1">{visit.members?.name ?? '—'}</span>
                    <span className="text-[11px] text-iris font-medium">Titular</span>
                  </button>
                </div>

                {/* Co-titulares */}
                {acompCoTitulares.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">Co-titulares</p>
                    <div className="space-y-1.5">
                      {acompCoTitulares.map(cot => (
                        <button key={cot.id}
                          onClick={() => setAcompCoTitulares(prev => prev.map(c => c.id === cot.id ? { ...c, selected: !c.selected } : c))}
                          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors text-left ${
                            cot.selected ? 'bg-lime/10 border-lime/40' : 'bg-surface2 border-line hover:border-lime/30'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            cot.selected ? 'bg-lime border-lime' : 'border-line2'
                          }`}>
                            {cot.selected && <Check size={10} className="text-ink" strokeWidth={3} />}
                          </span>
                          <span className="text-xs font-medium text-snow flex-1">{cot.name}</span>
                          <span className="text-[11px] text-lime font-medium">Co-titular</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hijos registrados */}
                {registeredChildren.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">Hijos registrados</p>
                    <div className="space-y-1.5">
                      {registeredChildren.map((child, i) => {
                        const checked = selectedNames.has(child.name)
                        const age = fmtChildAge(child.birth_date, child.age)
                        return (
                          <button key={i} onClick={() => toggleChild(child)}
                            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors text-left ${
                              checked ? 'bg-iris/10 border-iris/40' : 'bg-surface2 border-line hover:border-iris/30'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                              checked ? 'bg-iris border-iris' : 'border-line2'
                            }`}>
                              {checked && <Check size={10} className="text-ink" strokeWidth={3} />}
                            </span>
                            <span className="text-xs font-medium text-snow flex-1">{child.name}</span>
                            {age && <span className="text-[11px] text-fog">{age}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Invitados */}
                <div>
                  <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">Invitados</p>
                  <div className="space-y-2">
                    {/* Adultos invitados */}
                    <div className="flex items-center justify-between rounded-xl bg-surface2 border border-line px-3 py-2.5">
                      <span className="text-xs text-snow">Adultos invitados</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setAcompGuestAdults(n => Math.max(0, n - 1))}
                          className="w-6 h-6 flex items-center justify-center rounded-md bg-surface border border-line text-fog hover:text-rose hover:border-rose/40 transition-colors font-bold">−</button>
                        <input
                          type="number" min={0}
                          value={acompGuestAdults}
                          onChange={e => setAcompGuestAdults(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-8 text-center text-xs font-semibold text-snow bg-transparent focus:outline-none"
                        />
                        <button onClick={() => setAcompGuestAdults(n => n + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-md bg-surface border border-line text-fog hover:text-lime hover:border-lime/40 transition-colors font-bold">+</button>
                      </div>
                    </div>
                    {/* Niños invitados */}
                    <div className="flex items-center justify-between rounded-xl bg-surface2 border border-line px-3 py-2.5">
                      <span className="text-xs text-snow">Niños invitados</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setAcompGuestChildren(n => Math.max(0, n - 1))}
                          className="w-6 h-6 flex items-center justify-center rounded-md bg-surface border border-line text-fog hover:text-rose hover:border-rose/40 transition-colors font-bold">−</button>
                        <input
                          type="number" min={0}
                          value={acompGuestChildren}
                          onChange={e => setAcompGuestChildren(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-8 text-center text-xs font-semibold text-snow bg-transparent focus:outline-none"
                        />
                        <button onClick={() => setAcompGuestChildren(n => n + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-md bg-surface border border-line text-fog hover:text-lime hover:border-lime/40 transition-colors font-bold">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-line shrink-0 flex items-center justify-between">
                <span className="text-[11px] text-mist">{totalAcomp} acompañante{totalAcomp !== 1 ? 's' : ''}</span>
                <span className={`text-[11px] flex items-center gap-1 transition-opacity ${savingAcomp || savedAcomp ? 'opacity-100' : 'opacity-0'}`}>
                  {savingAcomp
                    ? <span className="text-fog">Guardando...</span>
                    : <span className="text-mint flex items-center gap-1"><Check size={11} /> Guardado</span>
                  }
                </span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de detalle de importe */}
      {importeVisitId && (() => {
        const visit = activeVisits.find(v => v.id === importeVisitId)
        if (!visit) return null
        const elapsedMins = (Date.now() - new Date(visit.checked_in_at).getTime()) / 60000
        const hours = elapsedMins / 60
        const imp = calcImporte(visit)
        const mt = visit.memberships?.membership_types
        const fmtH = (mins: number) => {
          const h = Math.floor(mins / 60), m = Math.round(mins % 60)
          return h > 0 ? `${h}h ${m}min` : `${m}min`
        }
        const hourRate = visit.visit_type === 'custodia' ? rateCustodia : rateAdult
        const childRate = visit.visit_type === 'custodia' ? rateCustodia : rateChild
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setImporteVisitId(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-sm rounded-2xl border border-line bg-surface shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line">
                <div className="flex items-center gap-2">
                  <Receipt size={15} className="text-lime shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-snow">{visit.members?.name ?? '—'}</p>
                    <p className="text-[11px] text-fog">Desglose del importe</p>
                  </div>
                </div>
                <button onClick={() => setImporteVisitId(null)} className="text-fog hover:text-snow transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
              {/* Body */}
              <div className="px-5 py-4 space-y-2.5">
                {/* Meta */}
                <div className="flex justify-between text-xs text-fog">
                  <span>Entrada</span><span className="text-snow">{fmtTime(visit.checked_in_at)}</span>
                </div>
                <div className="flex justify-between text-xs text-fog">
                  <span>Tiempo en sala</span><span className="text-snow">{fmtH(elapsedMins)}</span>
                </div>
                <div className="flex justify-between text-xs text-fog">
                  <span>Tipo de visita</span><span className="text-snow">{fmtVisitType(visit)}</span>
                </div>

                {/* Tarifa sin bono */}
                <div className="border-t border-line pt-2.5 space-y-1.5">
                  <p className="text-[10px] font-semibold text-mist uppercase tracking-wide">Tarifa regular</p>
                  {visit.adults_count > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-fog">{visit.adults_count} adulto{visit.adults_count !== 1 ? 's' : ''} × {hourRate}€/h × {hours.toFixed(2)}h</span>
                      <span className="text-snow">{imp.titular.toFixed(2)}€</span>
                    </div>
                  )}
                  {visit.children_count > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-fog">{visit.children_count} niño{visit.children_count !== 1 ? 's' : ''} × {childRate}€/h × {hours.toFixed(2)}h</span>
                      <span className="text-snow">{imp.ninos.toFixed(2)}€</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-fog">Subtotal regular</span>
                    <span className={imp.bonoPrecioSesion !== null ? 'text-mist line-through' : 'text-lime'}>{imp.regular.toFixed(2)}€</span>
                  </div>
                </div>

                {/* Descuento bono */}
                {imp.bonoPrecioSesion !== null && mt && (
                  <div className="border-t border-line pt-2.5 space-y-1.5">
                    <p className="text-[10px] font-semibold text-iris uppercase tracking-wide">{mt.name}</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-fog">Precio por sesión ({mt.price}€ ÷ {mt.sessions} ses.)</span>
                      <span className="text-iris">{imp.bonoPrecioSesion.toFixed(2)}€</span>
                    </div>
                    {imp.ahorro > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-fog">Ahorro aplicado</span>
                        <span className="text-mint">−{imp.ahorro.toFixed(2)}€</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Total */}
                <div className="border-t border-line pt-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-snow">Total a cobrar</span>
                  <span className="text-xl font-bold text-lime">{imp.total.toFixed(2)}€</span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de registro de visita */}
      {checkinOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setCheckinOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-3xl rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[95vh]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <LogIn size={15} className="text-lime shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-snow">Registrar visita</p>
                  <p className="text-[11px] text-fog">Check-in manual o por QR</p>
                </div>
              </div>
              <button onClick={() => setCheckinOpen(false)} className="text-fog hover:text-snow transition-colors p-1">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4">
              <CheckinPanel
                checkinMembers={checkinMembers}
                activeVisits={activeVisits}
                rates={{ adult: rateAdult, child: rateChild, custodia: rateCustodia }}
                onCheckedIn={() => { router.refresh(); setCheckinMembers([]) }}
                onClose={() => setCheckinOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de consumos */}
      {consumosVisitId && consumosVisit && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setConsumosVisitId(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Panel */}
          <div
            className="relative w-full sm:max-w-md rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[85vh]"
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
                  <span className="text-base font-bold text-lime">
                    {openChecks.get(consumosVisitId)!.items.reduce((s, i) => s + i.unit_price * i.quantity, 0).toFixed(2)}€
                  </span>
                )}
                <button onClick={() => setConsumosVisitId(null)} className="text-fog hover:text-snow transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {/* Items consumidos — agrupados por producto */}
              {(() => {
                const items = openChecks.get(consumosVisitId)?.items ?? []
                // Group by product key (product_id or name fallback)
                const grouped = Object.values(
                  items.reduce<Record<string, { name: string; unit_price: number; ids: string[]; product_id: string | null }>>((acc, item) => {
                    const key = item.product_id ?? item.name
                    if (!acc[key]) acc[key] = { name: item.name, unit_price: item.unit_price, ids: [], product_id: item.product_id }
                    acc[key].ids.push(item.id)
                    return acc
                  }, {})
                )
                const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

                return grouped.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">Consumido</p>
                    <div className="space-y-1.5">
                      {grouped.map(g => {
                        const qty = g.ids.length
                        const lineTotal = g.unit_price * qty
                        const product = products.find(p => p.id === g.product_id)
                        return (
                          <div key={g.product_id ?? g.name} className="flex items-center gap-3 rounded-xl bg-surface2 border border-line px-3 py-2.5">
                            {/* Name + unit price */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-snow truncate">{g.name}</p>
                              <p className="text-[10px] text-mist">{Number(g.unit_price).toFixed(2)}€/ud.</p>
                            </div>
                            {/* Quantity controls */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleRemoveItem(consumosVisitId, g.ids[g.ids.length - 1])}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-surface border border-line text-fog hover:text-rose hover:border-rose/40 transition-colors text-sm font-bold"
                              >
                                −
                              </button>
                              <span className="w-5 text-center text-xs font-semibold text-snow">{qty}</span>
                              <button
                                onClick={() => product && handleAddProduct(consumosVisitId, product)}
                                disabled={!product || addingProduct === (g.product_id ?? g.name) + consumosVisitId}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-surface border border-line text-fog hover:text-lime hover:border-lime/40 transition-colors text-sm font-bold disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                            {/* Line total */}
                            <p className="text-xs font-semibold text-lime w-14 text-right shrink-0">{lineTotal.toFixed(2)}€</p>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-end mt-3 pt-3 border-t border-line">
                      <p className="text-xs text-fog">
                        Total: <span className="text-lime font-bold">{total.toFixed(2)}€</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-mist">Sin consumos registrados aún.</p>
                )
              })()}

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
