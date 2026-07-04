'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { LogIn, LogOut, Users, CalendarDays, Cake, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant, loadAndStoreTenant } from '@/lib/tenant'
import { toast } from 'sonner'

type TodayVisit = {
  id: string
  checked_in_at: string
  checked_out_at: string | null
  membership_id: string | null
  member_id: string
  visit_type: string
  children_present: { name: string; age?: number; birth_date?: string }[] | null
  adults_count: number
  children_count: number
  members: { name: string } | null
}

type TodayBooking = {
  id: string
  title: string
  type: 'birthday' | 'custodia' | 'other'
  start_time: string | null
  end_time: string | null
  status: string
  child_name: string | null
  guests: number | null
  members: { name: string } | null
}

type BirthdayMember = {
  name: string
  birth_date: string
  titularName: string
  booking: { start_time: string | null; end_time: string | null; guests: number | null; title: string } | null
}

type HomeClientProps = {
  todayVisits: TodayVisit[]
  todayCustodias: TodayVisit[]
  monthCount: number
  dateLabel: string
  capacity: number | null
  todayBirthdays: BirthdayMember[]
  todayBookings: TodayBooking[]
}

function fmtElapsed(checkedInAt: string): string {
  const mins = Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60000)
  const h = Math.floor(mins / 60), m = mins % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function fmtChildAge(birth_date?: string, fallbackAge?: number): string {
  if (birth_date) {
    const now = new Date()
    const dob = new Date(birth_date)
    let years = now.getFullYear() - dob.getFullYear()
    let months = now.getMonth() - dob.getMonth()
    if (now.getDate() < dob.getDate()) months--
    if (months < 0) { years--; months += 12 }
    if (years === 0) return `${months}m`
    if (months === 0) return `${years}a`
    return `${years}a ${months}m`
  }
  if (fallbackAge != null) return `${fallbackAge}a`
  return ''
}

export default function HomeClient({ todayVisits, dateLabel, capacity, todayBirthdays, todayBookings }: HomeClientProps) {
  const [allVisits, setAllVisits] = useState<TodayVisit[]>(todayVisits)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [showResumen, setShowResumen] = useState(false)
  const [tick, setTick] = useState(0)

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

  // Tick every minute to refresh elapsed times
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  // Poll visits every 30s
  const refreshVisits = useCallback(async () => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('visits')
      .select('id, checked_in_at, checked_out_at, member_id, membership_id, visit_type, children_present, adults_count, children_count, members(name)')
      .gte('checked_in_at', todayStart.toISOString())
      .order('checked_in_at', { ascending: true })
    if (data) setAllVisits(data as unknown as TodayVisit[])
  }, [])

  useEffect(() => {
    const interval = setInterval(refreshVisits, 30000)
    return () => clearInterval(interval)
  }, [refreshVisits])

  async function handleCheckOut(visit: TodayVisit) {
    setCheckingOut(visit.id)
    await supabase.from('visits').update({ checked_out_at: new Date().toISOString() }).eq('id', visit.id)
    const dmin = Math.max(1, Math.floor((Date.now() - new Date(visit.checked_in_at).getTime()) / 60000))
    const dh = Math.floor(dmin / 60), dm = dmin % 60
    toast.success(`Salida — ${visit.members?.name ?? '—'} · ${dh > 0 ? `${dh}h ${dm}min` : `${dmin}min`}`)
    setCheckingOut(null)
    await refreshVisits()
  }

  // Derived values — depend on tick so elapsed updates every minute
  void tick
  const activeVisits = allVisits.filter(v => !v.checked_out_at)
    .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime())

  const persons = (v: TodayVisit) => (v.adults_count ?? 1) + (v.children_count ?? 0)
  const activeAdults = activeVisits.reduce((s, v) => s + (v.adults_count ?? 1), 0)
  const activeChildren = activeVisits.reduce((s, v) => s + (v.children_count ?? 0), 0)
  const activeTotal = activeAdults + activeChildren

  const aforoPct = capacity ? Math.min(100, (activeTotal / capacity) * 100) : 0
  const aforoTextColor = aforoPct < 70 ? 'text-lime' : aforoPct <= 90 ? 'text-amber' : 'text-rose-500'

  const totalHoy = allVisits.reduce((s, v) => s + persons(v), 0)
  const conBonoHoy = allVisits.filter(v => v.membership_id).reduce((s, v) => s + persons(v), 0)
  const sinBonoHoy = allVisits.filter(v => !v.membership_id).reduce((s, v) => s + persons(v), 0)
  const custodiasHoy = allVisits.filter(v => v.visit_type === 'custodia').length

  const agendaItems = todayBookings.filter(b => b.type !== 'birthday')
  const hasAgenda = todayBookings.length > 0 || todayBirthdays.length > 0

  return (
    <div className="space-y-5 pb-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow truncate">{tenantName ?? 'Mi establecimiento'}</h1>
          <p className="text-sm text-fog capitalize mt-0.5">{dateLabel}</p>
        </div>
        <Link
          href="/checkin?tab=checkin"
          className="flex items-center gap-1.5 bg-lime text-ink font-semibold rounded-xl px-4 py-2.5 text-sm shrink-0 active:scale-95 transition-transform"
          style={{ boxShadow: 'var(--shadow-lime)' }}
        >
          <LogIn size={15} strokeWidth={2.4} />
          Nueva entrada
        </Link>
      </div>

      {/* Aforo compacto */}
      {capacity != null && (
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-fog flex items-center gap-1.5">
              <Users size={12} /> Aforo
            </span>
            <div className="flex items-center gap-3 text-xs text-fog">
              <span><span className="text-lime font-semibold">{activeAdults}</span> adultos</span>
              <span><span className="text-cyan-300 font-semibold">{activeChildren}</span> niños</span>
              <span className={`font-bold ${aforoTextColor}`}>{activeTotal}/{capacity}</span>
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-line overflow-hidden flex">
            <div className="h-full bg-lime transition-all duration-500"
              style={{ width: `${capacity ? Math.min(100, (activeAdults / capacity) * 100) : 0}%` }} />
            <div className="h-full bg-cyan-300 transition-all duration-500"
              style={{ width: `${capacity ? Math.min(100, (activeChildren / capacity) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {/* Dentro ahora */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
            <Clock size={12} />
            Dentro ahora
            {activeVisits.length > 0 && (
              <span className="ml-0.5 text-lime font-bold">{activeVisits.length}</span>
            )}
          </h2>
          {activeVisits.length > 0 && (
            <Link href="/checkin?tab=dentro" className="text-[11px] text-fog hover:text-snow transition-colors">
              Ver sala →
            </Link>
          )}
        </div>

        {activeVisits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center">
            <p className="text-sm text-mist">La sala está vacía</p>
            <p className="text-xs text-fog mt-1">Registra la primera entrada del día</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeVisits.map(visit => {
              const dmin = Math.floor((Date.now() - new Date(visit.checked_in_at).getTime()) / 60000)
              const isLong = dmin >= 120
              const isVeryLong = dmin >= 180
              const kids = visit.children_present ?? []

              return (
                <div
                  key={visit.id}
                  className={`rounded-2xl border bg-surface px-4 py-3 flex items-center gap-3 transition-colors ${
                    isVeryLong ? 'border-rose/40 bg-rose/5' : isLong ? 'border-amber/30' : 'border-line'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {(isLong || isVeryLong) && (
                        <AlertTriangle size={12} className={isVeryLong ? 'text-rose shrink-0' : 'text-amber shrink-0'} />
                      )}
                      <p className="font-semibold text-sm text-snow truncate">{visit.members?.name ?? '—'}</p>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${visit.membership_id ? 'bg-iris' : 'bg-amber'}`} />
                    </div>
                    {kids.length > 0 && (
                      <p className="text-xs text-mist truncate">
                        {kids.map(c => {
                          const age = fmtChildAge(c.birth_date, c.age)
                          return c.name + (age ? ` · ${age}` : '')
                        }).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold tabular-nums ${
                      isVeryLong ? 'text-rose' : isLong ? 'text-amber' : 'text-fog'
                    }`}>
                      {fmtElapsed(visit.checked_in_at)}
                    </span>
                    <button
                      onClick={() => handleCheckOut(visit)}
                      disabled={checkingOut === visit.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface2 border border-line text-xs font-semibold text-fog hover:text-snow hover:border-line2 active:scale-95 transition-all disabled:opacity-40"
                    >
                      <LogOut size={11} strokeWidth={2.2} />
                      {checkingOut === visit.id ? '...' : 'Salida'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Agenda de hoy */}
      {hasAgenda && (
        <div>
          <h2 className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5 mb-3">
            <CalendarDays size={12} /> Hoy
          </h2>
          <div className="space-y-2">
            {/* Cumpleaños */}
            {todayBirthdays.map((b, i) => (
              <Link key={`bday-${i}`} href="/calendario"
                className="flex items-center gap-3 rounded-2xl border border-rose/30 bg-rose/5 px-4 py-3 hover:border-rose/50 transition-colors"
              >
                <Cake size={14} className="text-rose shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-snow truncate">{b.name}</p>
                  <p className="text-xs text-fog">{b.titularName}</p>
                </div>
                {b.booking?.start_time && (
                  <span className="text-xs font-semibold text-rose shrink-0">
                    {b.booking.start_time.slice(0, 5)}
                  </span>
                )}
              </Link>
            ))}
            {/* Reservas (custodias, otros — excluye birthday ya mostrados arriba) */}
            {agendaItems.map(booking => (
              <Link key={booking.id} href="/calendario"
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:border-line2 transition-colors"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  booking.type === 'birthday' ? 'bg-iris' : booking.type === 'custodia' ? 'bg-amber' : 'bg-fog'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-snow truncate">{booking.child_name || booking.title}</p>
                  {booking.members?.name && <p className="text-xs text-fog">{booking.members.name}</p>}
                </div>
                <div className="text-right shrink-0">
                  {booking.start_time && (
                    <p className="text-xs font-semibold text-mist">
                      {booking.start_time.slice(0, 5)}{booking.end_time ? `–${booking.end_time.slice(0, 5)}` : ''}
                    </p>
                  )}
                  {booking.guests != null && (
                    <p className="text-[11px] text-fog">{booking.guests} inv.</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Resumen del día */}
      <div>
        <button
          onClick={() => setShowResumen(v => !v)}
          className="w-full flex items-center justify-between text-xs font-semibold text-fog uppercase tracking-wide hover:text-snow transition-colors py-1"
        >
          <span>Resumen del día</span>
          {showResumen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showResumen && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Entradas hoy', value: totalHoy, accent: 'text-lime' },
              { label: 'Con bono', value: conBonoHoy, accent: 'text-iris' },
              { label: 'Sin bono', value: sinBonoHoy, accent: 'text-amber' },
              { label: 'Custodias', value: custodiasHoy, accent: 'text-mint' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-2xl border border-line bg-surface p-3 text-center">
                <div className={`font-display text-2xl font-bold leading-none ${value > 0 ? accent : 'text-fog'}`}>{value}</div>
                <div className="text-[11px] text-fog mt-1.5">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
