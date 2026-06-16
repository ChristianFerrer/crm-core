'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Check, X, Baby, MousePointerClick, LogIn } from 'lucide-react'

type Family = {
  id: string
  name: string
  phone: string | null
  children: { name: string; birth_date: string | null }[]
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

function verify(family: Family, checkedInToday: Set<string>) {
  const m = family.memberships?.[0]
  if (!m) return { ok: false, title: 'Sin bono activo', detail: 'Esta familia no tiene ningún bono asignado.' }
  const isUnlimited = m.membership_types?.name?.toLowerCase().includes('ilimitado')
  if (isUnlimited) {
    if (checkedInToday.has(family.id)) return { ok: true, title: 'Bono ilimitado', detail: 'Ya registró entrada hoy, pero puede volver a entrar.' }
    return { ok: true, title: 'Bono ilimitado', detail: 'Acceso libre — bono mensual sin límite de sesiones.' }
  }
  if (m.sessions_remaining === 0) return { ok: false, title: 'Bono agotado', detail: 'No quedan sesiones. Hay que renovar el bono.' }
  if (m.sessions_remaining == null) return { ok: false, title: 'Sin sesiones', detail: 'El bono no tiene sesiones configuradas.' }
  return {
    ok: true,
    title: 'Acceso permitido',
    detail: `Le quedan ${m.sessions_remaining} sesión${m.sessions_remaining === 1 ? '' : 'es'} tras esta visita.`,
  }
}

function dot(family: Family, checkedInToday: Set<string>) {
  const m = family.memberships?.[0]
  if (!m || m.sessions_remaining === 0) return 'bg-rose'
  if (m.membership_types?.name?.toLowerCase().includes('ilimitado')) return 'bg-iris'
  if (checkedInToday.has(family.id)) return 'bg-fog'
  if (m.sessions_remaining != null && m.sessions_remaining <= 2) return 'bg-amber'
  return 'bg-mint'
}

export default function CheckInPage() {
  const [families, setFamilies] = useState<Family[]>([])
  const [checkedInToday, setCheckedInToday] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false)
  const flashTimer = useRef<NodeJS.Timeout | undefined>(undefined)

  const fetchAll = useCallback(async () => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const [fam, visits] = await Promise.all([
      supabase
        .from('families')
        .select('id, name, phone, children(name, birth_date), memberships(id, sessions_remaining, expires_at, membership_types(name))')
        .order('name'),
      supabase
        .from('visits')
        .select('family_id')
        .gte('checked_in_at', todayStart.toISOString()),
    ])
    setFamilies((fam.data as unknown as Family[]) ?? [])
    setCheckedInToday(new Set((visits.data ?? []).map((v: any) => v.family_id)))
    setLoading(false)
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return families
    const qd = q.replace(/\D/g, '')
    return families.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (qd.length >= 2 && (f.phone ?? '').replace(/\D/g, '').includes(qd))
    )
  }, [families, query])

  const selected = families.find(f => f.id === selectedId) ?? null
  const result = selected ? verify(selected, checkedInToday) : null

  async function handleCheckIn() {
    if (!selected || !result?.ok || registering) return
    setRegistering(true)
    const m = selected.memberships?.[0]
    const isUnlimited = m?.membership_types?.name?.toLowerCase().includes('ilimitado')

    await supabase.from('visits').insert({
      family_id: selected.id,
      membership_id: m?.id ?? null,
      checked_in_at: new Date().toISOString(),
    })

    if (m && !isUnlimited && m.sessions_remaining != null) {
      await supabase.from('memberships')
        .update({ sessions_remaining: Math.max(0, m.sessions_remaining - 1) })
        .eq('id', m.id)
    }

    clearTimeout(flashTimer.current)
    setFlash(isUnlimited ? 'Entrada registrada — bono ilimitado.' : `Entrada registrada. Quedan ${Math.max(0, (m?.sessions_remaining ?? 1) - 1)} sesiones.`)
    flashTimer.current = setTimeout(() => setFlash(null), 3000)
    setRegistering(false)
    void fetchAll()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">Check-in</h1>
        <p className="text-sm text-fog mt-0.5">Selecciona la familia para registrar la entrada</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">

        {/* Left: search + list */}
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Nombre o teléfono..."
              autoFocus
              className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-10 pr-4 text-sm text-snow placeholder:text-mist outline-none focus:border-line2"
            />
          </div>

          {loading ? (
            <div className="space-y-1">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-xl bg-surface2 animate-pulse" />)}
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-0.5 pr-1">
              {filtered.map(family => {
                const d = dot(family, checkedInToday)
                const isSelected = selectedId === family.id
                return (
                  <button
                    key={family.id}
                    onClick={() => { setSelectedId(family.id); setFlash(null) }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected ? 'bg-lime text-ink' : 'text-snow hover:bg-surface2'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${d}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium">{family.name}</span>
                      <span className={`block truncate text-xs ${isSelected ? 'text-ink/60' : 'text-mist'}`}>
                        {family.children?.slice(0, 2).map((c, i) => (
                          `${c.name}${c.birth_date ? ` ${getAge(c.birth_date)}a` : ''}`
                        )).join(' · ')}
                      </span>
                    </span>
                    {family.memberships?.[0]?.sessions_remaining != null && (
                      <span className={`text-xs font-semibold shrink-0 ${isSelected ? 'text-ink/70' : 'text-mist'}`}>
                        {family.memberships[0].sessions_remaining} ses.
                      </span>
                    )}
                    {family.memberships?.[0]?.membership_types?.name?.toLowerCase().includes('ilimitado') && (
                      <span className={`text-xs font-semibold shrink-0 ${isSelected ? 'text-ink/70' : 'text-iris'}`}>∞</span>
                    )}
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-fog">Sin resultados</p>
              )}
            </div>
          )}
        </div>

        {/* Right: result panel */}
        <div>
          {!selected || !result ? (
            <div className="grid min-h-[20rem] place-items-center rounded-2xl border-2 border-dashed border-line bg-surface/40 p-8 text-center">
              <div>
                <MousePointerClick size={32} className="mx-auto text-mist" />
                <p className="mt-3 max-w-xs text-sm text-fog">Selecciona una familia para ver su estado</p>
              </div>
            </div>
          ) : (
            <div className={`overflow-hidden rounded-2xl border ${result.ok ? 'border-mint/30 bg-mint-soft' : 'border-rose/30 bg-rose-soft'}`}>
              {/* Status header */}
              <div className={`px-6 py-7 text-center ${result.ok ? 'bg-mint text-ink' : 'bg-rose text-ink'}`}>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink/15">
                  {result.ok ? <Check size={30} strokeWidth={3} /> : <X size={30} strokeWidth={3} />}
                </div>
                <div className="mt-3 font-display text-xl font-semibold">{result.title}</div>
                <div className="mx-auto mt-1 max-w-xs text-sm text-ink/75">{result.detail}</div>
              </div>

              {/* Family details + action */}
              <div className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-semibold text-snow">{selected.name}</p>
                    {selected.phone && <p className="text-sm text-fog mt-0.5">{selected.phone}</p>}
                    {selected.children?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selected.children.map((c, i) => (
                          <span key={i} className="flex items-center gap-1 text-xs text-fog bg-surface2 border border-line rounded-lg px-2 py-1">
                            <Baby size={11} className="text-iris" />
                            {c.name}{c.birth_date ? ` ${getAge(c.birth_date)}a` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm text-fog shrink-0">
                    <p>{selected.memberships?.[0]?.membership_types?.name}</p>
                    {selected.memberships?.[0]?.sessions_remaining != null && (
                      <p className={`font-bold text-base mt-0.5 ${selected.memberships[0].sessions_remaining <= 2 ? 'text-amber' : 'text-lime'}`}>
                        {selected.memberships[0].sessions_remaining} ses.
                      </p>
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
