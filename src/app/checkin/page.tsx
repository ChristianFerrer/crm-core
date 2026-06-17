'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Check, X, QrCode, RotateCcw, LogIn, LogOut, Search, User, UserPlus, Clock, AlertTriangle, Timer } from 'lucide-react'
import Link from 'next/link'

// Tarifa por hora cuando no hay bono activo
const HOURLY_RATE = 5 // €/h

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
}

type ActiveVisit = {
  id: string
  checked_in_at: string
  membership_id: string | null
  members: { id: string; name: string } | null
}

type CheckoutSummary = {
  memberName: string
  durationMin: number
  cost: number | null
  visitId: string
}

function getAge(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
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

function calcCurrentDuration(checkedIn: string, now: Date) {
  return Math.floor((now.getTime() - new Date(checkedIn).getTime()) / 60000)
}

function calcFinalCost(checkedIn: string, hasBono: boolean): { minutes: number; cost: number | null } {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(checkedIn).getTime()) / 60000))
  if (hasBono) return { minutes, cost: null }
  const halfHours = Math.ceil(minutes / 30)
  return { minutes, cost: halfHours * 0.5 * HOURLY_RATE }
}

function getBono(m: MemberRow) {
  const bono = m.memberships?.[0]
  if (!bono) return null
  const isUnlimited = bono.membership_types?.name?.toLowerCase().includes('ilimitado')
  if (isUnlimited) return { ok: true, unlimited: true, label: 'Bono ilimitado' }
  if ((bono.sessions_remaining ?? 0) <= 0) return { ok: false, unlimited: false, label: 'Bono agotado', sessions: 0 }
  return { ok: true, unlimited: false, label: bono.membership_types?.name ?? 'Bono', sessions: bono.sessions_remaining }
}

const MEMBER_QUERY = 'id, name, phone, birth_date, families(name), memberships(id, sessions_remaining, expires_at, membership_types(name))'

export default function CheckInPage() {
  const [mode, setMode] = useState<'qr' | 'search'>('qr')
  const [scanning, setScanning] = useState(true)
  const [member, setMember] = useState<MemberRow | null>(null)
  const [registering, setRegistering] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [allMembers, setAllMembers] = useState<MemberRow[]>([])

  const [activeVisits, setActiveVisits] = useState<ActiveVisit[]>([])
  const [now, setNow] = useState(new Date())
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [checkoutSummaries, setCheckoutSummaries] = useState<CheckoutSummary[]>([])

  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    supabase.from('members').select(MEMBER_QUERY).order('name')
      .then(({ data }) => setAllMembers((data as unknown as MemberRow[]) ?? []))
    loadActiveVisits()
  }, [])

  async function loadActiveVisits() {
    const { data } = await supabase
      .from('visits')
      .select('id, checked_in_at, membership_id, members(id, name)')
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: true })
    setActiveVisits((data as unknown as ActiveVisit[]) ?? [])
  }

  // QR scanner
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
          setMember(data as unknown as MemberRow)
        },
        () => {}
      ).catch(() => setCamError('No se puede acceder a la cámara'))
    })
    return () => { stopped = true; html5Qr?.stop().catch(() => {}) }
  }, [mode, scanning])

  async function handleCheckIn() {
    if (!member || registering) return
    setRegistering(true)
    const bono = getBono(member)
    const m = member.memberships?.[0]

    const { data: visit } = await supabase.from('visits').insert({
      member_id: member.id,
      membership_id: (bono?.ok && m) ? m.id : null,
      checked_in_at: new Date().toISOString(),
    }).select('id').single()

    if (bono?.ok && !bono.unlimited && m?.sessions_remaining != null) {
      await supabase.from('memberships')
        .update({ sessions_remaining: Math.max(0, m.sessions_remaining - 1) })
        .eq('id', m.id)
    }

    clearTimeout(flashTimer.current)
    setFlash(
      bono?.ok
        ? bono.unlimited ? '✓ Entrada registrada · bono ilimitado'
          : `✓ Entrada registrada · quedan ${Math.max(0, (m?.sessions_remaining ?? 1) - 1)} sesiones`
        : `✓ Entrada registrada · sin bono — se cobrará ${HOURLY_RATE}€/h`
    )
    flashTimer.current = setTimeout(() => setFlash(null), 5000)
    setRegistering(false)

    // Refresh member + active list
    const { data } = await supabase.from('members').select(MEMBER_QUERY).eq('id', member.id).single()
    if (data) setMember(data as unknown as MemberRow)
    await loadActiveVisits()
  }

  async function handleCheckOut(visit: ActiveVisit) {
    setCheckingOut(visit.id)
    const checkedOutAt = new Date().toISOString()
    await supabase.from('visits').update({ checked_out_at: checkedOutAt }).eq('id', visit.id)
    const { minutes, cost } = calcFinalCost(visit.checked_in_at, visit.membership_id !== null)
    setCheckoutSummaries(prev => [{
      visitId: visit.id,
      memberName: visit.members?.name ?? '—',
      durationMin: minutes,
      cost,
    }, ...prev.slice(0, 4)])
    setCheckingOut(null)
    await loadActiveVisits()
  }

  function reset() {
    setMember(null); setFlash(null); setCamError(null); setScanning(true)
  }

  const filteredMembers = query.trim().length > 0
    ? allMembers.filter(m => {
        const q = query.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        const mName = m.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        const qd = q.replace(/\D/g, '')
        return mName.includes(q) || (qd.length > 0 && (m.phone ?? '').replace(/\D/g, '').includes(qd))
      })
    : []

  // Member panel
  const bono = member ? getBono(member) : null
  const alreadyInside = member ? activeVisits.some(v => v.members?.id === member.id) : false

  const memberPanel = member ? (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden">
      {/* Status bar */}
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
            <p className="text-xs text-amber/80 mt-0.5">Tarifa: {HOURLY_RATE} €/h · mínimo 30 min</p>
          )}
        </div>
      </div>

      {/* Member info */}
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

        {alreadyInside ? (
          <div className="rounded-xl bg-iris/10 border border-iris/20 px-4 py-3 text-sm text-iris font-medium text-center">
            Este miembro ya tiene una entrada activa
          </div>
        ) : (
          <button
            onClick={handleCheckIn}
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
          <RotateCcw size={12} /> {mode === 'qr' ? 'Escanear otro' : 'Nueva búsqueda'}
        </button>
      </div>
    </div>
  ) : (
    <div className="grid min-h-[14rem] place-items-center rounded-2xl border-2 border-dashed border-line bg-surface/40 p-8 text-center">
      <div>
        {mode === 'qr' ? <QrCode size={32} className="mx-auto text-mist" /> : <User size={32} className="mx-auto text-mist" />}
        <p className="mt-3 text-sm text-fog max-w-xs">
          {mode === 'qr' ? 'Escanea el QR del miembro' : 'Busca y selecciona un miembro'}
        </p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">Check-in</h1>
          <p className="text-sm text-fog mt-0.5">Registra entradas y salidas</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Link href="/alta"
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors shrink-0">
            <UserPlus size={13} /> Alta
          </Link>
          <div className="flex rounded-xl border border-line bg-surface overflow-hidden shrink-0">
            <button onClick={() => { setMode('qr'); reset() }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${mode === 'qr' ? 'bg-lime/15 text-lime' : 'text-mist hover:text-fog'}`}>
              <QrCode size={13} /> QR
            </button>
            <button onClick={() => { setMode('search'); setMember(null) }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${mode === 'search' ? 'bg-lime/15 text-lime' : 'text-mist hover:text-fog'}`}>
              <Search size={13} /> Manual
            </button>
          </div>
        </div>
      </div>

      {/* Scanner + result */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        {/* Left */}
        <div className="rounded-2xl border border-line bg-surface p-4">
          {mode === 'qr' ? (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
                <QrCode size={13} className="text-lime" /> Escáner QR
              </div>
              {scanning && !camError ? (
                <div id="qr-reader" className="w-full rounded-xl overflow-hidden [&>*]:rounded-xl" />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
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
              <div className="relative mb-3">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Nombre o teléfono..." autoFocus
                  className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-10 pr-4 text-sm text-snow placeholder:text-mist outline-none focus:border-line2" />
              </div>
              <div className="max-h-[50vh] overflow-y-auto space-y-0.5">
                {filteredMembers.length > 0 ? filteredMembers.map(m => {
                  const b = getBono(m)
                  const inside = activeVisits.some(v => v.members?.id === m.id)
                  return (
                    <button key={m.id} onClick={() => { setMember(m); setQuery('') }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${member?.id === m.id ? 'bg-lime text-ink' : 'text-snow hover:bg-surface2'}`}>
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
                  <p className="py-8 text-center text-sm text-fog">{query.trim() ? 'Sin resultados' : 'Escribe para buscar'}</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right */}
        <div>{memberPanel}</div>
      </div>

      {/* ─── Dentro ahora ─── */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
          <Timer size={13} className="text-lime" />
          Dentro ahora
          <span className="ml-1 rounded-full bg-lime/15 text-lime px-2 py-0.5 font-bold">{activeVisits.length}</span>
        </div>

        {/* Checkout summaries */}
        {checkoutSummaries.map(s => (
          <div key={s.visitId} className="mb-2 rounded-xl border border-mint/20 bg-mint/5 px-4 py-3 flex items-center gap-3">
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
          <div className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-mist">
            Nadie dentro en este momento
          </div>
        ) : (
          <div className="space-y-2">
            {activeVisits.map(v => {
              const durationMin = calcCurrentDuration(v.checked_in_at, now)
              const hasBono = v.membership_id !== null
              const estimatedCost = hasBono ? null : (() => {
                const hh = Math.ceil(durationMin / 30)
                return hh * 0.5 * HOURLY_RATE
              })()
              const entryTime = new Date(v.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

              return (
                <div key={v.id} className="rounded-2xl border border-line bg-surface px-4 py-3 flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-surface2 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-fog">{(v.members?.name ?? '?')[0]}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-snow truncate">{v.members?.name ?? '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-mist">Entrada {entryTime}</span>
                      <span className="text-xs text-fog font-medium">{fmtDuration(durationMin)}</span>
                    </div>
                  </div>

                  {/* Bono / coste estimado */}
                  <div className="text-right shrink-0">
                    {hasBono ? (
                      <span className="text-xs text-iris font-medium">Bono</span>
                    ) : (
                      <div>
                        <p className="text-xs text-amber font-semibold">{fmtCost(estimatedCost!)}</p>
                        <p className="text-[10px] text-mist">estimado</p>
                      </div>
                    )}
                  </div>

                  {/* Checkout button */}
                  <button
                    onClick={() => handleCheckOut(v)}
                    disabled={checkingOut === v.id}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-semibold text-fog hover:border-rose/40 hover:text-rose transition-colors disabled:opacity-50 shrink-0"
                  >
                    <LogOut size={13} />
                    {checkingOut === v.id ? '...' : 'Salida'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
