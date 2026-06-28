'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Check, X, QrCode, RotateCcw, LogIn, LogOut, Search, User, UserPlus, Clock, AlertTriangle, Timer, History, CalendarDays, ChevronLeft, ChevronRight, Users, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { OpenCheckPanel } from './OpenCheckPanel'

const FALLBACK_HOURLY_RATE = 5

type VisitType = 'entrada' | 'custodia'

type ServiceRates = {
  adult: number       // entrada adulto €/hora
  child: number       // entrada niño €/hora
  custodia: number    // custodia €/hora por niño
}

type MemberRow = {
  id: string
  name: string
  phone: string | null
  birth_date: string | null
  families: { name: string } | null
  memberships: {
    id: string
    sessions_remaining: number | null
    expires_at: string
    membership_types: { name: string } | null
  }[]
  children?: { name: string; sex: string; birth_date: string }[]
}

type ActiveVisit = {
  id: string
  checked_in_at: string
  membership_id: string | null
  visit_type: VisitType
  children_present: { name: string }[] | null
  members: { id: string; name: string } | null
}

type HistoryVisit = {
  id: string
  checked_in_at: string
  checked_out_at: string | null
  membership_id: string | null
  visit_type: VisitType
  children_present: { name: string }[] | null
  members: { id: string; name: string } | null
}

type CheckoutSummary = {
  memberName: string
  durationMin: number
  cost: number | null
  visitId: string
}

function fmtDuration(minutes: number) {
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function fmtCost(cost: number) {
  return cost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function calcDurationMin(from: string, to?: string | null) {
  const end = to ? new Date(to).getTime() : Date.now()
  return Math.max(0, Math.floor((end - new Date(from).getTime()) / 60000))
}

function calcCost(minutes: number, numChildren: number, visitType: VisitType, rates: ServiceRates) {
  const fractions = Math.ceil(minutes / 60) // por hora o fracción
  if (visitType === 'custodia') {
    // Custodia: tarifa/hora × niños (el adulto acompañante no se cobra aparte)
    return fractions * rates.custodia * Math.max(1, numChildren)
  }
  // Entrada: adulto + cada niño, por hora o fracción
  return fractions * (rates.adult + numChildren * rates.child)
}

function getBono(m: MemberRow) {
  const bono = m.memberships?.[0]
  if (!bono) return null
  const isUnlimited = bono.membership_types?.name?.toLowerCase().includes('ilimitado')
  if (isUnlimited) return { ok: true, unlimited: true, label: 'Bono ilimitado' }
  if ((bono.sessions_remaining ?? 0) <= 0) return { ok: false, unlimited: false, label: 'Bono agotado', sessions: 0 }
  return { ok: true, unlimited: false, label: bono.membership_types?.name ?? 'Bono', sessions: bono.sessions_remaining }
}

// Format a Date as YYYY-MM-DD in local time
function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MEMBER_QUERY = 'id, name, phone, birth_date, families(name), memberships(id, sessions_remaining, expires_at, membership_types(name)), children'

// ─── Tab: Check-in ───────────────────────────────────────────────────────────

function CheckInTab({
  allMembers,
  activeVisits,
  onCheckedIn,
  rates,
}: {
  allMembers: MemberRow[]
  activeVisits: ActiveVisit[]
  onCheckedIn: () => void
  rates: ServiceRates
}) {
  const [mode, setMode] = useState<'manual' | 'qr'>('manual')
  const [scanning, setScanning] = useState(true)
  const [member, setMember] = useState<MemberRow | null>(null)
  const [registering, setRegistering] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [visitType, setVisitType] = useState<VisitType>('entrada')
  const [childrenPresent, setChildrenPresent] = useState<{ name: string; birth_date?: string }[]>([])
  const [extraChildren, setExtraChildren] = useState<string[]>([])
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (mode !== 'qr' || !scanning) return
    let html5Qr: any, stopped = false
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return
      html5Qr = new Html5Qrcode('qr-reader')
      html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decoded: string) => {
          await html5Qr.stop().catch(() => {})
          setScanning(false)
          const { data } = await supabase.from('members').select(MEMBER_QUERY).eq('qr_code', decoded).single()
          if (!data) { setCamError('Código QR no reconocido'); return }
          selectMember(data as unknown as MemberRow)
        },
        () => {}
      ).catch(() => setCamError('No se puede acceder a la cámara'))
    })
    return () => { stopped = true; html5Qr?.stop().catch(() => {}) }
  }, [mode, scanning])

  function reset() {
    setMember(null); setFlash(null); setCamError(null); setScanning(true)
    setVisitType('entrada'); setChildrenPresent([]); setExtraChildren([]); setPendingConfirm(false)
  }

  function selectMember(m: MemberRow) {
    setMember(m)
    setChildrenPresent((m.children ?? []).map(c => ({ name: c.name, birth_date: c.birth_date ?? undefined })))
    setExtraChildren([])
  }

  const filteredMembers = query.trim().length > 0
    ? allMembers.filter(m => {
        const q = query.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        const mName = m.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        const qd = q.replace(/\D/g, '')
        return mName.includes(q) || (qd.length > 0 && (m.phone ?? '').replace(/\D/g, '').includes(qd))
      })
    : allMembers

  const bono = member ? getBono(member) : null
  const alreadyInside = member ? activeVisits.some(v => v.members?.id === member.id) : false

  async function handleCheckIn() {
    if (!member || registering) return
    setRegistering(true)
    const b = getBono(member)
    const m = member.memberships?.[0]

    const allChildrenPresent = [
      ...childrenPresent,
      ...extraChildren.filter(n => n.trim()).map(n => ({ name: n.trim() })),
    ]
    const numChildren = Math.max(1, allChildrenPresent.length)

    await supabase.from('visits').insert({
      member_id: member.id,
      membership_id: (b?.ok && m) ? m.id : null,
      checked_in_at: new Date().toISOString(),
      visit_type: visitType,
      children_present: allChildrenPresent,
    })

    if (b?.ok && !b.unlimited && m?.sessions_remaining != null) {
      await supabase.from('memberships')
        .update({ sessions_remaining: Math.max(0, m.sessions_remaining - 1) })
        .eq('id', m.id)
    }

    const typeLabel = visitType === 'custodia' ? 'Custodia' : 'Entrada'
    clearTimeout(flashTimer.current)
    if (b?.ok) {
      setFlash(
        b.unlimited
          ? `✓ ${typeLabel} registrada · bono ilimitado · ${numChildren} niño${numChildren !== 1 ? 's' : ''}`
          : `✓ ${typeLabel} registrada · quedan ${Math.max(0, (m?.sessions_remaining ?? 1) - 1)} sesiones`
      )
    } else {
      const rateLabel = visitType === 'custodia'
        ? `${rates.custodia}€/h × ${numChildren} niño${numChildren !== 1 ? 's' : ''}`
        : `${rates.adult}€ adulto + ${numChildren} × ${rates.child}€ niño/h`
      setFlash(`✓ ${typeLabel} registrada · sin bono — ${rateLabel}`)
    }
    flashTimer.current = setTimeout(() => setFlash(null), 6000)
    setRegistering(false)

    const { data } = await supabase.from('members').select(MEMBER_QUERY).eq('id', member.id).single()
    if (data) {
      const refreshed = data as unknown as MemberRow
      setMember(refreshed)
      setChildrenPresent((refreshed.children ?? []).map(c => ({ name: c.name })))
      setExtraChildren([])
    }
    onCheckedIn()
  }

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl border border-line bg-surface overflow-hidden">
          <button onClick={() => { setMode('manual'); reset() }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${mode === 'manual' ? 'bg-lime/15 text-lime' : 'text-mist hover:text-fog'}`}>
            <Search size={13} /> Manual
          </button>
          <button onClick={() => { setMode('qr'); reset() }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${mode === 'qr' ? 'bg-lime/15 text-lime' : 'text-mist hover:text-fog'}`}>
            <QrCode size={13} /> QR
          </button>
        </div>
        <Link href="/miembros/nuevo"
          className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors">
          <UserPlus size={13} /> Nuevo miembro
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1.1fr] md:items-stretch">
        {/* Search / QR */}
        <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col h-[calc(100svh-20rem)] min-h-[22rem]">
          {mode === 'qr' ? (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
                <QrCode size={13} className="text-lime" /> Escáner QR
              </div>
              {scanning && !camError ? (
                <div id="qr-reader" className="w-full rounded-xl overflow-hidden [&>*]:rounded-xl" />
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 gap-3">
                  {camError && <p className="text-sm text-rose text-center">{camError}</p>}
                  {!member && (
                    <button onClick={reset}
                      className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-fog hover:text-snow hover:border-line2 transition-colors">
                      <RotateCcw size={14} /> Volver a escanear
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="relative mb-3 shrink-0">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Nombre o teléfono..." autoFocus
                  className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-10 pr-4 text-sm text-snow placeholder:text-mist outline-none focus:border-line2" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
                {filteredMembers.length > 0 ? filteredMembers.map(m => {
                  const b = getBono(m)
                  const inside = activeVisits.some(v => v.members?.id === m.id)
                  return (
                    <button key={m.id} onClick={() => { selectMember(m); setQuery('') }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${member?.id === m.id ? 'bg-lime/15 text-lime' : 'text-snow hover:bg-surface2'}`}>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${inside ? 'bg-iris' : !b ? 'bg-rose' : !b.ok ? 'bg-amber' : b.unlimited ? 'bg-iris' : (b.sessions ?? 99) <= 2 ? 'bg-amber' : 'bg-mint'}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium">{m.name}</span>
                        {inside && <span className="block text-xs text-iris">Dentro ahora</span>}
                      </span>
                      {b?.unlimited ? <span className="text-xs font-semibold text-iris shrink-0">∞</span>
                        : b?.sessions != null ? <span className="text-xs font-semibold text-mist shrink-0">{b.sessions} ses.</span>
                        : <span className="text-xs text-rose shrink-0">sin bono</span>}
                    </button>
                  )
                }) : (
                  <p className="py-8 text-center text-sm text-fog">Sin resultados</p>
                )}
              </div>
              {/* Dot legend */}
              <div className="shrink-0 mt-3 pt-3 border-t border-line flex flex-wrap gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-mint shrink-0" /><span className="text-[11px] text-fog">Bono activo</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber shrink-0" /><span className="text-[11px] text-fog">Bono bajo / agotado</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose shrink-0" /><span className="text-[11px] text-fog">Sin bono</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-iris shrink-0" /><span className="text-[11px] text-fog">Dentro ahora / ilimitado</span></div>
              </div>
            </>
          )}
        </div>

        {/* Member panel */}
        {member ? (
          <div className="rounded-2xl border border-line bg-surface overflow-hidden flex flex-col">
            <div className={`px-5 py-4 flex items-center gap-3 ${
              alreadyInside ? 'bg-iris/10 border-b border-iris/20' :
              bono?.ok ? 'bg-lime/10 border-b border-lime/20' :
              'bg-amber/10 border-b border-amber/20'
            }`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                alreadyInside ? 'bg-iris/20' : bono?.ok ? 'bg-lime/20' : 'bg-amber/20'
              }`}>
                {alreadyInside ? <Clock size={18} className="text-iris" /> :
                 bono?.ok ? <Check size={18} className="text-lime" strokeWidth={2.5} /> :
                 <AlertTriangle size={18} className="text-amber" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${alreadyInside ? 'text-iris' : bono?.ok ? 'text-lime' : 'text-amber'}`}>
                  {alreadyInside ? 'Ya está dentro' :
                   bono?.ok ? (bono.unlimited ? 'Bono ilimitado' : `${bono.sessions} sesiones restantes`) :
                   !bono ? 'Sin bono · se cobrará por horas' : 'Bono agotado · se cobrará por horas'}
                </p>
                {!bono?.ok && !alreadyInside && (
                  <p className="text-xs text-amber/80 mt-0.5">
                    {visitType === 'custodia'
                      ? `Custodia: ${rates.custodia} €/h × niños · por hora o fracción`
                      : `Adulto ${rates.adult}€ + niño ${rates.child}€ · por hora o fracción`}
                  </p>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold text-snow">{member.name}</p>
                  {member.families && <p className="text-xs text-mist mt-0.5">Familia {member.families.name}</p>}
                  {member.phone && <p className="text-sm text-fog mt-1">{member.phone}</p>}
                </div>
                {bono && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-fog">{bono.label}</p>
                    {bono.unlimited ? (
                      <p className="font-bold text-base text-iris mt-0.5">∞</p>
                    ) : bono.sessions != null ? (
                      <p className={`font-bold text-base mt-0.5 ${bono.sessions <= 2 ? 'text-amber' : 'text-lime'}`}>{bono.sessions}</p>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Visit type selector */}
              {!alreadyInside && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-fog uppercase tracking-wide">Tipo de visita</p>
                  <div className="flex gap-2">
                    {(['entrada', 'custodia'] as VisitType[]).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setVisitType(t)}
                        className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors capitalize ${
                          visitType === t
                            ? t === 'custodia'
                              ? 'bg-mint/15 border-mint/30 text-mint'
                              : 'bg-lime/15 border-lime/30 text-lime'
                            : 'bg-surface2 border-line text-fog hover:text-snow'
                        }`}
                      >
                        {t === 'entrada' ? 'Entrada normal' : 'Custodia'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Children selection */}
              {((member.children && member.children.length > 0) || extraChildren.length > 0) && !alreadyInside && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-fog uppercase tracking-wide">Niños presentes</p>
                  {member.children && member.children.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {member.children.map((child, i) => {
                        const selected = childrenPresent.some(c => c.name === child.name)
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setChildrenPresent(prev =>
                              selected
                                ? prev.filter(c => c.name !== child.name)
                                : [...prev, { name: child.name }]
                            )}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                              selected
                                ? 'bg-lime/15 border-lime/30 text-lime'
                                : 'bg-surface2 border-line text-fog'
                            }`}
                          >
                            {child.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {extraChildren.length > 0 && (
                    <div className="space-y-1.5">
                      {extraChildren.map((name, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            value={name}
                            onChange={e => setExtraChildren(prev => prev.map((n, j) => j === i ? e.target.value : n))}
                            placeholder="Nombre del niño/a"
                            className="flex-1 rounded-xl border border-line bg-surface2 px-3 py-1.5 text-sm text-snow placeholder:text-mist outline-none focus:border-line2"
                          />
                          <button
                            type="button"
                            onClick={() => setExtraChildren(prev => prev.filter((_, j) => j !== i))}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-line bg-surface2 text-fog hover:text-rose hover:border-rose/30 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!alreadyInside && (
                <button
                  type="button"
                  onClick={() => setExtraChildren(prev => [...prev, ''])}
                  className="flex items-center gap-1.5 text-xs text-mist hover:text-fog transition-colors"
                >
                  <span className="w-5 h-5 rounded-full border border-line bg-surface2 flex items-center justify-center font-bold text-fog">+</span>
                  Añadir niño/a
                </button>
              )}

              {alreadyInside ? (
                <div className="rounded-xl bg-iris/10 border border-iris/20 px-4 py-3 text-sm text-iris font-medium text-center">
                  Este miembro ya tiene una entrada activa
                </div>
              ) : pendingConfirm ? (
                <div className="rounded-xl border border-amber/30 bg-amber/10 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="text-amber shrink-0 mt-0.5" />
                    <p className="text-sm text-amber font-semibold">¿Confirmar entrada sin bono?</p>
                  </div>
                  <p className="text-xs text-fog">
                    {bono ? 'El bono está agotado.' : 'No tiene bono activo.'} Se cobrará en efectivo:{' '}
                    {visitType === 'custodia'
                      ? `${rates.custodia} €/h por niño`
                      : `${rates.adult} €/h adulto + ${rates.child} €/h niño`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPendingConfirm(false)}
                      className="flex-1 rounded-xl border border-line py-2 text-sm text-fog hover:text-snow transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCheckIn}
                      disabled={registering}
                      className="flex-1 rounded-xl bg-amber/20 border border-amber/30 py-2 text-sm font-semibold text-amber hover:bg-amber/30 transition-colors disabled:opacity-60"
                    >
                      {registering ? 'Registrando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { if (!bono?.ok) { setPendingConfirm(true) } else { handleCheckIn() } }}
                  disabled={registering}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm transition active:scale-[0.99] disabled:opacity-60 ${
                    bono?.ok
                      ? 'bg-lime text-ink hover:bg-lime-deep'
                      : 'bg-amber/20 text-amber border border-amber/30 hover:bg-amber/30'
                  }`}
                  style={bono?.ok ? { boxShadow: 'var(--shadow-lime)' } : {}}
                >
                  <LogIn size={17} strokeWidth={2.2} />
                  {registering ? 'Registrando...' : bono?.ok ? 'Registrar entrada' : 'Registrar entrada (sin bono)'}
                </button>
              )}

              {flash && (
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-mint text-center">
                  <Check size={14} strokeWidth={2.5} /> {flash}
                </div>
              )}

              <button onClick={reset} className="flex w-full items-center justify-center gap-1.5 text-xs text-mist hover:text-fog pt-1">
                <RotateCcw size={12} /> Nueva búsqueda
              </button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[24rem] place-items-center rounded-2xl border-2 border-dashed border-line bg-surface/40 p-8 text-center h-full">
            <div>
              {mode === 'qr' ? <QrCode size={32} className="mx-auto text-mist" /> : <User size={32} className="mx-auto text-mist" />}
              <p className="mt-3 text-sm text-fog max-w-xs">
                {mode === 'qr' ? 'Escanea el QR del miembro' : 'Busca y selecciona un miembro'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Dentro ahora ───────────────────────────────────────────────────────

function DentroTab({
  activeVisits,
  onCheckOut,
  checkingOut,
  checkoutSummaries,
  rates,
}: {
  activeVisits: ActiveVisit[]
  onCheckOut: (v: ActiveVisit) => void
  checkingOut: string | null
  checkoutSummaries: CheckoutSummary[]
  rates: ServiceRates
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [openCheckVisitId, setOpenCheckVisitId] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex flex-col gap-3 h-[calc(100svh-20rem)] min-h-[22rem]">
      <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide shrink-0">
        <Timer size={13} className="text-lime" />
        Dentro ahora
      </div>

      {checkoutSummaries.map(s => (
        <div key={s.visitId} className="shrink-0 rounded-xl border border-mint/20 bg-mint/5 px-4 py-3 flex items-center gap-3">
          <Check size={14} className="text-mint shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-snow">{s.memberName}</span>
            <span className="text-xs text-fog ml-2">{fmtDuration(s.durationMin)}</span>
          </div>
          {s.cost !== null ? (
            <span className="text-sm font-bold text-lime shrink-0">{fmtCost(s.cost)}</span>
          ) : (
            <span className="text-xs text-fog shrink-0">Bono</span>
          )}
        </div>
      ))}

      {activeVisits.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-mist">
          Nadie dentro en este momento
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
          {activeVisits.map(v => {
            const durationMin = calcDurationMin(v.checked_in_at, null)
            const isStale = durationMin > 180
            const hasBono = v.membership_id !== null
            const numChildren = Math.max(1, v.children_present?.length ?? 0)
            const estimatedCost = hasBono ? null : calcCost(Math.max(30, durationMin), numChildren, v.visit_type, rates)
            const entryTime = new Date(v.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            const kids = v.children_present ?? []
            const isExpanded = expandedId === v.id

            return (
              <div key={v.id} className="rounded-2xl border border-line bg-surface overflow-hidden">
                {/* Main row — clickable */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface2 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                >
                  <div className="w-8 h-8 rounded-full bg-surface2 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-fog">{(v.members?.name ?? '?')[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-snow truncate">{v.members?.name ?? '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-mist">Entrada {entryTime}</span>
                      <span className={`text-xs font-medium ${isStale ? 'text-amber' : 'text-fog'}`}>{fmtDuration(durationMin)}</span>
                      {isStale && <span className="text-[10px] text-amber font-semibold">· revisar salida</span>}
                      {kids.length > 0 && (
                        <span className="text-xs text-lime font-medium">{kids.length} niño{kids.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 mr-1">
                    {hasBono ? (
                      <div className="text-right">
                        <span className="text-xs text-iris font-medium">Bono</span>
                        {v.visit_type === 'custodia' && <p className="text-[10px] text-mint">Custodia</p>}
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="text-xs text-amber font-semibold">{fmtCost(estimatedCost!)}</p>
                        <p className="text-[10px] text-mist">{v.visit_type === 'custodia' ? 'custodia' : 'estimado'}</p>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} className={`text-mist shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-line px-4 py-3 space-y-3 bg-surface2/40">
                    <div className="flex items-center gap-4 text-xs text-fog">
                      <span className="flex items-center gap-1"><Clock size={11} className="text-mist" /> Entrada <span className="text-snow font-semibold">{entryTime}</span></span>
                      <span className="flex items-center gap-1"><Timer size={11} className="text-mist" /> <span className="text-snow font-semibold">{fmtDuration(durationMin)}</span></span>
                    </div>

                    {kids.length > 0 ? (
                      <div>
                        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-1.5">Niños presentes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {kids.map((k, i) => (
                            <span key={i} className="rounded-full bg-lime/10 border border-lime/20 text-lime text-xs px-2.5 py-1 font-medium">{k.name}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-mist">Sin niños registrados</p>
                    )}

                    {/* Cost breakdown */}
                    {!hasBono && (() => {
                      const fractions = Math.ceil(Math.max(1, durationMin) / 60)
                      const isCustodia = v.visit_type === 'custodia'
                      const lines = isCustodia
                        ? kids.map(k => ({ label: k.name, unit: `${rates.custodia}€ × ${fractions}h`, cost: fractions * rates.custodia }))
                        : [
                            { label: v.members?.name ?? 'Adulto', unit: `${rates.adult}€ × ${fractions}h`, cost: fractions * rates.adult },
                            ...kids.map(k => ({ label: k.name, unit: `${rates.child}€ × ${fractions}h`, cost: fractions * rates.child })),
                          ]
                      const total = lines.reduce((s, l) => s + l.cost, 0)
                      return (
                        <div className="rounded-xl border border-line bg-surface divide-y divide-line overflow-hidden">
                          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide px-3 py-2">
                            Desglose · {isCustodia ? 'Custodia' : 'Entrada'} · por hora o fracción
                          </p>
                          {lines.map((l, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2">
                              <span className="text-xs text-fog">{l.label}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] text-mist">{l.unit}</span>
                                <span className="text-xs font-semibold text-snow min-w-[3.5rem] text-right">{fmtCost(l.cost)}</span>
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center justify-between px-3 py-2 bg-surface2">
                            <span className="text-xs font-semibold text-snow">Total estimado</span>
                            <span className="text-sm font-bold text-lime">{fmtCost(total)}</span>
                          </div>
                        </div>
                      )
                    })()}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setOpenCheckVisitId(openCheckVisitId === v.id ? null : v.id)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-semibold text-fog hover:text-snow transition-colors"
                      >
                        <ShoppingBag size={13} /> Ver cuenta
                      </button>
                      <button
                        onClick={() => onCheckOut(v)}
                        disabled={checkingOut === v.id}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs font-semibold text-rose hover:bg-rose/20 transition-colors disabled:opacity-50"
                      >
                        <LogOut size={13} />
                        {checkingOut === v.id ? 'Salida...' : 'Registrar salida'}
                      </button>
                    </div>

                    {openCheckVisitId === v.id && (
                      <OpenCheckPanel
                        visitId={v.id}
                        memberName={v.members?.name ?? '—'}
                        durationMin={durationMin}
                        timeCost={hasBono ? null : calcCost(Math.max(30, durationMin), Math.max(1, v.children_present?.length ?? 0), v.visit_type, rates)}
                        onClose={() => setOpenCheckVisitId(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Historial ──────────────────────────────────────────────────────────

type HistorialRange = 'day' | 'week' | 'month' | 'custom'

function HistorialTab({ rates }: { rates: ServiceRates }) {
  const [range, setRange] = useState<HistorialRange>('day')
  const [customDate, setCustomDate] = useState(toLocalDate(new Date()))
  const [visits, setVisits] = useState<HistoryVisit[]>([])
  const [loading, setLoading] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week
  const [monthOffset, setMonthOffset] = useState(0)

  useEffect(() => {
    fetchVisits()
  }, [range, customDate, weekOffset, monthOffset])

  async function fetchVisits() {
    setLoading(true)
    const now = new Date()
    let from: string, to: string

    if (range === 'day') {
      const d = toLocalDate(now)
      from = `${d}T00:00:00`
      to = `${d}T23:59:59`
    } else if (range === 'week') {
      const d = new Date(now)
      d.setDate(d.getDate() + weekOffset * 7)
      const day = d.getDay() === 0 ? 6 : d.getDay() - 1
      const mon = new Date(d); mon.setDate(d.getDate() - day)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      from = `${toLocalDate(mon)}T00:00:00`
      to = `${toLocalDate(sun)}T23:59:59`
    } else if (range === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      from = `${toLocalDate(d)}T00:00:00`
      to = `${toLocalDate(last)}T23:59:59`
    } else {
      from = `${customDate}T00:00:00`
      to = `${customDate}T23:59:59`
    }

    const { data } = await supabase
      .from('visits')
      .select('id, checked_in_at, checked_out_at, membership_id, visit_type, children_present, members(id, name)')
      .gte('checked_in_at', from)
      .lte('checked_in_at', to)
      .order('checked_in_at', { ascending: false })

    setVisits((data as unknown as HistoryVisit[]) ?? [])
    setLoading(false)
  }

  function rangeLabel() {
    const now = new Date()
    if (range === 'week') {
      const d = new Date(now); d.setDate(d.getDate() + weekOffset * 7)
      const day = d.getDay() === 0 ? 6 : d.getDay() - 1
      const mon = new Date(d); mon.setDate(d.getDate() - day)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return `${mon.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
    }
    if (range === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
      return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    }
    return ''
  }

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex lg:inline-flex gap-1 bg-surface rounded-xl p-1 border border-line">
        {(['day', 'week', 'month', 'custom'] as HistorialRange[]).map(r => (
          <button key={r} onClick={() => { setRange(r); setWeekOffset(0); setMonthOffset(0) }}
            className={`flex-1 lg:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${range === r ? 'bg-lime text-ink' : 'text-fog hover:text-snow'}`}>
            {r === 'day' ? 'Hoy' : r === 'week' ? 'Semana' : r === 'month' ? 'Mes' : 'Fecha'}
          </button>
        ))}
      </div>

      {/* Navigation for week/month */}
      {(range === 'week' || range === 'month') && (
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => range === 'week' ? setWeekOffset(o => o - 1) : setMonthOffset(o => o - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-line bg-surface text-fog hover:text-snow hover:border-line2 transition-colors">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-snow capitalize">{rangeLabel()}</span>
          <button
            onClick={() => range === 'week' ? setWeekOffset(o => o + 1) : setMonthOffset(o => o + 1)}
            disabled={(range === 'week' && weekOffset >= 0) || (range === 'month' && monthOffset >= 0)}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-line bg-surface text-fog hover:text-snow hover:border-line2 transition-colors disabled:opacity-30">
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Custom date picker */}
      {range === 'custom' && (
        <input
          type="date"
          value={customDate}
          max={toLocalDate(new Date())}
          onChange={e => setCustomDate(e.target.value)}
          className="w-full bg-surface2 border border-line rounded-xl px-4 py-2 text-sm text-snow outline-none focus:border-line2"
        />
      )}

      {/* Visit count */}
      <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide">
        <History size={13} className="text-lime" />
        {loading ? 'Cargando...' : `${visits.length} visitas`}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-surface border border-line animate-pulse" />)}
        </div>
      ) : visits.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-mist">
          Sin visitas en este período
        </div>
      ) : (
        <div className="space-y-1.5">
          {visits.map(v => {
            const dmin = v.checked_out_at ? calcDurationMin(v.checked_in_at, v.checked_out_at) : null
            const numChildren = Math.max(1, v.children_present?.length ?? 0)
            const cost = (!v.membership_id && dmin != null) ? calcCost(Math.max(30, dmin), numChildren, v.visit_type, rates) : null
            const entryTime = new Date(v.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            const exitTime = v.checked_out_at ? new Date(v.checked_out_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null
            const dateStr = new Date(v.checked_in_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

            return (
              <div key={v.id} className="rounded-xl border border-line bg-surface px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-snow truncate">{v.members?.name ?? '—'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {range !== 'day' && range !== 'custom' && (
                      <span className="text-[10px] text-mist capitalize">{dateStr} ·</span>
                    )}
                    <span className="text-xs text-fog">{entryTime}{exitTime ? ` → ${exitTime}` : ' → en curso'}</span>
                    {dmin != null && <span className="text-xs text-mist">· {fmtDuration(dmin)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {v.membership_id ? (
                    <div>
                      <span className="text-xs text-iris font-medium">Bono</span>
                      {v.visit_type === 'custodia' && <p className="text-[10px] text-mint">Custodia</p>}
                    </div>
                  ) : cost != null ? (
                    <div>
                      <span className="text-xs font-bold text-lime">{fmtCost(cost)}</span>
                      {v.visit_type === 'custodia' && <p className="text-[10px] text-mint">Custodia</p>}
                    </div>
                  ) : (
                    <span className="text-xs text-amber">En curso</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

function VisitasPageInner() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') as 'checkin' | 'dentro' | 'historial' | null
  const [tab, setTab] = useState<'checkin' | 'dentro' | 'historial'>(initialTab ?? 'checkin')
  const [allMembers, setAllMembers] = useState<MemberRow[]>([])
  const [activeVisits, setActiveVisits] = useState<ActiveVisit[]>([])
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [checkoutSummaries, setCheckoutSummaries] = useState<CheckoutSummary[]>([])
  const [rates, setRates] = useState<ServiceRates>({ adult: FALLBACK_HOURLY_RATE, child: FALLBACK_HOURLY_RATE, custodia: FALLBACK_HOURLY_RATE })
  const [capacity, setCapacity] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('members').select(MEMBER_QUERY).order('name')
      .then(({ data }) => setAllMembers((data as unknown as MemberRow[]) ?? []))
    supabase.from('tenants').select('capacity').single()
      .then(({ data }) => { if (data?.capacity) setCapacity(data.capacity) })
    loadActiveVisits()
    // Load service rates
    supabase
      .from('services')
      .select('name, category, price, price_unit')
      .in('category', ['entrada', 'custodia'])
      .eq('active', true)
      .then(({ data }) => {
        const rows = data ?? []
        const adult = rows.find(s => s.category === 'entrada' && /adulto/i.test(s.name))
        const child = rows.find(s => s.category === 'entrada' && /ni[ñn]/i.test(s.name))
        const custodiaHour = rows.find(s => s.category === 'custodia' && s.price_unit === 'hora')
        setRates({
          adult: adult?.price ?? FALLBACK_HOURLY_RATE,
          child: child?.price ?? FALLBACK_HOURLY_RATE,
          custodia: custodiaHour?.price ?? FALLBACK_HOURLY_RATE,
        })
      })
  }, [])

  async function loadActiveVisits() {
    const { data } = await supabase
      .from('visits')
      .select('id, checked_in_at, membership_id, visit_type, children_present, members(id, name)')
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: true })
    setActiveVisits((data as unknown as ActiveVisit[]) ?? [])
  }

  async function handleCheckOut(visit: ActiveVisit) {
    setCheckingOut(visit.id)
    const checkedOutAt = new Date().toISOString()
    await supabase.from('visits').update({ checked_out_at: checkedOutAt }).eq('id', visit.id)
    const dmin = Math.max(1, Math.floor((Date.now() - new Date(visit.checked_in_at).getTime()) / 60000))
    const numChildren = Math.max(1, visit.children_present?.length ?? 0)
    const cost = visit.membership_id !== null ? null : calcCost(Math.max(30, dmin), numChildren, visit.visit_type, rates)
    setCheckoutSummaries(prev => [{
      visitId: visit.id,
      memberName: visit.members?.name ?? '—',
      durationMin: dmin,
      cost,
    }, ...prev.slice(0, 4)])
    setCheckingOut(null)
    await loadActiveVisits()
  }

  const tabs = [
    { id: 'checkin' as const, label: 'Check-in', icon: LogIn },
    { id: 'dentro' as const, label: 'Dentro', icon: Timer },
    { id: 'historial' as const, label: 'Historial', icon: History },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">Visitas</h1>
        <p className="text-sm text-fog mt-0.5">Entradas, salidas e historial</p>
      </div>

      {/* Aforo gauge — always visible */}
      {capacity != null && (() => {
        const activeAdults = activeVisits.length
        const activeChildren = activeVisits.reduce((s, v) => s + (v.children_present?.length ?? 0), 0)
        const activeTotal = activeAdults + activeChildren
        const aforoPct = Math.min(100, (activeTotal / capacity) * 100)
        const aforoTextColor = aforoPct < 70 ? 'text-lime' : aforoPct <= 90 ? 'text-amber' : 'text-rose-500'
        return (
          <div className="rounded-2xl border border-line bg-surface p-4 lg:p-5">
            <h2 className="text-xs font-semibold text-fog uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Users size={13} /> Aforo
            </h2>
            <div className="flex items-end justify-between mb-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-semibold text-snow">{activeTotal}</span>
                <span className="text-xs text-fog">de {capacity} plazas</span>
              </div>
              <span className={`text-sm font-bold ${aforoTextColor}`}>{Math.round(aforoPct)}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-line overflow-hidden mb-3 flex">
              <div className="h-full bg-lime transition-all duration-500" style={{ width: `${capacity ? Math.min(100, (activeAdults / capacity) * 100) : 0}%` }} />
              <div className="h-full bg-cyan-300 transition-all duration-500" style={{ width: `${capacity ? Math.min(100, (activeChildren / capacity) * 100) : 0}%` }} />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-lime shrink-0" />
                <span className="text-xs text-fog"><span className="text-lime font-semibold">{activeAdults}</span> adulto{activeAdults !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-300 shrink-0" />
                <span className="text-xs text-fog"><span className="text-cyan-300 font-semibold">{activeChildren}</span> niño{activeChildren !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tab bar */}
      <div className="flex lg:inline-flex gap-1 bg-surface rounded-xl p-1 border border-line">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors relative ${tab === id ? 'bg-lime text-ink' : 'text-fog hover:text-snow'}`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'checkin' && (
        <CheckInTab
          allMembers={allMembers}
          activeVisits={activeVisits}
          onCheckedIn={loadActiveVisits}
          rates={rates}
        />
      )}

      {tab === 'dentro' && (
        <DentroTab
          activeVisits={activeVisits}
          onCheckOut={handleCheckOut}
          checkingOut={checkingOut}
          checkoutSummaries={checkoutSummaries}
          rates={rates}
        />
      )}

      {tab === 'historial' && <HistorialTab rates={rates} />}
    </div>
  )
}

import { Suspense } from 'react'
export default function VisitasPage() {
  return (
    <Suspense>
      <VisitasPageInner />
    </Suspense>
  )
}
