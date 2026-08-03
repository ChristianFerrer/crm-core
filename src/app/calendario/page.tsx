'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, Clock, User, FileText, Tag, Calendar, Users, Euro, Pencil, Trash2, CheckCircle, UserPlus, CalendarPlus, Play, ArrowUp, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant } from '@/lib/tenant'
import { executeBooking } from '@/lib/bookingExecution'
import { memberMatchesQuery } from '@/lib/searchMembers'
import { resolveRates } from '@/lib/pricing'
import { BookingSearchAndTypeModal, BookingFormModal, bookingBarStyle, bookingDurationLabel, BOOKING_TYPE_COLOR_VAR, type FullMember, type BookingService, type BookingInitial } from '@/app/HomeClient'
import { MemberForm, type CreatedMember } from '@/components/MemberForm'
import { useLanguage } from '@/lib/i18n'

type BookingType = 'birthday' | 'custodia' | 'other'
type BookingStatus = 'pending' | 'confirmed' | 'cancelled'
type PaymentStatus = 'pending' | 'partial' | 'paid'

interface Booking {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  type: BookingType
  title: string
  child_name: string | null
  member_id: string | null
  members: { id: string; name: string; children: { name: string; birth_date: string }[] } | null
  notes: string | null
  status: BookingStatus
  guests: number | null
  guest_adults: number | null
  guest_children: number | null
  payment_status: PaymentStatus
  amount: number | null
  deposit_amount: number | null
  service_id: string | null
  addons: { name: string; price: number }[] | null
  services: { name: string } | null
  executed_at: string | null
}

interface MemberChild { name: string; birth_date?: string }
interface Member { id: string; name: string; children?: MemberChild[] }

const DOW_KEYS = ['calendario_dow_lun', 'calendario_dow_mar', 'calendario_dow_mie', 'calendario_dow_jue', 'calendario_dow_vie', 'calendario_dow_sab', 'calendario_dow_dom'] as const
const MONTH_KEYS = ['calendario_mes_enero', 'calendario_mes_febrero', 'calendario_mes_marzo', 'calendario_mes_abril', 'calendario_mes_mayo', 'calendario_mes_junio', 'calendario_mes_julio', 'calendario_mes_agosto', 'calendario_mes_septiembre', 'calendario_mes_octubre', 'calendario_mes_noviembre', 'calendario_mes_diciembre'] as const

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfWeek(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7 }
function toDateStr(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` }

function calcAge(birth_date: string) {
  const now = new Date(), dob = new Date(birth_date)
  let y = now.getFullYear() - dob.getFullYear(), m = now.getMonth() - dob.getMonth()
  if (now.getDate() < dob.getDate()) m--
  if (m < 0) { y--; m += 12 }
  return y === 0 ? `${m}m` : m === 0 ? `${y}a` : `${y}a ${m}m`
}

// Custodia = cian en toda la app (coherente con Inicio y el detalle del día)
function bookingColor(t: BookingType) { return t === 'birthday' ? 'bg-iris' : t === 'custodia' ? 'bg-cyan-300' : 'bg-lime' }
function statusBadge(s: BookingStatus) { return s === 'confirmed' ? 'text-lime' : s === 'cancelled' ? 'text-rose' : 'text-fog' }
function paymentBadge(p: PaymentStatus) { return p === 'paid' ? 'text-mint' : p === 'partial' ? 'text-cyan-300' : 'text-amber' }
function paymentLabelKey(p: PaymentStatus): 'calendario_pagado' | 'calendario_senal' | 'calendario_pendiente' {
  return p === 'paid' ? 'calendario_pagado' : p === 'partial' ? 'calendario_senal' : 'calendario_pendiente'
}

// Estilo por tipo alineado con la "Agenda de hoy" del inicio
const TYPE_STYLE: Record<BookingType, { bar: string; badge: string; labelKey: 'calendario_tipo_cumpleanos' | 'calendario_tipo_custodia' | 'calendario_tipo_otro' }> = {
  birthday: { bar: 'bg-iris',     badge: 'text-iris',     labelKey: 'calendario_tipo_cumpleanos' },
  custodia: { bar: 'bg-cyan-300', badge: 'text-cyan-300', labelKey: 'calendario_tipo_custodia' },
  other:    { bar: 'bg-lime',     badge: 'text-lime',     labelKey: 'calendario_tipo_otro' },
}


function addDaysStr(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function bookingLiveStatus(b: Booking, todayStr: string): 'ejecutado' | 'en_curso' | 'pendiente' | 'pasado' {
  if (b.executed_at) return 'ejecutado'
  if (b.date !== todayStr) return b.date < todayStr ? 'pasado' : 'pendiente'
  if (!b.start_time) return 'pendiente'
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = b.start_time.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = b.end_time ? (() => { const [h, m] = b.end_time!.split(':').map(Number); return h * 60 + m })() : startMins + 120
  if (nowMins >= startMins && nowMins < endMins) return 'en_curso'
  if (nowMins >= endMins) return 'pasado'
  return 'pendiente'
}


export default function CalendarioPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [members, setMembers] = useState<Member[]>([])
  // Por defecto la agenda muestra las reservas del día actual
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateStr(today.getFullYear(), today.getMonth(), today.getDate()))
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
  const [executingId, setExecutingId] = useState<string | null>(null)
  // Tira de calendario plegable: contraída = solo la semana del día seleccionado
  const [stripExpanded, setStripExpanded] = useState(false)
  const agendaRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const suppressSpy = useRef(false)
  const didInitialScroll = useRef(false)
  const [showJumpToday, setShowJumpToday] = useState(false)
  // Add-member popup
  const [showAddMember, setShowAddMember] = useState(false)
  const newMemberForFlow = useRef(false)

  // ── Flujo compartido de reserva (mismo componente que Inicio) ──
  const [flowStep, setFlowStep] = useState<null | 'pick' | 'form'>(null)
  const [flowMember, setFlowMember] = useState<FullMember | null>(null)
  const [flowType, setFlowType] = useState<'birthday' | 'custodia' | 'other'>('birthday')
  const [flowCategory, setFlowCategory] = useState('generico')
  const [flowPreselectService, setFlowPreselectService] = useState<string | null>(null)
  const [flowQuery, setFlowQuery] = useState('')
  const [flowEditId, setFlowEditId] = useState<string | null>(null)
  const [flowInitial, setFlowInitial] = useState<BookingInitial | null>(null)
  const [bookingServices, setBookingServices] = useState<BookingService[]>([])
  const [rateAdult, setRateAdult] = useState(3)
  const [rateChild, setRateChild] = useState(7)
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({ cumpleanos: 'Cumpleaños', custodia: 'Custodia', generico: 'Otro', otros: 'Otro' })

  useEffect(() => {
    supabase.from('services')
      .select('id, name, description, category, price, price_unit, deposit_pct, price_per_guest_adult, price_per_guest_child, included_guests, applies_to, reservable, tipo, flujo')
      .eq('active', true).order('sort_order')
      .then(({ data }) => {
        if (!data) return
        setBookingServices(data as BookingService[])
        const r = resolveRates(data as any[])
        setRateAdult(r.adult); setRateChild(r.child)
      })
    try {
      const raw = localStorage.getItem('wm_service_categories')
      if (raw) {
        const cats = JSON.parse(raw) as { value: string; label: string }[]
        setCategoryLabels(prev => ({ ...prev, ...Object.fromEntries(cats.map(c => [c.value, c.label])) }))
      }
    } catch {}
  }, [])

  const reservableTypes = (() => {
    const svc = bookingServices.filter(s => s.tipo === 'reservable')
    const items: { flujo: string; flow: 'birthday' | 'custodia' | 'other'; label: string; serviceId?: string; desc?: string }[] = []
    if (svc.some(s => s.flujo === 'cumpleanos')) items.push({ flujo: 'cumpleanos', flow: 'birthday', label: 'Cumpleaños' })
    if (svc.some(s => s.flujo === 'custodia'))   items.push({ flujo: 'custodia',   flow: 'custodia', label: 'Custodia' })
    svc.filter(s => s.flujo !== 'cumpleanos' && s.flujo !== 'custodia')
      .forEach(s => items.push({ flujo: 'generico', flow: 'other', label: s.name, serviceId: s.id, desc: s.description ?? 'Reserva con paquete de servicio' }))
    return items
  })()

  const flowMembers: FullMember[] = members.map(m => ({
    id: m.id, name: m.name, phone: (m as any).phone ?? null, family_id: null, memberships: [],
    children: (m.children ?? []).map(c => ({ name: c.name, birth_date: c.birth_date ?? '' })),
  }))
  const flowFiltered = flowQuery.trim().length > 0
    ? flowMembers.filter(m => memberMatchesQuery(flowQuery, m))
    : []

  function closeFlow() { setFlowStep(null); setFlowMember(null); setFlowQuery(''); setFlowEditId(null); setFlowInitial(null); setFlowPreselectService(null) }
  function openNewFlow() { setFlowEditId(null); setFlowInitial(null); setFlowMember(null); setFlowQuery(''); setFlowStep('pick') }
  function openEditFlow(b: Booking) {
    // Las reservas sin titular (datos antiguos) también deben poder editarse
    const mem: FullMember = b.members
      ? {
          id: b.members.id, name: b.members.name, phone: null, family_id: null, memberships: [],
          children: (b.members.children ?? []).map(c => ({ name: c.name, birth_date: c.birth_date ?? '' })),
        }
      : { id: '', name: '(Sin titular)', phone: null, family_id: null, memberships: [], children: [] }
    const cat = bookingServices.find(s => s.id === b.service_id)?.flujo ?? (b.type === 'birthday' ? 'cumpleanos' : b.type === 'custodia' ? 'custodia' : 'generico')
    setFlowMember(mem)
    setFlowType(b.type)
    setFlowCategory(cat)
    setFlowPreselectService(null)
    setFlowInitial({
      title: b.title, child_name: b.child_name, date: b.date, start_time: b.start_time, end_time: b.end_time,
      guest_adults: b.guest_adults, guest_children: b.guest_children, service_id: b.service_id,
      amount: b.amount, deposit_amount: b.deposit_amount, addons: b.addons ?? [], notes: b.notes,
    })
    setFlowEditId(b.id)
    setFlowStep('form')
  }

  // La agenda es continua, así que se carga una ventana de 3 meses alrededor
  // del mes visible (anterior, actual y siguiente) en vez de solo el actual.
  const fetchBookings = useCallback(async () => {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month + 2, 0)
    const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
    const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    const { data } = await supabase
      .from('bookings')
      .select('id, date, start_time, end_time, type, title, child_name, member_id, members(id, name, children), notes, status, guests, guest_adults, guest_children, payment_status, amount, deposit_amount, service_id, addons, services(name), executed_at')
      .gte('date', from).lte('date', to).order('start_time')
    setBookings((data ?? []) as unknown as Booking[])
  }, [year, month])

  const fetchMembers = useCallback(() => {
    supabase.from('members').select('id, name, phone, children').order('name').then(({ data }) => setMembers((data ?? []) as Member[]))
  }, [])

  async function handleExecute(b: Booking) {
    if (!b.member_id) return
    setExecutingId(b.id)
    // Fuente única de verdad para el conteo de aforo (compartida con Inicio)
    const { error } = await executeBooking(b)
    setExecutingId(null)
    if (error) { alert(t('calendario_error_ejecutar', { error })); return }
    fetchBookings()
  }

  useEffect(() => { fetchBookings() }, [fetchBookings])
  useEffect(() => { fetchMembers() }, [fetchMembers])

  // Navegar de mes ancla la selección al día 1, para que la tira contraída
  // muestre una semana coherente con el mes al que se ha saltado.
  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setSelectedDate(toDateStr(d.getFullYear(), d.getMonth(), 1))
  }

  async function handleCancel(id: string) {
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    fetchBookings()
  }

  function handleMemberCreated(member: CreatedMember) {
    fetchMembers()
    // Volver al flujo compartido con el titular recién creado preseleccionado
    newMemberForFlow.current = false
    setFlowMember({ id: member.id, name: member.name, phone: member.phone, family_id: member.family_id, memberships: [], children: member.children })
    setFlowStep('pick')
    setShowAddMember(false)
  }

  const DOW_LABELS = DOW_KEYS.map(k => t(k))
  const MONTH_NAMES = MONTH_KEYS.map(k => t(k))

  const bookingsByDate: Record<string, Booking[]> = {}
  bookings.forEach(b => { if (!bookingsByDate[b.date]) bookingsByDate[b.date] = []; bookingsByDate[b.date].push(b) })

  // ── Tira de calendario ──────────────────────────────────────────────
  // Semanas completas (lunes→domingo). Los huecos de inicio y fin se rellenan
  // con los días reales del mes anterior y del siguiente, atenuados.
  type Cell = { date: string; inMonth: boolean }
  const firstDow = getFirstDayOfWeek(year, month)
  const daysInMonth = getDaysInMonth(year, month)
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7
  const gridStart = new Date(year, month, 1 - firstDow)
  const monthCells: Cell[] = Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return {
      date: toDateStr(d.getFullYear(), d.getMonth(), d.getDate()),
      inMonth: d.getMonth() === month && d.getFullYear() === year,
    }
  })
  const weeks: Cell[][] = []
  for (let i = 0; i < monthCells.length; i += 7) weeks.push(monthCells.slice(i, i + 7))

  const anchor = selectedDate ?? todayStr
  const weekOfAnchor = weeks.findIndex(w => w.some(c => c.date === anchor))
  const visibleWeeks = stripExpanded ? weeks : [weeks[weekOfAnchor >= 0 ? weekOfAnchor : 0] ?? []]

  // ── Agenda continua ─────────────────────────────────────────────────
  // Solo los días con reservas, ordenados; los días vacíos no ocupan espacio.
  const agendaDays = Object.keys(bookingsByDate)
    .filter(d => (bookingsByDate[d] ?? []).length > 0)
    .sort()

  // La agenda abarca 3 meses, así que al entrar arrancaría en el mes anterior.
  // Tras la primera carga se posiciona en hoy (o en el primer día con reservas
  // a partir de hoy), sin animación para que no se vea el salto.
  useEffect(() => {
    if (didInitialScroll.current || bookings.length === 0) return
    const target = agendaDays.find(d => d >= todayStr) ?? agendaDays[agendaDays.length - 1]
    if (!target) return
    didInitialScroll.current = true
    setSelectedDate(target)
    const d = new Date(target + 'T12:00:00')
    if (d.getMonth() !== month || d.getFullYear() !== year) {
      setMonth(d.getMonth()); setYear(d.getFullYear())
    }
    // Doble rAF: la primera pasada aún no ha pintado las secciones de día,
    // así que las refs todavía no existen
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToDay(target, 'auto')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings])

  function relativeLabel(dateStr: string) {
    if (dateStr === todayStr) return t('calendario_hoy')
    if (dateStr === addDaysStr(todayStr, 1)) return t('calendario_manana')
    if (dateStr === addDaysStr(todayStr, -1)) return t('calendario_ayer')
    const dow = (new Date(dateStr + 'T12:00:00').getDay() + 6) % 7
    return DOW_LABELS[dow]
  }

  function dayHeading(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00')
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3).toLowerCase()}`
  }

  // En móvil desplaza la ventana, pero en escritorio quien scrollea es el panel
  // de contenido del AppShell (h-screen + overflow-y-auto). Se busca el
  // contenedor real en vez de asumir que siempre es la ventana.
  function getScroller(): HTMLElement | null {
    let el: HTMLElement | null = agendaRef.current?.parentElement ?? null
    while (el) {
      const oy = getComputedStyle(el).overflowY
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el
      el = el.parentElement
    }
    return null
  }

  // Día de la agenda al que saltar: el propio si tiene reservas, si no el
  // siguiente con reservas, y como último recurso el anterior más cercano.
  function nearestAgendaDay(dateStr: string): string | null {
    if (dayRefs.current[dateStr]) return dateStr
    const after = agendaDays.find(d => d >= dateStr)
    if (after) return after
    return agendaDays.length ? agendaDays[agendaDays.length - 1] : null
  }

  // Desplaza dejando hueco para la cabecera fija, que si no taparía el día
  function scrollToDay(dateStr: string, behavior: ScrollBehavior = 'smooth') {
    const target = nearestAgendaDay(dateStr)
    const el = target ? dayRefs.current[target] : null
    if (!el) return false
    const offset = (headerRef.current?.offsetHeight ?? 0) + 8
    const scroller = getScroller()
    suppressSpy.current = true
    if (scroller) {
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - offset
      scroller.scrollTo({ top, behavior })
    } else {
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior })
    }
    setTimeout(() => { suppressSpy.current = false }, behavior === 'smooth' ? 600 : 150)
    return true
  }

  function goToDay(dateStr: string) {
    setSelectedDate(dateStr)
    // Si el día pertenece al mes anterior o siguiente, la tira salta a ese mes
    const d = new Date(dateStr + 'T12:00:00')
    if (d.getMonth() !== month || d.getFullYear() !== year) {
      setMonth(d.getMonth()); setYear(d.getFullYear())
    }
    scrollToDay(dateStr)
  }

  function jumpToToday() {
    const d = new Date()
    setYear(d.getFullYear()); setMonth(d.getMonth())
    setSelectedDate(todayStr)
    if (!scrollToDay(todayStr)) {
      const scroller = getScroller()
      if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' })
      else window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Scroll-spy: el primer día que queda bajo la cabecera fija manda sobre la
  // tira y el título del mes. La página desplaza de forma natural, así que se
  // escucha el scroll de la ventana (o del panel de contenido en escritorio).
  useEffect(() => {
    function onScroll() {
      if (suppressSpy.current) return
      const offset = (headerRef.current?.offsetHeight ?? 0) + 8
      let current: string | null = null
      for (const d of agendaDays) {
        const el = dayRefs.current[d]
        if (!el) continue
        if (el.getBoundingClientRect().top - offset <= 0) current = d
      }
      if (current && current !== selectedDate) {
        setSelectedDate(current)
        const dt = new Date(current + 'T12:00:00')
        if (dt.getMonth() !== month || dt.getFullYear() !== year) {
          setMonth(dt.getMonth()); setYear(dt.getFullYear())
        }
      }
      setShowJumpToday((current ?? anchor) !== todayStr)
    }
    window.addEventListener('scroll', onScroll, true)
    onScroll()
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [agendaDays.join(','), selectedDate, month, year, anchor, todayStr])

  return (
    <div className="bg-carbon text-snow">
      {/* ── Cabecera fija: mes + acciones + tira de calendario ── */}
      <div ref={headerRef} className="sticky top-0 z-20 bg-carbon -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-2 pb-3 border-b border-line relative">
        <div className="flex items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-1 min-w-0">
            <h1 className="font-display text-3xl font-bold text-snow lowercase truncate">
              {MONTH_NAMES[month]}
            </h1>
            <button
              onClick={() => shiftMonth(-1)}
              aria-label={MONTH_NAMES[(month + 11) % 12]}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors ml-1"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => shiftMonth(1)}
              aria-label={MONTH_NAMES[(month + 1) % 12]}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            onClick={openNewFlow}
            className="hidden sm:flex items-center gap-2 border border-iris bg-iris/10 text-iris font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-iris/20 transition-colors shrink-0"
          >
            <CalendarPlus size={16} /> {t('calendario_nueva_reserva')}
          </button>
        </div>

        {/* ── Tira de calendario plegable ── */}
        <div>
        <div className="grid grid-cols-7">
          {DOW_LABELS.map(d => (
            <div key={d} className="py-1.5 text-center text-[11px] font-medium text-mist">{d}</div>
          ))}
        </div>

        {visibleWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map(({ date: dateStr, inMonth }) => {
              const day = Number(dateStr.slice(8, 10))
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const hasBookings = (bookingsByDate[dateStr] ?? []).some(b => b.status !== 'cancelled')
              return (
                <button
                  key={dateStr}
                  onClick={() => goToDay(dateStr)}
                  className="h-12 flex flex-col items-center justify-center gap-1"
                >
                  <span className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ${
                    isSelected
                      ? 'bg-iris text-white font-bold'
                      : isToday
                        ? 'text-iris font-bold'
                        : inMonth
                          ? 'text-snow font-medium hover:bg-surface2'
                          : 'text-mist font-medium hover:bg-surface2'
                  }`}>
                    {day}
                  </span>
                  <span className={`w-1 h-1 rounded-full ${hasBookings && !isSelected ? (inMonth ? 'bg-iris' : 'bg-iris/40') : 'bg-transparent'}`} />
                </button>
              )
            })}
          </div>
        ))}

        </div>

        {/* Pestaña sobresaliente: cuelga por debajo del borde del panel */}
        <button
          onClick={() => setStripExpanded(o => !o)}
          aria-label={stripExpanded ? t('calendario_contraer_calendario') : t('calendario_expandir_calendario')}
          aria-expanded={stripExpanded}
          className="absolute right-4 lg:right-8 -bottom-[26px] z-10 flex items-center justify-center w-12 h-[26px] rounded-b-xl border border-t-0 border-line bg-surface text-fog hover:text-snow hover:bg-surface2 transition-colors shadow-sm"
        >
          {stripExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* ── Agenda continua ── */}
      {/* pt-4: deja aire para la pestaña que sobresale de la cabecera */}
      <div ref={agendaRef} className="pt-4 pb-28 lg:pb-8 relative">
        {agendaDays.length === 0 ? (
          <div className="py-16 text-center text-sm text-mist">{t('calendario_sin_reservas_rango')}</div>
        ) : (
          agendaDays.map(dateStr => {
            const dayBookings = [...(bookingsByDate[dateStr] ?? [])].sort(
              (a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')
            )
            const allDay = dayBookings.filter(b => !b.start_time)
            const timed = dayBookings.filter(b => b.start_time)
            const isToday = dateStr === todayStr
            return (
              <div key={dateStr} ref={el => { dayRefs.current[dateStr] = el }} className="pt-6">
                {/* Cabecera del día */}
                <div className="flex items-baseline gap-2.5 mb-3">
                  <span className={`text-lg font-bold ${isToday ? 'text-iris' : 'text-snow'}`}>
                    {dayHeading(dateStr)}
                  </span>
                  <span className={`text-sm ${isToday ? 'text-iris' : 'text-mist'}`}>
                    {relativeLabel(dateStr)}
                  </span>
                </div>

                {/* Todo el día */}
                {allDay.length > 0 && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-mist w-16 shrink-0">{t('calendario_todo_el_dia')}</span>
                    <button
                      onClick={() => allDay.length === 1 ? openEditFlow(allDay[0]) : goToDay(dateStr)}
                      className="flex-1 flex items-center gap-2.5 rounded-xl bg-surface2 px-3 py-2.5 text-left hover:bg-surface transition-colors"
                    >
                      <span className="w-1 h-5 rounded-full shrink-0" style={bookingBarStyle(allDay[0].status, BOOKING_TYPE_COLOR_VAR[allDay[0].type])} />
                      <span className="flex-1 text-sm text-snow truncate">
                        {allDay.length === 1 ? allDay[0].title : t('calendario_n_reservas', { n: allDay.length, s: allDay.length !== 1 ? 's' : '' })}
                      </span>
                      <ChevronRight size={14} className="text-mist shrink-0" />
                    </button>
                  </div>
                )}

                {/* Reservas con hora */}
                <div className="space-y-4">
                  {timed.map(b => {
                    const ts = TYPE_STYLE[b.type]
                    const st = bookingLiveStatus(b, todayStr)
                    const dur = bookingDurationLabel(b.start_time, b.end_time, t)
                    const gA = b.guest_adults ?? 0
                    const gC = b.guest_children ?? 0
                    const totalG = b.guests ?? (gA + gC)
                    const canExecute = st !== 'ejecutado' && b.status !== 'cancelled' && !!b.member_id && b.date === todayStr
                    const pendiente = Math.max(0, (b.amount ?? 0) - (b.deposit_amount ?? 0))
                    const showPago = b.status !== 'cancelled' && (b.amount != null && b.amount > 0)
                    return (
                      <div key={b.id} className={`flex items-stretch gap-3 ${st === 'pasado' || b.status === 'cancelled' ? 'opacity-50' : ''}`}>
                        {/* Hora + duración */}
                        <div className="w-16 shrink-0 pt-0.5">
                          <p className="text-xs text-snow leading-tight">{b.start_time?.slice(0, 5)}</p>
                          {dur && <p className="text-xs text-mist leading-tight mt-0.5">{dur}</p>}
                        </div>

                        {/* Barra de color */}
                        <span
                          className="w-1 rounded-full shrink-0"
                          style={bookingBarStyle(b.status, BOOKING_TYPE_COLOR_VAR[b.type])}
                        />

                        {/* Contenido */}
                        <button onClick={() => openEditFlow(b)} className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-snow">{b.title}</p>
                            <span className={`text-xs font-semibold ${ts.badge}`}>{t(ts.labelKey)}</span>
                            {st === 'ejecutado' && <span className="text-xs font-semibold text-mint flex items-center gap-0.5"><CheckCircle size={10} />{t('calendario_ejecutado')}</span>}
                            {st === 'en_curso' && <span className="text-xs font-semibold text-lime flex items-center gap-0.5"><Clock size={10} />{t('calendario_en_curso')}</span>}
                            {b.status === 'cancelled' && <span className="text-xs font-semibold text-rose">{t('calendario_cancelada')}</span>}
                            {showPago && (
                              <span className={`text-xs font-semibold ${paymentBadge(b.payment_status)}`}>
                                {t(paymentLabelKey(b.payment_status))}{b.payment_status !== 'paid' && pendiente > 0 ? ` · ${pendiente.toFixed(0)}€` : ''}
                              </span>
                            )}
                          </div>
                          {b.members?.name && <p className="text-xs text-fog mt-0.5">{b.members.name}</p>}
                          {(totalG > 0 || gA > 0 || gC > 0) && (
                            <p className="text-xs text-mist mt-0.5">
                              {totalG} {b.type === 'custodia' ? t('calendario_ninos', { s: totalG !== 1 ? 's' : '' }) : t('calendario_invitados', { s: totalG !== 1 ? 's' : '' })}
                              {b.type !== 'custodia' && (gA > 0 || gC > 0) && <span> · {gA} {t('calendario_adultos', { s: gA !== 1 ? 's' : '' })}, {gC} {t('calendario_ninos', { s: gC !== 1 ? 's' : '' })}</span>}
                            </p>
                          )}
                        </button>

                        {canExecute && (
                          <button
                            type="button"
                            onClick={() => handleExecute(b)}
                            disabled={executingId === b.id}
                            className="flex items-center gap-1 self-start text-xs font-semibold text-lime border border-lime bg-lime/10 rounded-lg px-2 py-1 shrink-0 hover:bg-lime/20 active:scale-95 transition-all disabled:opacity-50"
                          >
                            <Play size={11} fill="currentColor" /> {executingId === b.id ? '...' : t('calendario_ejecutar')}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Píldora «Hoy» cuando la agenda está lejos del día actual ── */}
      {showJumpToday && (
        <button
          onClick={jumpToToday}
          className="fixed left-1/2 -translate-x-1/2 bottom-above-nav z-30 flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-iris shadow-2xl hover:bg-surface2 transition-colors"
        >
          <ArrowUp size={14} /> {t('calendario_ir_a_hoy')}
        </button>
      )}

      {/* ── Botón flotante de nueva reserva (móvil) ── */}
      <button
        onClick={openNewFlow}
        aria-label={t('calendario_nueva_reserva')}
        className="sm:hidden fixed bottom-above-nav right-4 z-30 w-14 h-14 rounded-full bg-iris text-white flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
      >
        <CalendarPlus size={22} />
      </button>

      {/* ── New booking modal ── */}

      {/* ── Nuevo titular (mismos campos que /miembros/nuevo) ── */}
      {showAddMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowAddMember(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
              <h3 className="text-sm font-semibold text-snow">{t('calendario_nuevo_titular')}</h3>
              <button onClick={() => setShowAddMember(false)} aria-label={t('calendario_cerrar')} className="text-mist hover:text-fog"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4">
              <MemberForm onCreated={handleMemberCreated} submitLabel={t('calendario_guardar_continuar')} />
            </div>
          </div>
        </div>
      )}


      {/* ── Flujo compartido: crear/editar reserva (mismo componente que Inicio) ── */}
      {/* Se oculta mientras está abierto 'Nuevo titular' para que ese modal quede al frente */}
      {flowStep === 'pick' && !showAddMember && (
        <BookingSearchAndTypeModal
          filtered={flowFiltered}
          query={flowQuery}
          onQueryChange={setFlowQuery}
          preselectedMember={flowMember}
          types={reservableTypes}
          onProceed={(m, t, flujo, serviceId) => { setFlowMember(m); setFlowType(t); setFlowCategory(flujo); setFlowPreselectService(serviceId ?? null); setFlowStep('form') }}
          onNewMember={() => { newMemberForFlow.current = true; setShowAddMember(true) }}
          onClose={closeFlow}
        />
      )}
      {flowStep === 'form' && flowMember && (
        <BookingFormModal
          key={flowEditId ?? 'nuevo'}
          member={flowMember}
          bookingType={flowType}
          serviceCategory={flowCategory}
          preselectServiceId={flowPreselectService}
          selectedDate={selectedDate ?? todayStr}
          services={bookingServices}
          rateAdult={rateAdult}
          rateChild={rateChild}
          tenantId={getStoredTenant()?.id ?? null}
          editId={flowEditId}
          initial={flowInitial}
          onCancelBooking={flowEditId ? () => { const id = flowEditId; handleCancel(id); closeFlow() } : undefined}
          onBack={() => { if (flowEditId) closeFlow(); else setFlowStep('pick') }}
          onClose={closeFlow}
          onSaved={() => { fetchBookings() }}
        />
      )}
    </div>
  )
}
