'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, X, Clock, User, FileText, Tag, Calendar, Users, Euro, Pencil, Trash2, List, LogIn, CheckCircle, UserPlus } from 'lucide-react'
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

const EMPTY_FORM = { type: 'birthday' as BookingType, title: '', child_name: '', date: '', start_time: '', end_time: '', member_id: '', guests: '', amount: '', notes: '' }
const EMPTY_NEW_MEMBER = { name: '', phone: '', birth_date: '' }

export default function CalendarioPage() {
  const router = useRouter()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [showUpcoming, setShowUpcoming] = useState(false)
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  // For custodia: independently track selected children names
  const [custodiaChildren, setCustodiaChildren] = useState<string[]>([])
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
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
  const [flowCategory, setFlowCategory] = useState('otros')
  const [flowQuery, setFlowQuery] = useState('')
  const [flowEditId, setFlowEditId] = useState<string | null>(null)
  const [flowInitial, setFlowInitial] = useState<BookingInitial | null>(null)
  const [bookingServices, setBookingServices] = useState<BookingService[]>([])
  const [rateAdult, setRateAdult] = useState(3)
  const [rateChild, setRateChild] = useState(7)
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({ cumpleanos: 'Cumpleaños', custodia: 'Custodia', otros: 'Otro' })

  useEffect(() => {
    supabase.from('services')
      .select('id, name, description, category, price, deposit_pct, price_per_guest_adult, price_per_guest_child, included_guests, applies_to, reservable')
      .eq('active', true).order('sort_order')
      .then(({ data }) => {
        if (!data) return
        setBookingServices(data as BookingService[])
        const a = (data as any[]).find(r => r.category === 'entrada' && r.name === 'Adulto')
        const c = (data as any[]).find(r => r.category === 'entrada' && r.name === 'Niño')
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
    const preferred = ['cumpleanos', 'custodia', 'otros']
    const cats = Array.from(new Set(bookingServices.filter(s => s.reservable).map(s => s.category)))
    cats.sort((x, y) => (preferred.indexOf(x) === -1 ? 99 : preferred.indexOf(x)) - (preferred.indexOf(y) === -1 ? 99 : preferred.indexOf(y)))
    return cats.map(cat => ({
      category: cat,
      flow: (cat === 'cumpleanos' ? 'birthday' : cat === 'custodia' ? 'custodia' : 'other') as 'birthday' | 'custodia' | 'other',
      label: categoryLabels[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1),
    }))
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

  function closeFlow() { setFlowStep(null); setFlowMember(null); setFlowQuery(''); setFlowEditId(null); setFlowInitial(null) }
  function openNewFlow() { setFlowEditId(null); setFlowInitial(null); setFlowMember(null); setFlowQuery(''); setFlowStep('pick') }
  function openEditFlow(b: Booking) {
    if (!b.member_id || !b.members) return
    const mem: FullMember = {
      id: b.members.id, name: b.members.name, phone: null, family_id: null, memberships: [],
      children: (b.members.children ?? []).map(c => ({ name: c.name, birth_date: c.birth_date ?? '' })),
    }
    const cat = bookingServices.find(s => s.id === b.service_id)?.category ?? (b.type === 'birthday' ? 'cumpleanos' : b.type === 'custodia' ? 'custodia' : 'otros')
    setFlowMember(mem)
    setFlowType(b.type)
    setFlowCategory(cat)
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
  useEffect(() => {
    if (!showUpcoming) return
    const from = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
    const future = new Date(); future.setDate(future.getDate() + 60)
    const to = toDateStr(future.getFullYear(), future.getMonth(), future.getDate())
    supabase
      .from('bookings')
      .select('id, date, start_time, end_time, type, title, child_name, member_id, members(id, name, children), notes, status, guests, payment_status, amount')
      .gte('date', from).lte('date', to).neq('status', 'cancelled').order('date').order('start_time')
      .then(({ data }) => setUpcomingBookings((data ?? []) as unknown as Booking[]))
  }, [showUpcoming])

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1); setSelectedDate(null) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1); setSelectedDate(null) }

  function openNewBooking() {
    // Reutiliza el mismo flujo de nueva reserva de la pantalla de inicio
    const d = selectedDate ?? toDateStr(year, month, today.getDate())
    router.push(`/?nueva=1&date=${d}`)
  }

  // Derived member data for the form
  const selectedMember = members.find(m => m.id === form.member_id) ?? null
  const memberChildren: MemberChild[] = selectedMember?.children ?? []

  function handleMemberChange(memberId: string) {
    const member = members.find(m => m.id === memberId) ?? null
    setForm(f => ({
      ...f,
      member_id: memberId,
      // Auto-fill title for custodia
      title: f.type === 'custodia' && member ? `Custodia · ${member.name}` : f.title,
      // Clear child_name when member changes
      child_name: '',
    }))
    setCustodiaChildren([])
  }

  function handleChildSelect(childName: string) {
    setForm(f => ({
      ...f,
      child_name: childName,
      title: childName ? `Cumple de ${childName}` : f.title,
    }))
  }

  function toggleCustodiaChild(name: string) {
    setCustodiaChildren(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    let guestsValue: number | null = form.guests ? parseInt(form.guests) : null
    if (form.type === 'custodia') {
      // guests = selected children + additional invitados
      const extra = form.guests ? parseInt(form.guests) : 0
      guestsValue = custodiaChildren.length + extra || null
    }
    await supabase.from('bookings').insert({
      type: form.type, title: form.title, date: form.date,
      child_name: form.child_name || null,
      start_time: form.start_time || null, end_time: form.end_time || null,
      member_id: form.member_id || null,
      guests: guestsValue,
      amount: form.amount ? parseFloat(form.amount) : null,
      notes: form.notes || null, status: 'pending', payment_status: 'pending',
    })
    setLoading(false); setShowModal(false); fetchBookings()
  }

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
      if (newMemberForFlow.current) {
        // Volver al flujo compartido con el titular recién creado preseleccionado
        newMemberForFlow.current = false
        setFlowMember({ id: member.id, name: member.name, phone: (member as any).phone ?? null, family_id: null, memberships: [], children: (member.children ?? []).map(c => ({ name: c.name, birth_date: c.birth_date ?? '' })) })
        setFlowStep('pick')
      } else {
        setForm(f => ({
          ...f,
          member_id: member.id,
          title: f.type === 'custodia' ? `Custodia · ${member.name}` : f.title,
        }))
      }
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
            <button
              onClick={() => setShowUpcoming(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${showUpcoming ? 'bg-iris/15 text-iris border-iris/30' : 'border-line bg-surface text-fog hover:text-snow'}`}
            >
              <List size={15} /> Próximas
            </button>
            <button onClick={openNewFlow} className="flex items-center gap-2 bg-lime text-ink font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-lime/90 transition-colors">
              <Plus size={16} /> Nueva reserva
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-8 space-y-4">
        {/* Próximas reservas */}
        {showUpcoming && (
          <div className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-snow">Próximas reservas</p>
                <p className="text-xs text-mist mt-0.5">{upcomingBookings.length} reserva{upcomingBookings.length !== 1 ? 's' : ''} en los próximos 60 días</p>
              </div>
              <button onClick={() => setShowUpcoming(false)} className="text-mist hover:text-fog"><X size={16} /></button>
            </div>
            {upcomingBookings.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-mist">Sin reservas próximas</div>
            ) : (
              <div className="divide-y divide-line max-h-[50vh] overflow-y-auto">
                {upcomingBookings.map(b => (
                  <button
                    key={b.id}
                    onClick={() => { setSelectedDate(b.date); setShowUpcoming(false) }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-surface2 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${bookingColor(b.type)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-snow truncate">{b.child_name || b.title}</p>
                      <p className="text-xs text-mist mt-0.5">
                        {new Date(b.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {b.start_time ? ` · ${b.start_time.slice(0, 5)}` : ''}
                        {b.members?.name ? ` · ${b.members.name}` : ''}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusBadge(b.status)}`}>
                      {b.status === 'confirmed' ? 'Confirmada' : 'Solicitud'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
                      <button onClick={() => setDetailBooking(b)} className="flex-1 px-4 py-3 flex items-start gap-3 text-left hover:bg-surface2 transition-colors">
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
                            className="flex items-center gap-1 text-[10px] font-semibold text-lime border border-lime/30 bg-lime/10 rounded-lg px-2 py-1 shrink-0 hover:bg-lime/20 active:scale-95 transition-all disabled:opacity-50"
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
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-surface border border-line rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
              <h2 className="text-base font-semibold text-snow">Nueva reserva</h2>
              <button onClick={() => setShowModal(false)} className="text-mist hover:text-fog"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5"><Tag size={11} className="inline mr-1" />Tipo</label>
                <div className="flex gap-2">
                  {[{ value: 'birthday', label: 'Cumpleaños' }, { value: 'custodia', label: 'Custodia' }, { value: 'other', label: 'Otro' }].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => {
                        const type = opt.value as BookingType
                        setForm(f => ({ ...f, type, title: '', child_name: '' }))
                        setCustodiaChildren([])
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${form.type === opt.value ? opt.value === 'birthday' ? 'bg-iris/20 text-iris border-iris/40' : opt.value === 'custodia' ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' : 'bg-fog/20 text-fog border-fog/40' : 'bg-surface2 text-mist border-line hover:text-snow'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title — shown only for "other"; auto-generated for birthday/custodia */}
              {form.type === 'other' && (
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5">Título *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Evento especial" className={inputClass} />
                </div>
              )}

              {/* Titular de contacto — all types */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-fog"><User size={11} className="inline mr-1" />Titular de contacto</label>
                  <button
                    type="button"
                    onClick={() => setShowAddMember(true)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-iris hover:text-iris/80 transition-colors"
                  >
                    <UserPlus size={11} /> Agregar titular
                  </button>
                </div>
                <select
                  value={form.member_id}
                  onChange={e => handleMemberChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Sin asignar</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              {/* ── BIRTHDAY specific fields ── */}
              {form.type === 'birthday' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-fog mb-1.5">Niño/a festejado/a</label>
                    {memberChildren.length > 0 ? (
                      <select
                        value={form.child_name}
                        onChange={e => handleChildSelect(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Selecciona un hijo/a...</option>
                        {memberChildren.map(c => (
                          <option key={c.name} value={c.name}>
                            {c.name}{c.birth_date ? ` · ${calcAge(c.birth_date)}` : ''}
                          </option>
                        ))}
                        <option value="__manual__">Otro (escribir nombre)</option>
                      </select>
                    ) : null}
                    {(memberChildren.length === 0 || form.child_name === '__manual__' || (form.child_name && !memberChildren.some(c => c.name === form.child_name))) && (
                      <input
                        value={form.child_name === '__manual__' ? '' : form.child_name}
                        onChange={e => setForm(f => ({ ...f, child_name: e.target.value, title: e.target.value ? `Cumple de ${e.target.value}` : f.title }))}
                        placeholder="Nombre del niño/a"
                        className={`${inputClass} ${memberChildren.length > 0 ? 'mt-2' : ''}`}
                      />
                    )}
                  </div>
                  {/* Title auto-filled but editable */}
                  <div>
                    <label className="block text-xs font-semibold text-fog mb-1.5">Título de la reserva *</label>
                    <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Cumple de Martina" className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5"><Users size={11} className="inline mr-1" />Nº invitados</label>
                      <input type="number" min="1" value={form.guests} onChange={e => setForm(f => ({ ...f, guests: e.target.value }))} placeholder="12" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5"><Euro size={11} className="inline mr-1" />Importe (€)</label>
                      <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="120.00" className={inputClass} />
                    </div>
                  </div>
                </>
              )}

              {/* ── CUSTODIA specific fields ── */}
              {form.type === 'custodia' && (
                <>
                  {/* Children selector */}
                  {memberChildren.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-2">Hijos que entran en custodia</label>
                      <div className="space-y-1.5">
                        {memberChildren.map(c => {
                          const selected = custodiaChildren.includes(c.name)
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => toggleCustodiaChild(c.name)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${selected ? 'bg-amber-400/15 border-amber-400/40 text-amber-300' : 'bg-surface2 border-line text-fog hover:text-snow hover:border-line2'}`}
                            >
                              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-amber-400 border-amber-400' : 'border-line2'}`}>
                                {selected && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#1a1f26" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </span>
                              <span className="text-sm font-medium">
                                {c.name}{c.birth_date ? <span className="text-xs text-mist ml-1">· {calcAge(c.birth_date)}</span> : null}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {/* Title auto-filled but editable */}
                  <div>
                    <label className="block text-xs font-semibold text-fog mb-1.5">Título de la reserva *</label>
                    <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Custodia tarde" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-fog mb-1.5"><Users size={11} className="inline mr-1" />Invitados adicionales</label>
                    <input type="number" min="0" value={form.guests} onChange={e => setForm(f => ({ ...f, guests: e.target.value }))} placeholder="0" className={inputClass} />
                    {custodiaChildren.length > 0 && (
                      <p className="text-[10px] text-mist mt-1">
                        Total: {custodiaChildren.length} hijo{custodiaChildren.length !== 1 ? 's' : ''} seleccionado{custodiaChildren.length !== 1 ? 's' : ''}
                        {form.guests ? ` + ${form.guests} invitado${parseInt(form.guests) !== 1 ? 's' : ''}` : ''}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ── OTHER specific fields ── */}
              {form.type === 'other' && (
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5"><Users size={11} className="inline mr-1" />Nº invitados</label>
                  <input type="number" min="0" value={form.guests} onChange={e => setForm(f => ({ ...f, guests: e.target.value }))} placeholder="0" className={inputClass} />
                </div>
              )}

              {/* Date & time — all types */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5"><Calendar size={11} className="inline mr-1" />Fecha *</label>
                <input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5"><Clock size={11} className="inline mr-1" />Hora inicio</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5"><Clock size={11} className="inline mr-1" />Hora fin</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className={inputClass} />
                </div>
              </div>

              {/* Notes — all types */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5"><FileText size={11} className="inline mr-1" />Notas (opcional)</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones..." className={inputClass + ' resize-none'} />
              </div>

              <button type="submit" disabled={loading} className="w-full bg-lime text-ink font-semibold py-3 rounded-xl hover:bg-lime/90 transition-colors disabled:opacity-50 text-sm">
                {loading ? 'Guardando...' : 'Crear reserva'}
              </button>
            </form>
          </div>
        </div>
      )}

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

      {/* ── Popup detalle de reserva (misma vista que Inicio) ── */}
      {detailBooking && (() => {
        const b = detailBooking
        const ts = TYPE_STYLE[b.type]
        const st = bookingLiveStatus(b, todayStr)
        const statusLabels = {
          ejecutado: { label: 'Ejecutado', cls: 'bg-mint/10 text-mint border-mint/30' },
          en_curso:  { label: 'En curso',  cls: 'bg-lime/10 text-lime border-lime/30' },
          pendiente: { label: 'Pendiente', cls: 'bg-surface2 text-fog border-line' },
          pasado:    { label: 'Pasado',    cls: 'bg-surface2 text-mist border-line' },
        }
        const stl = statusLabels[st]
        const childObj = b.child_name && b.members?.children
          ? (b.members.children as any[]).find(c => c.name.toLowerCase() === b.child_name!.toLowerCase()) : null
        const childAge = childObj?.birth_date ? calcAge(childObj.birth_date) : null
        const gA = b.guest_adults ?? 0, gC = b.guest_children ?? 0
        const totalG = b.guests ?? (gA + gC)
        const total = Number(b.amount) || 0, dep = Number(b.deposit_amount) || 0
        const pend = Math.max(0, Math.round((total - dep) * 100) / 100)
        const canExecute = st !== 'ejecutado' && b.status !== 'cancelled' && !!b.member_id && b.date === todayStr
        const paidBadge = b.payment_status === 'paid'
          ? { label: 'Pagado', cls: 'bg-mint/10 text-mint border-mint/30' }
          : { label: 'Pago pendiente', cls: 'bg-amber/10 text-amber border-amber/30' }
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setDetailBooking(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full sm:max-w-sm rounded-2xl border border-line bg-surface shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={13} className="text-fog shrink-0" />
                    <p className="text-xs font-semibold text-fog uppercase tracking-wide">Reserva</p>
                  </div>
                  <p className="text-base font-bold text-snow leading-tight">{b.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${ts.badge}`}>{ts.label}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${stl.cls}`}>{stl.label}</span>
                  </div>
                </div>
                <button onClick={() => setDetailBooking(null)} className="text-fog hover:text-snow transition-colors p-1 shrink-0 ml-2"><X size={16} /></button>
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
                {b.members?.name && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-fog">Titular</span>
                    <span className="text-sm font-semibold text-snow">{b.members.name}</span>
                  </div>
                )}
                {b.child_name && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-fog">{b.type === 'birthday' ? 'Cumpleañero/a' : 'Menores'}</span>
                    <span className="text-sm font-semibold text-snow">{b.child_name}{childAge ? ` · ${childAge}` : ''}</span>
                  </div>
                )}
                {b.date && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-fog">Fecha</span>
                    <span className="text-sm font-semibold text-snow capitalize">{new Date(b.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  </div>
                )}
                <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 space-y-2">
                  <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Horario</p>
                  <div className="flex items-center gap-4">
                    {b.start_time && (<div><p className="text-[10px] text-mist mb-0.5">Inicio</p><p className="text-lg font-bold text-snow">{b.start_time.slice(0, 5)}</p></div>)}
                    {b.start_time && b.end_time && <span className="text-mist">→</span>}
                    {b.end_time && (<div><p className="text-[10px] text-mist mb-0.5">Fin</p><p className="text-lg font-bold text-snow">{b.end_time.slice(0, 5)}</p></div>)}
                  </div>
                </div>
                {(totalG > 0 || gA > 0 || gC > 0) && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-fog">{b.type === 'custodia' ? 'Niños' : 'Invitados'}</span>
                      <span className="text-sm font-semibold text-snow">{totalG} {b.type === 'custodia' ? `niño${totalG !== 1 ? 's' : ''}` : `invitado${totalG !== 1 ? 's' : ''}`}</span>
                    </div>
                    {b.type !== 'custodia' && (gA > 0 || gC > 0) && (
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-mist">
                        <span>{gA} adulto{gA !== 1 ? 's' : ''}</span><span>·</span><span>{gC} niño{gC !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                )}
                {(total > 0 || dep > 0) && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5"><Euro size={12} /> Pagos</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${paidBadge.cls}`}>{paidBadge.label}</span>
                    </div>
                    {b.services?.name && (
                      <div className="flex items-center justify-between pb-1.5 border-b border-line/60">
                        <span className="text-xs text-mist">Paquete</span><span className="text-xs font-medium text-snow">{b.services.name}</span>
                      </div>
                    )}
                    {(b.addons ?? []).length > 0 && (
                      <div className="space-y-1 pb-1.5 border-b border-line/60">
                        {(b.addons ?? []).map((a, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-xs text-fog">+ {a.name}</span><span className="text-xs text-snow">{(Number(a.price) || 0).toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between"><span className="text-xs text-mist">Total</span><span className="text-sm font-semibold text-snow">{total.toFixed(2)} €</span></div>
                    {dep > 0 && (<div className="flex items-center justify-between"><span className="text-xs text-mist">Adelanto</span><span className="text-sm font-semibold text-lime">{dep.toFixed(2)} €</span></div>)}
                    <div className="flex items-center justify-between pt-1.5 border-t border-line/60"><span className="text-xs text-mist">Pendiente</span><span className="text-sm font-bold text-snow">{pend.toFixed(2)} €</span></div>
                  </div>
                )}
                {b.notes && (
                  <div className="rounded-xl border border-line bg-surface2/40 px-4 py-3">
                    <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">Notas</p>
                    <p className="text-xs text-snow whitespace-pre-wrap leading-relaxed">{b.notes}</p>
                  </div>
                )}
                {canExecute && (
                  <button onClick={() => { handleExecute(b); setDetailBooking(null) }} disabled={executingId === b.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 bg-lime text-ink font-semibold text-sm hover:brightness-105 transition active:scale-[0.99] disabled:opacity-60">
                    <LogIn size={15} /> {executingId === b.id ? 'Ejecutando...' : 'Ejecutar reserva · registrar entrada'}
                  </button>
                )}
                {b.status !== 'cancelled' && (
                  <button onClick={() => { setDetailBooking(null); openEditFlow(b) }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 border border-line text-fog font-semibold text-sm hover:text-snow transition-colors">
                    <Pencil size={14} /> Editar reserva
                  </button>
                )}
                {b.status !== 'cancelled' && (
                  <button onClick={() => { handleCancel(b.id); setDetailBooking(null) }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 border border-rose/30 text-rose font-semibold text-sm hover:bg-rose/10 transition-colors">
                    <Trash2 size={14} /> Cancelar reserva
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Flujo compartido: crear/editar reserva (mismo componente que Inicio) ── */}
      {flowStep === 'pick' && (
        <BookingSearchAndTypeModal
          filtered={flowFiltered}
          query={flowQuery}
          onQueryChange={setFlowQuery}
          preselectedMember={flowMember}
          types={reservableTypes}
          onProceed={(m, t, cat) => { setFlowMember(m); setFlowType(t); setFlowCategory(cat); setFlowStep('form') }}
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
          selectedDate={selectedDate ?? todayStr}
          services={bookingServices}
          rateAdult={rateAdult}
          rateChild={rateChild}
          tenantId={getStoredTenant()?.id ?? null}
          editId={flowEditId}
          initial={flowInitial}
          onBack={() => { if (flowEditId) closeFlow(); else setFlowStep('pick') }}
          onClose={closeFlow}
          onSaved={() => { fetchBookings() }}
        />
      )}
    </div>
  )
}
