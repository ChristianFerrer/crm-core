'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  LogIn, Users, CalendarClock, Cake, ChevronDown,
  BarChart2, Activity, LogOut, AlertTriangle, Play, Clock,
  Check, ShoppingCart, Plus, X, ChevronLeft, ChevronRight, Receipt, UserPlus, Bell,
  Search, QrCode, RotateCcw, User, Phone, Loader2, Save, Calendar, Trash2, CalendarPlus,
  Euro, CreditCard, Store, ArrowLeft,
  CupSoda, Coffee, Droplet, Citrus, Cookie, Candy, Croissant, Popcorn, Package,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { useHomeSections, type HomeSections } from '@/lib/homeSections'
import { supabase } from '@/lib/supabase'
import { getStoredTenant, loadAndStoreTenant } from '@/lib/tenant'
import { executeBooking, bookingGuestCount } from '@/lib/bookingExecution'
import { childKey } from '@/lib/children'
import { findConflicts } from '@/lib/agenda'
import { memberMatchesQuery } from '@/lib/searchMembers'
import { bonoStatus, activeBono } from '@/lib/bonoStatus'
import { resolveRates } from '@/lib/pricing'
import { DatePickerModal } from '@/components/DatePickerModal'
import { MonthCalendarPicker } from '@/components/MonthCalendarPicker'
import { MemberForm } from '@/components/MemberForm'
import { TableFilterBar } from '@/components/TableFilterBar'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LabelList,
} from 'recharts'

/**
 * Personas que ya están dentro en OTRA visita abierta, por nombre.
 *
 * Evita que dos titulares de la misma familia registren al mismo hijo o al
 * mismo co-titular: sin esto el aforo los contaba dos veces.
 */
export function namesAlreadyInside(
  visits: { id: string; checked_out_at: string | null; members: { name: string } | null; children_present: { id?: string; name: string; is_adult?: boolean }[] | null }[],
  excludeVisitId?: string,
): { adults: Set<string>; children: Set<string> } {
  const adults = new Set<string>()
  const children = new Set<string>()
  for (const v of visits) {
    if (v.checked_out_at || v.id === excludeVisitId) continue
    if (v.members?.name) adults.add(v.members.name)
    for (const e of v.children_present ?? []) {
      if (e.is_adult) adults.add(e.name)
      else children.add(childKey(e))
    }
  }
  return { adults, children }
}

type TodayVisit = {
  id: string
  checked_in_at: string
  checked_out_at: string | null
  membership_id: string | null
  member_id: string
  visit_type: string
  children_present: { id?: string; name: string; age?: number; birth_date?: string; is_adult?: boolean }[] | null
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
  status: string | null
  addons: { name: string; price: number }[] | null
  members: { name: string } | null
  services: { name: string } | null
}

// ── Estilo compartido de los ítems de reserva (Inicio y Agenda) ───────────
// Se define aquí porque la Agenda ya importa de este módulo; así hay una
// única fuente de verdad para el aspecto de una reserva en toda la app.
export const BOOKING_TYPE_COLOR_VAR: Record<'birthday' | 'custodia' | 'other', string> = {
  birthday: 'var(--color-grape)',
  custodia: 'var(--color-cyan-300)',
  other: 'var(--color-lime)',
}

// Barra vertical: sólida cuando está confirmada, rayada mientras esté pendiente
export function bookingBarStyle(status: string | null | undefined, colorVar: string): React.CSSProperties {
  if (status === 'pending') {
    return { backgroundImage: `repeating-linear-gradient(45deg, ${colorVar} 0 3px, transparent 3px 6px)` }
  }
  return { backgroundColor: colorVar }
}

export function bookingDurationLabel(
  start: string | null,
  end: string | null,
  t: (k: any, v?: any) => string,
): string | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return null
  const h = Math.floor(mins / 60), m = mins % 60
  if (h === 0) return `${m} ${t('calendario_min_abrev')}`
  if (m === 0) return `${h} ${t('calendario_hora_abrev')}`
  return `${h} ${t('calendario_hora_abrev')} ${m} ${t('calendario_min_abrev')}`
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
  const { t } = useLanguage()
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
          if (!data) { setCamError(t('home_codigo_qr_no_reconocido')); return }
          onSelect(data as unknown as FullMember)
        },
        () => {}
      ).catch(() => setCamError(t('home_no_camara')))
    })
    return () => { stopped = true; html5Qr?.stop().catch(() => {}) }
  }, [mode, scanning])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[80dvh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <LogIn size={15} className="text-lime shrink-0" />
            <div>
              <p className="text-sm font-semibold text-snow">{t('home_registrar_entrada')}</p>
              <p className="text-[11px] text-fog">{t('home_registro_entrada_visitantes')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-fog hover:text-snow transition-colors p-1" aria-label={t('home_cerrar')}><X size={16} /></button>
        </div>

        {/* Tabs manual / QR */}
        <div className="flex border-b border-line shrink-0">
          <button onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${mode === 'manual' ? 'text-lime border-b-2 border-lime' : 'text-mist hover:text-fog'}`}>
            <Search size={13} /> {t('home_manual')}
          </button>
          <button onClick={() => { setMode('qr'); setScanning(true); setCamError(null) }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${mode === 'qr' ? 'text-lime border-b-2 border-lime' : 'text-mist hover:text-fog'}`}>
            <QrCode size={13} /> {t('home_escanear_qr')}
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
                  <RotateCcw size={14} /> {t('home_volver_a_escanear')}
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
                  placeholder={t('home_buscar_nombre_telefono')} autoFocus
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
                      {inside && <span className="block text-xs text-iris">{t('home_dentro_ahora')}</span>}
                    </span>
                    {b?.unlimited ? <span className="text-xs font-semibold text-iris shrink-0">∞</span>
                      : b?.sessions != null ? <span className="text-xs font-semibold text-mist shrink-0">{b.sessions} ses.</span>
                      : <span className="text-xs text-rose shrink-0">{t('home_sin_bono_corto')}</span>}
                  </button>
                )
              })}
              {query.trim().length > 0 && filtered.length === 0 && (
                <div className="flex flex-col items-center gap-4 py-8 px-5">
                  <p className="text-sm text-fog text-center">{t('home_no_se_encontro_miembro')}</p>
                  <button onClick={onNewMember}
                    className="flex items-center gap-2 rounded-xl bg-lime/10 border border-lime/30 px-5 py-2.5 text-sm font-semibold text-lime hover:bg-lime/20 transition-colors">
                    <UserPlus size={15} /> {t('home_crear_nuevo_miembro')}
                  </button>
                </div>
              )}
              {query.trim().length === 0 && (
                <p className="py-8 text-center text-sm text-mist">{t('home_escribe_nombre_telefono')}</p>
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
  const { t } = useLanguage()
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [checkedOut, setCheckedOut] = useState(false)
  const [showGuests, setShowGuests] = useState(false)
  const [currentMember, setCurrentMember] = useState<FullMember>(member)
  const [visitType, setVisitType] = useState<'entrada' | 'custodia'>('entrada')
  // Mejora #1: menores sin pre-seleccionar
  const [childrenPresent, setChildrenPresent] = useState<{ id?: string; name: string; birth_date?: string }[]>([])
  const [extraChildrenCount, setExtraChildrenCount] = useState(0)
  const [coTitulares, setCoTitulares] = useState<{ id: string; name: string; selected: boolean }[]>(
    member.family_id
      ? checkinMembers.filter(o => (o as any).family_id === member.family_id && o.id !== member.id)
          .map(o => ({ id: o.id, name: o.name, selected: false }))
      : []
  )
  const [extraAdultsCount, setExtraAdultsCount] = useState(0)
  // Hora a la que empieza una custodia programada para más tarde (para el mensaje final)
  const [scheduledAt, setScheduledAt] = useState<string | null>(null)
  const [custodiaStart, setCustodiaStart] = useState('')
  const [custodiaEnd, setCustodiaEnd] = useState('')
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const bono = getBonoInfo(currentMember)
  // Nombres que ya están dentro en otra visita: no se pueden volver a añadir
  const inside = namesAlreadyInside(activeVisits)
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
    const startsAt = visitType === 'custodia' && custodiaStart
      ? new Date(`${today}T${custodiaStart}:00`)
      : null
    setScheduledAt(startsAt && startsAt.getTime() > Date.now() ? custodiaStart : null)
    setRegistering(false)
    setRegistered(true)
    onCheckedIn()
    closeTimer.current = setTimeout(onClose, 2000)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[80dvh]" onClick={e => e.stopPropagation()}>
        {/* Header — nombre del miembro */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-line shrink-0">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 bg-surface/60 text-fog hover:text-snow transition-colors shrink-0">
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-snow truncate">{currentMember.name}</p>
            <p className="text-xs text-fog">{t('home_registro_de_entrada')}</p>
          </div>
          <button onClick={onClose} className="text-fog hover:text-snow transition-colors p-1" aria-label={t('home_cerrar')}><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Confirmación de registro */}
          {registered ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 rounded-full bg-lime/15 border border-lime/30 flex items-center justify-center">
                <Check size={30} className="text-lime" strokeWidth={2.5} />
              </div>
              <p className="text-lg font-bold text-snow">{scheduledAt ? t('home_custodia_programada') : t('home_entrada_registrada_excl')}</p>
              <p className="text-sm text-fog text-center">
                {t('home_la_visita_de')} <span className="text-snow font-medium">{currentMember.name}</span> {t('home_ha_sido_registrada')}
                {scheduledAt && <> · {t('home_entrara_en_sala_a_las')} <span className="text-snow font-medium">{scheduledAt}</span></>}
              </p>
              <p className="text-xs text-mist mt-1">{t('home_cerrando_automaticamente')}</p>
            </div>
          ) : alreadyInside ? (
            <div className="space-y-3">
              {checkedOut ? (
                <div className="rounded-xl bg-lime/10 border border-lime/20 px-4 py-4 flex flex-col items-center gap-2">
                  <Check size={22} className="text-lime" strokeWidth={2.5} />
                  <p className="text-sm font-semibold text-lime">{t('home_salida_registrada')}</p>
                  <p className="text-xs text-fog">{t('home_cerrando')}</p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl bg-iris/10 border border-iris/20 px-4 py-3 text-sm text-iris font-medium text-center">
                    {t('home_ya_esta_dentro')}
                  </div>
                  <button onClick={handleCheckOut}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-4 bg-iris/15 border border-iris/30 text-iris font-semibold text-sm hover:bg-iris/25 transition active:scale-[0.99]">
                    <LogOut size={17} strokeWidth={2.2} />
                    {t('home_registrar_salida')}
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Tipo de entrada */}
              <div>
                <p className="px-1 pb-1.5 text-[10px] font-semibold text-fog uppercase tracking-wide">{t('home_tipo_de_entrada')}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setVisitType('entrada')}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      visitType === 'entrada' ? 'bg-lime/15 border-lime/30 text-lime' : 'bg-surface2 border-line text-fog hover:text-snow'
                    }`}>{t('home_libre')}</button>
                  <button type="button" onClick={() => setVisitType('custodia')}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      visitType === 'custodia' ? 'bg-cyan-300/15 border-cyan-300/30 text-cyan-300' : 'bg-surface2 border-line text-fog hover:text-snow'
                    }`}>{t('home_custodia')}</button>
                </div>
                {visitType === 'custodia' && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <p className="px-1 text-[10px] font-semibold text-fog uppercase tracking-wide">{t('home_entrada')} <span className="text-rose">*</span></p>
                      <div className="flex items-center px-3 py-2.5 rounded-xl border border-cyan-300/30 bg-surface2">
                        <input type="time" value={custodiaStart} onChange={e => setCustodiaStart(e.target.value)}
                          className="w-full bg-transparent text-sm text-snow outline-none" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="px-1 text-[10px] font-semibold text-fog uppercase tracking-wide">{t('home_salida')} <span className="text-rose">*</span></p>
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
                  <p className="px-1 pb-1.5 text-[10px] font-semibold text-fog uppercase tracking-wide">{t('home_co_titulares')}</p>
                  <div className="space-y-2">
                    {coTitulares.map((co, i) => {
                      const busy = inside.adults.has(co.name)
                      return (
                      <button key={co.id} type="button" disabled={busy}
                        title={busy ? t('home_ya_en_sala') : undefined}
                        onClick={() => setCoTitulares(prev => prev.map((c, j) => j === i ? { ...c, selected: !c.selected } : c))}
                        className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                          busy ? 'border-line bg-surface2 opacity-50 cursor-not-allowed'
                          : co.selected ? 'bg-iris/5 border-iris/30' : 'border-line bg-surface2 hover:border-line2'
                        }`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${co.selected && !busy ? 'bg-iris border-iris' : 'bg-surface2 border-line2'}`}>
                          {co.selected && !busy && <Check size={11} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className={`flex-1 text-sm font-medium ${co.selected && !busy ? 'text-snow' : 'text-fog'}`}>{co.name}</span>
                        <span className="text-[10px] text-iris font-medium shrink-0">{busy ? t('home_ya_en_sala') : t('home_co_titular')}</span>
                      </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Menores — #1 sin pre-seleccionar */}
              {currentMember.children && currentMember.children.length > 0 && (
                <div>
                  <p className="px-1 pb-1.5 text-[10px] font-semibold text-fog uppercase tracking-wide">{t('home_menores')}</p>
                  <div className="space-y-2">
                    {currentMember.children.map((child, i) => {
                      const sel = childrenPresent.some(c => childKey(c) === childKey(child))
                      const busyChild = inside.children.has(childKey(child))
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
                        <button key={child.name + i} type="button" disabled={busyChild}
                          title={busyChild ? t('home_ya_en_sala') : undefined}
                          onClick={() => setChildrenPresent(prev =>
                            sel ? prev.filter(c => childKey(c) !== childKey(child))
                                : [...prev, { id: (child as any).id, name: child.name, birth_date: bd }]
                          )}
                          className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                            busyChild ? 'border-line bg-surface2 opacity-50 cursor-not-allowed'
                            : sel ? 'bg-iris/5 border-iris/30' : 'border-line bg-surface2 hover:border-line2'
                          }`}>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${sel && !busyChild ? 'bg-iris border-iris' : 'bg-surface2 border-line2'}`}>
                            {sel && !busyChild && <Check size={11} className="text-white" strokeWidth={3} />}
                          </div>
                          <span className={`flex-1 text-sm font-medium ${sel && !busyChild ? 'text-snow' : 'text-fog'}`}>{child.name}</span>
                          {busyChild
                            ? <span className="text-[10px] text-mist shrink-0">{t('home_ya_en_sala')}</span>
                            : age && <span className="text-xs text-mist shrink-0">{age}</span>}
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
                  <Plus size={13} /> {t('home_anadir_invitados_adicionales')}
                </button>
              ) : (
                <div>
                  <div className="flex items-center justify-between px-1 pb-1.5">
                    <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">{t('home_invitados_adicionales')}</p>
                    <button type="button" onClick={() => { setShowGuests(false); setExtraAdultsCount(0); setExtraChildrenCount(0) }}
                      className="text-mist hover:text-fog transition-colors"><X size={13} /></button>
                  </div>
                  <div className="space-y-2">
                    {visitType === 'entrada' && (
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-line">
                        <span className="text-sm text-fog">{t('home_adultos')}</span>
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
                      <span className="text-sm text-fog">{t('home_ninos')}</span>
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
                    {bono ? t('home_bono_agotado_punto') : t('home_sin_bono_punto')}{' '}
                    {visitType === 'custodia' ? `${rates.custodia} €/h × niños` : `${rates.adult} €/h adulto · ${rates.child} €/h niño`}
                  </p>
                </div>
              )}

              {/* Botón registrar — #4 se cierra solo tras registro */}
              <button onClick={handleCheckIn} disabled={registering || !custodiaValid}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-4 border border-lime bg-lime/10 text-lime font-semibold text-sm hover:bg-lime/20 transition active:scale-[0.99] disabled:opacity-60"
                style={{ boxShadow: 'var(--shadow-lime)' }}>
                <LogIn size={17} strokeWidth={2.2} />
                {registering ? t('home_registrando') : t('home_registrar_entrada')}
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
  submitLabel,
}: {
  onBack: () => void
  onClose: () => void
  onCreated: (member: FullMember) => void
  submitLabel?: string
}) {
  const { t } = useLanguage()
  return (
    <FlowScreen z="z-[80]" onClose={onClose}>
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-line shrink-0">
          <FlowBackButton onClick={onBack} label={t('home_volver')} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-snow truncate">{t('home_nuevo_miembro')}</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          <MemberForm onCreated={onCreated} submitLabel={submitLabel} />
        </div>
      </div>
    </FlowScreen>
  )
}



/**
 * Envoltorio de los pasos de un flujo (nueva reserva, nuevo miembro).
 *
 * En móvil ocupa toda la pantalla y se navega con la flecha de volver, como
 * el detalle de un miembro; en escritorio se mantiene como diálogo centrado.
 */
export function FlowScreen({ z = 'z-[60]', onClose, children }: {
  z?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`fixed inset-0 ${z} flex items-stretch justify-center sm:items-center sm:p-4`} onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm hidden sm:block" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative flex w-full flex-col bg-surface h-full sm:h-auto sm:max-w-lg sm:max-h-[90dvh] sm:rounded-2xl sm:border sm:border-line sm:shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {children}
      </div>
    </div>
  )
}

/** Botón de volver de los flujos: flecha en móvil, igual en escritorio. */
export function FlowBackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="w-9 h-9 flex items-center justify-center rounded-lg border border-line/60 bg-surface2/60 text-fog hover:text-snow transition-colors shrink-0">
      <ArrowLeft size={18} />
    </button>
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
  const { t } = useLanguage()
  const [member, setMember] = useState<FullMember | null>(preselectedMember)

  const flowMeta = {
    birthday: { Icon: Cake,     colorCls: 'text-grape',    activeCls: 'border-grape/40 bg-grape/10 hover:bg-grape/15',       desc: t('home_desc_cumpleanos') },
    custodia: { Icon: Clock,    colorCls: 'text-cyan-300', activeCls: 'border-cyan-300/40 bg-cyan-300/10 hover:bg-cyan-300/15', desc: t('home_desc_custodia') },
    other:    { Icon: Calendar, colorCls: 'text-lime',     activeCls: 'border-lime/40 bg-lime/10 hover:bg-lime/15',            desc: t('home_desc_otro') },
  } as const
  const types = reservableTypes.map(t => { const m = flowMeta[t.flow]; return { ...m, flow: t.flow, flujo: t.flujo, label: t.label, serviceId: t.serviceId, desc: t.desc ?? m.desc } })

  return (
    <FlowScreen onClose={onClose}>
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-line shrink-0">
          <FlowBackButton onClick={onClose} label={t('home_cerrar')} />
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <CalendarClock size={15} className="text-iris shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-snow truncate">{t('home_nueva_reserva')}</p>
              <p className="text-[11px] text-fog">{t('home_paso1_titular_tipo')}</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Titular */}
          <div>
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">
              {t('home_titular')} <span className="text-rose">*</span>
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
                    placeholder={t('home_buscar_nombre_telefono')} autoFocus
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
                        <p className="text-xs text-fog text-center">{t('home_no_se_encontro_miembro_punto')}</p>
                        <button onClick={onNewMember}
                          className="flex items-center gap-2 rounded-xl bg-lime/10 border border-lime/30 px-4 py-2 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors">
                          <UserPlus size={13} /> {t('home_crear_nuevo_miembro')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-mist text-center py-1">{t('home_escribe_para_buscar')}</p>
                )}
              </div>
            )}
          </div>

          {/* Tipo de reserva */}
          <div>
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">
              {t('home_tipo_de_reserva')} <span className="text-rose">*</span>
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
                  {t('home_no_hay_servicios_reservables')}
                </p>
              )}
            </div>
            {!member && types.length > 0 && (
              <p className="text-xs text-mist text-center pt-1">{t('home_selecciona_titular_continuar')}</p>
            )}
          </div>
        </div>
      </div>
    </FlowScreen>
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
  const { t } = useLanguage()
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
  // Un sub-servicio solo aparece si tiene explícitamente configurada la relación
  // con este tipo de reserva ("Aplica a"); sin relación, no se ofrece.
  const subServices = services.filter(s =>
    s.tipo === 'subservicio' && !!s.applies_to?.includes(serviceCat)
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

  const typeLabels  = { birthday: t('home_reserva_de_cumpleanos'), custodia: t('home_reserva_de_custodia'), other: t('home_otra_reserva') }
  const typeIcons   = { birthday: Cake, custodia: Clock, other: Calendar }
  const typeColors  = { birthday: 'text-grape', custodia: 'text-cyan-300', other: 'text-lime' }
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
    // Aviso de solape: otra reserva activa que ocupa la MISMA sala en esa franja.
    // Con salas distintas ya no avisa, que era lo que enseñaba a ignorar el aviso.
    if (!force && startTime && endTime) {
      const { data: sameDay } = await supabase
        .from('bookings')
        .select('id, start_time, end_time, title, status, service_id, date')
        .eq('date', date).neq('status', 'cancelled')
      const resourceByService: Record<string, string | null> = Object.fromEntries(
        services.map(sv => [sv.id, sv.resource_name ?? null])
      )
      const candidate = {
        id: editId ?? '__nueva__', date, start_time: startTime, end_time: endTime,
        status: 'confirmed', service_id: serviceId || null, title: title.trim(),
      }
      const clash = findConflicts(candidate, (sameDay ?? []) as any[], resourceByService)[0]
      if (clash) {
        setOverlap(clash.title ?? t('home_otra_reserva_lc'))
        setSaving(false)
        return
      }
    }
    const finalTitle = title.trim() || (
      bookingType === 'birthday' ? `Cumple de ${birthdayChild || member.name}` :
      bookingType === 'custodia' ? `Custodia — ${member.name}` : t('home_reserva')
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
    <FlowScreen onClose={onClose}>
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <FlowBackButton onClick={onBack} label={t('home_volver')} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <TypeIcon size={20} className="text-snow shrink-0" />
                  <div className="min-w-0 flex-1">
                    <FitText className="font-bold text-snow leading-tight" min={15} max={20}>{typeLabels[bookingType]}</FitText>
                  </div>
                </div>
                <p className="text-[11px] text-fog mt-1">{editId ? t('home_editar_reserva') : t('home_paso2_de_2')}</p>
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
              <p className="text-lg font-bold text-snow">{editId ? t('home_reserva_actualizada_excl') : t('home_reserva_guardada_excl')}</p>
              <p className="text-sm text-fog text-center">{t('home_la_reserva_de')} <span className="text-snow font-medium">{member.name}</span> {t('home_ha_sido')} {editId ? t('home_actualizada') : t('home_registrada')}.</p>
              <p className="text-xs text-mist mt-1">{t('home_cerrando_automaticamente')}</p>
            </div>
          ) : (
            <>
              {/* Titular — no editable */}
              <div>
                <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">{t('home_titular')}</p>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line bg-surface2/40">
                  <div className="w-5 h-5 rounded-md border-2 border-line2 bg-line2 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-fog" strokeWidth={3} />
                  </div>
                  <span className="flex-1 text-sm font-medium text-snow">{member.name}</span>
                  <span className="text-[10px] text-snow font-medium">{t('home_titular')}</span>
                </div>
              </div>

              {/* Niño/a — selector cumpleaños (checkbox) y custodia (multi-checkbox) */}
              {member.children && member.children.length > 0 && (bookingType === 'birthday' || bookingType === 'custodia') && (
                <div>
                  <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">
                    {bookingType === 'birthday' ? t('home_nino_que_cumple') : t('home_menores')}
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
                  {t('home_titulo')} {needsTitle && <span className="text-rose">*</span>}
                </label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder={needsTitle ? t('home_nombre_evento_reserva') : ''}
                  className={inputCls} />
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">
                  {t('home_fecha')} <span className="text-rose">*</span>
                </label>
                <DatePickerModal value={date} onChange={setDate} title={t('home_fecha')} />
              </div>

              {/* Horario */}
              <div>
                <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">
                  {t('home_horario')} <span className="text-rose">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-mist px-1">{t('home_inicio')}</p>
                    <TimePicker value={startTime} onChange={setStart} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-mist px-1">{t('home_fin')}</p>
                    <TimePicker value={endTime} onChange={setEnd} />
                  </div>
                </div>
                {startTime && endTime && endTime <= startTime && (
                  <p className="text-xs text-amber mt-1.5 px-1">{t('home_hora_fin_posterior')}</p>
                )}
              </div>

              {/* Invitados — colapsable con botón dashed */}
              <div>
                {!guestsOpen ? (
                  <button type="button" onClick={() => setGuestsOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line2 py-3 text-sm font-medium text-fog hover:border-line hover:text-snow transition-colors">
                    <Plus size={14} />
                    {bookingType === 'custodia' ? t('home_anadir_ninos_adicionales') : bookingType === 'birthday' ? t('home_asistentes_previstos') : t('home_anadir_invitados_adicionales')}
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">
                        {bookingType === 'custodia' ? t('home_ninos_adicionales') : bookingType === 'birthday' ? t('home_asistentes_capacidad') : t('home_invitados')}
                      </p>
                      <button type="button" onClick={() => { setGuestsOpen(false); setGuestAdults(0); setGuestChildren(0) }}
                        className="text-[10px] text-mist hover:text-rose transition-colors">{t('home_quitar')}</button>
                    </div>
                    <div className="space-y-2">
                      {bookingType !== 'custodia' && (
                        <Counter value={guestAdults} onChange={setGuestAdults} label={t('home_adultos')} />
                      )}
                      <Counter
                        value={guestChildren}
                        onChange={setGuestChildren}
                        label={bookingType === 'custodia' ? t('home_ninos_sin_registrar') : t('home_ninos')}
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
                      <span className="flex items-center gap-2"><Receipt size={14} /> {t('home_pagos_y_paquete')}</span>
                      {totalNum > 0
                        ? <span className="text-xs font-semibold text-snow">{totalNum.toFixed(2)}€</span>
                        : <Plus size={14} />}
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
                          <Receipt size={12} /> {t('home_pagos')}
                        </p>
                        <button type="button" onClick={() => { setPaymentsOpen(false); setServiceId(''); setTotalStr(''); setDepositStr('') }}
                          className="text-[10px] text-mist hover:text-rose transition-colors">{t('home_quitar')}</button>
                      </div>
                      <div className="rounded-xl border border-line bg-surface2/40 p-4 space-y-3">
                        {/* Paquete */}
                        <div>
                          <p className="text-[10px] text-mist mb-1.5">{t('home_paquete')}</p>
                          <div className="relative">
                            <select value={serviceId} onChange={e => setServiceId(e.target.value)}
                              style={{ colorScheme: 'dark' }}
                              className="w-full appearance-none bg-surface2 border border-line rounded-xl pl-4 pr-9 py-2.5 text-sm text-snow outline-none focus:border-line2 transition-colors cursor-pointer">
                              <option value="">{t('home_selecciona_un_paquete')}</option>
                              {catServices.map(s => (
                                <option key={s.id} value={s.id}>{s.name} · {(Number(s.price) || 0).toFixed(2)}€</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-fog pointer-events-none" />
                          </div>
                          {selectedService && Number(selectedService.included_guests) > 0 && (
                            <p className="text-[11px] text-mist mt-1.5">
                              {bookingType === 'birthday'
                                ? `${t('home_precio_fijo_capacidad')} ${Number(selectedService.included_guests)} ${t('home_personas')}.`
                                : `${t('home_incluye')} ${Number(selectedService.included_guests)} ${t('home_personas_invitados_exceden')}`}
                            </p>
                          )}
                        </div>
                        {/* Sub-servicios / Extras */}
                        {subServices.length > 0 && (
                          <div>
                            <p className="text-[10px] text-mist mb-1.5">{t('home_sub_servicios')}</p>
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
                          <span className="text-sm text-fog">{t('home_total')}</span>
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
                          <span className="text-sm text-fog">{t('home_adelanto')}</span>
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
                          <span className="text-xs text-mist">{t('home_pendiente')}</span>
                          <span className="text-sm font-bold text-snow">{pendingNum.toFixed(2)}€</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-mist">{t('home_estado')}</span>
                          <span className={`text-[10px] font-semibold ${
                            paymentStatus === 'paid'    ? 'text-mint' :
                            paymentStatus === 'partial' ? 'text-amber' :
                                                          'text-fog'
                          }`}>
                            {paymentStatus === 'paid' ? t('home_pagado') : paymentStatus === 'partial' ? t('home_adelanto') : t('home_pendiente')}
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
                  {t('home_notas')}
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder={t('home_alergias_decoracion_placeholder')}
                  className={`${inputCls} resize-none`} />
              </div>

              {error && <p className="text-sm text-rose text-center">{error}</p>}

              {overlap && (
                <div className="rounded-xl bg-amber/10 border border-amber/30 px-3 py-2.5 space-y-2">
                  <p className="flex items-center gap-1.5 text-xs text-amber">
                    <AlertTriangle size={13} className="shrink-0" /> {t('home_ya_hay_otra_reserva')} («{overlap}»).
                  </p>
                  <button onClick={() => { setOverlap(null); handleSave(true) }}
                    className="w-full rounded-lg bg-amber/20 border border-amber/30 py-2 text-xs font-semibold text-amber hover:bg-amber/30 transition-colors">
                    {t('home_guardar_de_todos_modos')}
                  </button>
                </div>
              )}

              <button onClick={() => handleSave()} disabled={!isValid || saving || (!!startTime && !!endTime && endTime <= startTime)}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-4 border border-lime bg-lime/10 text-lime font-semibold text-sm hover:bg-lime/20 transition active:scale-[0.99] disabled:opacity-60"
                style={{ boxShadow: 'var(--shadow-lime)' }}>
                <CalendarClock size={17} strokeWidth={2.2} />
                {saving ? t('home_guardando') : editId ? t('home_guardar_cambios') : t('home_guardar_reserva')}
              </button>

              {editId && onCancelBooking && (
                <button onClick={onCancelBooking}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 border border-rose/30 text-rose font-semibold text-sm hover:bg-rose/20 transition-colors">
                  <Trash2 size={15} /> {t('home_cancelar_reserva')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </FlowScreen>
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
  resource_name: string | null
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
  homeSections?: HomeSections
  todayBirthdays: BirthdayMember[]
  todayBookings: TodayBooking[]
  selectedDate: string
  todayStr: string
  allMembers: MemberData[]
}

/** Grupo de opciones (pills verticales) dentro del desplegable de filtros */
function FilterGroup({ title, value, onChange, options }: {
  title: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">{title}</p>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            value === opt.value ? 'bg-iris/10 text-iris' : 'text-fog hover:bg-surface2 hover:text-snow'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function StackedBar({ x, y, width, height, fill, roundTop }: {
  x?: number; y?: number; width?: number; height?: number; fill?: string; roundTop?: boolean
}) {
  // Barras un 10% más gruesas que el ancho que calcula Recharts, centradas en su posición
  const rawW = width ?? 0
  const _w = rawW * 1.1
  const _x = (x ?? 0) - (_w - rawW) / 2
  const _y = y ?? 0, _h = height ?? 0
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

export default function HomeClient({ todayVisits, monthCount, dateLabel, capacity, homeSections: initialSections, todayBirthdays, todayBookings, selectedDate, todayStr, allMembers }: HomeClientProps) {
  const { t, lang } = useLanguage()
  const { sections: homeSections } = useHomeSections(initialSections)
  // Si Inicio no muestra ni la agenda ni las métricas, la sala se queda sola
  // en la pantalla y puede usar todo el alto disponible
  const salaFullHeight = !homeSections.agenda && !homeSections.metricas
  const router = useRouter()
  const searchParams = useSearchParams()
  const isToday = selectedDate === todayStr

  const localeMap: Record<string, string> = { es: 'es-ES', en: 'en-GB', ca: 'ca-ES', de: 'de-DE' }
  const selectedDateObj = new Date(selectedDate + 'T12:00:00')
  const dayNum = selectedDateObj.getDate()
  const monthAbbrev = selectedDateObj.toLocaleDateString(localeMap[lang], { month: 'short' }).replace(/\.$/, '')

  const [calendarOpen, setCalendarOpen] = useState(false)

  function goToDate(newDate: string) {
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
  // Si se pasó a cobro desde la ventana de salida, volver a mostrarla tras cobrar
  const [returnToCheckoutAfterPay, setReturnToCheckoutAfterPay] = useState<string | null>(null)
  const [executingBooking, setExecutingBooking] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [bookingServices, setBookingServices] = useState<BookingService[]>([])
  const [openChecks, setOpenChecks] = useState<Map<string, OpenCheck>>(new Map())
  const [consumosVisitId, setConsumosVisitId] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [addingProduct, setAddingProduct] = useState<string | null>(null)
  const [importeVisitId, setImporteVisitId] = useState<string | null>(null)
  const [totalVisitId, setTotalVisitId] = useState<string | null>(null)
  const [payingVisit, setPayingVisit] = useState<string | null>(null)
  const [acompVisitId, setAcompVisitId] = useState<string | null>(null)
  const [acompCoTitulares, setAcompCoTitulares] = useState<{ id: string; name: string; selected: boolean }[]>([])
  const [acompChildren, setAcompChildren] = useState<{ id?: string; name: string; birth_date?: string; isGuest?: boolean }[]>([])
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

  // Reloj: solo sirve para volver a pintar cada 30s y que las custodias
  // programadas entren en sala solas. El corte se calcula con Date.now() en el
  // propio render; si se usara este estado, una visita recién creada podía
  // tardar hasta 30s en aparecer en el aforo.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    setTick(1)
    const id = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const persons = (v: TodayVisit) => (v.adults_count ?? 1) + (v.children_count ?? 0)
  // Visitas sin salida: incluye las custodias programadas para más tarde
  const openVisits = todayVisits.filter(v => !v.checked_out_at)
  // En sala AHORA: una custodia con hora de entrada futura aún no ha entrado.
  // Con `tick === 0` (primer render, también el del servidor) no se filtra, para
  // que la hidratación coincida; ya en el cliente se compara con la hora real.
  const activeVisits = tick === 0
    ? openVisits
    : openVisits.filter(v => new Date(v.checked_in_at).getTime() <= Date.now())

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
  const aforoTextColor = aforoPct < 70 ? 'text-lime' : aforoPct <= 90 ? 'text-amber' : 'text-rose'

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
      .select('id, name, description, category, price, deposit_pct, price_per_guest_adult, price_per_guest_child, included_guests, applies_to, reservable, resource_name, tipo, flujo')
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
    const presentChildKeys = new Set(presentEntries.filter(e => !e.is_adult).map(e => childKey(e)))

    // Co-titulares: other members in the same family
    const coTitulares = allMembers
      .filter(m => m.id !== visit.member_id && m.family_id && m.family_id === member?.family_id)
      .map(m => ({ id: m.id, name: m.name, selected: presentAdultNames.has(m.name) }))

    // Children: registered (with check state) + guest children
    const regChildren = registeredChildren.map(c => ({ ...c, isGuest: false }))
    const guestKids = presentEntries
      .filter(e => !e.is_adult && !registeredChildren.some((r: { id?: string; name: string }) => childKey(r) === childKey(e)))
      .map(e => ({ id: e.id, name: e.name, birth_date: e.birth_date, isGuest: true }))

    // If children_present is empty but children_count > 0 (e.g. just executed from booking),
    // pre-select registered children up to children_count so the popup isn't blank
    const noPresenceData = presentEntries.filter(e => !e.is_adult).length === 0
    const selectedChildren = noPresenceData && (visit.children_count ?? 0) > 0
      ? regChildren.slice(0, visit.children_count)
      : [
          ...regChildren.filter((c: { id?: string; name: string }) => presentChildKeys.has(childKey(c))),
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
    if (returnToCheckoutAfterPay === visitId) {
      setReturnToCheckoutAfterPay(null)
      setConfirmCheckout(visitId)
    }
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
    if (error) { alert(`${t('home_no_se_pudo_ejecutar_reserva')}: ${error}`); return }
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
    <Link href="/panel/servicios" className="inline-flex items-center gap-1 rounded-md border border-amber bg-amber/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber hover:bg-amber/20 transition-colors whitespace-nowrap">
      <AlertTriangle size={10} /> {t('home_configura_tarifas')}
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
    birthday: { bar: 'bg-grape', badge: 'text-grape', label: t('home_cumpleanos') },
    custodia: { bar: 'bg-cyan-300', badge: 'text-cyan-300', label: t('home_custodia') },
    other:    { bar: 'bg-lime', badge: 'text-lime', label: t('home_otro') },
  }

  // Group products by category for the picker
  const productsByCategory = products.reduce<Record<string, Product[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  function getProductIcon(p: Product) {
    const n = p.name.toLowerCase()
    if (n.includes('café') || n.includes('cafe')) return Coffee
    if (n.includes('agua') || n.includes('mineral')) return Droplet
    if (n.includes('zumo') || n.includes('naranja') || n.includes('fanta')) return Citrus
    if (n.includes('galleta')) return Cookie
    if (n.includes('gomino') || n.includes('caramel') || n.includes('haribo') || n.includes('kinder')) return Candy
    if (n.includes('bollycao') || n.includes('croissant')) return Croissant
    if (n.includes('patata') || n.includes('chips') || n.includes('lay')) return Popcorn
    const c = p.category.toLowerCase()
    if (c.includes('bebida')) return CupSoda
    if (c.includes('snack')) return Cookie
    return Package
  }

  const consumosVisit = consumosVisitId ? activeVisits.find(v => v.id === consumosVisitId) : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow truncate">{tenantName ?? t('home_mi_establecimiento')}</h1>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Date navigation — esquina superior derecha, junto al nombre */}
          <button
            onClick={() => setCalendarOpen(true)}
            className={`w-10 h-10 rounded-xl overflow-hidden border flex flex-col shrink-0 transition-colors ${
              isToday ? 'border-line hover:border-line2' : 'border-lime'
            }`}
          >
            <span className={`w-full flex-none h-[40%] flex items-center justify-center text-[8px] font-bold text-white uppercase leading-none ${isToday ? 'bg-rose' : 'bg-lime-deep'}`}>
              {monthAbbrev}
            </span>
            {/* `surface` es blanco puro en el tema claro y oscuro en el nocturno:
                la hoja del calendario sigue siendo blanca de día sin deslumbrar de noche */}
            <span className="w-full flex-1 bg-surface flex items-center justify-center text-sm font-bold text-snow leading-none">
              {dayNum}
            </span>
          </button>
          <button
            onClick={() => { setDismissedAlerts(new Set()); setAlertsOpen(true) }}
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${
              totalAlerts > 0 ? 'border-amber/40 bg-amber/10 text-amber hover:bg-amber/20' : 'border-line bg-surface text-fog hover:text-snow hover:bg-surface2'
            }`}
          >
            <Bell size={16} />
            {totalAlerts > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[20px] h-5 bg-rose border-2 border-carbon text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1">
                {totalAlerts}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Calendario para navegar entre fechas */}
      {calendarOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setCalendarOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm mx-4 rounded-3xl border border-line bg-surface flex flex-col"
            style={{ maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-none px-5 pt-4 pb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-snow">{t('home_ir_a_fecha')}</p>
              <button type="button" onClick={() => setCalendarOpen(false)} className="text-mist hover:text-fog p-1">
                <X size={16} />
              </button>
            </div>
            <div className="flex-none px-5 pb-5">
              <MonthCalendarPicker value={selectedDate} onChange={d => { goToDate(d); setCalendarOpen(false) }} />
            </div>
          </div>
        </div>
      )}

      {/* ZONA 2 — En sala ahora (tabla) */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        {/* Stats header */}
        <div className="px-4 pt-4 pb-3 border-b border-line space-y-3">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-2">
                <Users size={13} className="shrink-0" />
                {isToday ? t('home_en_sala_ahora') : t('home_visitas_del_dia')}
              </h2>
            </div>
          </div>

          {/* Aforo bar */}
          {capacity != null && (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className={`font-display text-2xl font-bold leading-none ${aforoTextColor}`}>{activeTotal}</span>
                  <span className="text-xs text-fog">{t('home_de')} {capacity} {t('home_plazas')}</span>
                </div>
                <span className={`text-sm font-bold ${aforoTextColor}`}>{Math.round(aforoPct)}%</span>
              </div>
              <div className="h-[15px] w-full rounded-full bg-line overflow-hidden flex">
                <div className="h-full bg-lime transition-all duration-500 rounded-l-full" style={{ width: `${Math.min(100, (activeAdults / capacity) * 100)}%` }} />
                <div className="h-full bg-cyan-300 transition-all duration-500" style={{ width: `${Math.min(100, (activeChildren / capacity) * 100)}%` }} />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-lime">
                  <span className="w-2 h-2 rounded-full bg-lime shrink-0" />
                  <span className="font-semibold">{activeAdults}</span> {activeAdults !== 1 ? t('home_adultos_lc') : t('home_adulto_lc')}
                </span>
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-2 h-2 rounded-full bg-cyan-300 shrink-0" />
                  <span className="font-semibold">{activeChildren}</span> {activeChildren !== 1 ? t('home_ninos_lc') : t('home_nino_lc')}
                </span>
              </div>
            </div>
          )}
          {capacity == null && (
            <div className="flex gap-4 text-xs">
              <span className="text-fog"><span className="text-snow font-semibold">{activeTotal}</span> {t('home_en_sala_lc')}</span>
              <span className="text-fog"><span className="text-lime font-semibold">{activeAdults}</span> {activeAdults !== 1 ? t('home_adultos_lc') : t('home_adulto_lc')}</span>
              <span className="text-fog"><span className="text-cyan-300 font-semibold">{activeChildren}</span> {activeChildren !== 1 ? t('home_ninos_lc') : t('home_nino_lc')}</span>
            </div>
          )}

          {/* Search + filtros en embudo */}
          <TableFilterBar
            search={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t('home_buscar_nombre_telefono')}
            activeFilterCount={[filterTipo, filterBono, filterSesiones].filter(f => f !== 'all').length}
            filters={
              <>
                <FilterGroup
                  title={t('home_tipo')}
                  value={filterTipo}
                  onChange={setFilterTipo}
                  options={[
                    { value: 'all', label: t('home_todos') },
                    { value: 'libre', label: t('home_libre') },
                    { value: 'birthday', label: t('home_cumpleanos') },
                    { value: 'custodia', label: t('home_custodia') },
                  ]}
                />
                <FilterGroup
                  title={t('home_bono')}
                  value={filterBono}
                  onChange={setFilterBono}
                  options={[
                    { value: 'all', label: t('home_todos') },
                    { value: 'con_bono', label: t('home_con_bono') },
                    { value: 'sin_bono', label: t('home_sin_bono') },
                  ]}
                />
                <FilterGroup
                  title={t('home_sesiones')}
                  value={filterSesiones}
                  onChange={setFilterSesiones}
                  options={[
                    { value: 'all', label: t('home_todas') },
                    { value: 'critical', label: t('home_criticas') },
                    { value: 'low', label: t('home_bajas') },
                    { value: 'ok', label: t('home_ok_sesiones') },
                  ]}
                />
              </>
            }
          />
        </div>

        {/* Empty states */}
        {activeVisits.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-mist">{t('home_sin_personas_en_sala')}</div>
        ) : filteredVisits.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-mist">{t('home_sin_resultados_busqueda')}</div>
        ) : (
          // Sin los otros paneles, la sala deja de limitarse a 60vh y usa todo
          // el alto disponible de la pantalla
          <div className={salaFullHeight ? 'overflow-y-auto' : 'max-h-[60dvh] overflow-y-auto'}>
            {/* ── MOBILE: expandable cards (< md) ──────────────────────── */}
            <div className="xl:hidden px-3 py-3 space-y-2.5">
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
                              aria-label={t('home_registrar_salida')}
                              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-rose bg-rose/10 text-rose hover:brightness-110 active:scale-[0.98] transition-all"
                            >
                              <LogOut size={14} strokeWidth={2.2} />
                            </button>
                          )}
                        </div>

                        {/* Línea 2: stats inline */}
                        <button onClick={() => setDetailVisitId(visit.id)} className="w-full text-left px-3 pb-2.5">
                          <div className="flex items-center gap-1.5 text-xs text-mist">
                            <span className="font-semibold text-snow">{visit.adults_count + numChildren}</span>
                            <span>{t('home_en_sala_lc')}</span>
                            <span className="text-line2">·</span>
                            <span className={`font-semibold ${isLong ? 'text-amber' : 'text-snow'}`}>{fmtElapsed(visit.checked_in_at)}</span>
                            {isLong && <AlertTriangle size={11} className="text-amber" />}
                            <span className="text-line2">·</span>
                            {pricingMissing(visit, imp)
                              ? <span className="font-semibold text-amber">{t('home_configura_tarifas')}</span>
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
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full min-w-[820px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    {([
                      { key: 'Titular', label: t('home_titular') },
                      { key: 'Acomp.', label: t('home_acompanantes') },
                      { key: 'Total', label: t('home_personas_en_sala') },
                      { key: 'Tipo', label: t('home_tipo_de_visita') },
                      { key: 'Bono', label: t('home_bono') },
                      { key: 'Sesiones', label: t('home_sesiones_restantes') },
                      { key: 'Entrada', label: t('home_hora_de_entrada') },
                      { key: 'Tiempo', label: t('home_tiempo_en_sala') },
                      { key: 'Importe', label: t('home_importe_por_tiempo') },
                      { key: 'Consumos', label: t('home_consumos') },
                      { key: 'Total a pagar', label: t('home_total_a_pagar') },
                      { key: 'Salida', label: t('home_salida') },
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
                                        {extraAdults} <span className="text-[10px] font-normal">{extraAdults !== 1 ? t('home_adultos_lc') : t('home_adulto_lc')}</span>
                                      </span>
                                    )}
                                    {extraAdults > 0 && numChildren > 0 && (
                                      <span className="text-mist text-[10px]">·</span>
                                    )}
                                    {numChildren > 0 && (
                                      <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-0.5">
                                        {numChildren} <span className="text-[10px] font-normal">{numChildren !== 1 ? t('home_ninos_lc') : t('home_nino_lc')}</span>
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
                                ? 'text-iris'
                                : tipo === 'Custodia'
                                ? 'text-cyan-300'
                                : 'text-fog'
                              return (
                                <span className={`text-[10px] font-semibold whitespace-nowrap ${cls}`}>
                                  {tipo}
                                </span>
                              )
                            })()}
                          </td>
                          {/* Bono */}
                          <td className="px-3 py-3 align-top">
                            <span className={`text-[10px] font-semibold whitespace-nowrap ${bono ? 'text-iris' : 'text-amber'}`}>
                              {bono ? (visit.memberships?.membership_types?.name ?? t('home_con_bono')) : t('home_sin_bono')}
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
                                onClick={() => { setProductSearch(''); setConsumosVisitId(isShowingConsumos ? null : visit.id) }}
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
                                aria-label={t('home_registrar_salida')}
                                className="flex items-center justify-center text-rose bg-rose/10 border border-rose rounded-lg w-7 h-7 hover:brightness-110 transition-all"
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
          </div>
        )}

      </div>

      {/* ZONA 3 — Agenda de hoy (se puede ocultar desde Configuración) */}
      {homeSections.agenda && (
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-line flex items-center gap-2">
          <CalendarClock size={13} className="text-fog" />
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide">{t('home_agenda_de_hoy')}</h2>
          <span className="text-[11px] text-mist">{todayBookings.length} {todayBookings.length !== 1 ? t('home_reservas_lc') : t('home_reserva_lc')}</span>
          {homeSections.nuevaReserva && (
            <button
              onClick={() => { setBookingModal('pick'); setBookingQuery('') }}
              className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-iris bg-iris/10 border border-iris rounded-lg px-2.5 py-1.5 hover:bg-iris/20 transition-all"
            >
              <CalendarPlus size={13} /> {t('home_nueva_reserva')}
            </button>
          )}
        </div>

        {timeline.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-mist">{t('home_sin_reservas_hoy')}</div>
        ) : (
          <div className="px-4 py-4 space-y-4 max-h-[60dvh] overflow-y-auto">
            {timeline.map(b => {
              const status = getBookingStatus(b)
              const style = bookingTypeStyle[b.type]
              const canExecute = status === 'pendiente' || status === 'en_curso'
              const dur = bookingDurationLabel(b.start_time, b.end_time, t)
              const pendiente = Math.max(0, (b.amount ?? 0) - (b.deposit_amount ?? 0))
              const showPago = b.amount != null && b.amount > 0
              return (
                <div key={b.id} className={`flex items-stretch gap-3 ${status === 'pasado' ? 'opacity-50' : ''}`}>
                  {/* Hora + duración */}
                  <div className="w-16 shrink-0 pt-0.5">
                    <p className="text-xs text-snow leading-tight">{b.start_time?.slice(0, 5) ?? '—'}</p>
                    {dur && <p className="text-xs text-mist leading-tight mt-0.5">{dur}</p>}
                  </div>

                  {/* Barra de color */}
                  <span
                    className="w-1 rounded-full shrink-0"
                    style={bookingBarStyle(b.status, BOOKING_TYPE_COLOR_VAR[b.type])}
                  />

                  {/* Contenido */}
                  <button onClick={() => setSelectedBooking(b)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-snow">{b.title}</p>
                      <span className={`text-xs font-semibold ${style.badge}`}>{style.label}</span>
                      {status === 'ejecutado' && (
                        <span className="text-xs font-semibold text-mint flex items-center gap-0.5">
                          <Check size={10} />{t('home_ejecutado')}
                        </span>
                      )}
                      {status === 'en_curso' && (
                        <span className="text-xs font-semibold text-lime flex items-center gap-0.5">
                          <Clock size={10} />{t('home_en_curso')}
                        </span>
                      )}
                      {showPago && (
                        <span className={`text-xs font-semibold ${b.payment_status === 'paid' ? 'text-mint' : b.payment_status === 'partial' ? 'text-cyan-300' : 'text-amber'}`}>
                          {b.payment_status === 'paid' ? t('home_pagado') : b.payment_status === 'partial' ? t('home_adelanto') : t('home_pendiente')}
                          {b.payment_status !== 'paid' && pendiente > 0 ? ` · ${pendiente.toFixed(0)}€` : ''}
                        </span>
                      )}
                    </div>
                    {b.members?.name && <p className="text-xs text-fog mt-0.5">{b.members.name}</p>}
                    {(() => {
                      const gA = b.guest_adults ?? 0
                      const gC = b.guest_children ?? 0
                      const totalG = bookingGuestCount(b)
                      if (totalG <= 0 && gA === 0 && gC === 0) return null
                      if (b.type === 'custodia') {
                        return <p className="text-xs text-mist mt-0.5">{totalG} {totalG !== 1 ? t('home_ninos_lc') : t('home_nino_lc')}</p>
                      }
                      return (
                        <p className="text-xs text-mist mt-0.5">
                          {totalG} {totalG !== 1 ? t('home_invitados_lc') : t('home_invitado_lc')}
                          {(gA > 0 || gC > 0) && <span> · {gA} {gA !== 1 ? t('home_adultos_lc') : t('home_adulto_lc')}, {gC} {gC !== 1 ? t('home_ninos_lc') : t('home_nino_lc')}</span>}
                        </p>
                      )
                    })()}
                  </button>

                  {isToday && canExecute && (
                    <button
                      onClick={e => { e.stopPropagation(); handleExecuteBooking(b) }}
                      disabled={executingBooking === b.id}
                      className="flex items-center gap-1 self-start text-xs font-semibold text-lime border border-lime bg-lime/10 rounded-lg px-2 py-1 shrink-0 hover:bg-lime/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Play size={11} fill="currentColor" />
                      {executingBooking === b.id ? '...' : t('home_ejecutar')}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}

      {/* ZONA 4 — Métricas del día (se puede ocultar desde Configuración) */}
      {homeSections.metricas && (<>
      <div className="flex items-center gap-2 px-1">
        <BarChart2 size={13} className="text-fog" />
        <span className="text-xs font-semibold text-fog uppercase tracking-wide">{t('home_metricas_del_dia')}</span>
        <span className="text-[11px] text-mist">{monthCount} {t('home_visitas_este_mes')}</span>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Aforo por hora */}
        <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
                    <BarChart2 size={13} /> {t('home_aforo_por_hora')}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-fog">
                      <span className="w-2 h-2 rounded-full bg-iris shrink-0" /> {t('home_alcanzado')}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-fog">
                      <span className="w-2 h-2 rounded-full bg-amber shrink-0" /> {t('home_reservado')}
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-line)" strokeDasharray="0" vertical={false} />
                    <XAxis dataKey="hour" tick={({ x, y, payload }: any) => (
                      <text x={x} y={y + 10} textAnchor="middle"
                        fontSize={payload.value === currentHourLabel ? 13 : 10}
                        fill={payload.value === currentHourLabel ? 'var(--color-lime)' : 'var(--color-mist)'}
                        fontWeight={payload.value === currentHourLabel ? 700 : 400}>
                        {payload.value}
                      </text>
                    )} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--color-mist)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--color-surface2)' }}
                      content={({ active, label }: any) => {
                        if (!active) return null
                        const entry = chartData.find(d => d.hour === label)
                        if (!entry) return null
                        return (
                          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, padding: '10px 14px', fontSize: 11 }}>
                            <p style={{ color: 'var(--color-mist)', marginBottom: 6 }}>{label}</p>
                            {entry.alcanzado != null ? (
                              <>
                                <p style={{ color: 'var(--color-iris)', fontWeight: 600 }}>{t('home_alcanzado')}: {entry.alcanzado}</p>
                                <p style={{ color: 'var(--color-mist)', marginTop: 4 }}>{entry.adultos} {t('home_adultos_lc')} · {entry.ninos} {t('home_ninos_lc')}</p>
                              </>
                            ) : entry.reservado != null ? (
                              <>
                                <p style={{ color: 'var(--color-amber)', fontWeight: 600 }}>{t('home_reservado')}: {entry.reservado}</p>
                                {entry.planBirthday ? <p style={{ color: 'var(--color-mist)', marginTop: 4 }}>{t('home_cumpleanos')}: {entry.planBirthday}</p> : null}
                                {entry.planCustodia ? <p style={{ color: 'var(--color-mist)', marginTop: 2 }}>{t('home_custodias')}: {entry.planCustodia}</p> : null}
                                {entry.planOther    ? <p style={{ color: 'var(--color-mist)', marginTop: 2 }}>{t('home_otros')}: {entry.planOther}</p> : null}
                              </>
                            ) : (
                              <p style={{ color: 'var(--color-mist)' }}>{t('home_sin_datos')}</p>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="alcanzado" stackId="a" fill="var(--color-iris)"
                      shape={(p: any) => <StackedBar {...p} roundTop={!p.reservado} />}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill="var(--color-iris)" fillOpacity={i + 7 === currentHour ? 1 : 0.6} />
                      ))}
                      <LabelList dataKey="_alcanzadoLabel" position="top" style={{ fill: 'var(--color-mist)', fontSize: 9, fontWeight: 600 }} />
                    </Bar>
                    <Bar dataKey="reservado" stackId="a" fill="var(--color-amber)"
                      shape={(p: any) => <StackedBar {...p} roundTop />}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill="var(--color-amber)" fillOpacity={i + 7 === currentHour ? 1 : 0.6} />
                      ))}
                      <LabelList dataKey="_reservadoLabel" position="top" style={{ fill: 'var(--color-mist)', fontSize: 9, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
        </div>

        {/* Afluencia bono/sin bono */}
        <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
                    <Activity size={13} /> {t('home_afluencia_por_hora')}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-fog">
                      <span className="w-2 h-2 rounded-full bg-iris shrink-0" /> {t('home_con_bono')}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-fog">
                      <span className="w-2 h-2 rounded-full bg-amber shrink-0" /> {t('home_sin_bono')}
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 0, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-line)" strokeDasharray="0" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fill: 'var(--color-mist)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--color-mist)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: '12px' }}
                      labelStyle={{ color: 'var(--color-mist)', fontSize: 11 }}
                      itemStyle={{ color: 'var(--color-snow)', fontSize: 11 }}
                      cursor={{ stroke: 'var(--color-line)' }}
                    />
                    <Line type="monotone" dataKey="conBono" name={t('home_con_bono')} stroke="var(--color-iris)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="sinBono" name={t('home_sin_bono')} stroke="var(--color-amber)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
        </div>
      </div>
      </>)}

      {/* Botón flotante de registrar entrada (solo icono) */}
      {isToday && (
        <button
          onClick={() => { setCheckinModal('search'); setCheckinQuery('') }}
          aria-label={t('home_registrar_entrada')}
          title={t('home_registrar_entrada')}
          className="fixed bottom-above-nav right-4 lg:right-8 z-30 w-14 h-14 rounded-full bg-lime text-white flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
        >
          <LogIn size={22} />
        </button>
      )}

      {/* Modal de alertas */}
      {alertsOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-end p-4 pt-16 sm:pt-4" onClick={() => setAlertsOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl border border-amber/30 bg-surface shadow-2xl flex flex-col max-h-[80dvh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-amber" />
                <span className="text-sm font-semibold text-snow">{t('home_alertas_activas')}</span>
                <span className="text-[10px] font-bold bg-rose border-2 border-surface text-white px-1.5 py-0.5 rounded-full">{totalAlerts - dismissedAlerts.size}</span>
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
                          <p className="text-[11px] text-fog">{t('home_lleva')} {fmtElapsed(v.checked_in_at)} {t('home_en_sala_lc')}</p>
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
                        className="flex items-center gap-1 text-[10px] font-medium text-rose bg-rose/10 border border-rose rounded-lg px-2 py-1 hover:brightness-110 transition-all shrink-0"
                      >
                        <LogOut size={10} /> {t('home_salida')}
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
                          <p className="text-[11px] text-fog">{t('home_empieza_a_las')} {b.start_time?.slice(0, 5)}</p>
                        </div>
                      </div>
                      <button onClick={() => setDismissedAlerts(prev => new Set([...prev, 'bday-' + b.id]))} className="text-mist hover:text-fog transition-colors p-1 shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-iris border-2 border-surface text-white">{t('home_cumpleanos')}</span>
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
                          <p className="text-[11px] text-fog">{t('home_custodia_termina_a_las')} {b.end_time?.slice(0, 5)}</p>
                        </div>
                      </div>
                      <button onClick={() => setDismissedAlerts(prev => new Set([...prev, 'cust-' + b.id]))} className="text-mist hover:text-fog transition-colors p-1 shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-cyan-300 border-2 border-surface text-white">{t('home_custodia')}</span>
                      {grandTotal !== null && <span className="text-xs font-bold text-lime">{grandTotal.toFixed(2)}€</span>}
                    </div>
                  </div>
                )
              })}
              {totalAlerts - dismissedAlerts.size === 0 && (
                <p className="text-xs text-mist text-center py-4">{t('home_todas_las_alertas_cerradas')}</p>
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
        const closeTotalModal = () => {
          setTotalVisitId(null)
          if (returnToCheckoutAfterPay === visit.id) {
            setReturnToCheckoutAfterPay(null)
            setConfirmCheckout(visit.id)
          }
        }
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={closeTotalModal}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-sm rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[90dvh]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
                <div className="flex items-center gap-2">
                  <Receipt size={15} className="text-lime shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-snow">{visit.members?.name ?? '—'}</p>
                    <p className="text-[11px] text-fog">{t('home_total_a_pagar')}</p>
                  </div>
                </div>
                <button onClick={closeTotalModal} className="text-fog hover:text-snow transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                {/* Sección paquete de reserva (cumpleaños/custodia/otro con importe) */}
                {imp.isPackage ? (
                  <div>
                    <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">{t('home_reserva')}</p>
                    <div className="space-y-1.5">
                      {imp.pkg?.live && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-fog">
                              {t('home_paquete_base')}
                              {imp.pkg.included > 0 && <span className="text-mist"> ({t('home_incluye_lc')} {imp.pkg.included})</span>}
                            </span>
                            <span className="text-snow">{imp.pkg.base.toFixed(2)}€</span>
                          </div>
                          <div className="flex justify-between text-xs text-mist">
                            <span>{t('home_presentes')}: {imp.pkg.presentA + imp.pkg.presentC}
                              {(imp.pkg.presentA + imp.pkg.presentC) !== (imp.pkg.contractedA + imp.pkg.contractedC) &&
                                ` (${t('home_contratados_lc')} ${imp.pkg.contractedA + imp.pkg.contractedC})`}
                            </span>
                          </div>
                          {imp.pkg.chargeA > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-fog">{imp.pkg.chargeA} {imp.pkg.chargeA !== 1 ? t('home_adultos_lc') : t('home_adulto_lc')} {t('home_extra_lc')} × {imp.pkg.rateA.toFixed(2)}€</span>
                              <span className="text-snow">{(imp.pkg.chargeA * imp.pkg.rateA).toFixed(2)}€</span>
                            </div>
                          )}
                          {imp.pkg.chargeC > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-fog">{imp.pkg.chargeC} {imp.pkg.chargeC !== 1 ? t('home_ninos_lc') : t('home_nino_lc')} {t('home_extra_lc')} × {imp.pkg.rateC.toFixed(2)}€</span>
                              <span className="text-snow">{(imp.pkg.chargeC * imp.pkg.rateC).toFixed(2)}€</span>
                            </div>
                          )}
                          {imp.pkg.chargeA === 0 && imp.pkg.chargeC === 0 && (
                            <div className="flex justify-between text-xs text-mint">
                              <span>{t('home_sin_invitados_extra')}</span>
                            </div>
                          )}
                        </>
                      )}
                      {(visit.bookings?.addons ?? []).length > 0 && (
                        <div className="pt-1 border-t border-line/60 space-y-1.5">
                          <p className="text-[10px] text-mist">{t('home_sub_servicios')}</p>
                          {(visit.bookings?.addons ?? []).map((a, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-fog">+ {a.name}</span>
                              <span className="text-snow">{(Number(a.price) || 0).toFixed(2)}€</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-semibold pt-1 border-t border-line">
                        <span className="text-fog">{t('home_total_del_paquete')}</span>
                        <span className="text-snow">{imp.total.toFixed(2)}€</span>
                      </div>
                      {imp.deposit > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-fog">{t('home_adelanto_pagado')}</span>
                          <span className="text-mint">−{imp.deposit.toFixed(2)}€</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-semibold pt-1 border-t border-line">
                        <span className="text-fog">{t('home_pendiente_reserva')}</span>
                        <span className="text-lime">{imp.toPay.toFixed(2)}€</span>
                      </div>
                    </div>
                  </div>
                ) : (
                <div>
                  <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">{t('home_importe_por_tiempo')}</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-fog">
                      <span>{t('home_tiempo_en_sala')}</span><span className="text-snow">{fmtH(elapsedMins)}</span>
                    </div>
                    {visit.adults_count > 0 && imp.titular > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-fog">{visit.adults_count} {visit.adults_count !== 1 ? t('home_adultos_lc') : t('home_adulto_lc')} × {hourRate}€/h × {hours.toFixed(2)}h</span>
                        <span className="text-snow">{imp.titular.toFixed(2)}€</span>
                      </div>
                    )}
                    {visit.children_count > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-fog">{visit.children_count} {visit.children_count !== 1 ? t('home_ninos_lc') : t('home_nino_lc')} × {childRate}€/h × {hours.toFixed(2)}h</span>
                        <span className="text-snow">{imp.ninos.toFixed(2)}€</span>
                      </div>
                    )}
                    {imp.bonoPrecioSesion !== null && mt && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-fog line-through">{t('home_subtotal_regular')}</span>
                          <span className="text-mist line-through">{imp.regular.toFixed(2)}€</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-iris">{mt.name} ({mt.price}€ ÷ {mt.sessions} ses.)</span>
                          <span className="text-iris font-semibold">{imp.bonoPrecioSesion.toFixed(2)}€</span>
                        </div>
                        {imp.ahorro > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-fog">{t('home_ahorro_aplicado')}</span>
                            <span className="text-mint">−{imp.ahorro.toFixed(2)}€</span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex justify-between text-xs font-semibold pt-1 border-t border-line">
                      <span className="text-fog">{t('home_subtotal_tiempo')}</span>
                      <span className="text-lime">{imp.total.toFixed(2)}€</span>
                    </div>
                  </div>
                </div>
                )}

                {/* Sección consumos */}
                <div>
                  <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">{t('home_consumos')}</p>
                  {grouped.length === 0 ? (
                    <p className="text-xs text-mist">{t('home_sin_consumos')}</p>
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
                        <span className="text-fog">{t('home_subtotal_consumos')}</span>
                        <span className="text-lime">{consumosTotal.toFixed(2)}€</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Total + cobro */}
              <div className="px-5 py-4 border-t border-line shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-snow">{t('home_total_a_pagar')}</span>
                  {pricingMissing(visit, imp)
                    ? <span className="text-sm font-semibold text-amber">{t('home_sin_tarifas')}</span>
                    : <span className="text-2xl font-bold text-lime">{grandTotal.toFixed(2)}€</span>}
                </div>
                {pricingMissing(visit, imp) ? (
                  <Link href="/panel/servicios" onClick={() => setTotalVisitId(null)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-amber bg-amber/10 py-3 text-sm font-semibold text-amber hover:bg-amber/20 transition-colors">
                    <AlertTriangle size={15} /> {t('home_configura_tarifas_para_cobrar')}
                  </Link>
                ) : visit.paid_at ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-mint/10 border border-mint/20 py-2.5 text-sm font-semibold text-mint">
                    <Check size={15} /> {t('home_cobrado')}
                    {visit.paid_amount != null && <span className="text-mint/80">· {visit.paid_amount.toFixed(2)}€</span>}
                    {visit.payment_method && <span className="text-mint/60 capitalize">· {visit.payment_method}</span>}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handlePayVisit(totalVisitId, grandTotal, 'efectivo')}
                      disabled={payingVisit === totalVisitId}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-lime bg-lime/10 py-3 text-sm font-semibold text-lime hover:bg-lime/20 transition-colors disabled:opacity-50"
                    >
                      <Euro size={15} /> {t('home_efectivo')}
                    </button>
                    <button
                      onClick={() => handlePayVisit(totalVisitId, grandTotal, 'tarjeta')}
                      disabled={payingVisit === totalVisitId}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-lime bg-lime/10 py-3 text-sm font-semibold text-lime hover:bg-lime/20 transition-colors disabled:opacity-50"
                    >
                      <CreditCard size={15} /> {t('home_tarjeta')}
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
                    <p className="text-[11px] text-fog">{t('home_confirmar_salida')}</p>
                  </div>
                </div>
                <button onClick={() => setConfirmCheckout(null)} className="text-fog hover:text-snow transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-fog">
                  {t('home_registrar_salida_de')} <span className="font-semibold text-snow">{visit.members?.name ?? '—'}</span>?
                </p>
                {check && check.items.length > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-amber/10 border border-amber/30 px-3 py-2.5">
                    <ShoppingCart size={13} className="text-amber shrink-0" />
                    <p className="text-xs text-amber">
                      {t('home_hay')} {check.items.length} {check.items.length !== 1 ? t('home_consumos_abiertos_lc') : t('home_consumo_abierto_lc')} {t('home_por')} <span className="font-bold text-lime">{check.items.reduce((s, i) => s + i.unit_price * i.quantity, 0).toFixed(2)}€</span> — {t('home_se_cerraran_al_salir')}.
                    </p>
                  </div>
                )}
                {!visit.paid_at && (
                  <button
                    onClick={() => { setConfirmCheckout(null); setReturnToCheckoutAfterPay(visit.id); setTotalVisitId(visit.id) }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl bg-amber/10 border border-amber/30 px-3 py-2.5 hover:bg-amber/15 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs text-amber">
                      <Euro size={13} className="shrink-0" /> {t('home_aun_sin_cobrar')}
                    </span>
                    <ChevronRight size={14} className="text-amber shrink-0" />
                  </button>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setConfirmCheckout(null)}
                    className="flex-1 text-sm font-medium text-fog bg-surface2 border border-line rounded-xl py-2.5 hover:text-snow transition-colors"
                  >
                    {t('home_cancelar')}
                  </button>
                  <button
                    onClick={() => handleCheckout(visit.id)}
                    disabled={checkingOut === visit.id}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-rose bg-rose/10 border border-rose rounded-xl py-2.5 hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    <LogOut size={14} />
                    {checkingOut === visit.id ? t('home_registrando') : t('home_confirmar_salida')}
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
        const selectedNames = new Set(acompChildren.filter(c => !c.isGuest).map(c => childKey(c)))
        // Nombres presentes en OTRA visita abierta: no se pueden añadir aquí
        const inside = namesAlreadyInside(activeVisits, visit.id)

        function toggleChild(child: { id?: string; name: string; birth_date?: string }) {
          setAcompChildren(prev => {
            const exists = prev.some(c => !c.isGuest && childKey(c) === childKey(child))
            if (exists) return prev.filter(c => c.isGuest || childKey(c) !== childKey(child))
            return [...prev, { ...child, isGuest: false }]
          })
        }

        const coTitSelected = acompCoTitulares.filter(c => c.selected).length
        const totalAcomp = coTitSelected + acompGuestAdults + acompChildren.length + acompGuestChildren

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => closeAndReturn(() => setAcompVisitId(null))}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-md rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[90dvh]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-iris shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-snow">{visit.members?.name ?? '—'}</p>
                    <p className="text-[11px] text-fog">{totalAcomp} {totalAcomp !== 1 ? t('home_acompanantes_lc') : t('home_acompanante_lc')}</p>
                  </div>
                </div>
                <button onClick={() => closeAndReturn(() => setAcompVisitId(null))} className="text-fog hover:text-snow transition-colors p-1">
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
                {/* Titular */}
                <div>
                  <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">{t('home_titular')}</p>
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
                    <span className="text-[11px] text-iris font-medium">{t('home_titular')}</span>
                  </button>
                </div>

                {/* Co-titulares */}
                {acompCoTitulares.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">{t('home_co_titulares')}</p>
                    <div className="space-y-1.5">
                      {acompCoTitulares.map(cot => {
                        const busy = inside.adults.has(cot.name)
                        return (
                        <button key={cot.id} disabled={busy}
                          title={busy ? t('home_ya_en_sala') : undefined}
                          onClick={() => setAcompCoTitulares(prev => prev.map(c => c.id === cot.id ? { ...c, selected: !c.selected } : c))}
                          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors text-left ${
                            busy ? 'bg-surface2 border-line opacity-50 cursor-not-allowed'
                            : cot.selected ? 'bg-iris/10 border-iris/40' : 'bg-surface2 border-line hover:border-line2'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            cot.selected && !busy ? 'bg-iris border-iris' : 'border-line2'
                          }`}>
                            {cot.selected && !busy && <Check size={10} className="text-white" strokeWidth={3} />}
                          </span>
                          <span className="text-xs font-medium text-snow flex-1">{cot.name}</span>
                          <span className={`text-[11px] font-medium ${busy ? 'text-mist' : 'text-iris'}`}>{busy ? t('home_ya_en_sala') : t('home_co_titular')}</span>
                        </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Hijos registrados */}
                {registeredChildren.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">{t('home_hijos_registrados')}</p>
                    <div className="space-y-1.5">
                      {registeredChildren.map((child, i) => {
                        const checked = selectedNames.has(childKey(child))
                        const busy = inside.children.has(childKey(child))
                        const age = fmtChildAge(child.birth_date, child.age)
                        return (
                          <button key={i} onClick={() => toggleChild(child)} disabled={busy}
                            title={busy ? t('home_ya_en_sala') : undefined}
                            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors text-left ${
                              busy ? 'bg-surface2 border-line opacity-50 cursor-not-allowed'
                              : checked ? 'bg-iris/10 border-iris/40' : 'bg-surface2 border-line hover:border-iris/30'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                              checked && !busy ? 'bg-iris border-iris' : 'border-line2'
                            }`}>
                              {checked && !busy && <Check size={10} className="text-ink" strokeWidth={3} />}
                            </span>
                            <span className="text-xs font-medium text-snow flex-1">{child.name}</span>
                            {busy
                              ? <span className="text-[11px] text-mist">{t('home_ya_en_sala')}</span>
                              : age && <span className="text-[11px] text-fog">{age}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Invitados */}
                <div>
                  <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">{t('home_invitados')}</p>
                  <div className="space-y-2">
                    {/* Adultos invitados */}
                    <div className="flex items-center justify-between rounded-xl bg-surface2 border border-line px-3 py-2.5">
                      <span className="text-xs text-snow">{t('home_adultos_invitados')}</span>
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
                        <span className="text-[10px] text-cyan-300 font-medium">{t('home_nino_invitado')}</span>
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
                      <span className="text-xs text-snow">{t('home_ninos_invitados_adicionales')}</span>
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
                <span className="text-[11px] text-mist">{totalAcomp} {totalAcomp !== 1 ? t('home_acompanantes_lc') : t('home_acompanante_lc')}</span>
                <span className={`text-[11px] flex items-center gap-1 transition-opacity ${savingAcomp || savedAcomp ? 'opacity-100' : 'opacity-0'}`}>
                  {savingAcomp
                    ? <span className="text-fog">{t('home_guardando')}</span>
                    : <span className="text-mint flex items-center gap-1"><Check size={11} /> {t('home_guardado')}</span>
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
                    <p className="text-[11px] text-fog">{t('home_desglose_del_importe')}</p>
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
                  <span>{t('home_entrada')}</span><span className="text-snow font-medium">{fmtTime(visit.checked_in_at)}</span>
                </div>
                <div className="flex justify-between text-sm text-fog">
                  <span>{t('home_tiempo_en_sala')}</span><span className="text-snow font-medium">{fmtH(elapsedMins)}</span>
                </div>
                <div className="flex justify-between text-sm text-fog">
                  <span>{t('home_tipo_de_visita')}</span><span className="text-snow font-medium">{fmtVisitType(visit)}</span>
                </div>

                {/* Paquete de reserva */}
                {imp.isPackage && (
                  <div className="border-t border-line pt-3 space-y-2">
                    <p className="text-xs font-semibold text-mist uppercase tracking-wide">{t('home_reserva')}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-fog">{t('home_total_del_paquete')}</span>
                      <span className="text-snow font-medium">{imp.total.toFixed(2)}€</span>
                    </div>
                    {imp.deposit > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-fog">{t('home_adelanto_pagado')}</span>
                        <span className="text-mint font-medium">−{imp.deposit.toFixed(2)}€</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tarifa sin bono */}
                {!imp.isPackage && (
                <div className="border-t border-line pt-3 space-y-2">
                  <p className="text-xs font-semibold text-mist uppercase tracking-wide">{t('home_tarifa_regular')}</p>
                  {visit.adults_count > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-fog">{visit.adults_count} {visit.adults_count !== 1 ? t('home_adultos_lc') : t('home_adulto_lc')} × {hourRate}€/h × {hours.toFixed(2)}h</span>
                      <span className="text-snow font-medium">{imp.titular.toFixed(2)}€</span>
                    </div>
                  )}
                  {visit.children_count > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-fog">{visit.children_count} {visit.children_count !== 1 ? t('home_ninos_lc') : t('home_nino_lc')} × {childRate}€/h × {hours.toFixed(2)}h</span>
                      <span className="text-snow font-medium">{imp.ninos.toFixed(2)}€</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-fog">{t('home_subtotal_regular')}</span>
                    <span className={imp.bonoPrecioSesion !== null ? 'text-mist line-through' : 'text-lime'}>{imp.regular.toFixed(2)}€</span>
                  </div>
                </div>
                )}

                {/* Descuento bono */}
                {!imp.isPackage && imp.bonoPrecioSesion !== null && mt && (
                  <div className="border-t border-line pt-3 space-y-2">
                    <p className="text-xs font-semibold text-iris uppercase tracking-wide">{mt.name}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-fog">{t('home_precio_por_sesion')} ({mt.price}€ ÷ {mt.sessions} {t('home_ses_abrev')})</span>
                      <span className="text-iris font-medium">{imp.bonoPrecioSesion.toFixed(2)}€</span>
                    </div>
                    {imp.ahorro > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-fog">{t('home_ahorro_aplicado')}</span>
                        <span className="text-mint font-medium">−{imp.ahorro.toFixed(2)}€</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Total */}
                <div className="border-t border-line pt-4 flex justify-between items-center">
                  <span className="text-base font-bold text-snow">{imp.isPackage ? t('home_pendiente_a_cobrar') : t('home_total_a_cobrar')}</span>
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
            <div className="relative w-full sm:max-w-sm rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[85dvh]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Users size={13} className="text-fog shrink-0" />
                    <p className="text-xs font-semibold text-fog uppercase tracking-wide">{t('home_ahora_en_sala')}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-bold text-snow truncate">{titularName}</p>
                    <span className={`text-[10px] font-semibold shrink-0 ${tipo === 'Cumpleaños' ? 'text-iris' : tipo === 'Custodia' ? 'text-cyan-300' : 'text-fog'}`}>{tipo}</span>
                    {isLong && <span className="text-[10px] font-semibold text-amber shrink-0">⚠ {t('home_larga')}</span>}
                  </div>
                  <p className="text-xs text-fog mt-0.5">{t('home_entrada')} {fmtTime(visit.checked_in_at)} · <span className={isLong ? 'text-amber font-semibold' : 'text-snow'}>{fmtElapsed(visit.checked_in_at)}</span></p>
                </div>
                <button onClick={() => setDetailVisitId(null)} aria-label={t('home_cerrar')} className="text-fog hover:text-snow transition-colors p-1 shrink-0 ml-2"><X size={16} /></button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                {/* Personas: 2 líneas compactas */}
                <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 space-y-2.5">
                  {/* Adultos */}
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="text-xs text-fog shrink-0 w-14">{t('home_adultos')}</span>
                    <span className="text-lg font-bold text-lime leading-none shrink-0">{visit.adults_count}</span>
                    <ScrollingName text={adultNamesStr} suffix={adultSuffix} suffixClass="text-mist" />
                  </div>
                  {/* Niños */}
                  {numChildren > 0 && (
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className="text-xs text-fog shrink-0 w-14">{t('home_ninos')}</span>
                      <span className="text-lg font-bold text-cyan-300 leading-none shrink-0">{numChildren}</span>
                      <ScrollingName text={childNamesStr} suffix={childSuffix} suffixClass="text-mist" />
                    </div>
                  )}
                </div>

                {/* Bono */}
                <div className={`rounded-xl border px-4 py-3 space-y-1.5 ${bono ? 'border-iris/20 bg-iris/5' : 'border-amber/20 bg-amber/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-fog uppercase tracking-wide">{t('home_bono')}</span>
                      <span className={`text-sm font-bold ${bono ? 'text-iris' : 'text-amber'}`}>
                        {bono ? (bonoName ?? t('home_con_bono')) : t('home_sin_bono')}
                      </span>
                    </div>
                    {bono && !bonoIsUnlimited && bonoSessions != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-fog">{t('home_sesiones_restantes')}</span>
                        <span className={`text-sm font-bold ${bonoSessionColor}`}>{bonoSessions}</span>
                      </div>
                    )}
                    {bono && bonoIsUnlimited && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-fog">{t('home_sesiones')}</span>
                        <span className="text-sm font-bold text-iris">∞ {t('home_ilimitado')}</span>
                      </div>
                    )}
                </div>

                {/* Acciones */}
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => { returnToDetailRef.current = detailVisitId; setDetailVisitId(null); setImporteVisitId(detailVisitId) }}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl border border-line bg-surface2 hover:border-lime/40 transition-colors">
                    <Receipt size={15} className="text-lime" />
                    <span className="text-xs font-semibold text-lime">{imp.total.toFixed(2)}€</span>
                    <span className="text-[10px] text-mist">{t('home_importe')}</span>
                  </button>
                  <button onClick={() => { returnToDetailRef.current = detailVisitId; setDetailVisitId(null); setProductSearch(''); setConsumosVisitId(detailVisitId) }}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl border border-line bg-surface2 hover:border-iris/40 transition-colors">
                    <Store size={15} className="text-fog" />
                    <span className={`text-xs font-semibold ${consumosTotal > 0 ? 'text-lime' : 'text-mist'}`}>
                      {consumosTotal > 0 ? `${consumosTotal.toFixed(2)}€` : '—'}
                    </span>
                    <span className="text-[10px] text-mist">{t('home_consumos')}</span>
                  </button>
                  <button onClick={() => { returnToDetailRef.current = detailVisitId; setDetailVisitId(null); openAcompPopup(visit) }}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl border border-line bg-surface2 hover:border-iris/40 transition-colors">
                    <UserPlus size={15} className="text-fog" />
                    <span className="text-xs font-semibold text-mist">
                      {Math.max(0, visit.adults_count - 1) + numChildren}
                    </span>
                    <span className="text-[10px] text-mist">{t('home_acomp_abrev')}</span>
                  </button>
                </div>

                {/* Total + checkout */}
                {pricingMissing(visit, imp) ? (
                  <Link href="/panel/servicios" onClick={() => setDetailVisitId(null)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-amber bg-amber/10 text-sm font-semibold text-amber hover:bg-amber/20 transition-colors">
                    <AlertTriangle size={14} /> {t('home_configura_tarifas_para_cobrar')}
                  </Link>
                ) : (
                  <button onClick={() => { setDetailVisitId(null); setTotalVisitId(detailVisitId) }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-lime/5 border border-lime/20 hover:bg-lime/20 transition-colors">
                    <span className="text-sm font-semibold text-fog">{t('home_total_a_pagar')}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-bold text-lime">{grandTotal.toFixed(2)}€</span>
                      <Receipt size={13} className="text-lime/60" />
                    </div>
                  </button>
                )}

                {isToday && (
                  <button onClick={() => { setDetailVisitId(null); setConfirmCheckout(detailVisitId) }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 border border-rose bg-rose/10 text-rose font-semibold text-sm hover:brightness-110 transition active:scale-[0.99]">
                    <LogOut size={16} strokeWidth={2.2} />
                    {t('home_registrar_salida')}
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
          ejecutado: { label: t('home_ejecutado'), cls: 'text-mint' },
          en_curso:  { label: t('home_en_curso'),  cls: 'text-lime' },
          pendiente: { label: t('home_pendiente'), cls: 'text-fog' },
          pasado:    { label: t('home_pasado'),    cls: 'text-mist' },
        }
        const st = statusLabels[status]
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-sm rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[85dvh]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarClock size={13} className="text-fog shrink-0" />
                    <p className="text-xs font-semibold text-fog uppercase tracking-wide">{t('home_reserva')}</p>
                  </div>
                  <FitText className="font-bold text-snow leading-tight" min={13} max={18}>{b.title}</FitText>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold ${style.badge}`}>{style.label}</span>
                    <span className={`text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
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
                    <span className="text-xs text-fog">{t('home_titular')}</span>
                    <span className="text-sm font-semibold text-snow">{b.members.name}</span>
                  </div>
                )}

                {/* Menor (cumpleaños / custodia) */}
                {b.child_name && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-fog">{b.type === 'birthday' ? t('home_cumpleanero') : t('home_menores')}</span>
                    <span className="text-sm font-semibold text-snow">{b.child_name}</span>
                  </div>
                )}

                {/* Fecha */}
                {b.date && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-fog">{t('home_fecha')}</span>
                    <span className="text-sm font-semibold text-snow capitalize">
                      {new Date(b.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                )}

                {/* Horario */}
                <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 space-y-2">
                  <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">{t('home_horario')}</p>
                  <div className="flex items-center gap-4">
                    {b.start_time && (
                      <div>
                        <p className="text-[10px] text-mist mb-0.5">{t('home_inicio')}</p>
                        <p className="text-lg font-bold text-snow">{b.start_time.slice(0, 5)}</p>
                      </div>
                    )}
                    {b.start_time && b.end_time && <span className="text-mist">→</span>}
                    {b.end_time && (
                      <div>
                        <p className="text-[10px] text-mist mb-0.5">{t('home_fin')}</p>
                        <p className="text-lg font-bold text-snow">{b.end_time.slice(0, 5)}</p>
                      </div>
                    )}
                    {b.start_time && b.end_time && (() => {
                      const diff = timeToMins(b.end_time) - timeToMins(b.start_time)
                      const h = Math.floor(diff / 60), m = diff % 60
                      return (
                        <div className="ml-auto">
                          <p className="text-[10px] text-mist mb-0.5">{t('home_duracion')}</p>
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
                  const totalG = bookingGuestCount(b)
                  if (totalG <= 0 && gA === 0 && gC === 0) return null
                  return (
                    <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-fog">{b.type === 'custodia' ? t('home_ninos') : t('home_invitados')}</span>
                        <span className="text-sm font-semibold text-snow">
                          {totalG} {b.type === 'custodia' ? (totalG !== 1 ? t('home_ninos_lc') : t('home_nino_lc')) : (totalG !== 1 ? t('home_invitados_lc') : t('home_invitado_lc'))}
                        </span>
                      </div>
                      {b.type !== 'custodia' && (gA > 0 || gC > 0) && (
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-mist">
                          <span>{gA} {gA !== 1 ? t('home_adultos_lc') : t('home_adulto_lc')}</span>
                          <span>·</span>
                          <span>{gC} {gC !== 1 ? t('home_ninos_lc') : t('home_nino_lc')}</span>
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
                  const badge = ps === 'paid'    ? { label: t('home_pagado'),    cls: 'text-mint' }
                              : ps === 'partial' ? { label: t('home_adelanto'),  cls: 'text-amber' }
                              :                    { label: t('home_pendiente'), cls: 'text-fog' }
                  return (
                    <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5"><Receipt size={12} /> {t('home_pagos')}</p>
                        <span className={`text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                      </div>
                      {b.services?.name && (
                        <div className="flex items-center justify-between pb-1.5 border-b border-line/60">
                          <span className="text-xs text-mist">{t('home_paquete')}</span>
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
                        <span className="text-xs text-mist">{t('home_total')}</span>
                        <span className="text-sm font-semibold text-snow">{total.toFixed(2)}€</span>
                      </div>
                      {dep > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-mist">{t('home_adelanto')}</span>
                          <span className="text-sm font-semibold text-lime">{dep.toFixed(2)}€</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1.5 border-t border-line/60">
                        <span className="text-xs text-mist">{t('home_pendiente')}</span>
                        <span className="text-sm font-bold text-snow">{pend.toFixed(2)}€</span>
                      </div>
                    </div>
                  )
                })()}

                {/* Notas */}
                {b.notes && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3">
                    <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">{t('home_notas')}</p>
                    <p className="text-xs text-snow whitespace-pre-wrap leading-relaxed">{b.notes}</p>
                  </div>
                )}

                {/* Visita vinculada */}
                {linkedVisit && (
                  <div className="rounded-xl border border-lime/20 bg-lime/5 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-fog">{t('home_en_sala_ahora')}</span>
                    <span className="text-sm font-semibold text-lime">{fmtElapsed(linkedVisit.checked_in_at)}</span>
                  </div>
                )}

                {/* Botón ejecutar */}
                {canExecute && (
                  <button
                    onClick={() => { handleExecuteBooking(b); setSelectedBooking(null) }}
                    disabled={executingBooking === b.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 border border-lime bg-lime/10 text-lime font-semibold text-sm hover:bg-lime/20 transition active:scale-[0.99] disabled:opacity-60"
                    style={{ boxShadow: 'var(--shadow-lime)' }}
                  >
                    <Play size={15} fill="currentColor" />
                    {executingBooking === b.id ? t('home_ejecutando') : t('home_ejecutar_reserva')}
                  </button>
                )}

                {status === 'ejecutado' && (
                  <div className="flex items-center justify-center gap-2 rounded-xl py-3 bg-mint/10 border border-mint/20">
                    <Check size={15} className="text-mint" strokeWidth={2.5} />
                    <span className="text-sm font-semibold text-mint">{t('home_reserva_ejecutada')}</span>
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
            activeVisits={openVisits}
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
          activeVisits={openVisits}
          rates={{ adult: rateAdult, child: rateChild, custodia: rateCustodia }}
          onBack={() => setCheckinModal('search')}
          onClose={() => { setCheckinModal(null); setCheckinSelectedMember(null); setCheckinQuery('') }}
          onCheckedIn={() => { router.refresh(); setCheckinMembers([]) }}
        />
      )}

      {/* Modal 3: nuevo miembro */}
      {checkinModal === 'new-member' && (
        <CheckinNewMemberModal
          submitLabel={newMemberReturnTo.current === 'booking' ? t('home_guardar_y_continuar_reserva') : t('home_guardar_y_registrar_entrada')}
          onBack={() => {
            // Vuelve al flujo del que vino: búsqueda de check-in, o directamente
            // a la ventana de reserva (que sigue montada debajo, ya abierta en 'pick')
            setCheckinModal(newMemberReturnTo.current === 'booking' ? null : 'search')
          }}
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
            className="relative w-full sm:max-w-md rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[85dvh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={15} className="text-iris shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-snow">{consumosVisit.members?.name ?? '—'}</p>
                  <p className="text-[11px] text-fog">{t('home_consumos_de_la_visita')}</p>
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
                    <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-2">{t('home_consumido')}</p>
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
                        {t('home_total')}: <span className="text-lime font-bold">{total.toFixed(2)}€</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-mist">{t('home_sin_consumos_registrados')}</p>
                )
              })()}

              {/* Selector de productos */}
              <div>
                <p className="text-[10px] font-semibold text-mist uppercase tracking-wide mb-3">{t('home_anadir_producto')}</p>

                {/* Buscador */}
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder={t('home_buscar_producto')}
                    className="w-full bg-surface2 border border-line rounded-xl pl-9 pr-3 py-2.5 text-sm text-snow placeholder:text-mist focus:outline-none focus:border-iris/50 transition-colors"
                  />
                </div>

                {Object.entries(productsByCategory).map(([cat, prods]) => {
                  const filtered = [...prods]
                    .filter(p => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                  if (filtered.length === 0) return null
                  return (
                    <div key={cat} className="mb-4 last:mb-0">
                      <p className="text-[10px] font-semibold text-fog capitalize mb-2">{cat}</p>
                      <div className="flex flex-col gap-2">
                        {filtered.map(p => {
                          const Icon = getProductIcon(p)
                          return (
                            <button
                              key={p.id}
                              onClick={() => handleAddProduct(consumosVisitId, p)}
                              disabled={addingProduct === p.id + consumosVisitId}
                              className="flex items-center gap-3 text-sm font-medium text-snow bg-surface2 border border-line rounded-xl px-3.5 py-3 hover:border-iris/50 hover:bg-iris/5 transition-colors disabled:opacity-50 text-left"
                            >
                              <Icon size={18} className="text-iris shrink-0" />
                              <span className="flex-1 min-w-0">{p.name}</span>
                              <span className="text-mist shrink-0">{Number(p.price).toFixed(2)}€</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {Object.values(productsByCategory).every(prods =>
                  prods.every(p => !p.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
                ) && (
                  <p className="text-xs text-mist text-center py-4">{t('home_sin_resultados')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
