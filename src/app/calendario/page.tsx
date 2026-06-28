'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Clock, User, FileText, Tag, Calendar, Users, Euro, Pencil, Trash2, List, LogIn, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant } from '@/lib/tenant'

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
  payment_status: PaymentStatus
  amount: number | null
  executed_at: string | null
}

interface Member { id: string; name: string }

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

const EMPTY_FORM = { type: 'birthday' as BookingType, title: '', child_name: '', date: '', start_time: '', end_time: '', member_id: '', guests: '', amount: '', notes: '' }

type EditForm = { guests: string; member_id: string; status: BookingStatus; payment_status: PaymentStatus; notes: string }

export default function CalendarioPage() {
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ guests: '', member_id: '', status: 'pending', payment_status: 'pending', notes: '' })
  const [saving, setSaving] = useState(false)
  const [executingId, setExecutingId] = useState<string | null>(null)

  const fetchBookings = useCallback(async () => {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(getDaysInMonth(year, month)).padStart(2, '0')}`
    const { data } = await supabase
      .from('bookings')
      .select('id, date, start_time, end_time, type, title, child_name, member_id, members(id, name, children), notes, status, guests, payment_status, amount, executed_at')
      .gte('date', from).lte('date', to).order('start_time')
    setBookings((data ?? []) as unknown as Booking[])
  }, [year, month])

  async function handleExecute(b: Booking) {
    if (!b.member_id) return
    const tenant = getStoredTenant()
    if (!tenant) return
    setExecutingId(b.id)
    await supabase.from('visits').insert({
      tenant_id: tenant.id,
      member_id: b.member_id,
      checked_in_at: new Date().toISOString(),
      visit_type: 'entrada',
      booking_id: b.id,
    })
    await supabase.from('bookings').update({ executed_at: new Date().toISOString(), status: 'confirmed' }).eq('id', b.id)
    setExecutingId(null)
    fetchBookings()
  }

  useEffect(() => { fetchBookings() }, [fetchBookings])
  useEffect(() => { supabase.from('members').select('id, name').order('name').then(({ data }) => setMembers(data ?? [])) }, [])
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
    setForm({ ...EMPTY_FORM, type: 'birthday', date: selectedDate ?? toDateStr(year, month, today.getDate()) })
    setShowModal(true)
  }

  function openEdit(b: Booking) {
    setEditingId(b.id)
    setEditForm({
      guests: b.guests?.toString() ?? '',
      member_id: b.member_id ?? '',
      status: b.status,
      payment_status: b.payment_status,
      notes: b.notes ?? '',
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    await supabase.from('bookings').insert({
      type: form.type, title: form.title, date: form.date,
      child_name: form.child_name || null,
      start_time: form.start_time || null, end_time: form.end_time || null,
      member_id: form.member_id || null,
      guests: form.guests ? parseInt(form.guests) : null,
      amount: form.amount ? parseFloat(form.amount) : null,
      notes: form.notes || null, status: 'pending', payment_status: 'pending',
    })
    setLoading(false); setShowModal(false); fetchBookings()
  }

  async function handleSaveEdit() {
    if (!editingId) return; setSaving(true)
    await supabase.from('bookings').update({
      guests: editForm.guests ? parseInt(editForm.guests) : null,
      member_id: editForm.member_id || null,
      status: editForm.status,
      payment_status: editForm.payment_status,
      notes: editForm.notes || null,
    }).eq('id', editingId)
    setSaving(false); setEditingId(null); fetchBookings()
  }

  async function handleCancel(id: string) {
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    setEditingId(null); fetchBookings()
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
            <button onClick={openNewBooking} className="flex items-center gap-2 bg-lime text-ink font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-lime/90 transition-colors">
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
                  const childObj = b.child_name && b.members?.children
                    ? (b.members.children as any[]).find(c => c.name.toLowerCase() === b.child_name!.toLowerCase())
                    : null
                  const childAge = childObj?.birth_date ? calcAge(childObj.birth_date) : null
                  const isEditing = editingId === b.id

                  return (
                    <div key={b.id} className="px-5 py-4">
                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${bookingBadge(b.type)}`}>
                          {b.type === 'birthday' ? 'Cumpleaños' : b.type === 'custodia' ? 'Custodia' : 'Otro'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(b.status)}`}>
                          {b.status === 'confirmed' ? 'Confirmada' : b.status === 'cancelled' ? 'Cancelada' : 'Solicitud'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${paymentBadge(b.payment_status)}`}>
                          {b.payment_status === 'paid' ? 'Pagado' : 'Pago pendiente'}
                        </span>
                        {!isEditing && b.status !== 'cancelled' && (
                          <button onClick={() => openEdit(b)} className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-fog hover:text-snow transition-colors">
                            <Pencil size={11} /> Editar
                          </button>
                        )}
                      </div>

                      {/* Main info (always visible) */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="min-w-0 space-y-1">
                          {b.child_name ? (
                            <p className="text-sm font-semibold text-cyan-300">{b.child_name}{childAge ? ` · ${childAge}` : ''}</p>
                          ) : (
                            <p className="text-sm font-semibold text-snow">{b.title}</p>
                          )}
                          {b.members?.name && <p className="text-xs text-fog">{b.members.name}</p>}
                          {(b.start_time || b.end_time) && (
                            <p className="text-xs text-mist flex items-center gap-1">
                              <Clock size={11} />{b.start_time?.slice(0, 5)}{b.end_time ? ` → ${b.end_time.slice(0, 5)}` : ''}
                            </p>
                          )}
                          {b.guests && <p className="text-xs text-mist flex items-center gap-1"><Users size={11} /> {b.guests} invitados</p>}
                          {b.notes && <p className="text-xs text-fog italic">{b.notes}</p>}
                        </div>
                        {b.amount != null && (
                          <p className="text-lg font-bold text-snow shrink-0">{b.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
                        )}
                      </div>

                      {/* Execute reservation button */}
                      {!isEditing && b.status !== 'cancelled' && b.member_id && selectedDate === toDateStr(today.getFullYear(), today.getMonth(), today.getDate()) && (
                        <div className="mb-3">
                          {b.executed_at ? (
                            <div className="flex items-center gap-1.5 text-xs text-lime font-semibold">
                              <CheckCircle size={13} /> Ejecutada · check-in registrado
                            </div>
                          ) : (
                            <button
                              onClick={() => handleExecute(b)}
                              disabled={executingId === b.id}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-lime/15 text-lime border border-lime/30 text-xs font-semibold hover:bg-lime/25 transition-colors disabled:opacity-50"
                            >
                              <LogIn size={13} /> {executingId === b.id ? 'Ejecutando...' : 'Ejecutar reserva · registrar entrada'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Inline edit form */}
                      {isEditing && (
                        <div className="mt-3 pt-3 border-t border-line space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            {/* Status */}
                            <div>
                              <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">Estado</label>
                              <div className="flex gap-1.5">
                                {(['pending', 'confirmed'] as BookingStatus[]).map(s => (
                                  <button key={s} type="button" onClick={() => setEditForm(f => ({ ...f, status: s }))}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors ${editForm.status === s ? s === 'confirmed' ? 'bg-lime/20 text-lime border-lime/40' : 'bg-fog/20 text-fog border-fog/40' : 'bg-surface2 text-mist border-line'}`}>
                                    {s === 'confirmed' ? 'Confirmada' : 'Solicitud'}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* Payment */}
                            <div>
                              <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">Pago</label>
                              <div className="flex gap-1.5">
                                {(['pending', 'paid'] as PaymentStatus[]).map(p => (
                                  <button key={p} type="button" onClick={() => setEditForm(f => ({ ...f, payment_status: p }))}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors ${editForm.payment_status === p ? p === 'paid' ? 'bg-mint/20 text-mint border-mint/40' : 'bg-amber/20 text-amber border-amber/40' : 'bg-surface2 text-mist border-line'}`}>
                                    {p === 'paid' ? 'Pagado' : 'Pendiente'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          {/* Guests */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">Nº invitados</label>
                              <input type="number" min="1" value={editForm.guests}
                                onChange={e => setEditForm(f => ({ ...f, guests: e.target.value }))}
                                className="w-full bg-surface2 border border-line rounded-lg px-3 py-2 text-sm text-snow outline-none focus:border-line2" />
                            </div>
                            {/* Contact */}
                            <div>
                              <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">Titular de contacto</label>
                              <select value={editForm.member_id} onChange={e => setEditForm(f => ({ ...f, member_id: e.target.value }))}
                                className="w-full bg-surface2 border border-line rounded-lg px-3 py-2 text-sm text-snow outline-none focus:border-line2">
                                <option value="">Sin asignar</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                            </div>
                          </div>
                          {/* Notes */}
                          <div>
                            <label className="block text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">Notas</label>
                            <textarea rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                              className="w-full bg-surface2 border border-line rounded-lg px-3 py-2 text-sm text-snow outline-none focus:border-line2 resize-none" />
                          </div>
                          {/* Actions */}
                          <div className="flex flex-wrap gap-2">
                            <button onClick={handleSaveEdit} disabled={saving}
                              className="flex-1 min-w-[120px] bg-lime text-ink font-semibold py-2 rounded-lg text-xs hover:bg-lime/90 transition-colors disabled:opacity-50">
                              {saving ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                            <button onClick={() => handleCancel(b.id)}
                              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-rose border border-rose/30 hover:bg-rose/10 transition-colors whitespace-nowrap">
                              <Trash2 size={12} /> Cancelar reserva
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="px-3 py-2 rounded-lg text-xs font-semibold text-fog border border-line hover:text-snow transition-colors">
                              Cerrar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New booking modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-surface border border-line rounded-t-2xl lg:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
              <h2 className="text-base font-semibold text-snow">Nueva reserva</h2>
              <button onClick={() => setShowModal(false)} className="text-mist hover:text-fog"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5"><Tag size={11} className="inline mr-1" />Tipo</label>
                <div className="flex gap-2">
                  {[{ value: 'birthday', label: 'Cumpleaños' }, { value: 'custodia', label: 'Custodia' }, { value: 'other', label: 'Otro' }].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, type: opt.value as BookingType }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${form.type === opt.value ? opt.value === 'birthday' ? 'bg-iris/20 text-iris border-iris/40' : opt.value === 'custodia' ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' : 'bg-fog/20 text-fog border-fog/40' : 'bg-surface2 text-mist border-line hover:text-snow'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Título *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Cumple de Martina" className={inputClass} />
              </div>
              {form.type === 'birthday' && (
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5">Nombre del niño/a</label>
                  <input value={form.child_name} onChange={e => setForm(f => ({ ...f, child_name: e.target.value }))} placeholder="Ej: Martina" className={inputClass} />
                </div>
              )}
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
              {form.type === 'birthday' && (
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
              )}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5"><User size={11} className="inline mr-1" />Titular de contacto</label>
                <select value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))} className={inputClass}>
                  <option value="">Sin asignar</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5"><FileText size={11} className="inline mr-1" />Notas (opcional)</label>
                <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones..." className={inputClass + ' resize-none'} />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-lime text-ink font-semibold py-3 rounded-xl hover:bg-lime/90 transition-colors disabled:opacity-50 text-sm">
                {loading ? 'Guardando...' : 'Crear reserva'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
