'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, X, Clock, User, FileText, Tag, Calendar, Users, Euro, Pencil, Trash2, LogIn, CheckCircle, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant } from '@/lib/tenant'
import { BookingSearchAndTypeModal, BookingFormModal, type FullMember, type BookingService, type BookingInitial } from '@/app/HomeClient'

type BookingType = 'birthday' | 'custodia' | 'other'
type BookingStatus = 'pending' | 'confirmed' | 'cancelled'
type PaymentStatus = 'pending' | 'paid'

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

const inputClass = 'w-full bg-surface2 border border-line rounded-xl px-4 py-2 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
const DOW_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

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

function bookingColor(t: BookingType) { return t === 'birthday' ? 'bg-iris' : t === 'custodia' ? 'bg-amber-400' : 'bg-fog' }
function bookingBadge(t: BookingType) { return t === 'birthday' ? 'bg-iris/20 text-iris border border-iris/30' : t === 'custodia' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-fog/20 text-fog border border-fog/30' }
function statusBadge(s: BookingStatus) { return s === 'confirmed' ? 'bg-lime/20 text-lime border border-lime/30' : s === 'cancelled' ? 'bg-rose/20 text-rose border border-rose/30' : 'bg-fog/20 text-fog border border-fog/30' }
function paymentBadge(p: PaymentStatus) { return p === 'paid' ? 'bg-mint/20 text-mint border border-mint/30' : 'bg-amber/20 text-amber border border-amber/30' }

// Estilo por tipo alineado con la "Agenda de hoy" del inicio
const TYPE_STYLE: Record<BookingType, { bar: string; badge: string; label: string }> = {
  birthday: { bar: 'bg-iris',     badge: 'bg-iris/10 text-iris border-iris/30',           label: 'Cumpleaños' },
  custodia: { bar: 'bg-cyan-300', badge: 'bg-cyan-300/10 text-cyan-300 border-cyan-300/30', label: 'Custodia' },
  other:    { bar: 'bg-lime',     badge: 'bg-lime/10 text-lime border-lime/30',            label: 'Otro' },
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

const EMPTY_NEW_MEMBER = { name: '', phone: '', birth_date: '' }

export default function CalendarioPage() {
  const router = useRouter()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
  const [executingId, setExecutingId] = useState<string | null>(null)
  // Add-member popup
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberForm, setNewMemberForm] = useState(EMPTY_NEW_MEMBER)
  const [savingMember, setSavingMember] = useState(false)
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
      .select('id, name, description, category, price, deposit_pct, price_per_guest_adult, price_per_guest_child, included_guests, applies_to, reservable, tipo, flujo')
      .eq('active', true).order('sort_order')
      .then(({ data }) => {
        if (!data) return
        setBookingServices(data as BookingService[])
        const entradas = (data as any[]).filter(r => r.tipo === 'entrada')
        const a = entradas.find(r => /adult/i.test(r.name)) ?? entradas.find(r => r.price_unit !== 'hora')
        const c = entradas.find(r => /ni[ñn]/i.test(r.name)) ?? entradas.find(r => r.price_unit === 'hora')
        if (a) setRateAdult(Number(a.price))
        if (c) setRateChild(Number(c.price))
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
    ? flowMembers.filter(m => {
        const q = flowQuery.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        const n = m.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        const qd = q.replace(/\D/g, '')
        return n.includes(q) || (qd.length > 0 && (m.phone ?? '').replace(/\D/g, '').includes(qd))
      })
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

    const guestsCount = b.guests ?? 0
    // For birthday: 1 adult (titular) + guests as children (party attendees)
    // For custodia: 0 adults (no parent stays) + guests as children (kids left in custody)
    // For other: 1 adult + guests as guests
    const adultsCount = b.type === 'custodia' ? 0 : 1
    const childrenCount = b.type === 'other' ? 0 : guestsCount

    const { error } = await supabase.from('visits').insert({
      member_id: b.member_id,
      checked_in_at: new Date().toISOString(),
      visit_type: b.type === 'custodia' ? 'custodia' : 'entrada',
      booking_id: b.id,
      adults_count: adultsCount,
      children_count: childrenCount,
    })

    if (error) {
      alert(`Error al registrar la visita: ${error.message}`)
      setExecutingId(null)
      return
    }

    await supabase.from('bookings').update({ executed_at: new Date().toISOString(), status: 'confirmed' }).eq('id', b.id)
    setExecutingId(null)
    router.push('/checkin?tab=dentro')
  }

  useEffect(() => { fetchBookings() }, [fetchBookings])
  useEffect(() => { fetchMembers() }, [fetchMembers])

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1); setSelectedDate(null) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1); setSelectedDate(null) }

  async function handleCancel(id: string) {
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    fetchBookings()
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault(); setSavingMember(true)
    const { data } = await supabase.from('members').insert({
      name: newMemberForm.name,
      phone: newMemberForm.phone || null,
      birth_date: newMemberForm.birth_date || null,
    }).select('id, name, phone, children').single()
    setSavingMember(false)
    if (data) {
      fetchMembers()
      const member = data as Member
      // Volver al flujo compartido con el titular recién creado preseleccionado
      newMemberForFlow.current = false
      setFlowMember({ id: member.id, name: member.name, phone: (member as any).phone ?? null, family_id: null, memberships: [], children: (member.children ?? []).map(c => ({ name: c.name, birth_date: c.birth_date ?? '' })) })
      setFlowStep('pick')
    }
    setShowAddMember(false)
    setNewMemberForm(EMPTY_NEW_MEMBER)
  }

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
            <h1 className="text-2xl font-display font-bold text-snow">Agenda</h1>
            <p className="text-sm text-mist mt-0.5">Reservas y custodia</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openNewFlow} className="flex items-center gap-2 bg-lime text-ink font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-lime/90 transition-colors">
              <Plus size={16} /> Nueva reserva
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
            {DOW_LABELS.map(d => <div key={d} className="py-2 text-center text-[10px] font-semibold text-mist uppercase tracking-wide">{d}</div>)}
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
                  className={`min-h-[64px] p-1.5 border-r border-line/50 text-left transition-colors ${!isLastRow ? 'border-b' : ''} ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''} ${isSelected ? 'bg-lime/10' : 'hover:bg-surface2'}`}>
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-lime text-ink' : isSelected ? 'text-lime' : 'text-fog'}`}>{day}</span>
                  <div className="flex flex-wrap gap-0.5">
                    {dayBookings.filter(b => b.status !== 'cancelled').slice(0, 3).map(b => <span key={b.id} className={`w-2 h-2 rounded-full ${bookingColor(b.type)}`} />)}
                    {dayBookings.filter(b => b.status !== 'cancelled').length > 3 && <span className="text-[9px] text-mist self-end">+{dayBookings.filter(b => b.status !== 'cancelled').length - 3}</span>}
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
                <p className="text-xs text-mist mt-0.5">{allSelectedBookings.length} reserva{allSelectedBookings.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="text-mist hover:text-fog"><X size={16} /></button>
            </div>
            {allSelectedBookings.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-mist">No hay reservas este día</div>
            ) : (
              <div className="divide-y divide-line">
                {allSelectedBookings.map(b => {
                  const ts = TYPE_STYLE[b.type]
                  const st = bookingLiveStatus(b, todayStr)
                  const gA = b.guest_adults ?? 0
                  const gC = b.guest_children ?? 0
                  const totalG = b.guests ?? (gA + gC)
                  const canExecute = st !== 'ejecutado' && b.status !== 'cancelled' && !!b.member_id && b.date === todayStr
                  return (
                    <div key={b.id} className={`flex gap-0 ${st === 'pasado' ? 'opacity-50' : ''}`}>
                      <div className={`w-1 shrink-0 ${ts.bar}`} />
                      <button onClick={() => openEditFlow(b)} className="flex-1 px-4 py-3 flex items-start gap-3 text-left hover:bg-surface2 transition-colors">
                        <div className="shrink-0 text-right w-14">
                          <p className="text-xs font-semibold text-snow">{b.start_time?.slice(0, 5) ?? '—'}</p>
                          {b.end_time && <p className="text-[10px] text-mist">{b.end_time.slice(0, 5)}</p>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-xs font-semibold text-snow">{b.title}</p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${ts.badge}`}>{ts.label}</span>
                            {st === 'ejecutado' && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-mint/10 text-mint border-mint/30 flex items-center gap-0.5"><CheckCircle size={9} />Ejecutado</span>}
                            {st === 'en_curso' && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-lime/10 text-lime border-lime/30 flex items-center gap-0.5"><Clock size={9} />En curso</span>}
                            {b.status === 'cancelled' && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-rose/10 text-rose border-rose/30">Cancelada</span>}
                          </div>
                          {b.members?.name && <p className="text-[11px] text-fog">{b.members.name}</p>}
                          {(totalG > 0 || gA > 0 || gC > 0) && (
                            <p className="text-[11px] text-mist">
                              {totalG} {b.type === 'custodia' ? `niño${totalG !== 1 ? 's' : ''}` : `invitado${totalG !== 1 ? 's' : ''}`}
                              {b.type !== 'custodia' && (gA > 0 || gC > 0) && <span> · {gA} adulto{gA !== 1 ? 's' : ''}, {gC} niño{gC !== 1 ? 's' : ''}</span>}
                            </p>
                          )}
                        </div>
                        {canExecute && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); handleExecute(b) }}
                            disabled={executingId === b.id}
                            className="flex items-center gap-1 text-[10px] font-semibold text-ink bg-lime rounded-lg px-2 py-1 shrink-0 hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
                          >
                            <LogIn size={11} /> {executingId === b.id ? '...' : 'Ejecutar'}
                          </button>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── New booking modal ── */}

      {/* ── Add member popup (on top of booking modal) ── */}
      {showAddMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAddMember(false)} />
          <div className="relative w-full max-w-sm bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="text-sm font-semibold text-snow">Nuevo titular</h3>
              <button onClick={() => setShowAddMember(false)} className="text-mist hover:text-fog"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddMember} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Nombre completo *</label>
                <input
                  required
                  value={newMemberForm.name}
                  onChange={e => setNewMemberForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Ana García"
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Teléfono</label>
                <input
                  type="tel"
                  value={newMemberForm.phone}
                  onChange={e => setNewMemberForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Ej: 612 345 678"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Fecha de nacimiento</label>
                <input
                  type="date"
                  value={newMemberForm.birth_date}
                  onChange={e => setNewMemberForm(f => ({ ...f, birth_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={savingMember}
                className="w-full bg-iris text-snow font-semibold py-2.5 rounded-xl text-sm hover:bg-iris/80 transition-colors disabled:opacity-50"
              >
                {savingMember ? 'Guardando...' : 'Crear titular'}
              </button>
            </form>
          </div>
        </div>
      )}


      {/* ── Flujo compartido: crear/editar reserva (mismo componente que Inicio) ── */}
      {flowStep === 'pick' && (
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
