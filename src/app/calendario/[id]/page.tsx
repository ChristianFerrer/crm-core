'use client'

import { use, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Pencil, Play, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { executeBooking, bookingGuestCount } from '@/lib/bookingExecution'
import { findConflicts } from '@/lib/agenda'
import { bookingBarStyle, BOOKING_TYPE_COLOR_VAR } from '@/app/HomeClient'
import { useLanguage } from '@/lib/i18n'

type BookingType = 'birthday' | 'custodia' | 'other'

type Booking = {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  type: BookingType
  title: string
  child_name: string | null
  member_id: string | null
  members: { name: string } | null
  notes: string | null
  status: string | null
  guests: number | null
  guest_adults: number | null
  guest_children: number | null
  payment_status: string | null
  amount: number | null
  deposit_amount: number | null
  service_id: string | null
  services: { name: string; resource_name: string | null } | null
  executed_at: string | null
}

const SELECT = 'id, date, start_time, end_time, type, title, child_name, member_id, members(name), notes, status, guests, guest_adults, guest_children, payment_status, amount, deposit_amount, service_id, services(name, resource_name), executed_at'

const TYPE_BADGE: Record<BookingType, { badge: string; key: 'calendario_tipo_cumpleanos' | 'calendario_tipo_custodia' | 'calendario_tipo_otro' }> = {
  birthday: { badge: 'text-iris', key: 'calendario_tipo_cumpleanos' },
  custodia: { badge: 'text-cyan-300', key: 'calendario_tipo_custodia' },
  other: { badge: 'text-lime', key: 'calendario_tipo_otro' },
}

const MONTH_KEYS = ['calendario_mes_enero', 'calendario_mes_febrero', 'calendario_mes_marzo', 'calendario_mes_abril', 'calendario_mes_mayo', 'calendario_mes_junio', 'calendario_mes_julio', 'calendario_mes_agosto', 'calendario_mes_septiembre', 'calendario_mes_octubre', 'calendario_mes_noviembre', 'calendario_mes_diciembre'] as const

/**
 * Detalle de una reserva como página propia: así la flecha de volver y el botón
 * «atrás» del navegador hacen lo mismo, y el enlace se puede compartir.
 */
export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { t } = useLanguage()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [sameDay, setSameDay] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('bookings').select(SELECT).eq('id', id).maybeSingle()
      if (cancelled) return
      const b = data as unknown as Booking | null
      setBooking(b)
      setLoading(false)
      if (b) {
        const { data: day } = await supabase.from('bookings').select(SELECT).eq('date', b.date)
        if (!cancelled) setSameDay((day ?? []) as unknown as Booking[])
      }
    })()
    return () => { cancelled = true }
  }, [id])

  function back() { router.push('/calendario') }

  async function handleExecute() {
    if (!booking) return
    setWorking(true)
    const { error } = await executeBooking(booking as any)
    setWorking(false)
    if (error) { alert(t('calendario_error_ejecutar', { error })); return }
    back()
  }

  async function handleCancel() {
    if (!booking) return
    setWorking(true)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
    setWorking(false)
    back()
  }

  if (loading) {
    return <div className="py-20 text-center text-sm text-mist">…</div>
  }
  if (!booking) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-sm text-mist">{t('calendario_sin_reservas')}</p>
        <button onClick={back} className="text-sm font-semibold text-iris">{t('calendario_volver')}</button>
      </div>
    )
  }

  const b = booking
  const ts = TYPE_BADGE[b.type]
  const todayStr = new Date().toISOString().slice(0, 10)
  const pendiente = Math.max(0, (b.amount ?? 0) - (b.deposit_amount ?? 0))
  const gA = b.guest_adults ?? 0
  const gC = b.guest_children ?? 0
  const totalG = bookingGuestCount(b as any)
  const sala = b.services?.resource_name?.trim() || null
  const resourceByService: Record<string, string | null> = Object.fromEntries(
    sameDay.filter(x => x.service_id).map(x => [x.service_id as string, x.services?.resource_name ?? null])
  )
  const clash = findConflicts(b as any, sameDay as any[], resourceByService)
  const canExecute = !b.executed_at && b.status !== 'cancelled' && !!b.member_id && b.date === todayStr

  const d = new Date(b.date + 'T12:00:00')
  const fecha = `${d.getDate()} ${t(MONTH_KEYS[d.getMonth()]).toLowerCase()}`

  const row = (label: string, value: ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-line/60 last:border-b-0">
      <span className="text-xs text-fog shrink-0">{label}</span>
      <span className="text-sm text-snow text-right min-w-0">{value}</span>
    </div>
  )

  return (
    <div className="pb-safe-nav">
      {/* Cabecera con la flecha de volver a la agenda */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 bg-carbon border-b border-line">
        <div className="flex items-center gap-3 py-4">
          <button onClick={back} aria-label={t('calendario_volver')} title={t('calendario_volver')}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-line bg-surface2 text-fog hover:text-snow transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">{t('calendario_detalle_reserva')}</p>
            <h1 className="text-lg font-bold text-snow truncate">{b.title}</h1>
          </div>
          <span className="w-1.5 h-9 rounded-full shrink-0" style={bookingBarStyle(b.status, BOOKING_TYPE_COLOR_VAR[b.type])} />
        </div>
      </div>

      <div className="max-w-3xl py-5 space-y-5">
        {clash.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-rose/40 bg-rose/10 px-3 py-2.5">
            <AlertTriangle size={14} className="text-rose shrink-0 mt-0.5" />
            <p className="text-xs text-rose">{t('calendario_conflicto')}: {clash.map((c: any) => c.title).join(', ')}</p>
          </div>
        )}

        <div className="rounded-2xl border border-line bg-surface px-4 py-1">
          {row(t('calendario_estado'), (
            <span className="flex items-center gap-2 justify-end flex-wrap">
              <span className={`text-xs font-semibold ${ts.badge}`}>{t(ts.key)}</span>
              {b.status === 'cancelled'
                ? <span className="text-xs font-semibold text-rose">{t('calendario_cancelada')}</span>
                : b.executed_at
                  ? <span className="text-xs font-semibold text-mint">{t('calendario_ejecutado')}</span>
                  : null}
            </span>
          ))}
          {row(t('calendario_titular'), b.members?.name ?? '—')}
          {b.child_name && row(t('calendario_menores'), b.child_name)}
          {row(t('calendario_horario'), `${fecha} · ${b.start_time?.slice(0, 5) ?? '—'}${b.end_time ? `–${b.end_time.slice(0, 5)}` : ''}`)}
          {(totalG > 0 || gA > 0 || gC > 0) && row(
            b.type === 'custodia' ? t('calendario_ninos', { s: totalG !== 1 ? 's' : '' }) : t('calendario_invitados', { s: totalG !== 1 ? 's' : '' }),
            b.type === 'custodia'
              ? String(totalG)
              : `${totalG} · ${gA} ${t('calendario_adultos', { s: gA !== 1 ? 's' : '' })}, ${gC} ${t('calendario_ninos', { s: gC !== 1 ? 's' : '' })}`
          )}
          {b.services?.name && row(t('calendario_servicio'), b.services.name)}
          {sala && row(t('calendario_sala'), sala)}
        </div>

        {b.amount != null && b.amount > 0 && (
          <div className="rounded-2xl border border-line bg-surface px-4 py-1">
            {row(t('calendario_total'), `${b.amount.toFixed(2)}€`)}
            {row(t('calendario_adelanto'), `${(b.deposit_amount ?? 0).toFixed(2)}€`)}
            {row(t('calendario_pendiente_cobro'), (
              <span className={pendiente > 0 ? 'text-amber font-semibold' : 'text-mint font-semibold'}>
                {pendiente > 0 ? `${pendiente.toFixed(2)}€` : t('calendario_pagado')}
              </span>
            ))}
          </div>
        )}

        {b.notes && (
          <div className="rounded-2xl border border-line bg-surface px-4 py-3">
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-1">{t('calendario_notas_titulo')}</p>
            <p className="text-sm text-snow whitespace-pre-wrap">{b.notes}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => router.push(`/calendario?edit=${b.id}`)}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-4 py-2.5 text-sm font-semibold text-fog hover:text-snow transition-colors">
            <Pencil size={15} /> {t('calendario_editar')}
          </button>
          {canExecute && (
            <button onClick={handleExecute} disabled={working}
              className="flex items-center gap-2 rounded-xl border border-lime bg-lime/10 px-4 py-2.5 text-sm font-semibold text-lime hover:bg-lime/20 transition-colors disabled:opacity-50">
              <Play size={15} fill="currentColor" /> {t('calendario_ejecutar')}
            </button>
          )}
          {b.status !== 'cancelled' && (
            <button onClick={handleCancel} disabled={working}
              className="flex items-center gap-2 rounded-xl border border-rose/40 px-4 py-2.5 text-sm font-semibold text-rose hover:bg-rose/10 transition-colors disabled:opacity-50">
              <Trash2 size={15} /> {t('calendario_cancelada')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
