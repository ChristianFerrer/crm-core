'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Clock, User, FileText, Tag, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type BookingType = 'birthday' | 'custodia' | 'other'
type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

interface Booking {
  id: string
  created_at: string
  date: string
  start_time: string
  end_time: string
  type: BookingType
  title: string
  member_id: string | null
  notes: string | null
  status: BookingStatus
  guests: number | null
}

interface Member {
  id: string
  name: string
}

const inputClass =
  'w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'

const DOW_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  // Monday = 0
  const day = new Date(year, month, 1).getDay()
  return (day + 6) % 7
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function bookingColor(type: BookingType) {
  if (type === 'birthday') return 'bg-iris'
  if (type === 'custodia') return 'bg-amber-400'
  return 'bg-fog'
}

function bookingBadge(type: BookingType) {
  if (type === 'birthday') return 'bg-iris/20 text-iris border border-iris/30'
  if (type === 'custodia') return 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
  return 'bg-fog/20 text-fog border border-fog/30'
}

function statusBadge(status: BookingStatus) {
  if (status === 'confirmed') return 'bg-lime/20 text-lime border border-lime/30'
  if (status === 'cancelled') return 'bg-red-500/20 text-red-400 border border-red-500/30'
  return 'bg-fog/20 text-fog border border-fog/30'
}

export default function CalendarioPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [activeTab, setActiveTab] = useState<'birthday' | 'custodia'>('birthday')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    type: 'birthday' as BookingType,
    title: '',
    date: '',
    start_time: '',
    end_time: '',
    member_id: '',
    guests: '',
    notes: '',
  })

  const fetchBookings = useCallback(async () => {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = getDaysInMonth(year, month)
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('start_time')
    setBookings(data ?? [])
  }, [year, month])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  useEffect(() => {
    supabase.from('members').select('id, name').order('name').then(({ data }) => {
      setMembers(data ?? [])
    })
  }, [])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  function openNewBooking() {
    setForm({
      type: activeTab,
      title: '',
      date: selectedDate ?? toDateStr(year, month, today.getDate()),
      start_time: '',
      end_time: '',
      member_id: '',
      guests: '',
      notes: '',
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('bookings').insert({
      type: form.type,
      title: form.title,
      date: form.date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      member_id: form.member_id || null,
      guests: form.guests ? parseInt(form.guests) : null,
      notes: form.notes || null,
      status: 'pending',
    })
    setLoading(false)
    setShowModal(false)
    fetchBookings()
  }

  // Build calendar grid
  const daysInMonth = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month)
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const filteredBookings = bookings.filter(b => b.type === activeTab)

  // All bookings indexed by date (for dots — show all types)
  const bookingsByDate: Record<string, Booking[]> = {}
  bookings.forEach(b => {
    if (!bookingsByDate[b.date]) bookingsByDate[b.date] = []
    bookingsByDate[b.date].push(b)
  })

  const selectedBookings = selectedDate ? (bookingsByDate[selectedDate] ?? []) : []
  const allSelectedBookings = selectedDate ? (bookings.filter(b => b.date === selectedDate)) : []

  return (
    <div className="min-h-screen bg-carbon text-snow pb-24 lg:pb-8">
      {/* Header */}
      <div className="px-4 pt-8 pb-4 lg:px-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-snow">Agenda</h1>
            <p className="text-sm text-mist mt-0.5">Reservas y custodia</p>
          </div>
          <button
            onClick={openNewBooking}
            className="flex items-center gap-2 bg-lime text-ink font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-lime/90 transition-colors"
          >
            <Plus size={16} />
            Nueva reserva
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-5">
          {[
            { key: 'birthday', label: 'Reservas', color: 'text-iris' },
            { key: 'custodia', label: 'Custodia', color: 'text-amber-300' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key as 'birthday' | 'custodia'); setSelectedDate(null) }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                activeTab === tab.key
                  ? tab.key === 'birthday'
                    ? 'bg-iris/15 text-iris border-iris/30'
                    : 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                  : 'bg-surface border-line text-fog hover:text-snow'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 lg:px-8 space-y-4">
        {/* Calendar card */}
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-surface2 transition-colors text-fog hover:text-snow">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-snow">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-surface2 transition-colors text-fog hover:text-snow">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-line">
            {DOW_LABELS.map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-semibold text-mist uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="min-h-[64px] border-b border-r border-line/50 last:border-r-0" />
              }
              const dateStr = toDateStr(year, month, day)
              const dayBookings = bookingsByDate[dateStr] ?? []
              const isToday = dateStr === toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
              const isSelected = dateStr === selectedDate
              const isLastRow = idx >= cells.length - 7

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`min-h-[64px] p-1.5 border-r border-line/50 text-left transition-colors relative
                    ${!isLastRow ? 'border-b' : ''}
                    ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}
                    ${isSelected ? 'bg-lime/10' : 'hover:bg-surface2'}
                  `}
                >
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1
                    ${isToday ? 'bg-lime text-ink' : isSelected ? 'text-lime' : 'text-fog'}
                  `}>
                    {day}
                  </span>
                  <div className="flex flex-wrap gap-0.5">
                    {dayBookings.slice(0, 3).map(b => (
                      <span key={b.id} className={`w-2 h-2 rounded-full ${bookingColor(b.type)}`} />
                    ))}
                    {dayBookings.length > 3 && (
                      <span className="text-[9px] text-mist leading-none self-end">+{dayBookings.length - 3}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day detail */}
        {selectedDate && (
          <div className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-snow">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-xs text-mist mt-0.5">{allSelectedBookings.length} reserva{allSelectedBookings.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="text-mist hover:text-fog transition-colors">
                <X size={16} />
              </button>
            </div>
            {allSelectedBookings.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-mist">No hay reservas este día</div>
            ) : (
              <div className="divide-y divide-line">
                {allSelectedBookings.map(b => (
                  <div key={b.id} className="px-5 py-4 flex items-start gap-3">
                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${bookingColor(b.type)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-snow truncate">{b.title}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${bookingBadge(b.type)}`}>
                          {b.type === 'birthday' ? 'Cumple' : b.type === 'custodia' ? 'Custodia' : 'Otro'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(b.status)}`}>
                          {b.status === 'confirmed' ? 'Confirmada' : b.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                        </span>
                      </div>
                      {(b.start_time || b.end_time) && (
                        <p className="text-xs text-mist mt-1 flex items-center gap-1">
                          <Clock size={11} />
                          {b.start_time?.slice(0, 5)}{b.end_time ? ` – ${b.end_time.slice(0, 5)}` : ''}
                        </p>
                      )}
                      {b.notes && <p className="text-xs text-fog mt-1">{b.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-surface border border-line rounded-t-2xl lg:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
              <h2 className="text-base font-semibold text-snow">Nueva reserva</h2>
              <button onClick={() => setShowModal(false)} className="text-mist hover:text-fog transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">
                  <Tag size={11} className="inline mr-1" />Tipo
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'birthday', label: 'Cumpleaños' },
                    { value: 'custodia', label: 'Custodia' },
                    { value: 'other', label: 'Otro' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: opt.value as BookingType }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        form.type === opt.value
                          ? opt.value === 'birthday'
                            ? 'bg-iris/20 text-iris border-iris/40'
                            : opt.value === 'custodia'
                            ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                            : 'bg-fog/20 text-fog border-fog/40'
                          : 'bg-surface2 text-mist border-line hover:text-snow'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Título *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ej: Cumple de María"
                  className={inputClass}
                />
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">
                  <Calendar size={11} className="inline mr-1" />Fecha *
                </label>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={inputClass}
                />
              </div>

              {/* Hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5">
                    <Clock size={11} className="inline mr-1" />Hora inicio
                  </label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5">
                    <Clock size={11} className="inline mr-1" />Hora fin
                  </label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Invitados (solo cumpleaños) */}
              {form.type === 'birthday' && (
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5">Nº invitados</label>
                  <input
                    type="number"
                    min="1"
                    value={form.guests}
                    onChange={e => setForm(f => ({ ...f, guests: e.target.value }))}
                    placeholder="Ej: 12"
                    className={inputClass}
                  />
                </div>
              )}

              {/* Miembro */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">
                  <User size={11} className="inline mr-1" />Miembro
                </label>
                <select
                  value={form.member_id}
                  onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Sin asignar</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">
                  <FileText size={11} className="inline mr-1" />Notas (opcional)
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Observaciones..."
                  className={inputClass + ' resize-none'}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-lime text-ink font-semibold py-3 rounded-xl hover:bg-lime/90 transition-colors disabled:opacity-50 text-sm"
              >
                {loading ? 'Guardando...' : 'Crear reserva'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
