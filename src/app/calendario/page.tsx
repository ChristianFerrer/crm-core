'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, Clock, User, FileText, Tag, Calendar, Users, Euro, Pencil, Trash2, CheckCircle, UserPlus, CalendarPlus, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant } from '@/lib/tenant'
import { executeBooking } from '@/lib/bookingExecution'
import { memberMatchesQuery } from '@/lib/searchMembers'
import { resolveRates } from '@/lib/pricing'
import { BookingSearchAndTypeModal, BookingFormModal, type FullMember, type BookingService, type BookingInitial } from '@/app/HomeClient'
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

  const fetchBookings = useCallback(async () => {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(getDaysInMonth(year, month)).padStart(2, '0')}`
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

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1); setSelectedDate(null) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1); setSelectedDate(null) }

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

  const cells: (number | null)[] = [...Array(getFirstDayOfWeek(year, month)).fill(null), ...Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const bookingsByDate: Record<string, Booking[]> = {}
  bookings.forEach(b => { if (!bookingsByDate[b.date]) bookingsByDate[b.date] = []; bookingsByDate[b.date].push(b) })
  const allSelectedBookings = selectedDate ? bookings.filter(b => b.date === selectedDate) : []

  return (
    <div className="min-h-screen bg-carbon text-snow pb-24 lg:pb-8">
      <div className="px-4 pt-8 pb-4 lg:px-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-snow">{t('calendario_titulo')}</h1>
            <p className="text-sm text-mist mt-0.5">{t('calendario_subtitulo')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openNewFlow} className="flex items-center gap-2 border border-iris bg-iris/10 text-iris font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-iris/20 transition-colors">
              <CalendarPlus size={16} /> {t('calendario_nueva_reserva')}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-8 space-y-4">
        {/* Calendar grid */}
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-surface2 transition-colors text-fog hover:text-snow"><ChevronLeft size={18} /></button>
            <span className="text-sm font-semibold text-snow">{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-surface2 transition-colors text-fog hover:text-snow"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-line">
            {DOW_LABELS.map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-mist uppercase tracking-wide">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="min-h-[64px] border-b border-r border-line/50 last:border-r-0" />
              const dateStr = toDateStr(year, month, day)
              const dayBookings = bookingsByDate[dateStr] ?? []
              const isToday = dateStr === toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
              const isSelected = dateStr === selectedDate
              const isLastRow = idx >= cells.length - 7
              return (
                <button key={dateStr} onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`min-h-[64px] p-1.5 border-r border-line/50 text-left transition-colors ${!isLastRow ? 'border-b' : ''} ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''} ${isSelected ? 'ring-[3px] ring-inset ring-rose relative z-10' : 'hover:bg-surface2'}`}>
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-lime text-ink' : isSelected ? 'text-rose' : 'text-fog'}`}>{day}</span>
                  <div className="flex flex-wrap gap-0.5">
                    {dayBookings.filter(b => b.status !== 'cancelled').slice(0, 3).map(b => <span key={b.id} className={`w-2 h-2 rounded-full ${bookingColor(b.type)}`} />)}
                    {dayBookings.filter(b => b.status !== 'cancelled').length > 3 && <span className="text-xs text-mist self-end">+{dayBookings.filter(b => b.status !== 'cancelled').length - 3}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Day detail */}
        {selectedDate && (
          <div className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-snow">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <p className="text-xs text-mist mt-0.5">{(() => { const n = allSelectedBookings.filter(b => b.status !== 'cancelled').length; return t('calendario_n_reservas', { n, s: n !== 1 ? 's' : '' }) })()}</p>
              </div>
              <button onClick={() => setSelectedDate(null)} aria-label={t('calendario_cerrar')} className="text-mist hover:text-fog"><X size={16} /></button>
            </div>
            {allSelectedBookings.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-mist">{t('calendario_no_hay_reservas')}</div>
            ) : (
              <div className="divide-y divide-line">
                {allSelectedBookings.map(b => {
                  const ts = TYPE_STYLE[b.type]
                  const st = bookingLiveStatus(b, todayStr)
                  const gA = b.guest_adults ?? 0
                  const gC = b.guest_children ?? 0
                  const totalG = b.guests ?? (gA + gC)
                  const canExecute = st !== 'ejecutado' && b.status !== 'cancelled' && !!b.member_id && b.date === todayStr
                  const pendiente = Math.max(0, (b.amount ?? 0) - (b.deposit_amount ?? 0))
                  const showPago = b.status !== 'cancelled' && (b.amount != null && b.amount > 0)
                  return (
                    <div key={b.id} className={`flex items-stretch gap-0 hover:bg-surface2 transition-colors ${st === 'pasado' ? 'opacity-50' : ''}`}>
                      <div className={`w-1 shrink-0 ${ts.bar}`} />
                      <button onClick={() => openEditFlow(b)} className="flex-1 min-w-0 px-4 py-3 flex items-start gap-3 text-left">
                        <div className="shrink-0 text-right w-14">
                          <p className="text-xs font-semibold text-snow">{b.start_time?.slice(0, 5) ?? '—'}</p>
                          {b.end_time && <p className="text-xs text-mist">{b.end_time.slice(0, 5)}</p>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-xs font-semibold text-snow">{b.title}</p>
                            <span className={`text-xs font-semibold ${ts.badge}`}>{t(ts.labelKey)}</span>
                            {st === 'ejecutado' && <span className="text-xs font-semibold text-mint flex items-center gap-0.5"><CheckCircle size={9} />{t('calendario_ejecutado')}</span>}
                            {st === 'en_curso' && <span className="text-xs font-semibold text-lime flex items-center gap-0.5"><Clock size={9} />{t('calendario_en_curso')}</span>}
                            {b.status === 'cancelled' && <span className="text-xs font-semibold text-rose">{t('calendario_cancelada')}</span>}
                            {showPago && (
                              <span className={`text-xs font-semibold ${paymentBadge(b.payment_status)}`}>
                                {t(paymentLabelKey(b.payment_status))}{b.payment_status !== 'paid' && pendiente > 0 ? ` · ${pendiente.toFixed(0)}€` : ''}
                              </span>
                            )}
                          </div>
                          {b.members?.name && <p className="text-xs text-fog">{b.members.name}</p>}
                          {(totalG > 0 || gA > 0 || gC > 0) && (
                            <p className="text-xs text-mist">
                              {totalG} {b.type === 'custodia' ? t('calendario_ninos', { s: totalG !== 1 ? 's' : '' }) : t('calendario_invitados', { s: totalG !== 1 ? 's' : '' })}
                              {b.type !== 'custodia' && (gA > 0 || gC > 0) && <span> · {gA} {t('calendario_adultos', { s: gA !== 1 ? 's' : '' })}, {gC} {t('calendario_ninos', { s: gC !== 1 ? 's' : '' })}</span>}
                            </p>
                          )}
                        </div>
                      </button>
                      {canExecute && (
                        <button
                          type="button"
                          onClick={() => handleExecute(b)}
                          disabled={executingId === b.id}
                          className="flex items-center gap-1 self-center text-xs font-semibold text-lime border border-lime bg-lime/10 rounded-lg px-2 py-1 mr-4 shrink-0 hover:bg-lime/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                          <Play size={11} fill="currentColor" /> {executingId === b.id ? '...' : t('calendario_ejecutar')}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

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
