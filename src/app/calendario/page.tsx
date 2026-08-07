'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, Clock, User, FileText, Tag, Calendar, Users, Euro, Pencil, Trash2, CheckCircle, UserPlus, CalendarPlus, Play, ArrowUp, ChevronUp, ChevronDown, AlertTriangle, Plus, MapPin, EyeOff, Eye, Search, Filter, Rows3, LayoutList, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant } from '@/lib/tenant'
import { executeBooking, bookingGuestCount } from '@/lib/bookingExecution'
import { memberMatchesQuery } from '@/lib/searchMembers'
import { resolveRates } from '@/lib/pricing'
import { formatEur } from '@/lib/metrics'
import { BookingSearchAndTypeModal, BookingFormModal, bookingBarStyle, bookingDurationLabel, BOOKING_TYPE_COLOR_VAR, type FullMember, type BookingService, type BookingInitial } from '@/app/HomeClient'
import { MemberForm, type CreatedMember } from '@/components/MemberForm'
import { useLanguage } from '@/lib/i18n'
import {
  conflictMap, daySummary, freeGaps, parseSchedule, isOpenOn,
  toMinutes, minutesToLabel, durationLabel, bookingRange, layoutColumns, overlapClusters,
} from '@/lib/agenda'

type BookingType = 'birthday' | 'custodia' | 'other'
type BookingStatus = 'pending' | 'confirmed' | 'cancelled'
type PaymentStatus = 'pending' | 'partial' | 'paid'

interface TenantInfo { capacity: number | null; schedule_days: string | null; schedule_hours: string | null }

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
function bookingColor(t: BookingType) { return t === 'birthday' ? 'bg-grape' : t === 'custodia' ? 'bg-cyan-300' : 'bg-lime' }
function statusBadge(s: BookingStatus) { return s === 'confirmed' ? 'text-lime' : s === 'cancelled' ? 'text-rose' : 'text-fog' }
function paymentBadge(p: PaymentStatus) { return p === 'paid' ? 'text-mint' : p === 'partial' ? 'text-cyan-300' : 'text-amber' }
function paymentLabelKey(p: PaymentStatus): 'calendario_pagado' | 'calendario_senal' | 'calendario_pendiente' {
  return p === 'paid' ? 'calendario_pagado' : p === 'partial' ? 'calendario_senal' : 'calendario_pendiente'
}

// Estilo por tipo alineado con la "Agenda de hoy" del inicio
const TYPE_STYLE: Record<BookingType, { bar: string; badge: string; labelKey: 'calendario_tipo_cumpleanos' | 'calendario_tipo_custodia' | 'calendario_tipo_otro' }> = {
  birthday: { bar: 'bg-grape',    badge: 'text-grape',    labelKey: 'calendario_tipo_cumpleanos' },
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
  const searchParams = useSearchParams()
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
  // El panel de meses de escritorio navega por su cuenta: mueve sus flechas sin
  // arrastrar la agenda, que sigue mandada por el scroll.
  const [panelOffset, setPanelOffset] = useState(0)
  // Operativa: búsqueda, filtros, canceladas y vista (lista o rejilla horaria)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'todos' | BookingType>('todos')
  const [filterPago, setFilterPago] = useState<'todos' | 'pendiente' | 'pagado'>('todos')
  const [showCancelled, setShowCancelled] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Modo compacto: una línea por reserva para ver la jornada entera de un vistazo
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    try { setCompact(localStorage.getItem('wm_agenda_compact') === '1') } catch {}
  }, [])
  function toggleCompact() {
    setCompact(v => {
      const next = !v
      try { localStorage.setItem('wm_agenda_compact', next ? '1' : '0') } catch {}
      return next
    })
  }
  const [tenantInfo, setTenantInfo] = useState<TenantInfo>({ capacity: null, schedule_days: null, schedule_hours: null })
  const pendingScroll = useRef<string | null>(null)
  const navAt = useRef(0)
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
  const [flowDate, setFlowDate] = useState<string | null>(null)
  const [bookingServices, setBookingServices] = useState<BookingService[]>([])
  const [rateAdult, setRateAdult] = useState(3)
  const [rateChild, setRateChild] = useState(7)
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({ cumpleanos: 'Cumpleaños', custodia: 'Custodia', generico: 'Otro', otros: 'Otro' })

  useEffect(() => {
    supabase.from('services')
      .select('id, name, description, category, price, price_unit, deposit_pct, price_per_guest_adult, price_per_guest_child, included_guests, applies_to, reservable, resource_name, tipo, flujo')
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

  function closeFlow() { setFlowStep(null); setFlowMember(null); setFlowQuery(''); setFlowEditId(null); setFlowInitial(null); setFlowPreselectService(null); setFlowDate(null) }
  function openNewFlow() { setFlowEditId(null); setFlowInitial(null); setFlowMember(null); setFlowQuery(''); setFlowDate(null); setFlowStep('pick') }

  /**
   * Nueva reserva con contexto: día y, si se pulsa un hueco, también la hora.
   * Evita tener que volver a elegir lo que ya estabas mirando.
   */
  function openNewAt(dateStr: string, startMins?: number, endMins?: number) {
    setFlowEditId(null)
    setFlowMember(null)
    setFlowQuery('')
    setFlowDate(dateStr)
    setFlowInitial(startMins != null ? {
      date: dateStr,
      start_time: minutesToLabel(startMins),
      end_time: minutesToLabel(Math.min(endMins ?? startMins + 120, startMins + 120)),
    } : { date: dateStr })
    setFlowStep('pick')
  }
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

  // Horario y aforo del establecimiento: los usan la rejilla, los huecos y el
  // resumen de cada día.
  useEffect(() => {
    const id = getStoredTenant()?.id
    if (!id) return
    supabase.from('tenants').select('capacity, schedule_days, schedule_hours').eq('id', id).maybeSingle()
      .then(({ data }) => { if (data) setTenantInfo(data as TenantInfo) })
  }, [])

  const fetchMembers = useCallback(() => {
    supabase.from('members').select('id, name, phone, children').is('deleted_at', null).order('name').then(({ data }) => setMembers((data ?? []) as Member[]))
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
  // Cambiar de mes también mueve la agenda: si solo se cambiaba el estado, el
  // scroll-spy volvía a fijar el mes del día visible y la flecha «no hacía nada».
  // Con la tira contraída (vista de semana) las flechas mueven una semana;
  // con la tira desplegada (vista de mes), un mes.
  function shiftWeek(delta: number) {
    goToDay(addDaysStr(selectedDate ?? todayStr, delta * 7))
  }

  function shiftStrip(delta: number) {
    if (stripExpanded) shiftMonth(delta)
    else shiftWeek(delta)
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    const first = toDateStr(d.getFullYear(), d.getMonth(), 1)
    // Salta al primer día CON reservas del nuevo mes; si no tiene, al día 1
    const inMonth = Object.keys(bookingsByDate)
      .filter(x => (bookingsByDate[x] ?? []).length > 0)
      .sort()
      .find(x => x >= first && x.slice(0, 7) === first.slice(0, 7))
    goToDay(inMonth ?? first)
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

  // Sala de cada servicio: el criterio de solape es por sala, no global
  const resourceByService: Record<string, string | null> = Object.fromEntries(
    bookingServices.map(sv => [sv.id, sv.resource_name ?? null])
  )
  function resourceOf(b: Booking): string | null {
    const r = b.service_id ? resourceByService[b.service_id] : null
    return r && r.trim() ? r.trim() : null
  }

  const { open: openMins, close: closeMins } = parseSchedule(tenantInfo.schedule_hours)
  // Todas las horas del horario del establecimiento: la agenda las lista
  // completas, tengan reservas o no.
  const hourSlots: number[] = []
  for (let m = Math.floor(openMins / 60) * 60; m < closeMins; m += 60) hourSlots.push(m)

  // Conflictos de todo el rango cargado: los usa la pantalla de detalle
  const conflictsAll: Record<string, Booking[]> = (() => {
    const byDate: Record<string, Booking[]> = {}
    bookings.forEach(b => { (byDate[b.date] ||= []).push(b) })
    return Object.values(byDate).reduce<Record<string, Booking[]>>((acc, day) => {
      Object.assign(acc, conflictMap(day, resourceByService))
      return acc
    }, {})
  })()

  // Búsqueda y filtros: los filtros no ocultan el día, solo sus reservas
  const q = search.trim().toLowerCase()
  const matchesFilters = (b: Booking) => {
    if (filterType !== 'todos' && b.type !== filterType) return false
    if (filterPago === 'pendiente' && b.payment_status === 'paid') return false
    if (filterPago === 'pagado' && b.payment_status !== 'paid') return false
    if (!q) return true
    return [b.title, b.members?.name, b.services?.name, b.child_name]
      .some(v => (v ?? '').toLowerCase().includes(q))
  }
  const filtersActive = (filterType !== 'todos' ? 1 : 0) + (filterPago !== 'todos' ? 1 : 0)

  const bookingsByDate: Record<string, Booking[]> = {}
  bookings.filter(matchesFilters).forEach(b => { if (!bookingsByDate[b.date]) bookingsByDate[b.date] = []; bookingsByDate[b.date].push(b) })

  // El resumen del día cuenta SIEMPRE todas las reservas: si contara solo las
  // filtradas, el aforo y el pendiente de cobro mentirían al filtrar.
  const allByDate: Record<string, Booking[]> = {}
  bookings.forEach(b => { if (!allByDate[b.date]) allByDate[b.date] = []; allByDate[b.date].push(b) })

  // Para la línea bajo el título: cuántas reservas hay hoy y cuánto queda por
  // cobrar de ellas. Sale de lo ya cargado, sin consultas extra.
  const resumenHoy = daySummary(allByDate[todayStr] ?? [])

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

  /** Semanas completas de un mes cualquiera (para el panel de escritorio). */
  function weeksOf(y: number, m: number): Cell[][] {
    const fd = getFirstDayOfWeek(y, m)
    const dim = getDaysInMonth(y, m)
    const total = Math.ceil((fd + dim) / 7) * 7
    const start = new Date(y, m, 1 - fd)
    const cells: Cell[] = Array.from({ length: total }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return {
        date: toDateStr(d.getFullYear(), d.getMonth(), d.getDate()),
        inMonth: d.getMonth() === m && d.getFullYear() === y,
      }
    })
    const rows: Cell[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }

  const anchor = selectedDate ?? todayStr
  const weekOfAnchor = weeks.findIndex(w => w.some(c => c.date === anchor))
  const visibleWeeks = stripExpanded ? weeks : [weeks[weekOfAnchor >= 0 ? weekOfAnchor : 0] ?? []]

  // ── Agenda continua ─────────────────────────────────────────────────
  // Solo los días con reservas, ordenados; los días vacíos no ocupan espacio.
  // El día seleccionado siempre tiene sección, aunque esté vacío: así se puede
  // navegar a cualquier mes (con o sin reservas), hay a dónde desplazarse y el
  // scroll-spy no devuelve la cabecera al mes de la reserva más cercana.
  const agendaDays = Array.from(new Set([
    ...Object.keys(bookingsByDate).filter(d => (bookingsByDate[d] ?? []).length > 0),
    ...(selectedDate ? [selectedDate] : []),
  ])).sort()

  // La agenda abarca 3 meses, así que al entrar arrancaría en el mes anterior.
  // Tras la primera carga se posiciona en hoy (o en el primer día con reservas
  // a partir de hoy), sin animación para que no se vea el salto.
  useEffect(() => {
    if (didInitialScroll.current || bookings.length === 0) return
    // Siempre arranca en HOY: ahora el día seleccionado tiene sección propia
    // aunque no tenga reservas, así que no hace falta buscar la más cercana.
    const target = agendaDays.includes(todayStr)
      ? todayStr
      : (agendaDays.find(d => d >= todayStr) ?? agendaDays[agendaDays.length - 1])
    if (!target) return
    didInitialScroll.current = true
    setSelectedDate(target)
    const d = new Date(target + 'T12:00:00')
    if (d.getMonth() !== month || d.getFullYear() !== year) {
      setMonth(d.getMonth()); setYear(d.getFullYear())
    }
    // Doble rAF: la primera pasada aún no ha pintado las secciones de día,
    // así que las refs todavía no existen
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToDay(target, 'instant')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings])

  // Volver del detalle con ?edit=<id> abre directamente el formulario
  const editParam = searchParams.get('edit')
  const editHandled = useRef<string | null>(null)
  useEffect(() => {
    if (!editParam || editHandled.current === editParam) return
    const b = bookings.find(x => x.id === editParam)
    if (!b) return
    editHandled.current = editParam
    openEditFlow(b)
    router.replace('/calendario')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam, bookings])

  // Si la agenda cambia de mes, el panel vuelve a centrarse en él
  useEffect(() => { setPanelOffset(0) }, [month, year])

  // Desplazamiento pendiente tras navegar (ver goToDay)
  useEffect(() => {
    const target = pendingScroll.current
    if (!target) return
    if (scrollToDay(target, 'instant')) pendingScroll.current = null
  })

  // Al llegar las reservas del mes recién seleccionado, recolocar si el usuario
  // no ha tocado nada desde la navegación
  useEffect(() => {
    if (!selectedDate || Date.now() - navAt.current > 1500) return
    scrollToDay(selectedDate, 'instant')
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
  function scrollToDay(dateStr: string, behavior: ScrollBehavior = 'instant') {
    const target = nearestAgendaDay(dateStr)
    const el = target ? dayRefs.current[target] : null
    if (!el) return false
    // 2px de más: si el día queda justo en el umbral del scroll-spy, el
    // redondeo puede dejarlo "por encima" y la píldora de «Hoy» no se apaga.
    const offset = (headerRef.current?.offsetHeight ?? 0) + 8 - 2
    const scroller = getScroller()
    suppressSpy.current = true
    if (scroller) {
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - offset
      scroller.scrollTo({ top, behavior })
    } else {
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior })
    }
    setTimeout(() => { suppressSpy.current = false }, behavior === 'smooth' ? 600 : 60)
    return true
  }

  function goToDay(dateStr: string) {
    setSelectedDate(dateStr)
    // Si el día pertenece a otro mes, la tira salta a ese mes
    const d = new Date(dateStr + 'T12:00:00')
    if (d.getMonth() !== month || d.getFullYear() !== year) {
      setMonth(d.getMonth()); setYear(d.getFullYear())
    }
    // La sección del día puede no existir todavía (mes recién seleccionado),
    // así que el desplazamiento se hace tras pintar y, si el mes cambia, otra
    // vez cuando lleguen sus reservas.
    pendingScroll.current = dateStr
    navAt.current = Date.now()
    suppressSpy.current = true
    // Red de seguridad: si el destino no llega a existir, el scroll-spy no se
    // queda desactivado para siempre.
    setTimeout(() => { suppressSpy.current = false; pendingScroll.current = null }, 1200)
  }


  // Reutiliza goToDay: la sección de hoy puede no existir aún (si el día no
  // tiene reservas se crea al seleccionarlo), y goToDay ya espera al repintado
  // en vez de desplazar en el mismo tick, que era lo que dejaba el botón muerto.
  function jumpToToday() {
    goToDay(todayStr)
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
        // Tolerancia de 1px: evita que un decimal deje el día sin marcar
        if (el.getBoundingClientRect().top - offset <= 1) current = d
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

  type Gap = { start: number; end: number }

  /** Huecos que van justo entre dos reservas consecutivas (o en los extremos). */
  function gapsBefore(gaps: Gap[], prev: Booking | null, next: Booking | null): Gap[] {
    const prevEnd = prev ? (bookingRange(prev)?.end ?? null) : null
    const nextStart = next ? (bookingRange(next)?.start ?? null) : null
    return gaps.filter(g => {
      const afterPrev = prevEnd == null ? g.start <= (nextStart ?? Infinity) : g.start >= prevEnd
      const beforeNext = nextStart == null ? true : g.end <= nextStart
      if (prevEnd == null && nextStart == null) return true
      if (prevEnd == null) return g.end <= nextStart!
      return afterPrev && beforeNext
    })
  }
  // Escala de la línea de tiempo de escritorio: 0,625 px por minuto → 37,5 px/hora
  const TIMELINE_PX_PER_MIN = 0.625

  /**
   * Línea de tiempo de un día: cada reserva ocupa el alto que le corresponde
   * por su duración, y las que se pisan se reparten el ancho en columnas.
   */
  function renderDayTimeline(dateStr: string, dayBookings: Booking[], conflicts: Record<string, Booking[]>) {
    const columns = layoutColumns(dayBookings)
    const total = closeMins - openMins
    const isPast = dateStr < todayStr

    return (
      <div className="relative flex" style={{ height: total * TIMELINE_PX_PER_MIN }}>
        {/* Carril de horas */}
        <div className="w-12 lg:w-16 shrink-0 relative">
          {hourSlots.map(h => (
            <span key={h} className="absolute -translate-y-1/2 text-[11px] font-semibold text-mist tabular-nums"
              style={{ top: (h - openMins) * TIMELINE_PX_PER_MIN }}>
              {minutesToLabel(h)}
            </span>
          ))}
        </div>

        {/* Lienzo */}
        <div className="relative flex-1 min-w-0">
          {hourSlots.map(h => (
            <span key={h} className="absolute left-0 right-0 h-px bg-line/60"
              style={{ top: (h - openMins) * TIMELINE_PX_PER_MIN }} />
          ))}
          {/* Media hora: punteada fina, como referencia secundaria */}
          {hourSlots.map(h => (
            <span key={`half-${h}`} className="absolute left-0 right-0 border-t border-dotted border-line/50"
              style={{ top: (h + 30 - openMins) * TIMELINE_PX_PER_MIN }} />
          ))}

          {/* Franjas vacías: crean una reserva a esa hora */}
          {!isPast && hourSlots.map(h => (
            <button
              key={`slot-${h}`}
              onClick={() => openNewAt(dateStr, h, h + 60)}
              aria-label={`${minutesToLabel(h)} · ${t('calendario_libre')}`}
              className="absolute left-0 right-0 group"
              style={{ top: (h - openMins) * TIMELINE_PX_PER_MIN, height: 60 * TIMELINE_PX_PER_MIN }}
            >
              <span className="flex h-full w-full items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-mist">
                <Plus size={12} /> 
              </span>
            </button>
          ))}

          {/* Reservas, a escala */}
          {dayBookings.map(b => {
            const r = bookingRange(b)
            if (!r) return null
            const lay = columns[b.id] ?? { col: 0, cols: 1 }
            const widthPct = 100 / lay.cols
            const top = (Math.max(r.start, openMins) - openMins) * TIMELINE_PX_PER_MIN
            const height = Math.max(22, (Math.min(r.end, closeMins) - Math.max(r.start, openMins)) * TIMELINE_PX_PER_MIN - 3)
            return (
              <div
                key={b.id}
                className="absolute"
                style={{
                  top,
                  height,
                  left: `calc(${lay.col * widthPct}% + ${lay.col > 0 ? 3 : 0}px)`,
                  width: `calc(${widthPct}% - ${lay.cols > 1 ? 6 : 0}px)`,
                }}
              >
                {renderBookingCard(b, conflicts, dateStr, true)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  /**
   * Tarjeta de una reserva en la escala del día. Dos líneas: título con los
   * avisos, y titular + invitados + pendiente de pago. La hora no se repite:
   * la da la posición en la escala. Toda la tarjeta es el botón.
   */
  function renderBookingCard(b: Booking, conflicts: Record<string, Booking[]>, dateStr: string, fill = false) {
    const st = bookingLiveStatus(b, todayStr)
    const gA = b.guest_adults ?? 0
    const gC = b.guest_children ?? 0
    const totalG = bookingGuestCount(b)
    const pendiente = Math.max(0, (b.amount ?? 0) - (b.deposit_amount ?? 0))
    const hasConflict = !!conflicts[b.id]
    const sala = resourceOf(b)
    // En la escala, una reserva corta no da alto para dos líneas: se queda solo
    // con el título en vez de recortar la segunda a media altura.
    const r = bookingRange(b)
    const boxH = r ? (r.end - r.start) * TIMELINE_PX_PER_MIN : 999
    const showLinea2 = !fill || boxH >= 34

    const linea2 = [
      b.members?.name ?? null,
      totalG > 0
        ? `${totalG} ${b.type === 'custodia' ? t('calendario_ninos', { s: totalG !== 1 ? 's' : '' }) : t('calendario_invitados', { s: totalG !== 1 ? 's' : '' })}`
        : null,
      sala,
      pendiente > 0 && b.status !== 'cancelled' ? `${t('calendario_faltan')} ${pendiente.toFixed(0)}€` : null,
    ].filter(Boolean).join(' · ')

    return (
      <button
        onClick={() => router.push(`/calendario/${b.id}`)}
        title={hasConflict ? `${t('calendario_conflicto')}: ${conflicts[b.id].map(c => c.title).join(', ')}` : undefined}
        className={`w-full text-left overflow-hidden rounded-xl border px-2 py-[3px] ${
          hasConflict ? 'border-rose' : 'border-line'
        } bg-surface hover:bg-surface2 transition-colors ${st === 'pasado' ? 'opacity-50' : ''} ${fill ? 'h-full flex items-start gap-1.5' : 'flex items-start gap-1.5'}`}
      >
        <span className="w-1 self-stretch rounded-full shrink-0" style={bookingBarStyle(b.status, BOOKING_TYPE_COLOR_VAR[b.type])} />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-medium text-snow truncate leading-[1.15]">{b.title}</span>
            {hasConflict && <AlertTriangle size={11} className="text-rose shrink-0" />}
            {st === 'ejecutado' && <CheckCircle size={11} className="text-mint shrink-0" />}
            {st === 'en_curso' && <Clock size={11} className="text-lime shrink-0" />}
          </span>
          {linea2 && showLinea2 && (
            <span className="block text-[10px] text-fog truncate leading-[1.2]">{linea2}</span>
          )}
        </span>
      </button>
    )
  }

  /**
   * Fila compacta: una sola línea con el rango horario completo. Pensada para
   * ver la jornada entera —y los huecos— sin desplazarse.
   */
  function renderCompactRow(b: Booking, conflicts: Record<string, Booking[]>, simultaneas: number) {
    const ts = TYPE_STYLE[b.type]
    const st = bookingLiveStatus(b, todayStr)
    const isCancelled = b.status === 'cancelled'
    const pendiente = Math.max(0, (b.amount ?? 0) - (b.deposit_amount ?? 0))
    const hasConflict = !!conflicts[b.id]
    const r = bookingRange(b)
    return (
      <button
        key={b.id}
        onClick={() => router.push(`/calendario/${b.id}`)}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface2 ${
          isCancelled ? 'opacity-60' : st === 'pasado' ? 'opacity-50' : ''
        } ${hasConflict ? 'bg-rose/5' : ''}`}
      >
        <span className="w-[86px] shrink-0 text-[11px] text-fog tabular-nums">
          {r ? `${minutesToLabel(r.start)}–${minutesToLabel(r.end)}` : '—'}
        </span>
        <span className="w-1 h-4 rounded-full shrink-0" style={bookingBarStyle(b.status, BOOKING_TYPE_COLOR_VAR[b.type])} />
        <span className={`text-sm truncate ${isCancelled ? 'text-mist line-through' : 'text-snow'}`}>{b.title}</span>
        {b.members?.name && <span className="text-xs text-mist truncate hidden sm:inline">· {b.members.name}</span>}
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {simultaneas > 1 && !isCancelled && (
            <span className="text-[10px] text-mist">{simultaneas} {t('calendario_a_la_vez')}</span>
          )}
          {hasConflict && <AlertTriangle size={12} className="text-rose" />}
          {isCancelled
            ? <span className="text-[10px] font-semibold text-rose">{t('calendario_cancelada')}</span>
            : (
              <>
                {pendiente > 0 && <span className="text-[11px] font-semibold text-amber">{pendiente.toFixed(0)}€</span>}
                {st === 'ejecutado' && <CheckCircle size={12} className="text-mint" />}
                {st === 'en_curso' && <Clock size={12} className="text-lime" />}
                <span className={`text-[10px] font-semibold ${ts.badge} hidden sm:inline`}>{t(ts.labelKey)}</span>
              </>
            )}
        </span>
      </button>
    )
  }

  /** Hueco libre: clicable para crear una reserva ya con esa hora puesta. */
  function renderGap(dateStr: string, g: Gap) {
    return (
      <button
        key={`${dateStr}-${g.start}`}
        onClick={() => openNewAt(dateStr, g.start, g.end)}
        className="group flex w-full items-center gap-2 py-1.5 text-left"
      >
        <span className="w-16 shrink-0 text-[11px] text-mist">{minutesToLabel(g.start)}</span>
        <span className="flex-1 flex items-center gap-2">
          <span className="h-px flex-1 bg-line group-hover:bg-line2 transition-colors" />
          <span className="text-[11px] text-mist group-hover:text-fog transition-colors whitespace-nowrap">
            {durationLabel(g.end - g.start)} {t('calendario_libre')}
          </span>
          <Plus size={11} className="text-mist group-hover:text-lime transition-colors" />
          <span className="h-px flex-1 bg-line group-hover:bg-line2 transition-colors" />
        </span>
      </button>
    )
  }

  // Un punto por TIPO de reserva del día (cumpleaños, custodia, otros), con su
  // color: tres custodias siguen siendo un único punto celeste.
  function dayTypes(dateStr: string): BookingType[] {
    const present = new Set((bookingsByDate[dateStr] ?? []).filter(b => b.status !== 'cancelled').map(b => b.type))
    return (['birthday', 'custodia', 'other'] as BookingType[]).filter(x => present.has(x))
  }

  function renderCalendar(rows: Cell[][], compact = false) {
    // `compact`: versión del panel de escritorio, ajustada para que quepan tres
    // meses de alto sin scroll interno.
    const cellH = compact ? 'h-8' : 'h-12'
    const circle = compact ? 'w-7 h-7 text-[13px]' : 'w-9 h-9 text-sm'
    return (
      <>
        <div className="grid grid-cols-7">
          {DOW_LABELS.map(d => (
            <div key={d} className={`${compact ? 'py-0.5 text-[10px]' : 'py-1.5 text-[11px]'} text-center font-medium text-mist`}>{d}</div>
          ))}
        </div>
        {rows.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map(({ date: dateStr, inMonth }) => {
              // En el panel lateral cada mes muestra solo sus días: si el 1 de
              // septiembre saliera también en agosto, se marcaría dos veces.
              if (compact && !inMonth) return <span key={dateStr} className={cellH} />
              const day = Number(dateStr.slice(8, 10))
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const types = dayTypes(dateStr)
              const closed = !isOpenOn(dateStr, tenantInfo.schedule_days)
              return (
                <button
                  key={dateStr}
                  onClick={() => goToDay(dateStr)}
                  title={closed ? t('calendario_cerrado') : undefined}
                  className={`${cellH} flex flex-col items-center justify-center gap-1`}
                >
                  <span className={`${circle} flex items-center justify-center rounded-full transition-colors ${
                    isToday
                      ? `border-2 border-iris text-iris font-bold${isSelected ? ' bg-iris/15' : ''}`
                      : isSelected
                        ? 'bg-iris text-white font-bold'
                        : closed
                          ? 'text-mist/50 font-medium line-through hover:bg-surface2'
                          : inMonth
                            ? 'text-snow font-medium hover:bg-surface2'
                            : 'text-mist font-medium hover:bg-surface2'
                  }`}>
                    {day}
                  </span>
                  <span className="flex items-center gap-0.5 h-1">
                    {types.map(ty => (
                      <span
                        key={ty}
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: BOOKING_TYPE_COLOR_VAR[ty], opacity: inMonth ? 1 : 0.4 }}
                      />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </>
    )
  }

  return (
    <div className="bg-carbon text-snow lg:flex lg:items-start lg:gap-6">
      {/* ── Columna izquierda: cabecera + agenda ── */}
      <div className="lg:flex-1 lg:min-w-0">
      {/* ── Cabecera fija: mes + acciones + tira de calendario ── */}
      <div ref={headerRef} className="sticky top-0 z-20 bg-carbon -mx-4 md:-mx-6 lg:mx-0 px-4 md:px-6 lg:px-0 pt-2 pb-[22px] border-b border-line relative">
        <div className="flex items-center justify-between gap-3 pb-2">
          {/* Solo en escritorio: en móvil el título es el mes y lleva las
              flechas al lado, así que no cabe una línea más. */}
          <div className="hidden lg:block min-w-0">
            <h1 className="font-display text-3xl font-bold text-snow truncate">
              {t('nav_agenda')}
            </h1>
            <p className="text-sm text-fog mt-0.5 truncate">
              <span className="capitalize">{MONTH_NAMES[month]} {year}</span>
              {' · '}
              {resumenHoy.count === 0
                ? t('calendario_sin_reservas_hoy')
                : t('calendario_reservas_hoy', { n: resumenHoy.count })}
              {resumenHoy.pending > 0 && ` · ${formatEur(resumenHoy.pending)} ${t('calendario_por_cobrar').toLowerCase()}`}
            </p>
          </div>
          <div className="flex items-center gap-1 min-w-0 lg:hidden">
            <h1 className="font-display text-3xl font-bold text-snow lowercase truncate">
              {MONTH_NAMES[month]}
            </h1>
            <button
              onClick={() => shiftStrip(-1)}
              aria-label={stripExpanded ? MONTH_NAMES[(month + 11) % 12] : t('calendario_semana_anterior')}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors ml-1"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => shiftStrip(1)}
              aria-label={stripExpanded ? MONTH_NAMES[(month + 1) % 12] : t('calendario_semana_siguiente')}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Acciones a la altura del título */}
          <div className="flex items-center gap-1 shrink-0 relative">
            <button
              onClick={() => setFiltersOpen(o => !o)}
              aria-label={t('calendario_filtros')}
              title={t('calendario_filtros')}
              className={`relative w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
                filtersActive > 0 || search ? 'border-iris text-iris' : 'border-line text-fog hover:text-snow'
              }`}
            >
              <Filter size={16} />
              {filtersActive > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-iris border-2 border-carbon text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {filtersActive}
                </span>
              )}
            </button>

            {/* Compactar: una línea por reserva */}
            <button
              onClick={toggleCompact}
              aria-pressed={compact}
              aria-label={compact ? t('calendario_expandir_tarjetas') : t('calendario_compactar')}
              title={compact ? t('calendario_expandir_tarjetas') : t('calendario_compactar')}
              className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
                compact ? 'border-iris text-iris' : 'border-line text-fog hover:text-snow'
              }`}
            >
              {compact ? <LayoutList size={16} /> : <Rows3 size={16} />}
            </button>

            {/* Desplegable de filtros */}
            {filtersOpen && (
              <>
                <button className="fixed inset-0 z-30 cursor-default" aria-hidden onClick={() => setFiltersOpen(false)} />
                <div className="absolute right-0 top-11 z-40 w-[19rem] rounded-xl border border-line bg-surface p-3 shadow-2xl space-y-3">
                  {/* La búsqueda vive dentro del propio desplegable */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
                    <input
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder={t('calendario_buscar')}
                      className="w-full rounded-lg border border-line bg-surface2 py-2 pl-8 pr-8 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors"
                    />
                    {search && (
                      <button onClick={() => setSearch('')} aria-label={t('calendario_cerrar')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-mist hover:text-snow transition-colors">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">{t('calendario_tipo')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {([['todos', t('calendario_todos')], ['birthday', t('calendario_tipo_cumpleanos')], ['custodia', t('calendario_tipo_custodia')], ['other', t('calendario_tipo_otro')]] as const).map(([v, label]) => (
                        <button key={v} onClick={() => setFilterType(v as typeof filterType)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                            filterType === v ? 'border-iris bg-iris/10 text-iris' : 'border-line text-fog hover:text-snow'
                          }`}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">{t('calendario_pago')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {([['todos', t('calendario_todos')], ['pendiente', t('calendario_solo_pendientes')], ['pagado', t('calendario_solo_pagadas')]] as const).map(([v, label]) => (
                        <button key={v} onClick={() => setFilterPago(v as typeof filterPago)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                            filterPago === v ? 'border-iris bg-iris/10 text-iris' : 'border-line text-fog hover:text-snow'
                          }`}>{label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Tira de calendario plegable (en escritorio vive en el panel derecho) ── */}
        <div className="lg:hidden">{renderCalendar(visibleWeeks)}</div>

        {/* Pestaña sobresaliente: cuelga por debajo del borde del panel */}
        <button
          onClick={() => setStripExpanded(o => !o)}
          aria-label={stripExpanded ? t('calendario_contraer_calendario') : t('calendario_expandir_calendario')}
          aria-expanded={stripExpanded}
          className="lg:hidden absolute right-4 -bottom-[26px] z-10 flex items-center justify-center w-12 h-[26px] rounded-b-xl border border-t-0 border-line bg-surface text-fog hover:text-snow hover:bg-surface2 transition-colors shadow-sm"
        >
          {stripExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* ── Rejilla horaria del día seleccionado ── */}
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
            const allDay = dayBookings.filter(b => !b.start_time && b.status !== 'cancelled')
            const timedAll = dayBookings.filter(b => b.start_time)
            const timed = timedAll.filter(b => b.status !== 'cancelled')
            const cancelled = dayBookings.filter(b => b.status === 'cancelled')
            const isToday = dateStr === todayStr
            const sum = daySummary(allByDate[dateStr] ?? [])
            const aforoOver = !!tenantInfo.capacity && sum.people > tenantInfo.capacity
            const conflicts = conflictMap(allByDate[dateStr] ?? [], resourceByService)
            const gaps = dateStr >= todayStr ? freeGaps(allByDate[dateStr] ?? [], openMins, closeMins, 45) : []
            const clusters = overlapClusters(timed)
            // Línea de tiempo del modo compacto: reservas (también canceladas)
            // y huecos ordenados por hora de inicio.
            const simulCount: Record<string, number> = {}
            clusters.forEach(c => c.forEach(b => { simulCount[b.id] = c.length }))
            const timeline: ({ kind: 'booking'; booking: Booking; simultaneas: number; at: number }
                           | { kind: 'gap'; gap: { start: number; end: number }; at: number })[] = [
              ...timedAll.map(b => ({
                kind: 'booking' as const, booking: b,
                simultaneas: simulCount[b.id] ?? 1,
                at: bookingRange(b)?.start ?? 0,
              })),
              ...gaps.map(g => ({ kind: 'gap' as const, gap: g, at: g.start })),
            ].sort((a, b) => a.at - b.at)
            return (
              <div
                key={dateStr}
                ref={el => { dayRefs.current[dateStr] = el }}
                className="pt-6 lg:pt-8"
              >
                {/* Cabecera del día: banda con el resumen operativo de la jornada */}
                <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-3 rounded-xl px-3 py-2 ${
                  isToday ? 'bg-iris/10' : 'bg-surface2'
                }`}>
                  <span className={`text-lg font-bold ${isToday ? 'text-iris' : 'text-snow'}`}>
                    {dayHeading(dateStr)}
                  </span>
                  <span className={`text-sm ${isToday ? 'text-iris' : 'text-mist'}`}>
                    {relativeLabel(dateStr)}
                  </span>
                  {!isOpenOn(dateStr, tenantInfo.schedule_days) && (
                    <span className="text-[11px] font-semibold text-amber">{t('calendario_cerrado')}</span>
                  )}
                  <span className="ml-auto text-right text-[11px] text-fog leading-tight">
                    <span className="block">
                      {t('calendario_n_reservas', { n: sum.count, s: sum.count !== 1 ? 's' : '' })}
                      {sum.people > 0 && (
                        <span className={aforoOver ? 'text-rose font-semibold' : ''}>
                          {' · '}{sum.people}{tenantInfo.capacity ? `/${tenantInfo.capacity}` : ''} {t('calendario_personas')}
                        </span>
                      )}
                    </span>
                    {sum.pending > 0 && (
                      <span className="block text-amber font-semibold">
                        {t('calendario_por_cobrar')} {sum.pending.toFixed(0)}€
                      </span>
                    )}
                  </span>
                </div>

                {dayBookings.length === 0 && (
                  <p className="text-sm text-mist py-2">{t('calendario_sin_reservas')}</p>
                )}

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

                {/* Modo compacto: toda la jornada en una línea por reserva,
                    canceladas incluidas y con los huecos en su sitio. */}
                {compact ? (
                  <div className="space-y-0.5">
                    {timeline.map(item =>
                      item.kind === 'gap'
                        ? renderGap(dateStr, item.gap)
                        : renderCompactRow(item.booking, conflicts, item.simultaneas)
                    )}
                  </div>
                ) : (
                <>
                {/* La reserva ocupa su franja real de la escala, en móvil y en escritorio */}
                {renderDayTimeline(dateStr, timed, conflicts)}

                {/* Canceladas: plegadas para que no compitan con las vivas */}
                  {cancelled.length > 0 && (
                    <div className="pt-1">
                      <button
                        onClick={() => setShowCancelled(v => !v)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-mist hover:text-fog transition-colors"
                      >
                        {showCancelled ? <EyeOff size={12} /> : <Eye size={12} />}
                        {showCancelled ? t('calendario_ocultar_canceladas') : `${t('calendario_ver_canceladas')} (${cancelled.length})`}
                      </button>
                      {showCancelled && (
                        <div className="mt-2 space-y-1">
                          {cancelled.map(c => renderCompactRow(c, conflicts, 1))}
                        </div>
                      )}
                    </div>
                  )}
                </>
                )}
              </div>
            )
          })
        )}
      </div>
      </div>

      {/* ── Escritorio: calendario del mes siempre desplegado, a la derecha ── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[320px] lg:shrink-0 lg:sticky lg:top-0 lg:h-dvh lg:py-3">
        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2 px-1">
          {t('calendario_titulo_panel')}
        </p>
        <div className="flex-1 flex flex-col justify-between rounded-2xl border border-line bg-surface px-3 pb-3 overflow-hidden">
          {[-1, 0, 1].map((rel, i) => {
            const d = new Date(year, month + panelOffset + rel, 1)
            return (
              <div key={`${d.getFullYear()}-${d.getMonth()}`} className={i > 0 ? 'mt-3 pt-3 border-t border-line/60' : 'pt-3'}>
                {/* Las flechas viven dentro del panel, en la fila del mes */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h2 className="font-display text-base font-bold text-snow capitalize truncate">
                    {MONTH_NAMES[d.getMonth()]}{d.getFullYear() !== year ? ` ${d.getFullYear()}` : ''}
                  </h2>
                  {i === 0 && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => setPanelOffset(o => o - 1)}
                        aria-label={t('calendario_mes_anterior')}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => setPanelOffset(o => o + 1)}
                        aria-label={t('calendario_mes_siguiente')}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
                {renderCalendar(weeksOf(d.getFullYear(), d.getMonth()), true)}
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── Píldora «Hoy» cuando la agenda está lejos del día actual ── */}
      {showJumpToday && (
        <button
          onClick={jumpToToday}
          className="fixed left-1/2 -translate-x-1/2 bottom-above-nav z-30 flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-iris shadow-2xl hover:bg-surface2 transition-colors"
        >
          <ArrowUp size={14} /> {t('calendario_ir_a_hoy')}
        </button>
      )}

      {/* ── Botón flotante de nueva reserva ── */}
      <button
        onClick={openNewFlow}
        aria-label={t('calendario_nueva_reserva')}
        className="fixed bottom-above-nav right-4 lg:right-8 z-30 w-14 h-14 rounded-full bg-iris text-white flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
      >
        <CalendarPlus size={22} />
      </button>

      {/* ── New booking modal ── */}

      {/* ── Nuevo titular (mismos campos que /miembros/nuevo) ── */}
      {showAddMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowAddMember(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[85dvh]" onClick={e => e.stopPropagation()}>
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
          selectedDate={flowDate ?? selectedDate ?? todayStr}
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
