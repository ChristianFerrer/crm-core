'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  LogIn, Users, CalendarClock, Cake, ChevronDown, ChevronUp,
  BarChart2, Activity, LogOut, AlertTriangle, Play, Clock,
  Check, ShoppingCart, Plus, X, ChevronLeft, ChevronRight, Receipt, UserPlus, Bell,
  Search, QrCode, RotateCcw, User, Phone, Loader2, Save, Calendar, Trash2, CalendarPlus,
  Euro, CreditCard,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant, loadAndStoreTenant } from '@/lib/tenant'
import { executeBooking } from '@/lib/bookingExecution'
import { memberMatchesQuery } from '@/lib/searchMembers'
import { bonoStatus, activeBono } from '@/lib/bonoStatus'
import { resolveRates } from '@/lib/pricing'
import { DatePickerModal } from '@/components/DatePickerModal'
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
  paid_amount: number | null
  payment_method: string | null
  bookings: {
    type: string; amount: number | null; deposit_amount: number | null; payment_status: string | null
    guest_adults: number | null; guest_children: number | null
    addons: { name: string; price: number }[] | null
    services: { price: number | null; price_per_guest_adult: number | null; price_per_guest_child: number | null; included_guests: number | null } | null
  } | null
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
  date: string | null
  start_time: string | null
  end_time: string | null
  guests: number | null
  guest_adults: number | null
  guest_children: number | null
  child_name: string | null
  notes: string | null
  executed_at: string | null
  member_id: string | null
  amount: number | null
  deposit_amount: number | null
  payment_status: string | null
  addons: { name: string; price: number }[] | null
  members: { name: string } | null
  services: { name: string } | null
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

export type FullMember = {
  id: string
  name: string
  phone: string | null
  family_id: string | null
  memberships: {
    id: string
    sessions_remaining: number | null
    expires_at: string
    membership_types: { name: string } | null
  }[]
  children: { name: string; birth_date: string }[]
}

function getBonoInfo(m: FullMember) {
  const bono = activeBono(m.memberships)
  if (!bono) return null
  const st = bonoStatus(bono)
  return {
    ok: st.ok,
    unlimited: st.unlimited,
    label: st.unlimited ? 'Bono ilimitado' : st.depleted ? 'Bono agotado' : (bono.membership_types?.name ?? 'Bono'),
    sessions: st.unlimited ? null : st.sessions,
  }
}

// ── Modal 1: búsqueda + QR ──
function CheckinSearchModal({
  filtered,
  query,
  onQueryChange,
  activeVisits,
  onSelect,
  onNewMember,
  onClose,
}: {
  filtered: FullMember[]
  query: string
  onQueryChange: (q: string) => void
  activeVisits: TodayVisit[]
  onSelect: (m: FullMember) => void
  onNewMember: () => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'manual' | 'qr'>('manual')
  const [scanning, setScanning] = useState(true)
  const [camError, setCamError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'qr' || !scanning) return
    let html5Qr: any, stopped = false
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return
      html5Qr = new Html5Qrcode('qr-reader-checkin')
      html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        async (decoded: string) => {
          await html5Qr.stop().catch(() => {})
          setScanning(false)
          const { data } = await supabase.from('members')
            .select('id, name, phone, family_id, memberships(id, sessions_remaining, expires_at, membership_types(name)), children')
            .eq('qr_code', decoded).single()
          if (!data) { setCamError('Código QR no reconocido'); return }
          onSelect(data as unknown as FullMember)
        },
        () => {}
      ).catch(() => setCamError('No se puede acceder a la cámara'))
    })
    return () => { stopped = true; html5Qr?.stop().catch(() => {}) }
  }, [mode, scanning])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <LogIn size={15} className="text-lime shrink-0" />
            <div>
              <p className="text-sm font-semibold text-snow">Registrar entrada</p>
              <p className="text-[11px] text-fog">Registro de entrada de visitantes</p>
            </div>
          </div>
          <button onClick={onClose} className="text-fog hover:text-snow transition-colors p-1" aria-label="Cerrar"><X size={16} /></button>
        </div>

        {/* Tabs manual / QR */}
        <div className="flex border-b border-line shrink-0">
          <button onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${mode === 'manual' ? 'text-lime border-b-2 border-lime' : 'text-mist hover:text-fog'}`}>
            <Search size={13} /> Manual
          </button>
          <button onClick={() => { setMode('qr'); setScanning(true); setCamError(null) }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${mode === 'qr' ? 'text-lime border-b-2 border-lime' : 'text-mist hover:text-fog'}`}>
            <QrCode size={13} /> Escanear QR
          </button>
        </div>

        {mode === 'qr' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-5 gap-4">
            {scanning && !camError ? (
              <div id="qr-reader-checkin" className="w-full max-w-xs rounded-xl overflow-hidden [&>*]:rounded-xl" />
            ) : (
              <div className="flex flex-col items-center gap-3">
                {camError && <p className="text-sm text-rose text-center">{camError}</p>}
                <button onClick={() => { setScanning(true); setCamError(null) }}
                  className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-fog hover:text-snow hover:border-line2 transition-colors">
                  <RotateCcw size={14} /> Volver a escanear
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Search input */}
            <div className="px-5 pt-4 pb-2 shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
                <input value={query} onChange={e => onQueryChange(e.target.value)}
                  placeholder="Buscar por nombre o teléfono..." autoFocus
                  className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-10 pr-4 text-sm text-snow placeholder:text-mist outline-none focus:border-line2" />
              </div>
            </div>
            {/* Results */}
            <div className="overflow-y-auto flex-1 divide-y divide-line/50">
              {filtered.map(m => {
                const b = getBonoInfo(m)
                const inside = activeVisits.some(v => v.member_id === m.id && !v.checked_out_at)
                return (
                  <button key={m.id} onClick={() => onSelect(m)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface2 transition-colors">
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
              })}
              {query.trim().length > 0 && filtered.length === 0 && (
                <div className="flex flex-col items-center gap-4 py-8 px-5">
                  <p className="text-sm text-fog text-center">No se encontró ningún miembro con ese nombre o teléfono.</p>
                  <button onClick={onNewMember}
                    className="flex items-center gap-2 rounded-xl bg-lime/10 border border-lime/30 px-5 py-2.5 text-sm font-semibold text-lime hover:bg-lime/20 transition-colors">
                    <UserPlus size={15} /> Crear nuevo miembro
                  </button>
                </div>
              )}
              {query.trim().length === 0 && (
                <p className="py-8 text-center text-sm text-mist">Escribe un nombre o teléfono para buscar</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Modal 2: confirmación de entrada ──
function CheckinConfirmModal({
  member,
  checkinMembers,
  activeVisits,
  rates,
  onBack,
  onClose,
  onCheckedIn,
}: {
  member: FullMember
  checkinMembers: FullMember[]
  activeVisits: TodayVisit[]
  rates: { adult: number; child: number; custodia: number }
  onBack: () => void
  onClose: () => void
  onCheckedIn: () => void
}) {
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [checkedOut, setCheckedOut] = useState(false)
  const [showGuests, setShowGuests] = useState(false)
  const [currentMember, setCurrentMember] = useState<FullMember>(member)
  const [visitType, setVisitType] = useState<'entrada' | 'custodia'>('entrada')
  // Mejora #1: menores sin pre-seleccionar
  const [childrenPresent, setChildrenPresent] = useState<{ name: string; birth_date?: string }[]>([])
  const [extraChildrenCount, setExtraChildrenCount] = useState(0)
  const [coTitulares, setCoTitulares] = useState<{ id: string; name: string; selected: boolean }[]>(
    member.family_id
      ? checkinMembers.filter(o => (o as any).family_id === member.family_id && o.id !== member.id)
          .map(o => ({ id: o.id, name: o.name, selected: false }))
      : []
  )
  const [extraAdultsCount, setExtraAdultsCount] = useState(0)
  const [custodiaStart, setCustodiaStart] = useState('')
  const [custodiaEnd, setCustodiaEnd] = useState('')
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const bono = getBonoInfo(currentMember)
  const activeVisit = activeVisits.find(v => v.member_id === currentMember.id && !v.checked_out_at)
  const alreadyInside = !!activeVisit
  const custodiaValid = visitType !== 'custodia' || (custodiaStart.trim() !== '' && custodiaEnd.trim() !== '')

  // Checkout desde "ya dentro" — mismo efecto que el checkout de la tabla:
  // cierra cualquier cuenta abierta y marca la salida (sin dejar cuentas fantasma).
  async function handleCheckOut() {
    if (!activeVisit) return
    const now = new Date().toISOString()
    await supabase.from('open_checks').update({ closed_at: now, status: 'closed' })
      .eq('visit_id', activeVisit.id).is('closed_at', null)
    // La salida no marca el cobro (paso explícito aparte)
    await supabase.from('visits').update({ checked_out_at: now }).eq('id', activeVisit.id)
    setCheckedOut(true)
    onCheckedIn()
    closeTimer.current = setTimeout(onClose, 1500)
  }

  async function handleCheckIn() {
    if (registering || !custodiaValid) return
    setRegistering(true)
    const b = getBonoInfo(currentMember)
    const m = currentMember.memberships?.[0]
    const selectedCo = coTitulares.filter(c => c.selected)
    const numAdults = 1 + selectedCo.length + extraAdultsCount
    const numChildren = childrenPresent.length + extraChildrenCount
    const adultEntries = selectedCo.map(c => ({ name: c.name, is_adult: true }))
    const today = new Date().toISOString().slice(0, 10)
    const custodiaEndAt = visitType === 'custodia' && custodiaEnd
      ? new Date(`${today}T${custodiaEnd}:00`).toISOString()
      : null
    await supabase.from('visits').insert({
      member_id: currentMember.id,
      membership_id: (b?.ok && m) ? m.id : null,
      checked_in_at: visitType === 'custodia' && custodiaStart
        ? new Date(`${today}T${custodiaStart}:00`).toISOString()
        : new Date().toISOString(),
      visit_type: visitType,
      children_present: [...adultEntries, ...childrenPresent],
      adults_count: numAdults,
      children_count: numChildren,
      ...(custodiaEndAt ? { custodia_end_at: custodiaEndAt } : {}),
    })
    if (b?.ok && !b.unlimited && m?.sessions_remaining != null) {
      await supabase.from('memberships')
        .update({ sessions_remaining: Math.max(0, m.sessions_remaining - 1) })
        .eq('id', m.id)
    }
    setRegistering(false)
    setRegistered(true)
    onCheckedIn()
    closeTimer.current = setTimeout(onClose, 2000)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        {/* Header — nombre del miembro */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-line shrink-0">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 bg-surface/60 text-fog hover:text-snow transition-colors shrink-0">
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-snow truncate">{currentMember.name}</p>
            <p className="text-xs text-fog">Registro de entrada</p>
          </div>
          <button onClick={onClose} className="text-fog hover:text-snow transition-colors p-1" aria-label="Cerrar"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Confirmación de registro */}
          {registered ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 rounded-full bg-lime/15 border border-lime/30 flex items-center justify-center">
                <Check size={30} className="text-lime" strokeWidth={2.5} />
              </div>
              <p className="text-lg font-bold text-snow">¡Entrada registrada!</p>
              <p className="text-sm text-fog text-center">La visita de <span className="text-snow font-medium">{currentMember.name}</span> ha sido registrada correctamente.</p>
              <p className="text-xs text-mist mt-1">Cerrando automáticamente...</p>
            </div>
          ) : alreadyInside ? (
            <div className="space-y-3">
              {checkedOut ? (
                <div className="rounded-xl bg-lime/10 border border-lime/20 px-4 py-4 flex flex-col items-center gap-2">
                  <Check size={22} className="text-lime" strokeWidth={2.5} />
                  <p className="text-sm font-semibold text-lime">Salida registrada</p>
                  <p className="text-xs text-fog">Cerrando...</p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl bg-iris/10 border border-iris/20 px-4 py-3 text-sm text-iris font-medium text-center">
                    Este miembro ya está dentro
                  </div>
                  <button onClick={handleCheckOut}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-4 bg-iris/15 border border-iris/30 text-iris font-semibold text-sm hover:bg-iris/25 transition active:scale-[0.99]">
                    <LogOut size={17} strokeWidth={2.2} />
                    Registrar salida
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Tipo de entrada */}
              <div>
                <p className="px-1 pb-1.5 text-[10px] font-semibold text-fog uppercase tracking-wide">Tipo de entrada</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setVisitType('entrada')}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      visitType === 'entrada' ? 'bg-lime/15 border-lime/30 text-lime' : 'bg-surface2 border-line text-fog hover:text-snow'
                    }`}>Libre</button>
                  <button type="button" onClick={() => setVisitType('custodia')}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      visitType === 'custodia' ? 'bg-cyan-300/15 border-cyan-300/30 text-cyan-300' : 'bg-surface2 border-line text-fog hover:text-snow'
                    }`}>Custodia</button>
                </div>
                {visitType === 'custodia' && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <p className="px-1 text-[10px] font-semibold text-fog uppercase tracking-wide">Entrada <span className="text-rose">*</span></p>
                      <div className="flex items-center px-3 py-2.5 rounded-xl border border-cyan-300/30 bg-surface2">
                        <input type="time" value={custodiaStart} onChange={e => setCustodiaStart(e.target.value)}
                          className="w-full bg-transparent text-sm text-snow outline-none" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="px-1 text-[10px] font-semibold text-fog uppercase tracking-wide">Salida <span className="text-rose">*</span></p>
                      <div className="flex items-center px-3 py-2.5 rounded-xl border border-cyan-300/30 bg-surface2">
                        <input type="time" value={custodiaEnd} onChange={e => setCustodiaEnd(e.target.value)}
                          className="w-full bg-transparent text-sm text-snow outline-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Co-titulares — solo en entrada libre */}
              {visitType === 'entrada' && coTitulares.length > 0 && (
                <div>
                  <p className="px-1 pb-1.5 text-[10px] font-semibold text-fog uppercase tracking-wide">Co-titulares</p>
                  <div className="space-y-2">
                    {coTitulares.map((co, i) => (
                      <button key={co.id} type="button"
                        onClick={() => setCoTitulares(prev => prev.map((c, j) => j === i ? { ...c, selected: !c.selected } : c))}
                        className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                          co.selected ? 'bg-iris/5 border-iris/30' : 'border-line bg-surface2 hover:border-line2'
                        }`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${co.selected ? 'bg-iris border-iris' : 'bg-surface2 border-line2'}`}>
                          {co.selected && <Check size={11} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className={`flex-1 text-sm font-medium ${co.selected ? 'text-snow' : 'text-fog'}`}>{co.name}</span>
                        <span className="text-[10px] text-iris font-medium shrink-0">Co-titular</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Menores — #1 sin pre-seleccionar */}
              {currentMember.children && currentMember.children.length > 0 && (
                <div>
                  <p className="px-1 pb-1.5 text-[10px] font-semibold text-fog uppercase tracking-wide">Menores</p>
                  <div className="space-y-2">
                    {currentMember.children.map((child, i) => {
                      const sel = childrenPresent.some(c => c.name === child.name)
                      const bd = (child as any).birth_date as string | undefined
                      const age = bd ? (() => {
                        const now = new Date(), dob = new Date(bd)
                        let y = now.getFullYear() - dob.getFullYear()
                        let m = now.getMonth() - dob.getMonth()
                        if (now.getDate() < dob.getDate()) m--
                        if (m < 0) { y--; m += 12 }
                        return y > 0 ? `${y} año${y !== 1 ? 's' : ''}${m > 0 ? ` ${m} m.` : ''}` : `${m} mes${m !== 1 ? 'es' : ''}`
                      })() : null
                      return (
                        <button key={child.name + i} type="button"
                          onClick={() => setChildrenPresent(prev =>
                            sel ? prev.filter(c => c.name !== child.name) : [...prev, { name: child.name, birth_date: bd }]
                          )}
                          className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                            sel ? 'bg-iris/5 border-iris/30' : 'border-line bg-surface2 hover:border-line2'
                          }`}>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${sel ? 'bg-iris border-iris' : 'bg-surface2 border-line2'}`}>
                            {sel && <Check size={11} className="text-white" strokeWidth={3} />}
                          </div>
                          <span className={`flex-1 text-sm font-medium ${sel ? 'text-snow' : 'text-fog'}`}>{child.name}</span>
                          {age && <span className="text-xs text-mist shrink-0">{age}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Invitados adicionales — #2 colapsados */}
              {!showGuests ? (
                <button type="button" onClick={() => setShowGuests(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-xs font-semibold text-fog hover:border-line2 hover:text-snow transition-colors">
                  <Plus size={13} /> Añadir invitados adicionales
                </button>
              ) : (
                <div>
                  <div className="flex items-center justify-between px-1 pb-1.5">
                    <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Invitados adicionales</p>
                    <button type="button" onClick={() => { setShowGuests(false); setExtraAdultsCount(0); setExtraChildrenCount(0) }}
                      className="text-mist hover:text-fog transition-colors"><X size={13} /></button>
                  </div>
                  <div className="space-y-2">
                    {visitType === 'entrada' && (
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-line">
                        <span className="text-sm text-fog">Adultos</span>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => setExtraAdultsCount(n => Math.max(0, n - 1))} disabled={extraAdultsCount === 0}
                            className="w-8 h-8 rounded-lg border border-line bg-surface2 text-fog hover:text-snow flex items-center justify-center text-lg font-bold transition-colors disabled:opacity-30">−</button>
                          <span className="w-5 text-center font-bold text-snow">{extraAdultsCount}</span>
                          <button type="button" onClick={() => setExtraAdultsCount(n => n + 1)}
                            className="w-8 h-8 rounded-lg border border-lime/40 bg-lime/10 text-lime hover:bg-lime/20 flex items-center justify-center text-lg font-bold transition-colors">+</button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-line">
                      <span className="text-sm text-fog">Niños</span>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setExtraChildrenCount(n => Math.max(0, n - 1))} disabled={extraChildrenCount === 0}
                          className="w-8 h-8 rounded-lg border border-line bg-surface2 text-fog hover:text-snow flex items-center justify-center text-lg font-bold transition-colors disabled:opacity-30">−</button>
                        <span className="w-5 text-center font-bold text-snow">{extraChildrenCount}</span>
                        <button type="button" onClick={() => setExtraChildrenCount(n => n + 1)}
                          className="w-8 h-8 rounded-lg border border-lime/40 bg-lime/10 text-lime hover:bg-lime/20 flex items-center justify-center text-lg font-bold transition-colors">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Aviso tarifa */}
              {!bono?.ok && (
                <div className="flex items-start gap-2 rounded-xl bg-amber/10 border border-amber/20 px-3 py-2.5">
                  <AlertTriangle size={13} className="text-amber shrink-0 mt-0.5" />
                  <p className="text-xs text-amber/90">
                    {bono ? 'Bono agotado.' : 'Sin bono.'}{' '}
                    {visitType === 'custodia' ? `${rates.custodia} €/h × niños` : `${rates.adult} €/h adulto · ${rates.child} €/h niño`}
                  </p>
                </div>
              )}

              {/* Botón registrar — #4 se cierra solo tras registro */}
              <button onClick={handleCheckIn} disabled={registering || !custodiaValid}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-4 bg-lime text-ink font-semibold text-sm hover:brightness-105 transition active:scale-[0.99] disabled:opacity-60"
                style={{ boxShadow: 'var(--shadow-lime)' }}>
                <LogIn size={17} strokeWidth={2.2} />
                {registering ? 'Registrando...' : 'Registrar entrada'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal 3: nuevo miembro inline ──
function CheckinNewMemberModal({
  onBack,
  onClose,
  onCreated,
}: {
  onBack: () => void
  onClose: () => void
  onCreated: (member: FullMember) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [children, setChildren] = useState<{ name: string; sex: string; birth_date: string }[]>([])
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [showPartner, setShowPartner] = useState(false)
  const [partnerPhone, setPartnerPhone] = useState('')
  const [partnerSearching, setPartnerSearching] = useState(false)
  const [partnerFound, setPartnerFound] = useState<{ id: string; name: string; phone: string } | null | undefined>(undefined)
  const [partnerConfirmed, setPartnerConfirmed] = useState(false)
  const [partnerName, setPartnerName] = useState('')
  const partnerTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function handlePartnerPhone(val: string) {
    setPartnerPhone(val); setPartnerFound(undefined); setPartnerConfirmed(false); setPartnerName('')
    clearTimeout(partnerTimer.current)
    if (val.replace(/\s/g, '').length < 8) return
    setPartnerSearching(true)
    partnerTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('members').select('id, name, phone')
        .eq('phone', val.trim()).limit(1).maybeSingle()
      setPartnerSearching(false); setPartnerFound(data ?? null)
    }, 400)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !consentAccepted) return
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    setSaving(true); setError(null)
    try {
      const cleanChildren = children.filter(c => c.name.trim())
      const hasPartner = showPartner && partnerPhone.trim() && (partnerConfirmed || partnerName.trim())
      let familyId: string | null = null
      if (hasPartner) {
        const { data: fam, error: fe } = await supabase
          .from('families').insert({ name: `Familia ${lastName.trim() || firstName.trim()}` }).select('id').single()
        if (fe) throw fe
        familyId = fam.id
      }
      const { data: newMember, error: me } = await supabase.from('members').insert({
        name: fullName, phone: phone.trim() || null, email: email.trim() || null,
        birth_date: birthDate || null, family_id: familyId,
        children: cleanChildren, children_count: cleanChildren.length,
        consent_accepted_at: new Date().toISOString(), consent_version: 'v1.0',
      }).select('id, name, phone, family_id, memberships(id, sessions_remaining, expires_at, membership_types(name)), children').single()
      if (me) throw me
      if (hasPartner && familyId) {
        if (partnerFound && partnerConfirmed) {
          await supabase.from('members').update({
            family_id: familyId,
            ...(cleanChildren.length > 0 ? { children: cleanChildren, children_count: cleanChildren.length } : {}),
          }).eq('id', partnerFound.id)
        } else if (partnerName.trim()) {
          await supabase.from('members').insert({
            name: partnerName.trim(), phone: partnerPhone.trim(), family_id: familyId,
            children: cleanChildren, children_count: cleanChildren.length,
            consent_accepted_at: new Date().toISOString(), consent_version: 'v1.0',
          })
        }
      }
      onCreated(newMember as unknown as FullMember)
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar'); setSaving(false)
    }
  }

  const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-2 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
  const labelCls = 'block text-xs font-semibold text-fog uppercase tracking-wide mb-1.5'

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-line shrink-0">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 bg-surface/60 text-fog hover:text-snow transition-colors shrink-0">
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1">
            <p className="text-sm font-semibold text-snow">Nuevo miembro</p>
            <p className="text-[11px] text-fog">Registro de entrada</p>
          </div>
          <button onClick={onClose} className="text-fog hover:text-snow transition-colors p-1" aria-label="Cerrar"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Titular */}
          <div className="rounded-2xl border border-line bg-surface2/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Titular</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nombre *</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Apellido</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellido" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="612 345 678" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de nacimiento</label>
              <DatePickerModal value={birthDate} onChange={setBirthDate} />
            </div>
          </div>

          {/* Hijos */}
          <div className="rounded-2xl border border-line bg-surface2/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Hijos <span className="normal-case font-normal text-mist ml-1">opcional</span></p>
              <button type="button" onClick={() => setChildren(cs => [...cs, { name: '', sex: '', birth_date: '' }])}
                className="flex items-center gap-1 text-xs font-semibold text-lime hover:opacity-80 transition-opacity">
                <Plus size={13} /> Añadir
              </button>
            </div>
            {children.length === 0 && <p className="text-xs text-mist">Añade los niños que vienen con este miembro.</p>}
            {children.map((c, i) => (
              <div key={i} className="border-t border-line pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-fog">Hijo/a {i + 1}</p>
                  <button type="button" onClick={() => setChildren(cs => cs.filter((_, idx) => idx !== i))} className="text-mist hover:text-rose transition-colors"><X size={14} /></button>
                </div>
                <input value={c.name} onChange={e => setChildren(cs => cs.map((ch, idx) => idx === i ? { ...ch, name: e.target.value } : ch))} placeholder="Nombre" className={inputCls} />
                <select value={c.sex} onChange={e => setChildren(cs => cs.map((ch, idx) => idx === i ? { ...ch, sex: e.target.value } : ch))} className={inputCls}>
                  <option value="">Sin especificar</option>
                  <option value="M">Niño</option>
                  <option value="F">Niña</option>
                </select>
                <div>
                  <label className={labelCls}>Fecha de nacimiento</label>
                  <DatePickerModal value={c.birth_date} onChange={v => setChildren(cs => cs.map((ch, idx) => idx === i ? { ...ch, birth_date: v } : ch))} />
                </div>
              </div>
            ))}
          </div>

          {/* Pareja */}
          {!showPartner ? (
            <button type="button" onClick={() => setShowPartner(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-xs font-semibold text-fog hover:border-line2 hover:text-snow transition-colors">
              <UserPlus size={14} /> Agregar pareja / otro titular
            </button>
          ) : (
            <div className="rounded-2xl border border-line bg-surface2/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Pareja / otro titular</p>
                <button type="button" onClick={() => { setShowPartner(false); setPartnerPhone(''); setPartnerFound(undefined); setPartnerConfirmed(false); setPartnerName('') }}
                  className="text-mist hover:text-rose transition-colors"><X size={14} /></button>
              </div>
              <div className="relative">
                <input type="tel" value={partnerPhone} onChange={e => handlePartnerPhone(e.target.value)} placeholder="Teléfono de la pareja" className={inputCls} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {partnerSearching && <Loader2 size={14} className="text-mist animate-spin" />}
                  {partnerConfirmed && <Check size={14} className="text-lime" />}
                </div>
              </div>
              {partnerFound && !partnerConfirmed && (
                <div className="rounded-xl border border-lime/20 bg-lime/5 p-3 space-y-2">
                  <p className="text-xs text-fog">Miembro encontrado: <span className="text-snow font-medium">{partnerFound.name}</span></p>
                  <button type="button" onClick={() => setPartnerConfirmed(true)}
                    className="w-full rounded-xl bg-lime/10 border border-lime/30 py-2 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors">Confirmar como pareja</button>
                </div>
              )}
              {partnerConfirmed && partnerFound && (
                <div className="flex items-center gap-2 rounded-xl border border-lime/20 bg-lime/5 px-3 py-2.5">
                  <Check size={13} className="text-lime shrink-0" />
                  <p className="text-sm text-snow flex-1">{partnerFound.name}</p>
                  <button type="button" onClick={() => { setPartnerConfirmed(false); setPartnerFound(undefined); setPartnerPhone('') }}
                    className="text-mist hover:text-rose"><X size={13} /></button>
                </div>
              )}
              {partnerFound === null && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-amber/20 bg-amber/5 px-3 py-2">
                    <p className="text-xs text-amber font-medium">Número no registrado — se creará un nuevo miembro</p>
                  </div>
                  <input value={partnerName} onChange={e => setPartnerName(e.target.value)} placeholder="Nombre de la pareja" className={inputCls} />
                </div>
              )}
            </div>
          )}

          {/* Consentimiento RGPD */}
          <div className="rounded-2xl border border-line bg-surface2/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Protección de datos</p>
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 shrink-0">
                <input type="checkbox" checked={consentAccepted} onChange={e => setConsentAccepted(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${consentAccepted ? 'bg-lime border-lime' : 'bg-surface2 border-line group-hover:border-line2'}`}>
                  {consentAccepted && <Check size={12} className="text-ink" strokeWidth={3} />}
                </div>
              </div>
              <p className="text-xs text-fog leading-relaxed">
                El tutor legal ha sido informado y acepta el tratamiento de sus datos según la{' '}
                <a href="/privacidad" target="_blank" className="text-iris underline">política de privacidad</a>.
              </p>
            </label>
            {!consentAccepted && (
              <p className="text-[11px] text-amber flex items-center gap-1">
                <AlertTriangle size={11} /> Obligatorio para registrar al miembro
              </p>
            )}
          </div>

          {error && <p className="text-sm text-rose text-center">{error}</p>}

          <button type="submit" disabled={saving || !firstName.trim() || !consentAccepted}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-semibold text-ink transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
            style={{ boxShadow: 'var(--shadow-lime)' }}>
            <Save size={17} strokeWidth={2.2} />
            {saving ? 'Guardando...' : 'Guardar y registrar entrada'}
          </button>
        </form>
      </div>
    </div>
  )
}


// ── Modal reserva: titular + tipo (paso 1 de 2) ──
export function BookingSearchAndTypeModal({
  filtered, query, onQueryChange, preselectedMember, types: reservableTypes,
  onProceed, onNewMember, onClose,
}: {
  filtered: FullMember[]
  query: string
  onQueryChange: (q: string) => void
  preselectedMember: FullMember | null
  types: { flujo: string; flow: 'birthday' | 'custodia' | 'other'; label: string; serviceId?: string; desc?: string }[]
  onProceed: (member: FullMember, type: 'birthday' | 'custodia' | 'other', flujo: string, serviceId?: string) => void
  onNewMember: () => void
  onClose: () => void
}) {
  const [member, setMember] = useState<FullMember | null>(preselectedMember)

  const flowMeta = {
    birthday: { Icon: Cake,     colorCls: 'text-iris',     activeCls: 'border-iris/40 bg-iris/10 hover:bg-iris/15',           desc: 'Celebración con sala reservada' },
    custodia: { Icon: Clock,    colorCls: 'text-cyan-300', activeCls: 'border-cyan-300/40 bg-cyan-300/10 hover:bg-cyan-300/15', desc: 'Servicio de cuidado con horario' },
    other:    { Icon: Calendar, colorCls: 'text-lime',     activeCls: 'border-lime/40 bg-lime/10 hover:bg-lime/15',            desc: 'Reserva con paquete de servicio' },
  } as const
  const types = reservableTypes.map(t => { const m = flowMeta[t.flow]; return { ...m, flow: t.flow, flujo: t.flujo, label: t.label, serviceId: t.serviceId, desc: t.desc ?? m.desc } })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <CalendarClock size={15} className="text-iris shrink-0" />
            <div>
              <p className="text-sm font-semibold text-snow">Nueva reserva</p>
              <p className="text-[11px] text-fog">Paso 1 de 2 — Titular y tipo</p>
            </div>
          </div>
          <button onClick={onClose} className="text-fog hover:text-snow transition-colors p-1" aria-label="Cerrar"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Titular */}
          <div>
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">
              Titular <span className="text-rose">*</span>
            </p>
            {member ? (
              <div className="flex items-center gap-3 rounded-xl border border-lime/30 bg-lime/5 px-4 py-3">
                <User size={14} className="text-lime shrink-0" />
                <span className="flex-1 text-sm font-semibold text-snow">{member.name}</span>
                <button onClick={() => { setMember(null); onQueryChange('') }}
                  className="text-mist hover:text-rose transition-colors p-0.5">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative mb-1.5">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
                  <input value={query} onChange={e => onQueryChange(e.target.value)}
                    placeholder="Buscar por nombre o teléfono..." autoFocus
                    className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-10 pr-4 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors" />
                </div>
                {query.trim().length > 0 ? (
                  <div className="rounded-xl border border-line overflow-hidden divide-y divide-line/50 max-h-44 overflow-y-auto">
                    {filtered.map(m => (
                      <button key={m.id} onClick={() => { setMember(m); onQueryChange('') }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface2 transition-colors">
                        <User size={13} className="text-mist shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-sm font-medium text-snow">{m.name}</span>
                          {m.phone && <span className="block text-xs text-mist">{m.phone}</span>}
                        </span>
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <div className="flex flex-col items-center gap-3 py-5 px-4">
                        <p className="text-xs text-fog text-center">No se encontró ningún miembro.</p>
                        <button onClick={onNewMember}
                          className="flex items-center gap-2 rounded-xl bg-lime/10 border border-lime/30 px-4 py-2 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors">
                          <UserPlus size={13} /> Crear nuevo miembro
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-mist text-center py-1">Escribe para buscar</p>
                )}
              </div>
            )}
          </div>

          {/* Tipo de reserva */}
          <div>
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">
              Tipo de reserva <span className="text-rose">*</span>
            </p>
            <div className="space-y-2">
              {types.map((t, i) => (
                <button key={`${t.flow}-${t.serviceId ?? t.flujo}-${i}`}
                  onClick={() => { if (member) { onProceed(member, t.flow, t.flujo, t.serviceId) } }}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors text-left ${
                    member ? `${t.activeCls}` : 'border-line bg-surface2 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <t.Icon size={18} className={member ? t.colorCls : 'text-fog'} />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${member ? 'text-snow' : 'text-fog'}`}>{t.label}</p>
                    <p className="text-xs text-mist">{t.desc}</p>
                  </div>
                  <ChevronRight size={15} className={member ? 'text-fog' : 'text-line2'} />
                </button>
              ))}
              {types.length === 0 && (
                <p className="text-xs text-mist text-center py-4">
                  No hay servicios reservables. Marca un servicio como «Reservable» en Panel → Servicios.
                </p>
              )}
            </div>
            {!member && types.length > 0 && (
              <p className="text-xs text-mist text-center pt-1">Selecciona un titular para continuar</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Reparte la capacidad incluida en el precio (niños primero, luego adultos) y
// devuelve cuántos invitados quedan por cobrar de cada tipo.
function chargeableGuests(adults: number, children: number, included: number) {
  const freeChildren = Math.min(children, Math.max(0, included))
  const remaining = Math.max(0, included - freeChildren)
  const freeAdults = Math.min(adults, remaining)
  return { chargeAdults: Math.max(0, adults - freeAdults), chargeChildren: Math.max(0, children - freeChildren) }
}

export type BookingInitial = {
  title?: string | null; child_name?: string | null; date?: string | null
  start_time?: string | null; end_time?: string | null
  guest_adults?: number | null; guest_children?: number | null
  service_id?: string | null; amount?: number | null; deposit_amount?: number | null
  addons?: BookingAddon[] | null; notes?: string | null
}

// ── Modal reserva 3: formulario ──
export function BookingFormModal({
  member, bookingType, serviceCategory, selectedDate, services, rateAdult, rateChild, tenantId, onBack, onClose, onSaved,
  editId = null, initial = null, onCancelBooking, preselectServiceId = null,
}: {
  member: FullMember
  bookingType: 'birthday' | 'custodia' | 'other'
  serviceCategory: string   // flujo del paquete (cumpleanos | custodia | generico)
  selectedDate: string
  services: BookingService[]
  rateAdult: number
  rateChild: number
  tenantId: string | null
  onBack: () => void
  onClose: () => void
  onSaved: () => void
  editId?: string | null
  initial?: BookingInitial | null
  onCancelBooking?: () => void
  preselectServiceId?: string | null
}) {
  const firstChild = bookingType === 'birthday' && member.children?.length > 0 ? member.children[0].name : ''

  const [birthdayChild, setBirthdayChild] = useState(
    bookingType === 'birthday' ? (initial?.child_name || firstChild) : firstChild
  )
  const initialCustodiaChildren = bookingType === 'custodia' && initial?.child_name
    ? initial.child_name.split(',').map(s => s.trim()).filter(Boolean) : []
  const [selectedChildren, setSelectedChildren] = useState<string[]>(initialCustodiaChildren)
  const [title, setTitle] = useState(
    initial?.title ??
    (bookingType === 'birthday' ? `Cumple de ${firstChild || member.name}` :
    bookingType === 'custodia' ? `Custodia de ${member.children?.length > 0 ? member.children[0].name : member.name}` : '')
  )
  const [date, setDate]           = useState(initial?.date || selectedDate)
  const [startTime, setStart]     = useState(initial?.start_time?.slice(0, 5) ?? '')
  const [endTime, setEnd]         = useState(initial?.end_time?.slice(0, 5) ?? '')
  const [guestAdults, setGuestAdults]     = useState(initial?.guest_adults ?? 0)
  // En custodia, guest_children guardado incluye los menores seleccionados; aquí solo son los adicionales
  const [guestChildren, setGuestChildren] = useState(
    bookingType === 'custodia'
      ? Math.max(0, (initial?.guest_children ?? 0) - initialCustodiaChildren.length)
      : (initial?.guest_children ?? 0)
  )
  const [guestsOpen, setGuestsOpen] = useState(!!editId && ((initial?.guest_adults ?? 0) > 0 || (initial?.guest_children ?? 0) > 0))
  const [notes, setNotes]         = useState(initial?.notes ?? '')
  // Pagos
  const serviceCat = serviceCategory
  const catServices = serviceCat ? services.filter(s => s.tipo === 'reservable' && s.flujo === serviceCat) : []
  const [serviceId, setServiceId] = useState(initial?.service_id ?? preselectServiceId ?? '')
  const [totalStr, setTotalStr]   = useState(initial?.amount != null ? String(initial.amount) : '')
  const [depositStr, setDepositStr] = useState(initial?.deposit_amount != null ? String(initial.deposit_amount) : '')
  const [paymentsOpen, setPaymentsOpen] = useState(!!editId && (initial?.amount != null || !!initial?.service_id) || !!preselectServiceId)
  const [selectedAddons, setSelectedAddons] = useState<BookingAddon[]>(initial?.addons ?? [])
  const skipRecompute = useRef<boolean>(!!editId)
  const selectedService = catServices.find(s => s.id === serviceId) || null
  const subServices = services.filter(s =>
    s.tipo === 'subservicio' &&
    (!s.applies_to || s.applies_to.length === 0 || s.applies_to.includes(serviceCat))
  )
  const round2 = (n: number) => Math.round(n * 100) / 100
  const addonsTotal = round2(selectedAddons.reduce((s, a) => s + (Number(a.price) || 0), 0))

  // Cumpleaños: precio fijo del paquete. Al elegir servicio, precarga la capacidad dividida adultos/niños.
  useEffect(() => {
    if (editId) return  // en edición se respetan los valores guardados
    if (bookingType !== 'birthday' || !selectedService) return
    const cap = Number(selectedService.included_guests) || 0
    if (cap > 0) {
      const adults = Math.floor(cap / 2)
      setGuestAdults(adults)
      setGuestChildren(cap - adults)
      setGuestsOpen(true)
    }
  }, [serviceId])

  // Recalcula total y adelanto sugerido
  useEffect(() => {
    if (skipRecompute.current) { skipRecompute.current = false; return }  // preserva importes al abrir en edición
    if (!selectedService) return
    const base = Number(selectedService.price) || 0
    let guestsCharge = 0
    // Cumpleaños es precio fijo por capacidad: los asistentes NO alteran el precio.
    // Para el resto, los invitados que excedan la capacidad incluida se cobran (tarifa configurada o entrada libre).
    if (bookingType !== 'birthday') {
      const cfgA = Number(selectedService.price_per_guest_adult) || 0
      const cfgC = Number(selectedService.price_per_guest_child) || 0
      const ppa  = cfgA > 0 ? cfgA : rateAdult
      const ppc  = cfgC > 0 ? cfgC : rateChild
      const included = Number(selectedService.included_guests) || 0
      const { chargeAdults, chargeChildren } = chargeableGuests(guestAdults, guestChildren, included)
      guestsCharge = chargeAdults * ppa + chargeChildren * ppc
    }
    const total = round2(base + guestsCharge + addonsTotal)
    setTotalStr(String(total))
    const pct = selectedService.deposit_pct != null ? Number(selectedService.deposit_pct) : 50
    setDepositStr(String(round2(total * pct / 100)))
  }, [serviceId, guestAdults, guestChildren, rateAdult, rateChild, addonsTotal, bookingType])

  const totalNum   = Number(totalStr) || 0
  const depositNum = Number(depositStr) || 0
  const pendingNum = round2(Math.max(0, totalNum - depositNum))
  const paymentStatus = totalNum > 0 && depositNum >= totalNum ? 'paid' : depositNum > 0 ? 'partial' : 'pending'

  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [saved, setSaved]         = useState(false)
  const [overlap, setOverlap]     = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const typeLabels  = { birthday: 'Reserva de Cumpleaños', custodia: 'Reserva de Custodia', other: 'Otra Reserva' }
  const typeIcons   = { birthday: Cake, custodia: Clock, other: Calendar }
  const typeColors  = { birthday: 'text-iris', custodia: 'text-cyan-300', other: 'text-lime' }
  const TypeIcon    = typeIcons[bookingType]
  const needsTitle = bookingType === 'other'
  const birthdayValid = bookingType !== 'birthday' || !!birthdayChild || member.children.length === 0
  const custodiaValid = bookingType !== 'custodia' || selectedChildren.length > 0 || member.children.length === 0
  const isValid = (!needsTitle || title.trim()) && startTime && endTime && birthdayValid && custodiaValid

  function handleChildSelect(name: string) {
    setBirthdayChild(name)
    setTitle(`Cumple de ${name}`)
  }

  async function handleSave(force = false) {
    if (!isValid || saving) return
    setSaving(true); setError(null)
    // Aviso de solape: otra reserva activa en la misma franja horaria y fecha.
    // No bloquea (puede haber varias salas); pide una confirmación extra.
    if (!force && startTime && endTime) {
      const { data: sameDay } = await supabase
        .from('bookings')
        .select('id, start_time, end_time, title')
        .eq('date', date).neq('status', 'cancelled')
      const clash = (sameDay ?? []).find(b =>
        b.id !== editId && b.start_time && b.end_time &&
        b.start_time < endTime && startTime < b.end_time
      )
      if (clash) {
        setOverlap(clash.title ?? 'otra reserva')
        setSaving(false)
        return
      }
    }
    const finalTitle = title.trim() || (
      bookingType === 'birthday' ? `Cumple de ${birthdayChild || member.name}` :
      bookingType === 'custodia' ? `Custodia — ${member.name}` : 'Reserva'
    )
    const payload: Record<string, unknown> = {
      member_id: member.id || null,
      type: bookingType,
      title: finalTitle,
      start_time: startTime,
      end_time: endTime,
      guests: guestAdults + guestChildren + selectedChildren.length > 0
        ? guestAdults + guestChildren + selectedChildren.length : null,
      guest_adults: guestAdults,
      guest_children: bookingType === 'custodia'
        ? selectedChildren.length + guestChildren
        : guestChildren,
      child_name: bookingType === 'birthday'
        ? (birthdayChild || null)
        : bookingType === 'custodia' && selectedChildren.length > 0
          ? selectedChildren.join(', ')
          : null,
      date: date,
      notes: notes.trim() || null,
      service_id: serviceId || null,
      amount: totalNum > 0 ? totalNum : null,
      deposit_amount: depositNum,
      payment_status: paymentStatus,
      addons: selectedAddons,
    }
    // Solo fijar la fecha de pago de la señal cuando el adelanto pasa de 0 a >0;
    // en ediciones posteriores no se reescribe (conserva la fecha real de cobro).
    const prevDeposit = initial?.deposit_amount ?? 0
    if (!editId) {
      payload.deposit_paid_at = depositNum > 0 ? new Date().toISOString() : null
    } else if (prevDeposit <= 0 && depositNum > 0) {
      payload.deposit_paid_at = new Date().toISOString()
    } else if (depositNum <= 0) {
      payload.deposit_paid_at = null
    }
    const { error: err } = editId
      ? await supabase.from('bookings').update(payload).eq('id', editId)
      : await supabase.from('bookings').insert({ ...payload, tenant_id: tenantId, status: 'confirmed' })
    if (err) { setError(err.message); setSaving(false); return }
    setSaved(true)
    onSaved()
    closeTimer.current = setTimeout(onClose, 1800)
  }

  const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-2.5 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'

  function Counter({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
    return (
      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-line bg-surface2">
        <span className="text-sm text-fog">{label}</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0}
            className="w-8 h-8 rounded-lg border border-line bg-surface text-fog hover:text-snow flex items-center justify-center text-lg font-bold transition-colors disabled:opacity-30">−</button>
          <span className="w-6 text-center font-bold text-snow text-sm">{value}</span>
          <button type="button" onClick={() => onChange(value + 1)}
            className="w-8 h-8 rounded-lg border border-lime/40 bg-lime/10 text-lime hover:bg-lime/20 flex items-center justify-center text-lg font-bold transition-colors">+</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 bg-surface/60 text-fog hover:text-snow transition-colors shrink-0 mt-0.5">
                <ChevronLeft size={16} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <TypeIcon size={20} className="text-snow shrink-0" />
                  <div className="min-w-0 flex-1">
                    <FitText className="font-bold text-snow leading-tight" min={15} max={20}>{typeLabels[bookingType]}</FitText>
                  </div>
                </div>
                <p className="text-[11px] text-fog mt-1">{editId ? 'Editar reserva' : 'Paso 2 de 2'}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-fog hover:text-snow transition-colors p-1 mt-0.5 shrink-0"><X size={16} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {saved ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 rounded-full bg-lime/15 border border-lime/30 flex items-center justify-center">
                <Check size={30} className="text-lime" strokeWidth={2.5} />
              </div>
              <p className="text-lg font-bold text-snow">{editId ? '¡Reserva actualizada!' : '¡Reserva guardada!'}</p>
              <p className="text-sm text-fog text-center">La reserva de <span className="text-snow font-medium">{member.name}</span> ha sido {editId ? 'actualizada' : 'registrada'}.</p>
              <p className="text-xs text-mist mt-1">Cerrando automáticamente...</p>
            </div>
          ) : (
            <>
              {/* Titular — no editable */}
              <div>
                <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">Titular</p>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line bg-surface2/40">
                  <div className="w-5 h-5 rounded-md border-2 border-line2 bg-line2 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-fog" strokeWidth={3} />
                  </div>
                  <span className="flex-1 text-sm font-medium text-snow">{member.name}</span>
                  <span className="text-[10px] text-snow font-medium">Titular</span>
                </div>
              </div>

              {/* Niño/a — selector cumpleaños (checkbox) y custodia (multi-checkbox) */}
              {member.children && member.children.length > 0 && (bookingType === 'birthday' || bookingType === 'custodia') && (
                <div>
                  <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">
                    {bookingType === 'birthday' ? 'Niño/a que cumple' : 'Menores'}
                    {' '}<span className="text-rose">*</span>
                  </p>
                  <div className="space-y-1.5">
                    {member.children.map((c: any) => {
                      if (bookingType === 'birthday') {
                        const checked = birthdayChild === c.name
                        return (
                          <button key={c.name} type="button" onClick={() => handleChildSelect(c.name)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                              checked ? 'border-iris/30 bg-iris/5' : 'border-line bg-surface2 hover:border-line2'
                            }`}>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                              checked ? 'bg-iris border-iris' : 'bg-surface2 border-line2'
                            }`}>
                              {checked && <Check size={11} className="text-white" strokeWidth={3} />}
                            </div>
                            <span className={`flex-1 text-sm font-medium ${checked ? 'text-snow' : 'text-fog'}`}>{c.name}</span>
                            {c.birth_date && <span className="text-xs text-mist shrink-0">{fmtChildAge(c.birth_date)}</span>}
                          </button>
                        )
                      }
                      const sel = selectedChildren.includes(c.name)
                      const age = c.birth_date ? fmtChildAge(c.birth_date) : null
                      return (
                        <button key={c.name} type="button"
                          onClick={() => setSelectedChildren(prev => {
                            const next = sel ? prev.filter(n => n !== c.name) : [...prev, c.name]
                            if (bookingType === 'custodia') {
                              setTitle(next.length > 0 ? `Custodia de ${next.join(', ')}` : `Custodia de ${member.name}`)
                            }
                            return next
                          })}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                            sel ? 'border-iris/30 bg-iris/5' : 'border-line bg-surface2 hover:border-line2'
                          }`}>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            sel ? 'bg-iris border-iris' : 'bg-surface2 border-line2'
                          }`}>
                            {sel && <Check size={11} className="text-white" strokeWidth={3} />}
                          </div>
                          <span className={`flex-1 text-sm font-medium ${sel ? 'text-snow' : 'text-fog'}`}>{c.name}</span>
                          {age && <span className="text-xs text-mist shrink-0">{age}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Título */}
              <div>
                <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">
                  Título {needsTitle && <span className="text-rose">*</span>}
                </label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder={needsTitle ? 'Nombre del evento o reserva' : ''}
                  className={inputCls} />
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">
                  Fecha <span className="text-rose">*</span>
                </label>
                <div className="flex items-center px-3 py-2.5 rounded-xl border border-line bg-surface2">
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-transparent text-sm text-snow outline-none" />
                </div>
              </div>

              {/* Horario */}
              <div>
                <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">
                  Horario <span className="text-rose">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-mist px-1">Inicio</p>
                    <TimePicker value={startTime} onChange={setStart} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-mist px-1">Fin</p>
                    <TimePicker value={endTime} onChange={setEnd} />
                  </div>
                </div>
                {startTime && endTime && endTime <= startTime && (
                  <p className="text-xs text-amber mt-1.5 px-1">La hora de fin debe ser posterior a la de inicio</p>
                )}
              </div>

              {/* Invitados — colapsable con botón dashed */}
              <div>
                {!guestsOpen ? (
                  <button type="button" onClick={() => setGuestsOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line2 py-3 text-sm font-medium text-fog hover:border-line hover:text-snow transition-colors">
                    <Plus size={14} />
                    {bookingType === 'custodia' ? 'Añadir niños adicionales' : bookingType === 'birthday' ? 'Asistentes previstos' : 'Añadir invitados adicionales'}
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">
                        {bookingType === 'custodia' ? 'Niños adicionales' : bookingType === 'birthday' ? 'Asistentes (capacidad)' : 'Invitados'}
                      </p>
                      <button type="button" onClick={() => { setGuestsOpen(false); setGuestAdults(0); setGuestChildren(0) }}
                        className="text-[10px] text-mist hover:text-rose transition-colors">Quitar</button>
                    </div>
                    <div className="space-y-2">
                      {bookingType !== 'custodia' && (
                        <Counter value={guestAdults} onChange={setGuestAdults} label="Adultos" />
                      )}
                      <Counter
                        value={guestChildren}
                        onChange={setGuestChildren}
                        label={bookingType === 'custodia' ? 'Niños sin registrar' : 'Niños'}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Pagos */}
              {catServices.length > 0 && (
                <div>
                  {!paymentsOpen ? (
                    <button type="button" onClick={() => setPaymentsOpen(true)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-line2 px-4 py-3 text-sm font-medium text-fog hover:border-line hover:text-snow transition-colors">
                      <span className="flex items-center gap-2"><Receipt size={14} /> Pagos y paquete</span>
                      {totalNum > 0
                        ? <span className="text-xs font-semibold text-snow">{totalNum.toFixed(2)}€</span>
                        : <Plus size={14} />}
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
                          <Receipt size={12} /> Pagos
                        </p>
                        <button type="button" onClick={() => { setPaymentsOpen(false); setServiceId(''); setTotalStr(''); setDepositStr('') }}
                          className="text-[10px] text-mist hover:text-rose transition-colors">Quitar</button>
                      </div>
                      <div className="rounded-xl border border-line bg-surface2/40 p-4 space-y-3">
                        {/* Paquete */}
                        <div>
                          <p className="text-[10px] text-mist mb-1.5">Paquete</p>
                          <div className="relative">
                            <select value={serviceId} onChange={e => setServiceId(e.target.value)}
                              style={{ colorScheme: 'dark' }}
                              className="w-full appearance-none bg-surface2 border border-line rounded-xl pl-4 pr-9 py-2.5 text-sm text-snow outline-none focus:border-line2 transition-colors cursor-pointer">
                              <option value="">Selecciona un paquete</option>
                              {catServices.map(s => (
                                <option key={s.id} value={s.id}>{s.name} · {(Number(s.price) || 0).toFixed(2)}€</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-fog pointer-events-none" />
                          </div>
                          {selectedService && Number(selectedService.included_guests) > 0 && (
                            <p className="text-[11px] text-mist mt-1.5">
                              {bookingType === 'birthday'
                                ? `Precio fijo · capacidad ${Number(selectedService.included_guests)} personas.`
                                : `Incluye ${Number(selectedService.included_guests)} personas. Los invitados que excedan se cobran aparte.`}
                            </p>
                          )}
                        </div>
                        {/* Sub-servicios / Extras */}
                        {subServices.length > 0 && (
                          <div>
                            <p className="text-[10px] text-mist mb-1.5">Sub-servicios</p>
                            <div className="space-y-1.5">
                              {subServices.map(s => {
                                const sel = selectedAddons.some(a => a.name === s.name)
                                const p = Number(s.price) || 0
                                return (
                                  <button key={s.id} type="button"
                                    onClick={() => setSelectedAddons(prev => sel
                                      ? prev.filter(a => a.name !== s.name)
                                      : [...prev, { name: s.name, price: p }])}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                                      sel ? 'border-iris/30 bg-iris/5' : 'border-line bg-surface2 hover:border-line2'
                                    }`}>
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                      sel ? 'bg-iris border-iris' : 'bg-surface2 border-line2'
                                    }`}>
                                      {sel && <Check size={11} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm font-medium truncate ${sel ? 'text-snow' : 'text-fog'}`}>{s.name}</p>
                                      {s.description && <p className="text-[11px] text-mist truncate">{s.description}</p>}
                                    </div>
                                    <span className="text-xs font-semibold text-snow shrink-0">{p.toFixed(2)}€</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {/* Total */}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-fog">Total</span>
                          <div className="flex items-center gap-1 bg-surface2 border border-line rounded-lg px-3 py-2">
                            <input type="number" min={0} step="0.01" value={totalStr}
                              onChange={e => setTotalStr(e.target.value)}
                              placeholder="0.00"
                              className="w-20 bg-transparent text-right text-sm font-semibold text-snow outline-none" />
                            <span className="text-sm text-fog">€</span>
                          </div>
                        </div>
                        {/* Adelanto */}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-fog">Adelanto</span>
                          <div className="flex items-center gap-1 bg-surface2 border border-line rounded-lg px-3 py-2">
                            <input type="number" min={0} step="0.01" value={depositStr}
                              onChange={e => setDepositStr(e.target.value)}
                              placeholder="0.00"
                              className="w-20 bg-transparent text-right text-sm font-semibold text-lime outline-none" />
                            <span className="text-sm text-fog">€</span>
                          </div>
                        </div>
                        {/* Pendiente + estado */}
                        <div className="flex items-center justify-between pt-2 border-t border-line/60">
                          <span className="text-xs text-mist">Pendiente</span>
                          <span className="text-sm font-bold text-snow">{pendingNum.toFixed(2)}€</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-mist">Estado</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                            paymentStatus === 'paid'    ? 'bg-mint/10 text-mint border-mint/30' :
                            paymentStatus === 'partial' ? 'bg-amber/10 text-amber border-amber/30' :
                                                          'bg-surface2 text-fog border-line'
                          }`}>
                            {paymentStatus === 'paid' ? 'Pagado' : paymentStatus === 'partial' ? 'Adelanto' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">
                  Notas
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Alergias, decoración, peticiones especiales..."
                  className={`${inputCls} resize-none`} />
              </div>

              {error && <p className="text-sm text-rose text-center">{error}</p>}

              {overlap && (
                <div className="rounded-xl bg-amber/10 border border-amber/30 px-3 py-2.5 space-y-2">
                  <p className="flex items-center gap-1.5 text-xs text-amber">
                    <AlertTriangle size={13} className="shrink-0" /> Ya hay otra reserva en esa franja («{overlap}»).
                  </p>
                  <button onClick={() => { setOverlap(null); handleSave(true) }}
                    className="w-full rounded-lg bg-amber/20 border border-amber/30 py-2 text-xs font-semibold text-amber hover:bg-amber/30 transition-colors">
                    Guardar de todos modos
                  </button>
                </div>
              )}

              <button onClick={() => handleSave()} disabled={!isValid || saving || (!!startTime && !!endTime && endTime <= startTime)}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-4 bg-lime text-ink font-semibold text-sm hover:brightness-105 transition active:scale-[0.99] disabled:opacity-60"
                style={{ boxShadow: 'var(--shadow-lime)' }}>
                <CalendarClock size={17} strokeWidth={2.2} />
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Guardar reserva'}
              </button>

              {editId && onCancelBooking && (
                <button onClick={onCancelBooking}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 border border-rose/30 text-rose font-semibold text-sm hover:bg-rose/10 transition-colors">
                  <Trash2 size={15} /> Cancelar reserva
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export type BookingService = {
  id: string
  name: string
  description: string | null
  category: string
  price: number | null
  deposit_pct: number | null
  price_per_guest_adult: number | null
  price_per_guest_child: number | null
  included_guests: number | null
  applies_to: string[] | null
  reservable: boolean | null
  tipo: string | null
  flujo: string | null
}

export type BookingAddon = { name: string; price: number }

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

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center px-4 py-3 bg-surface2 rounded-xl border border-line">
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ colorScheme: 'dark' }}
        className="w-full bg-transparent text-base font-semibold text-snow outline-none"
      />
    </div>
  )
}

// Título que se auto-ajusta al ancho disponible: crece hasta `max` y se reduce hasta `min`
function FitText({ children, min = 14, max = 22, className = '' }: { children: React.ReactNode; min?: number; max?: number; className?: string }) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState(max)

  useEffect(() => {
    const el = spanRef.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const fit = () => {
      let s = max
      el.style.fontSize = `${s}px`
      const avail = parent.clientWidth
      while (s > min && el.offsetWidth > avail) {
        s -= 1
        el.style.fontSize = `${s}px`
      }
      setSize(s)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [children, min, max])

  return (
    <span ref={spanRef} className={className} style={{ fontSize: size, whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%' }}>
      {children}
    </span>
  )
}

function ScrollingName({ text, suffix, suffixClass }: { text: string; suffix: string; suffixClass: string }) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [scrollAmount, setScrollAmount] = useState(0)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      const overflow = textRef.current.offsetWidth - containerRef.current.offsetWidth
      setScrollAmount(overflow > 0 ? overflow : 0)
    }
  }, [text, suffix])

  const overflows = scrollAmount > 0

  return (
    <span
      ref={containerRef}
      className={`overflow-hidden min-w-0 flex-1 ${overflows ? 'cursor-pointer' : ''}`}
      onClick={(e) => { if (!overflows) return; e.stopPropagation(); setAnimKey(k => k + 1) }}
    >
      <span
        ref={textRef}
        key={animKey}
        className={`inline-block whitespace-nowrap text-sm text-snow leading-tight${overflows ? ' animate-scroll-once' : ''}`}
        style={overflows ? ({ '--scroll-amount': `-${scrollAmount}px` } as React.CSSProperties) : undefined}
      >
        {text}<span className={suffixClass}>{suffix}</span>
      </span>
    </span>
  )
}

export default function HomeClient({ todayVisits, monthCount, dateLabel, capacity, todayBirthdays, todayBookings, selectedDate, todayStr, allMembers }: HomeClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [bookingServices, setBookingServices] = useState<BookingService[]>([])
  const [openChecks, setOpenChecks] = useState<Map<string, OpenCheck>>(new Map())
  const [consumosVisitId, setConsumosVisitId] = useState<string | null>(null)
  const [addingProduct, setAddingProduct] = useState<string | null>(null)
  const [importeVisitId, setImporteVisitId] = useState<string | null>(null)
  const [totalVisitId, setTotalVisitId] = useState<string | null>(null)
  const [payingVisit, setPayingVisit] = useState<string | null>(null)
  const [acompVisitId, setAcompVisitId] = useState<string | null>(null)
  const [acompCoTitulares, setAcompCoTitulares] = useState<{ id: string; name: string; selected: boolean }[]>([])
  const [acompChildren, setAcompChildren] = useState<{ name: string; birth_date?: string; isGuest?: boolean }[]>([])
  const [acompGuestAdults, setAcompGuestAdults] = useState(0)
  const [acompGuestChildren, setAcompGuestChildren] = useState(0)
  const [acompTitularPresent, setAcompTitularPresent] = useState(true)
  const [savedAcomp, setSavedAcomp] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextSave = useRef(false)
  const returnToDetailRef = useRef<string | null>(null)

  function closeAndReturn(closeFn: () => void) {
    closeFn()
    if (returnToDetailRef.current) {
      setDetailVisitId(returnToDetailRef.current)
      returnToDetailRef.current = null
    }
  }
  const [savingAcomp, setSavingAcomp] = useState(false)
  const [rateAdult, setRateAdult] = useState(3)
  const [rateChild, setRateChild] = useState(7)
  const [rateCustodia, setRateCustodia] = useState(8)
  // ¿El tenant tiene tarifas de entrada/custodia configuradas? Si no, no se
  // inventa un precio: se pide configurar servicios. null = cargando.
  const [pricingReady, setPricingReady] = useState<boolean | null>(null)
  const [checkinModal, setCheckinModal] = useState<null | 'search' | 'confirm' | 'new-member'>(null)
  const [checkinSelectedMember, setCheckinSelectedMember] = useState<FullMember | null>(null)
  const [checkinQuery, setCheckinQuery] = useState('')
  const [checkinMembers, setCheckinMembers] = useState<FullMember[]>([])
  const [detailVisitId, setDetailVisitId] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<TodayBooking | null>(null)
  const [bookingModal, setBookingModal] = useState<null | 'pick' | 'form'>(null)
  const newMemberReturnTo = useRef<'checkin' | 'booking'>('checkin')
  const [bookingMember, setBookingMember] = useState<FullMember | null>(null)
  const [bookingType, setBookingType] = useState<'birthday' | 'custodia' | 'other' | null>(null)
  const [bookingCategory, setBookingCategory] = useState<string>('generico')
  const [bookingPreselectService, setBookingPreselectService] = useState<string | null>(null)
  const [bookingQuery, setBookingQuery] = useState('')
  const [editBookingId, setEditBookingId] = useState<string | null>(null)
  const [editInitial, setEditInitial] = useState<BookingInitial | null>(null)

  // Abrir el formulario en modo edición cuando se llega con ?editar=<id> (p. ej. desde la agenda)
  useEffect(() => {
    const editarId = searchParams.get('editar')
    if (!editarId) return
    ;(async () => {
      const { data: bk } = await supabase
        .from('bookings')
        .select('*, services(flujo)')
        .eq('id', editarId).single()
      if (!bk) return
      const { data: mem } = await supabase
        .from('members')
        .select('id, name, phone, family_id, memberships(id, sessions_remaining, expires_at, membership_types(name)), children')
        .eq('id', (bk as any).member_id).single()
      if (!mem) return
      const b = bk as any
      const flujo = b.services?.flujo ?? (b.type === 'birthday' ? 'cumpleanos' : b.type === 'custodia' ? 'custodia' : 'generico')
      setBookingMember(mem as unknown as FullMember)
      setBookingType(b.type)
      setBookingCategory(flujo)
      setEditInitial({
        title: b.title, child_name: b.child_name, date: b.date,
        start_time: b.start_time, end_time: b.end_time,
        guest_adults: b.guest_adults, guest_children: b.guest_children,
        service_id: b.service_id, amount: b.amount, deposit_amount: b.deposit_amount,
        addons: b.addons ?? [], notes: b.notes,
      })
      setEditBookingId(editarId)
      setBookingModal('form')
      const params = new URLSearchParams(Array.from(searchParams.entries()))
      params.delete('editar')
      router.replace(params.toString() ? `/?${params.toString()}` : '/')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Abrir el flujo de nueva reserva cuando se llega con ?nueva=1 (p. ej. desde el calendario)
  useEffect(() => {
    if (searchParams.get('nueva') === '1') {
      setBookingModal('pick')
      setBookingQuery('')
      const params = new URLSearchParams(Array.from(searchParams.entries()))
      params.delete('nueva')
      router.replace(params.toString() ? `/?${params.toString()}` : '/')
    }
    // Deep-link de registro de entrada para un miembro concreto (botón "Entrada" de la ficha)
    const checkinId = searchParams.get('checkin')
    if (checkinId) {
      supabase.from('members')
        .select('id, name, phone, family_id, memberships(id, sessions_remaining, expires_at, membership_types(name)), children')
        .eq('id', checkinId).maybeSingle()
        .then(({ data }) => {
          if (data) { setCheckinSelectedMember(data as unknown as FullMember); setCheckinModal('confirm') }
        })
      const params = new URLSearchParams(Array.from(searchParams.entries()))
      params.delete('checkin')
      router.replace(params.toString() ? `/?${params.toString()}` : '/')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Etiquetas de categorías (compartidas con la pantalla de servicios vía localStorage)
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({
    cumpleanos: 'Cumpleaños', custodia: 'Custodia', generico: 'Otro', otros: 'Otro',
  })
  useEffect(() => {
    try {
      const raw = localStorage.getItem('wm_service_categories')
      if (raw) {
        const cats = JSON.parse(raw) as { value: string; label: string }[]
        setCategoryLabels(prev => ({ ...prev, ...Object.fromEntries(cats.map(c => [c.value, c.label])) }))
      }
    } catch {}
  }, [])

  // Tipos reservables: una tarjeta por categoría con al menos un servicio reservable
  // Tipos de reserva: Cumpleaños y Custodia son especiales (una tarjeta); los genéricos aparecen uno por servicio (por su nombre).
  const reservableTypes = (() => {
    const svc = bookingServices.filter(s => s.tipo === 'reservable')
    const items: { flujo: string; flow: 'birthday' | 'custodia' | 'other'; label: string; serviceId?: string; desc?: string }[] = []
    if (svc.some(s => s.flujo === 'cumpleanos')) items.push({ flujo: 'cumpleanos', flow: 'birthday', label: 'Cumpleaños' })
    if (svc.some(s => s.flujo === 'custodia'))   items.push({ flujo: 'custodia',   flow: 'custodia', label: 'Custodia' })
    svc.filter(s => s.flujo !== 'cumpleanos' && s.flujo !== 'custodia')
      .forEach(s => items.push({ flujo: 'generico', flow: 'other', label: s.name, serviceId: s.id, desc: s.description ?? 'Reserva con paquete de servicio' }))
    return items
  })()

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
    supabase.from('services').select('name, price, price_unit, tipo, flujo').eq('active', true)
      .then(({ data }) => {
        // Configurado = hay al menos un servicio de entrada o de custodia con precio
        const rows = data ?? []
        const hasPricing = rows.some(s => s.tipo === 'entrada' || s.flujo === 'custodia')
        setPricingReady(hasPricing)
        if (hasPricing) {
          const r = resolveRates(rows)
          setRateAdult(r.adult); setRateChild(r.child); setRateCustodia(r.custodia)
        }
      })
    supabase.from('services')
      .select('id, name, description, category, price, deposit_pct, price_per_guest_adult, price_per_guest_child, included_guests, applies_to, reservable, tipo, flujo')
      .eq('active', true).order('sort_order')
      .then(({ data }) => { if (data) setBookingServices(data as BookingService[]) })
  }, [])

  useEffect(() => {
    if ((!checkinModal && !bookingModal) || checkinMembers.length > 0) return
    supabase.from('members')
      .select('id, name, phone, family_id, memberships(id, sessions_remaining, expires_at, membership_types(name)), children')
      .order('name')
      .then(({ data }) => { if (data) setCheckinMembers(data as unknown as FullMember[]) })
  }, [checkinModal, bookingModal])

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

  async function handlePayVisit(visitId: string, amount: number, method: 'efectivo' | 'tarjeta') {
    setPayingVisit(visitId)
    await supabase.from('visits')
      .update({ paid_at: new Date().toISOString(), paid_amount: amount, payment_method: method })
      .eq('id', visitId)
    setPayingVisit(null)
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
    // La salida no marca el cobro: el cobro es un paso explícito (botón "Cobrar")
    await supabase.from('visits').update({ checked_out_at: now }).eq('id', visitId)
    setCheckingOut(null)
    setConfirmCheckout(null)
    setConsumosVisitId(null)
    router.refresh()
  }

  async function handleExecuteBooking(booking: TodayBooking) {
    setExecutingBooking(booking.id)
    const { error } = await executeBooking(booking)
    setExecutingBooking(null)
    if (error) { alert(`No se pudo ejecutar la reserva: ${error}`); return }
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
    isPackage: boolean; deposit: number; toPay: number
    pkg?: {
      base: number; rateA: number; rateC: number; included: number
      chargeA: number; chargeC: number
      contractedA: number; contractedC: number; presentA: number; presentC: number
      live: boolean
    }
  } {
    // Reserva con paquete contratado: el total es el del paquete
    const bk = visit.bookings
    const bAmount = bk?.amount != null ? Number(bk.amount) : null
    if (bAmount != null) {
      const round2 = (n: number) => Math.round(n * 100) / 100
      const deposit = bk?.deposit_amount != null ? Number(bk.deposit_amount) : 0
      const svc = bk?.services
      // Recálculo en vivo según asistentes presentes (cumpleaños y otro; custodia mantiene lo contratado)
      let total = bAmount
      let pkg: NonNullable<ReturnType<typeof calcImporte>['pkg']> | undefined
      // Cumpleaños y custodia: precio fijo (usa el importe contratado). Recálculo en vivo solo para 'other'.
      if (svc && svc.price != null && bk?.type !== 'custodia' && bk?.type !== 'birthday') {
        const base = Number(svc.price) || 0
        const cfgA = Number(svc.price_per_guest_adult) || 0
        const cfgC = Number(svc.price_per_guest_child) || 0
        const rateA = cfgA > 0 ? cfgA : rateAdult
        const rateC = cfgC > 0 ? cfgC : rateChild
        // Invitados presentes = conteo de la visita menos titular (y niño del cumple)
        const presentA = Math.max(0, visit.adults_count - 1)
        const presentC = bk?.type === 'birthday'
          ? Math.max(0, visit.children_count - 1)
          : visit.children_count
        // El precio cubre N personas incluidas; solo se cobran los que excedan (niños primero)
        const included = Number(svc.included_guests) || 0
        const { chargeAdults, chargeChildren } = chargeableGuests(presentA, presentC, included)
        total = round2(base + chargeAdults * rateA + chargeChildren * rateC)
        pkg = {
          base, rateA, rateC, included,
          chargeA: chargeAdults, chargeC: chargeChildren,
          contractedA: bk?.guest_adults ?? 0,
          contractedC: bk?.guest_children ?? 0,
          presentA, presentC, live: true,
        }
      }
      const toPay = Math.max(0, round2(total - deposit))
      return {
        titular: 0, ninos: 0, regular: total, bonoPrecioSesion: null, ahorro: 0,
        total, isPackage: true, deposit, toPay, pkg,
      }
    }
    const elapsedMins = (Date.now() - new Date(visit.checked_in_at).getTime()) / 60000
    const hours = Math.max(1, Math.ceil(elapsedMins / 60)) // por hora o fracción (mín. 1h)
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
    return { titular, ninos, regular, bonoPrecioSesion, ahorro, total, isPackage: false, deposit: 0, toPay: total }
  }

  // ¿Falta configurar tarifas para poder cobrar esta visita?
  // (visitas por tiempo sin bono ni paquete requieren tarifas de entrada/custodia)
  function pricingMissing(v: TodayVisit, imp: ReturnType<typeof calcImporte>): boolean {
    return pricingReady === false && !imp.isPackage && !v.membership_id
  }
  const ConfigTarifasChip = () => (
    <Link href="/panel/servicios" className="inline-flex items-center gap-1 rounded-md border border-amber/40 bg-amber/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber hover:bg-amber/20 transition-colors whitespace-nowrap">
      <AlertTriangle size={10} /> Configura tarifas
    </Link>
  )

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
        </div>
      </div>

      {/* ZONA 2 — En sala ahora (tabla) */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        {/* Stats header */}
        <div className="px-4 pt-4 pb-3 border-b border-line space-y-3">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-2">
                <Users size={13} className="shrink-0" />
                {isToday ? 'En sala ahora' : 'Visitas del día'}
              </h2>
              {isToday && (
                <span className="mt-1 inline-flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white animate-pulse" />
                  </span>
                  En vivo
                </span>
              )}
            </div>
            {isToday && (
              <button
                onClick={() => { setCheckinModal('search'); setCheckinQuery('') }}
                className="shrink-0 whitespace-nowrap flex items-center gap-1.5 text-[11px] font-semibold text-ink bg-lime rounded-lg px-2.5 py-1.5 hover:brightness-105 active:scale-95 transition-all"
              >
                <LogIn size={12} className="shrink-0" /> Registrar entrada
              </button>
            )}
          </div>

          {/* Aforo bar */}
          {capacity != null && (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className={`font-display text-2xl font-bold leading-none ${aforoTextColor}`}>{activeTotal}</span>
                  <span className="text-xs text-fog">de {capacity} plazas</span>
                </div>
                <span className={`text-sm font-bold ${aforoTextColor}`}>{Math.round(aforoPct)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-line overflow-hidden flex">
                <div className="h-full bg-lime transition-all duration-500 rounded-l-full" style={{ width: `${Math.min(100, (activeAdults / capacity) * 100)}%` }} />
                <div className="h-full bg-cyan-300 transition-all duration-500" style={{ width: `${Math.min(100, (activeChildren / capacity) * 100)}%` }} />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-lime">
                  <span className="w-2 h-2 rounded-full bg-lime shrink-0" />
                  <span className="font-semibold">{activeAdults}</span> adulto{activeAdults !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-2 h-2 rounded-full bg-cyan-300 shrink-0" />
                  <span className="font-semibold">{activeChildren}</span> niño{activeChildren !== 1 ? 's' : ''}
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
                  { value: 'low', label: 'Bajas (3-5)' },
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
                const elapsedMins = (Date.now() - new Date(visit.checked_in_at).getTime()) / 60000
                const isLong = elapsedMins > 180
                const check = openChecks.get(visit.id)
                const imp = calcImporte(visit)
                const consumosTotal = (check?.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
                const grandTotal = imp.toPay + consumosTotal
                const numChildren = visit.children_count ?? 0
                const tipo = fmtVisitType(visit)
                const tipoColor = tipo === 'Cumpleaños' ? 'text-iris' : tipo === 'Custodia' ? 'text-cyan-300' : 'text-mist'

                return (
                  <div
                    key={visit.id}
                    className={`rounded-2xl border bg-surface overflow-hidden ${isLong ? 'border-amber/40' : 'border-line'}`}
                  >
                    <div className={`flex ${isLong ? 'border-l-[3px] border-amber' : ''}`}>
                      <div className="flex-1 min-w-0">
                        {/* Línea 1: nombre + badge + acciones */}
                        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                          <button onClick={() => setDetailVisitId(visit.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                            <span className="text-sm font-bold text-snow leading-tight truncate">{visit.members?.name ?? '—'}</span>
                            <span className="text-line2 shrink-0">·</span>
                            <span className={`text-[10px] font-semibold shrink-0 ${tipoColor}`}>{tipo}</span>
                          </button>
                          {isToday && (
                            <button
                              onClick={() => setConfirmCheckout(visit.id)}
                              aria-label="Registrar salida"
                              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-rose text-ink hover:brightness-110 active:scale-[0.98] transition-all"
                            >
                              <LogOut size={14} strokeWidth={2.2} />
                            </button>
                          )}
                        </div>

                        {/* Línea 2: stats inline */}
                        <button onClick={() => setDetailVisitId(visit.id)} className="w-full text-left px-3 pb-2.5">
                          <div className="flex items-center gap-1.5 text-xs text-mist">
                            <span className="font-semibold text-snow">{visit.adults_count + numChildren}</span>
                            <span>en sala</span>
                            <span className="text-line2">·</span>
                            <span className={`font-semibold ${isLong ? 'text-amber' : 'text-snow'}`}>{fmtElapsed(visit.checked_in_at)}</span>
                            {isLong && <AlertTriangle size={11} className="text-amber" />}
                            <span className="text-line2">·</span>
                            {pricingMissing(visit, imp)
                              ? <span className="font-semibold text-amber">Configura tarifas</span>
                              : <span className="font-semibold text-lime">{grandTotal.toFixed(2)}€</span>}
                          </div>
                        </button>
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
                    {([
                      { key: 'Titular', label: 'Titular' },
                      { key: 'Acomp.', label: 'Acompañantes' },
                      { key: 'Total', label: 'Personas en sala' },
                      { key: 'Tipo', label: 'Tipo de visita' },
                      { key: 'Bono', label: 'Bono' },
                      { key: 'Sesiones', label: 'Sesiones restantes' },
                      { key: 'Entrada', label: 'Hora de entrada' },
                      { key: 'Tiempo', label: 'Tiempo en sala' },
                      { key: 'Importe', label: 'Importe por tiempo' },
                      { key: 'Consumos', label: 'Consumos' },
                      { key: 'Total a pagar', label: 'Total a pagar' },
                      { key: 'Salida', label: 'Salida' },
                    ] as const).map(col => {
                      const isFiltered =
                        (col.key === 'Tipo' && filterTipo !== 'all') ||
                        (col.key === 'Bono' && filterBono !== 'all') ||
                        (col.key === 'Sesiones' && filterSesiones !== 'all')
                      return (
                        <th key={col.key} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap first:pl-4 last:pr-4">
                          <span className={`flex items-center gap-1 ${isFiltered ? 'text-iris' : 'text-mist'}`}>
                            {col.label}
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
                            {visit.member_id ? (
                              <Link href={`/miembros/${visit.member_id}`} className="text-xs font-semibold text-snow whitespace-nowrap hover:text-lime hover:underline transition-colors">
                                {visit.members?.name ?? '—'}
                              </Link>
                            ) : (
                              <p className="text-xs font-semibold text-snow whitespace-nowrap">{visit.members?.name ?? '—'}</p>
                            )}
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
                            {pricingMissing(visit, imp) ? (
                              <ConfigTarifasChip />
                            ) : (
                              <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="text-xs font-bold text-lime">{imp.total.toFixed(2)}€</span>
                                <button
                                  onClick={() => setImporteVisitId(visit.id)}
                                  className="w-6 h-6 flex items-center justify-center rounded-md border border-line text-fog hover:text-lime hover:border-lime/40 transition-colors"
                                >
                                  <Receipt size={11} />
                                </button>
                              </div>
                            )}
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
                            {pricingMissing(visit, imp) ? (
                              <ConfigTarifasChip />
                            ) : (() => {
                              const consumosTotal = (openChecks.get(visit.id)?.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
                              const grandTotal = imp.toPay + consumosTotal
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
                            {isToday ? (
                              <button
                                onClick={() => setConfirmCheckout(visit.id)}
                                aria-label="Registrar salida"
                                className="flex items-center justify-center text-ink bg-rose rounded-lg w-7 h-7 hover:brightness-110 transition-all"
                              >
                                <LogOut size={12} />
                              </button>
                            ) : (
                              <span className="text-[10px] text-mist">—</span>
                            )}
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
          <span className="text-[11px] text-mist">{todayBookings.length} reserva{todayBookings.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => { setBookingModal('pick'); setBookingQuery('') }}
            className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-ink bg-iris rounded-lg px-2.5 py-1.5 hover:brightness-110 transition-all"
          >
            <CalendarPlus size={13} /> Nueva reserva
          </button>
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
                  <button
                    onClick={() => setSelectedBooking(b)}
                    className="flex-1 px-4 py-3 flex items-start gap-3 text-left hover:bg-surface2 transition-colors"
                  >
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
                      {(() => {
                        const gA = b.guest_adults ?? 0
                        const gC = b.guest_children ?? 0
                        const totalG = b.guests ?? (gA + gC)
                        if (totalG <= 0 && gA === 0 && gC === 0) return null
                        if (b.type === 'custodia') {
                          return <p className="text-[11px] text-mist">{totalG} niño{totalG !== 1 ? 's' : ''}</p>
                        }
                        return (
                          <p className="text-[11px] text-mist">
                            {totalG} invitado{totalG !== 1 ? 's' : ''}
                            {(gA > 0 || gC > 0) && <span> · {gA} adulto{gA !== 1 ? 's' : ''}, {gC} niño{gC !== 1 ? 's' : ''}</span>}
                          </p>
                        )
                      })()}
                    </div>
                    {isToday && canExecute && (
                      <button
                        onClick={e => { e.stopPropagation(); handleExecuteBooking(b) }}
                        disabled={executingBooking === b.id}
                        className="flex items-center gap-1 text-[10px] font-semibold text-ink bg-lime rounded-lg px-2 py-1 shrink-0 hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
                      >
                        <Play size={9} fill="currentColor" />
                        {executingBooking === b.id ? '...' : 'Ejecutar'}
                      </button>
                    )}
                  </button>
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
                const grandTotal = imp.toPay + consumosTotal
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
                        className="flex items-center gap-1 text-[10px] font-medium text-ink bg-rose rounded-lg px-2 py-1 hover:brightness-110 transition-all shrink-0"
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
        const hours = Math.max(1, Math.ceil(elapsedMins / 60)) // por hora o fracción (mín. 1h)
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
        const grandTotal = imp.toPay + consumosTotal
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
                {/* Sección paquete de reserva (cumpleaños/custodia/otro con importe) */}
                {imp.isPackage ? (
                  <div>
                    <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">Reserva</p>
                    <div className="space-y-1.5">
                      {imp.pkg?.live && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-fog">
                              Paquete base
                              {imp.pkg.included > 0 && <span className="text-mist"> (incluye {imp.pkg.included})</span>}
                            </span>
                            <span className="text-snow">{imp.pkg.base.toFixed(2)}€</span>
                          </div>
                          <div className="flex justify-between text-xs text-mist">
                            <span>Presentes: {imp.pkg.presentA + imp.pkg.presentC}
                              {(imp.pkg.presentA + imp.pkg.presentC) !== (imp.pkg.contractedA + imp.pkg.contractedC) &&
                                ` (contratados ${imp.pkg.contractedA + imp.pkg.contractedC})`}
                            </span>
                          </div>
                          {imp.pkg.chargeA > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-fog">{imp.pkg.chargeA} adulto{imp.pkg.chargeA !== 1 ? 's' : ''} extra × {imp.pkg.rateA.toFixed(2)}€</span>
                              <span className="text-snow">{(imp.pkg.chargeA * imp.pkg.rateA).toFixed(2)}€</span>
                            </div>
                          )}
                          {imp.pkg.chargeC > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-fog">{imp.pkg.chargeC} niño{imp.pkg.chargeC !== 1 ? 's' : ''} extra × {imp.pkg.rateC.toFixed(2)}€</span>
                              <span className="text-snow">{(imp.pkg.chargeC * imp.pkg.rateC).toFixed(2)}€</span>
                            </div>
                          )}
                          {imp.pkg.chargeA === 0 && imp.pkg.chargeC === 0 && (
                            <div className="flex justify-between text-xs text-mint">
                              <span>Sin invitados extra</span>
                            </div>
                          )}
                        </>
                      )}
                      {(visit.bookings?.addons ?? []).length > 0 && (
                        <div className="pt-1 border-t border-line/60 space-y-1.5">
                          <p className="text-[10px] text-mist">Sub-servicios</p>
                          {(visit.bookings?.addons ?? []).map((a, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-fog">+ {a.name}</span>
                              <span className="text-snow">{(Number(a.price) || 0).toFixed(2)}€</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-semibold pt-1 border-t border-line">
                        <span className="text-fog">Total del paquete</span>
                        <span className="text-snow">{imp.total.toFixed(2)}€</span>
                      </div>
                      {imp.deposit > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-fog">Adelanto pagado</span>
                          <span className="text-mint">−{imp.deposit.toFixed(2)}€</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-semibold pt-1 border-t border-line">
                        <span className="text-fog">Pendiente reserva</span>
                        <span className="text-lime">{imp.toPay.toFixed(2)}€</span>
                      </div>
                    </div>
                  </div>
                ) : (
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
                    {imp.bonoPrecioSesion !== null && mt && (
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
                    )}
                    <div className="flex justify-between text-xs font-semibold pt-1 border-t border-line">
                      <span className="text-fog">Subtotal tiempo</span>
                      <span className="text-lime">{imp.total.toFixed(2)}€</span>
                    </div>
                  </div>
                </div>
                )}

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

              {/* Total + cobro */}
              <div className="px-5 py-4 border-t border-line shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-snow">Total a pagar</span>
                  {pricingMissing(visit, imp)
                    ? <span className="text-sm font-semibold text-amber">Sin tarifas</span>
                    : <span className="text-2xl font-bold text-lime">{grandTotal.toFixed(2)}€</span>}
                </div>
                {pricingMissing(visit, imp) ? (
                  <Link href="/panel/servicios" onClick={() => setTotalVisitId(null)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-amber/40 bg-amber/10 py-3 text-sm font-semibold text-amber hover:bg-amber/20 transition-colors">
                    <AlertTriangle size={15} /> Configura tus tarifas para cobrar
                  </Link>
                ) : visit.paid_at ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-mint/10 border border-mint/20 py-2.5 text-sm font-semibold text-mint">
                    <Check size={15} /> Cobrado
                    {visit.paid_amount != null && <span className="text-mint/80">· {visit.paid_amount.toFixed(2)}€</span>}
                    {visit.payment_method && <span className="text-mint/60 capitalize">· {visit.payment_method}</span>}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handlePayVisit(totalVisitId, grandTotal, 'efectivo')}
                      disabled={payingVisit === totalVisitId}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-lime py-3 text-sm font-semibold text-ink hover:bg-lime-deep transition-colors disabled:opacity-50"
                    >
                      <Euro size={15} /> Efectivo
                    </button>
                    <button
                      onClick={() => handlePayVisit(totalVisitId, grandTotal, 'tarjeta')}
                      disabled={payingVisit === totalVisitId}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-lime/40 bg-lime/10 py-3 text-sm font-semibold text-lime hover:bg-lime/20 transition-colors disabled:opacity-50"
                    >
                      <CreditCard size={15} /> Tarjeta
                    </button>
                  </div>
                )}
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
                {!visit.paid_at && (
                  <button
                    onClick={() => { setConfirmCheckout(null); setTotalVisitId(visit.id) }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl bg-amber/10 border border-amber/30 px-3 py-2.5 hover:bg-amber/15 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs text-amber">
                      <Euro size={13} className="shrink-0" /> Aún sin cobrar — pasar a cobro
                    </span>
                    <ChevronRight size={14} className="text-amber shrink-0" />
                  </button>
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
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-ink bg-rose rounded-xl py-2.5 hover:brightness-110 transition-all disabled:opacity-50"
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => closeAndReturn(() => setAcompVisitId(null))}>
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
                <button onClick={() => closeAndReturn(() => setAcompVisitId(null))} className="text-fog hover:text-snow transition-colors p-1">
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
                            cot.selected ? 'bg-iris/10 border-iris/40' : 'bg-surface2 border-line hover:border-line2'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            cot.selected ? 'bg-iris border-iris' : 'border-line2'
                          }`}>
                            {cot.selected && <Check size={10} className="text-white" strokeWidth={3} />}
                          </span>
                          <span className="text-xs font-medium text-snow flex-1">{cot.name}</span>
                          <span className="text-[11px] text-iris font-medium">Co-titular</span>
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

                    {/* Niños invitados con nombre (añadidos en el check-in) */}
                    {acompChildren.filter(c => c.isGuest).map((child, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl bg-surface2 border border-line px-3 py-2.5">
                        <span className="text-xs text-snow flex-1">{child.name}</span>
                        <span className="text-[10px] text-cyan-300 font-medium">Niño invitado</span>
                        <button
                          onClick={() => setAcompChildren(prev => {
                            const guestIdx = prev.filter(c => c.isGuest).indexOf(child)
                            let removed = 0
                            return prev.filter(c => {
                              if (!c.isGuest) return true
                              if (removed === guestIdx) { removed++; return false }
                              removed++
                              return true
                            })
                          })}
                          className="w-5 h-5 flex items-center justify-center rounded-md text-fog hover:text-rose transition-colors"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}

                    {/* Niños invitados anónimos */}
                    <div className="flex items-center justify-between rounded-xl bg-surface2 border border-line px-3 py-2.5">
                      <span className="text-xs text-snow">Niños invitados adicionales</span>
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
        const hours = Math.max(1, Math.ceil(elapsedMins / 60)) // por hora o fracción (mín. 1h)
        const imp = calcImporte(visit)
        const mt = visit.memberships?.membership_types
        const fmtH = (mins: number) => {
          const h = Math.floor(mins / 60), m = Math.round(mins % 60)
          return h > 0 ? `${h}h ${m}min` : `${m}min`
        }
        const hourRate = visit.visit_type === 'custodia' ? rateCustodia : rateAdult
        const childRate = visit.visit_type === 'custodia' ? rateCustodia : rateChild
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => closeAndReturn(() => setImporteVisitId(null))}>
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
                <button onClick={() => closeAndReturn(() => setImporteVisitId(null))} className="text-fog hover:text-snow transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
              {/* Body */}
              <div className="px-5 py-4 space-y-3">
                {/* Meta */}
                <div className="flex justify-between text-sm text-fog">
                  <span>Entrada</span><span className="text-snow font-medium">{fmtTime(visit.checked_in_at)}</span>
                </div>
                <div className="flex justify-between text-sm text-fog">
                  <span>Tiempo en sala</span><span className="text-snow font-medium">{fmtH(elapsedMins)}</span>
                </div>
                <div className="flex justify-between text-sm text-fog">
                  <span>Tipo de visita</span><span className="text-snow font-medium">{fmtVisitType(visit)}</span>
                </div>

                {/* Paquete de reserva */}
                {imp.isPackage && (
                  <div className="border-t border-line pt-3 space-y-2">
                    <p className="text-xs font-semibold text-mist uppercase tracking-wide">Reserva</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-fog">Total del paquete</span>
                      <span className="text-snow font-medium">{imp.total.toFixed(2)}€</span>
                    </div>
                    {imp.deposit > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-fog">Adelanto pagado</span>
                        <span className="text-mint font-medium">−{imp.deposit.toFixed(2)}€</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tarifa sin bono */}
                {!imp.isPackage && (
                <div className="border-t border-line pt-3 space-y-2">
                  <p className="text-xs font-semibold text-mist uppercase tracking-wide">Tarifa regular</p>
                  {visit.adults_count > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-fog">{visit.adults_count} adulto{visit.adults_count !== 1 ? 's' : ''} × {hourRate}€/h × {hours.toFixed(2)}h</span>
                      <span className="text-snow font-medium">{imp.titular.toFixed(2)}€</span>
                    </div>
                  )}
                  {visit.children_count > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-fog">{visit.children_count} niño{visit.children_count !== 1 ? 's' : ''} × {childRate}€/h × {hours.toFixed(2)}h</span>
                      <span className="text-snow font-medium">{imp.ninos.toFixed(2)}€</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-fog">Subtotal regular</span>
                    <span className={imp.bonoPrecioSesion !== null ? 'text-mist line-through' : 'text-lime'}>{imp.regular.toFixed(2)}€</span>
                  </div>
                </div>
                )}

                {/* Descuento bono */}
                {!imp.isPackage && imp.bonoPrecioSesion !== null && mt && (
                  <div className="border-t border-line pt-3 space-y-2">
                    <p className="text-xs font-semibold text-iris uppercase tracking-wide">{mt.name}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-fog">Precio por sesión ({mt.price}€ ÷ {mt.sessions} ses.)</span>
                      <span className="text-iris font-medium">{imp.bonoPrecioSesion.toFixed(2)}€</span>
                    </div>
                    {imp.ahorro > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-fog">Ahorro aplicado</span>
                        <span className="text-mint font-medium">−{imp.ahorro.toFixed(2)}€</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Total */}
                <div className="border-t border-line pt-4 flex justify-between items-center">
                  <span className="text-base font-bold text-snow">{imp.isPackage ? 'Pendiente a cobrar' : 'Total a cobrar'}</span>
                  <span className="text-2xl font-bold text-lime">{imp.toPay.toFixed(2)}€</span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de detalle de visita (móvil) */}
      {detailVisitId && (() => {
        const visit = activeVisits.find(v => v.id === detailVisitId)
        if (!visit) return null
        const bono = visit.membership_id
        const check = openChecks.get(detailVisitId)
        const imp = calcImporte(visit)
        const consumosTotal = (check?.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
        const grandTotal = imp.toPay + consumosTotal
        const numChildren = visit.children_count ?? 0
        const tipo = fmtVisitType(visit)
        const tipoColor = tipo === 'Cumpleaños' ? 'text-iris' : tipo === 'Custodia' ? 'text-cyan-300' : 'text-mist'
        const isLong = (Date.now() - new Date(visit.checked_in_at).getTime()) / 60000 > 180
        const elapsedMins = (Date.now() - new Date(visit.checked_in_at).getTime()) / 60000
        const cp = visit.children_present ?? []
        const coTitNames = cp.filter(e => e.is_adult).map(e => e.name)
        const childNames = cp.filter(e => !e.is_adult).map(e => e.name)
        const extraAdults = Math.max(0, (visit.adults_count ?? 1) - 1 - coTitNames.length)
        const extraChildren = Math.max(0, numChildren - childNames.length)
        // Build adult & children summary lines
        const titularName = visit.members?.name ?? '—'
        const allAdultNames = [titularName, ...coTitNames]
        const adultNamesStr = allAdultNames.join(', ')
        const adultSuffix = extraAdults > 0 ? ` + ${extraAdults} invitado${extraAdults !== 1 ? 's' : ''}` : ''
        const childNamesStr = childNames.join(', ')
        const childSuffix = extraChildren > 0 ? `${childNames.length > 0 ? ' + ' : ''}${extraChildren} invitado${extraChildren !== 1 ? 's' : ''}` : ''
        const bonoInfo = bono && visit.memberships
        const bonoName = bonoInfo ? (visit.memberships!.membership_types?.name ?? 'Con bono') : null
        const bonoSessions = bonoInfo ? visit.memberships!.sessions_remaining : null
        const bonoIsUnlimited = bonoName?.toLowerCase().includes('ilimitado')
        const bonoSessionColor = bonoSessions == null ? 'text-fog' : bonoSessions <= 2 ? 'text-rose' : bonoSessions <= 5 ? 'text-amber' : 'text-mint'

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setDetailVisitId(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-sm rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Users size={13} className="text-fog shrink-0" />
                    <p className="text-xs font-semibold text-fog uppercase tracking-wide">Ahora en sala</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-bold text-snow truncate">{titularName}</p>
                    <span className={`text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded-md border ${tipo === 'Cumpleaños' ? 'bg-iris/10 text-iris border-iris/30' : tipo === 'Custodia' ? 'bg-cyan-300/10 text-cyan-300 border-cyan-300/30' : 'bg-surface2 text-fog border-line'}`}>{tipo}</span>
                    {isLong && <span className="text-[10px] font-semibold text-amber shrink-0">⚠ Larga</span>}
                  </div>
                  <p className="text-xs text-fog mt-0.5">Entrada {fmtTime(visit.checked_in_at)} · <span className={isLong ? 'text-amber font-semibold' : 'text-snow'}>{fmtElapsed(visit.checked_in_at)}</span></p>
                </div>
                <button onClick={() => setDetailVisitId(null)} aria-label="Cerrar" className="text-fog hover:text-snow transition-colors p-1 shrink-0 ml-2"><X size={16} /></button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                {/* Personas: 2 líneas compactas */}
                <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 space-y-2.5">
                  {/* Adultos */}
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="text-xs text-fog shrink-0 w-14">Adultos</span>
                    <span className="text-lg font-bold text-lime leading-none shrink-0">{visit.adults_count}</span>
                    <ScrollingName text={adultNamesStr} suffix={adultSuffix} suffixClass="text-mist" />
                  </div>
                  {/* Niños */}
                  {numChildren > 0 && (
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className="text-xs text-fog shrink-0 w-14">Niños</span>
                      <span className="text-lg font-bold text-cyan-300 leading-none shrink-0">{numChildren}</span>
                      <ScrollingName text={childNamesStr} suffix={childSuffix} suffixClass="text-mist" />
                    </div>
                  )}
                </div>

                {/* Bono */}
                <div className={`rounded-xl border px-4 py-3 space-y-1.5 ${bono ? 'border-iris/20 bg-iris/5' : 'border-amber/20 bg-amber/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-fog uppercase tracking-wide">Bono</span>
                      <span className={`text-sm font-bold ${bono ? 'text-iris' : 'text-amber'}`}>
                        {bono ? (bonoName ?? 'Con bono') : 'Sin bono'}
                      </span>
                    </div>
                    {bono && !bonoIsUnlimited && bonoSessions != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-fog">Sesiones restantes</span>
                        <span className={`text-sm font-bold ${bonoSessionColor}`}>{bonoSessions}</span>
                      </div>
                    )}
                    {bono && bonoIsUnlimited && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-fog">Sesiones</span>
                        <span className="text-sm font-bold text-iris">∞ Ilimitado</span>
                      </div>
                    )}
                </div>

                {/* Acciones */}
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => { returnToDetailRef.current = detailVisitId; setDetailVisitId(null); setImporteVisitId(detailVisitId) }}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl border border-line bg-surface2 hover:border-lime/40 transition-colors">
                    <Receipt size={15} className="text-lime" />
                    <span className="text-xs font-semibold text-lime">{imp.total.toFixed(2)}€</span>
                    <span className="text-[10px] text-mist">Importe</span>
                  </button>
                  <button onClick={() => { returnToDetailRef.current = detailVisitId; setDetailVisitId(null); setConsumosVisitId(detailVisitId) }}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl border border-line bg-surface2 hover:border-iris/40 transition-colors">
                    <Plus size={15} className="text-fog" />
                    <span className={`text-xs font-semibold ${consumosTotal > 0 ? 'text-lime' : 'text-mist'}`}>
                      {consumosTotal > 0 ? `${consumosTotal.toFixed(2)}€` : '—'}
                    </span>
                    <span className="text-[10px] text-mist">Consumos</span>
                  </button>
                  <button onClick={() => { returnToDetailRef.current = detailVisitId; setDetailVisitId(null); openAcompPopup(visit) }}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl border border-line bg-surface2 hover:border-iris/40 transition-colors">
                    <UserPlus size={15} className="text-fog" />
                    <span className="text-xs font-semibold text-mist">
                      {Math.max(0, visit.adults_count - 1) + numChildren}
                    </span>
                    <span className="text-[10px] text-mist">Acomp.</span>
                  </button>
                </div>

                {/* Total + checkout */}
                {pricingMissing(visit, imp) ? (
                  <Link href="/panel/servicios" onClick={() => setDetailVisitId(null)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-amber/40 bg-amber/10 text-sm font-semibold text-amber hover:bg-amber/20 transition-colors">
                    <AlertTriangle size={14} /> Configura tus tarifas para cobrar
                  </Link>
                ) : (
                  <button onClick={() => { setDetailVisitId(null); setTotalVisitId(detailVisitId) }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-lime/5 border border-lime/20 hover:bg-lime/10 transition-colors">
                    <span className="text-sm font-semibold text-fog">Total a pagar</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-bold text-lime">{grandTotal.toFixed(2)}€</span>
                      <Receipt size={13} className="text-lime/60" />
                    </div>
                  </button>
                )}

                {isToday && (
                  <button onClick={() => { setDetailVisitId(null); setConfirmCheckout(detailVisitId) }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 bg-rose text-ink font-semibold text-sm hover:brightness-110 transition active:scale-[0.99]">
                    <LogOut size={16} strokeWidth={2.2} />
                    Registrar salida
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Popup detalle de reserva */}
      {selectedBooking && (() => {
        const b = selectedBooking
        const status = getBookingStatus(b)
        const style = bookingTypeStyle[b.type]
        const canExecute = isToday && (status === 'pendiente' || status === 'en_curso')
        const linkedVisit = activeVisits.find(v => v.booking_id === b.id)
        const statusLabels: Record<string, { label: string; cls: string }> = {
          ejecutado: { label: 'Ejecutado', cls: 'bg-mint/10 text-mint border-mint/30' },
          en_curso:  { label: 'En curso',  cls: 'bg-lime/10 text-lime border-lime/30' },
          pendiente: { label: 'Pendiente', cls: 'bg-surface2 text-fog border-line' },
          pasado:    { label: 'Pasado',    cls: 'bg-surface2 text-mist border-line' },
        }
        const st = statusLabels[status]
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-sm rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarClock size={13} className="text-fog shrink-0" />
                    <p className="text-xs font-semibold text-fog uppercase tracking-wide">Reserva</p>
                  </div>
                  <FitText className="font-bold text-snow leading-tight" min={13} max={18}>{b.title}</FitText>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${style.badge}`}>{style.label}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedBooking(null)} className="text-fog hover:text-snow transition-colors p-1 shrink-0 ml-2">
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
                {/* Titular */}
                {b.members?.name && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-fog">Titular</span>
                    <span className="text-sm font-semibold text-snow">{b.members.name}</span>
                  </div>
                )}

                {/* Menor (cumpleaños / custodia) */}
                {b.child_name && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-fog">{b.type === 'birthday' ? 'Cumpleañero/a' : 'Menores'}</span>
                    <span className="text-sm font-semibold text-snow">{b.child_name}</span>
                  </div>
                )}

                {/* Fecha */}
                {b.date && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-fog">Fecha</span>
                    <span className="text-sm font-semibold text-snow capitalize">
                      {new Date(b.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                )}

                {/* Horario */}
                <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 space-y-2">
                  <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Horario</p>
                  <div className="flex items-center gap-4">
                    {b.start_time && (
                      <div>
                        <p className="text-[10px] text-mist mb-0.5">Inicio</p>
                        <p className="text-lg font-bold text-snow">{b.start_time.slice(0, 5)}</p>
                      </div>
                    )}
                    {b.start_time && b.end_time && <span className="text-mist">→</span>}
                    {b.end_time && (
                      <div>
                        <p className="text-[10px] text-mist mb-0.5">Fin</p>
                        <p className="text-lg font-bold text-snow">{b.end_time.slice(0, 5)}</p>
                      </div>
                    )}
                    {b.start_time && b.end_time && (() => {
                      const diff = timeToMins(b.end_time) - timeToMins(b.start_time)
                      const h = Math.floor(diff / 60), m = diff % 60
                      return (
                        <div className="ml-auto">
                          <p className="text-[10px] text-mist mb-0.5">Duración</p>
                          <p className="text-sm font-semibold text-fog">{h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}min` : ''}</p>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Invitados / Niños con desglose */}
                {(() => {
                  const gA = b.guest_adults ?? 0
                  const gC = b.guest_children ?? 0
                  const totalG = b.guests ?? (gA + gC)
                  if (totalG <= 0 && gA === 0 && gC === 0) return null
                  return (
                    <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-fog">{b.type === 'custodia' ? 'Niños' : 'Invitados'}</span>
                        <span className="text-sm font-semibold text-snow">
                          {totalG} {b.type === 'custodia' ? `niño${totalG !== 1 ? 's' : ''}` : `invitado${totalG !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                      {b.type !== 'custodia' && (gA > 0 || gC > 0) && (
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-mist">
                          <span>{gA} adulto{gA !== 1 ? 's' : ''}</span>
                          <span>·</span>
                          <span>{gC} niño{gC !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Pagos */}
                {(b.amount != null || (b.deposit_amount != null && b.deposit_amount > 0)) && (() => {
                  const total = Number(b.amount) || 0
                  const dep   = Number(b.deposit_amount) || 0
                  const pend  = Math.max(0, Math.round((total - dep) * 100) / 100)
                  const ps = b.payment_status
                  const badge = ps === 'paid'    ? { label: 'Pagado',    cls: 'bg-mint/10 text-mint border-mint/30' }
                              : ps === 'partial' ? { label: 'Adelanto',  cls: 'bg-amber/10 text-amber border-amber/30' }
                              :                    { label: 'Pendiente', cls: 'bg-surface2 text-fog border-line' }
                  return (
                    <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5"><Receipt size={12} /> Pagos</p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${badge.cls}`}>{badge.label}</span>
                      </div>
                      {b.services?.name && (
                        <div className="flex items-center justify-between pb-1.5 border-b border-line/60">
                          <span className="text-xs text-mist">Paquete</span>
                          <span className="text-xs font-medium text-snow">{b.services.name}</span>
                        </div>
                      )}
                      {(b.addons ?? []).length > 0 && (
                        <div className="space-y-1 pb-1.5 border-b border-line/60">
                          {(b.addons ?? []).map((a, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-xs text-fog">+ {a.name}</span>
                              <span className="text-xs text-snow">{(Number(a.price) || 0).toFixed(2)}€</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-mist">Total</span>
                        <span className="text-sm font-semibold text-snow">{total.toFixed(2)}€</span>
                      </div>
                      {dep > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-mist">Adelanto</span>
                          <span className="text-sm font-semibold text-lime">{dep.toFixed(2)}€</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1.5 border-t border-line/60">
                        <span className="text-xs text-mist">Pendiente</span>
                        <span className="text-sm font-bold text-snow">{pend.toFixed(2)}€</span>
                      </div>
                    </div>
                  )
                })()}

                {/* Notas */}
                {b.notes && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3">
                    <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">Notas</p>
                    <p className="text-xs text-snow whitespace-pre-wrap leading-relaxed">{b.notes}</p>
                  </div>
                )}

                {/* Visita vinculada */}
                {linkedVisit && (
                  <div className="rounded-xl border border-lime/20 bg-lime/5 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-fog">En sala ahora</span>
                    <span className="text-sm font-semibold text-lime">{fmtElapsed(linkedVisit.checked_in_at)}</span>
                  </div>
                )}

                {/* Botón ejecutar */}
                {canExecute && (
                  <button
                    onClick={() => { handleExecuteBooking(b); setSelectedBooking(null) }}
                    disabled={executingBooking === b.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 bg-lime text-ink font-semibold text-sm hover:brightness-105 transition active:scale-[0.99] disabled:opacity-60"
                    style={{ boxShadow: 'var(--shadow-lime)' }}
                  >
                    <Play size={15} fill="currentColor" />
                    {executingBooking === b.id ? 'Ejecutando...' : 'Ejecutar reserva'}
                  </button>
                )}

                {status === 'ejecutado' && (
                  <div className="flex items-center justify-center gap-2 rounded-xl py-3 bg-mint/10 border border-mint/20">
                    <Check size={15} className="text-mint" strokeWidth={2.5} />
                    <span className="text-sm font-semibold text-mint">Reserva ejecutada</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Flujo nueva reserva ── */}
      {bookingModal === 'pick' && (() => {
        const filtered = bookingQuery.trim().length > 0
          ? checkinMembers.filter(m => memberMatchesQuery(bookingQuery, m))
          : []
        const closeAll = () => { setBookingModal(null); setBookingQuery(''); setBookingMember(null); setBookingType(null); setBookingPreselectService(null) }
        return (
          <BookingSearchAndTypeModal
            filtered={filtered}
            query={bookingQuery}
            onQueryChange={setBookingQuery}
            preselectedMember={bookingMember}
            types={reservableTypes}
            onProceed={(m, t, flujo, serviceId) => { setBookingMember(m); setBookingType(t); setBookingCategory(flujo); setBookingPreselectService(serviceId ?? null); setBookingModal('form') }}
            onNewMember={() => { newMemberReturnTo.current = 'booking'; setCheckinModal('new-member') }}
            onClose={closeAll}
          />
        )
      })()}

      {bookingModal === 'form' && bookingMember && bookingType && (
        <BookingFormModal
          key={editBookingId ?? 'nuevo'}
          member={bookingMember}
          bookingType={bookingType}
          serviceCategory={bookingCategory}
          preselectServiceId={bookingPreselectService}
          selectedDate={selectedDate}
          services={bookingServices}
          rateAdult={rateAdult}
          rateChild={rateChild}
          tenantId={getStoredTenant()?.id ?? null}
          editId={editBookingId}
          initial={editInitial}
          onBack={() => { if (editBookingId) { setBookingModal(null); setBookingMember(null); setBookingType(null); setEditBookingId(null); setEditInitial(null) } else { setBookingModal('pick') } }}
          onClose={() => { setBookingModal(null); setBookingMember(null); setBookingType(null); setBookingQuery(''); setBookingPreselectService(null); setEditBookingId(null); setEditInitial(null) }}
          onSaved={() => { router.refresh(); setCheckinMembers([]) }}
        />
      )}

      {/* Modal 1: búsqueda de miembro */}
      {checkinModal === 'search' && (() => {
        const filtered = checkinQuery.trim().length > 0
          ? checkinMembers.filter(m => memberMatchesQuery(checkinQuery, m))
          : []
        const closeAll = () => { setCheckinModal(null); setCheckinQuery(''); setCheckinSelectedMember(null) }
        return (
          <CheckinSearchModal
            filtered={filtered}
            query={checkinQuery}
            onQueryChange={setCheckinQuery}
            activeVisits={activeVisits}
            onSelect={m => { setCheckinSelectedMember(m); setCheckinModal('confirm') }}
            onNewMember={() => { newMemberReturnTo.current = 'checkin'; setCheckinModal('new-member') }}
            onClose={closeAll}
          />
        )
      })()}

      {/* Modal 2: confirmación de entrada */}
      {checkinModal === 'confirm' && checkinSelectedMember && (
        <CheckinConfirmModal
          member={checkinSelectedMember}
          checkinMembers={checkinMembers}
          activeVisits={activeVisits}
          rates={{ adult: rateAdult, child: rateChild, custodia: rateCustodia }}
          onBack={() => setCheckinModal('search')}
          onClose={() => { setCheckinModal(null); setCheckinSelectedMember(null); setCheckinQuery('') }}
          onCheckedIn={() => { router.refresh(); setCheckinMembers([]) }}
        />
      )}

      {/* Modal 3: nuevo miembro */}
      {checkinModal === 'new-member' && (
        <CheckinNewMemberModal
          onBack={() => setCheckinModal('search')}
          onClose={() => { setCheckinModal(null); setCheckinSelectedMember(null); setCheckinQuery(''); setCheckinMembers([]) }}
          onCreated={(newMember) => {
            setCheckinMembers([])
            if (newMemberReturnTo.current === 'booking') {
              setBookingMember(newMember)
              setBookingModal('pick')
              setCheckinModal(null)
            } else {
              setCheckinSelectedMember(newMember)
              setCheckinModal('confirm')
            }
          }}
        />
      )}

      {/* Modal de consumos */}
      {consumosVisitId && consumosVisit && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => closeAndReturn(() => setConsumosVisitId(null))}
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
                <button onClick={() => closeAndReturn(() => setConsumosVisitId(null))} className="text-fog hover:text-snow transition-colors p-1">
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
