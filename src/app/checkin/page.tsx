'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Check, X, QrCode, RotateCcw, LogIn, Search, User } from 'lucide-react'

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

function getAge(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

function verify(member: MemberRow) {
  const m = member.memberships?.[0]
  if (!m) return { ok: false, title: 'Sin bono activo', detail: 'Este miembro no tiene ningún bono asignado.' }
  const isUnlimited = m.membership_types?.name?.toLowerCase().includes('ilimitado')
  if (isUnlimited) return { ok: true, title: 'Bono ilimitado', detail: 'Acceso libre — bono mensual sin límite de sesiones.' }
  if (m.sessions_remaining === 0) return { ok: false, title: 'Bono agotado', detail: 'No quedan sesiones. Hay que renovar el bono.' }
  if (m.sessions_remaining == null) return { ok: false, title: 'Sin sesiones', detail: 'El bono no tiene sesiones configuradas.' }
  return {
    ok: true,
    title: 'Acceso permitido',
    detail: `Quedan ${m.sessions_remaining} sesión${m.sessions_remaining === 1 ? '' : 'es'} tras esta visita.`,
  }
}

const MEMBER_QUERY = 'id, name, phone, birth_date, families(name), memberships(id, sessions_remaining, expires_at, membership_types(name))'

export default function CheckInPage() {
  const [mode, setMode] = useState<'qr' | 'search'>('qr')
  const [scanning, setScanning] = useState(true)
  const [member, setMember] = useState<MemberRow | null>(null)
  const [result, setResult] = useState<ReturnType<typeof verify> | null>(null)
  const [registering, setRegistering] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [allMembers, setAllMembers] = useState<MemberRow[]>([])
  const flashTimer = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    supabase
      .from('members')
      .select(MEMBER_QUERY)
      .order('name')
      .then(({ data }) => setAllMembers((data as unknown as MemberRow[]) ?? []))
  }, [])

  useEffect(() => {
    if (mode !== 'qr' || !scanning) return
    let html5Qr: any
    let stopped = false

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return
      html5Qr = new Html5Qrcode('qr-reader')
      html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decoded: string) => {
          await html5Qr.stop().catch(() => {})
          setScanning(false)
          await lookupByQr(decoded)
        },
        () => {}
      ).catch(() => setCamError('No se puede acceder a la cámara'))
    })

    return () => {
      stopped = true
      html5Qr?.stop().catch(() => {})
    }
  }, [mode, scanning])

  async function lookupByQr(qrCode: string) {
    const { data } = await supabase
      .from('members')
      .select(MEMBER_QUERY)
      .eq('qr_code', qrCode)
      .single()
    if (!data) {
      setCamError('Código QR no reconocido')
      return
    }
    selectMember(data as unknown as MemberRow)
  }

  function selectMember(m: MemberRow) {
    setMember(m)
    setResult(verify(m))
    setFlash(null)
  }

  async function handleCheckIn() {
    if (!member || !result?.ok || registering) return
    setRegistering(true)
    const m = member.memberships?.[0]
    const isUnlimited = m?.membership_types?.name?.toLowerCase().includes('ilimitado')

    await supabase.from('visits').insert({
      member_id: member.id,
      membership_id: m?.id ?? null,
      checked_in_at: new Date().toISOString(),
    })

    if (m && !isUnlimited && m.sessions_remaining != null) {
      await supabase.from('memberships')
        .update({ sessions_remaining: Math.max(0, m.sessions_remaining - 1) })
        .eq('id', m.id)
    }

    clearTimeout(flashTimer.current)
    const remaining = isUnlimited ? null : Math.max(0, (m?.sessions_remaining ?? 1) - 1)
    setFlash(isUnlimited ? 'Entrada registrada — bono ilimitado.' : `Entrada registrada. Quedan ${remaining} sesiones.`)
    flashTimer.current = setTimeout(() => setFlash(null), 4000)
    setRegistering(false)

    // refresh member data
    const { data } = await supabase.from('members').select(MEMBER_QUERY).eq('id', member.id).single()
    if (data) { const updated = data as unknown as MemberRow; setMember(updated); setResult(verify(updated)) }
  }

  function reset() {
    setMember(null)
    setResult(null)
    setFlash(null)
    setCamError(null)
    setScanning(true)
  }

  const filteredMembers = query.trim().length > 0
    ? allMembers.filter(m => m.name.toLowerCase().includes(query.toLowerCase()) ||
        (m.phone ?? '').replace(/\D/g, '').includes(query.replace(/\D/g, '')))
    : []

  const resultPanel = member && result ? (
    <div className={`overflow-hidden rounded-2xl border ${result.ok ? 'border-mint/30 bg-mint-soft' : 'border-rose/30 bg-rose-soft'}`}>
      <div className={`px-6 py-7 text-center ${result.ok ? 'bg-mint text-ink' : 'bg-rose text-ink'}`}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink/15">
          {result.ok ? <Check size={30} strokeWidth={3} /> : <X size={30} strokeWidth={3} />}
        </div>
        <div className="mt-3 font-display text-xl font-semibold">{result.title}</div>
        <div className="mx-auto mt-1 max-w-xs text-sm text-ink/75">{result.detail}</div>
      </div>
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold text-snow">{member.name}</p>
            {member.families && <p className="text-xs text-mist mt-0.5">Familia {member.families.name}</p>}
            {member.phone && <p className="text-sm text-fog mt-0.5">{member.phone}</p>}
            {member.birth_date && <p className="text-xs text-mist mt-0.5">{getAge(member.birth_date)} años</p>}
          </div>
          <div className="text-right text-sm text-fog shrink-0">
            <p>{member.memberships?.[0]?.membership_types?.name}</p>
            {member.memberships?.[0]?.sessions_remaining != null && (
              <p className={`font-bold text-base mt-0.5 ${member.memberships[0].sessions_remaining <= 2 ? 'text-amber' : 'text-lime'}`}>
                {member.memberships[0].sessions_remaining} ses.
              </p>
            )}
            {member.memberships?.[0]?.membership_types?.name?.toLowerCase().includes('ilimitado') && (
              <p className="font-bold text-base text-iris mt-0.5">∞</p>
            )}
          </div>
        </div>
        {result.ok ? (
          <button
            onClick={handleCheckIn}
            disabled={registering}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-semibold text-ink transition hover:bg-lime-deep active:scale-[0.99] disabled:opacity-60"
            style={{ boxShadow: 'var(--shadow-lime)' }}
          >
            <LogIn size={18} strokeWidth={2.2} />
            {registering ? 'Registrando...' : 'Registrar entrada'}
          </button>
        ) : (
          <div className="rounded-xl border border-rose/30 bg-surface px-4 py-3 text-center text-sm font-medium text-rose">
            No se puede registrar la entrada
          </div>
        )}
        {flash && (
          <div className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-mint">
            <Check size={16} strokeWidth={2.5} /> {flash}
          </div>
        )}
        <button onClick={reset} className="flex w-full items-center justify-center gap-2 text-xs text-mist hover:text-fog pt-1">
          <RotateCcw size={12} /> {mode === 'qr' ? 'Escanear otro' : 'Nueva búsqueda'}
        </button>
      </div>
    </div>
  ) : (
    <div className="grid min-h-[20rem] place-items-center rounded-2xl border-2 border-dashed border-line bg-surface/40 p-8 text-center">
      <div>
        {mode === 'qr' ? <QrCode size={32} className="mx-auto text-mist" /> : <User size={32} className="mx-auto text-mist" />}
        <p className="mt-3 max-w-xs text-sm text-fog">
          {mode === 'qr' ? 'Escanea un código QR para ver el estado del miembro' : 'Busca y selecciona un miembro'}
        </p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">Check-in</h1>
          <p className="text-sm text-fog mt-0.5">Registra la entrada de un miembro</p>
        </div>
        <div className="flex rounded-xl border border-line bg-surface overflow-hidden shrink-0 mt-1">
          <button
            onClick={() => { setMode('qr'); reset() }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${mode === 'qr' ? 'bg-lime/15 text-lime' : 'text-mist hover:text-fog'}`}
          >
            <QrCode size={13} /> QR
          </button>
          <button
            onClick={() => { setMode('search'); setMember(null); setResult(null) }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${mode === 'search' ? 'bg-lime/15 text-lime' : 'text-mist hover:text-fog'}`}
          >
            <Search size={13} /> Manual
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        {/* Left panel */}
        <div className="rounded-2xl border border-line bg-surface p-4">
          {mode === 'qr' ? (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
                <QrCode size={13} className="text-lime" /> Escáner QR
              </div>
              {scanning && !camError ? (
                <div id="qr-reader" className="w-full rounded-xl overflow-hidden [&>*]:rounded-xl" />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[220px] gap-3">
                  {camError && <p className="text-sm text-rose text-center">{camError}</p>}
                  {!member && (
                    <button
                      onClick={reset}
                      className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-fog hover:text-snow hover:border-line2 transition-colors"
                    >
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
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Nombre o teléfono..."
                  autoFocus
                  className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-10 pr-4 text-sm text-snow placeholder:text-mist outline-none focus:border-line2"
                />
              </div>
              <div className="max-h-[50vh] overflow-y-auto space-y-0.5">
                {filteredMembers.length > 0 ? filteredMembers.map(m => {
                  const s = m.memberships?.[0]?.sessions_remaining
                  const isUnlimited = m.memberships?.[0]?.membership_types?.name?.toLowerCase().includes('ilimitado')
                  const isSelected = member?.id === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => { selectMember(m); setQuery('') }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${isSelected ? 'bg-lime text-ink' : 'text-snow hover:bg-surface2'}`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${!m.memberships?.length ? 'bg-rose' : s === 0 ? 'bg-rose' : isUnlimited ? 'bg-iris' : (s ?? 99) <= 2 ? 'bg-amber' : 'bg-mint'}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium">{m.name}</span>
                        {m.families && <span className={`block text-xs truncate ${isSelected ? 'text-ink/60' : 'text-mist'}`}>{m.families.name}</span>}
                      </span>
                      {isUnlimited ? (
                        <span className={`text-xs font-semibold ${isSelected ? 'text-ink/70' : 'text-iris'}`}>∞</span>
                      ) : s != null ? (
                        <span className={`text-xs font-semibold ${isSelected ? 'text-ink/70' : 'text-mist'}`}>{s} ses.</span>
                      ) : null}
                    </button>
                  )
                }) : (
                  <p className="py-8 text-center text-sm text-fog">
                    {query.trim() ? 'Sin resultados' : 'Escribe para buscar'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: result */}
        <div>{resultPanel}</div>
      </div>
    </div>
  )
}
