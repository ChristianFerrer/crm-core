'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, CheckCircle, Baby, AlertTriangle } from 'lucide-react'

type FamilyResult = {
  id: string
  name: string
  phone: string | null
  children: { name: string; birth_date: string | null }[]
  memberships: { id: string; sessions_remaining: number | null; expires_at: string; membership_types: { name: string } | null }[]
}

function getAge(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

export default function CheckInPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FamilyResult[]>([])
  const [selected, setSelected] = useState<FamilyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [success, setSuccess] = useState<{ familyName: string; sessionsRemaining: number | null } | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('families')
        .select('id, name, phone, children(name, birth_date), memberships(id, sessions_remaining, expires_at, membership_types(name))')
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5)
      setResults((data as unknown as FamilyResult[]) ?? [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function handleCheckIn() {
    if (!selected) return
    setRegistering(true)
    const membership = selected.memberships?.[0]

    await supabase.from('visits').insert({
      family_id: selected.id,
      membership_id: membership?.id ?? null,
      checked_in_at: new Date().toISOString(),
    })

    let newSessions: number | null = null
    if (membership && membership.sessions_remaining !== null) {
      const newCount = Math.max(0, membership.sessions_remaining - 1)
      await supabase.from('memberships').update({ sessions_remaining: newCount }).eq('id', membership.id)
      newSessions = newCount
    }

    setSuccess({ familyName: selected.name, sessionsRemaining: newSessions })
    setRegistering(false)
  }

  function reset() {
    setQuery(''); setResults([]); setSelected(null); setSuccess(null)
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-mint-soft flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-mint" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-snow">¡Entrada registrada!</h2>
          <p className="text-fog mt-1">{success.familyName}</p>
        </div>
        {success.sessionsRemaining !== null && (
          <div className={`px-5 py-2 rounded-full text-sm font-semibold ${
            success.sessionsRemaining <= 2 ? 'bg-rose/20 text-rose' : 'bg-lime/20 text-lime'
          }`}>
            {success.sessionsRemaining === 0 ? 'Bono agotado' : `Quedan ${success.sessionsRemaining} sesiones`}
          </div>
        )}
        {success.sessionsRemaining === null && (
          <div className="px-5 py-2 rounded-full text-sm font-semibold bg-iris/20 text-iris">Bono ilimitado</div>
        )}
        <button
          onClick={reset}
          className="mt-4 bg-lime text-ink font-semibold rounded-2xl px-8 py-3.5 text-sm active:scale-95 transition-transform"
          style={{ boxShadow: 'var(--shadow-lime)' }}
        >
          Nueva entrada
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-semibold text-snow">Check-in</h1>
        <p className="text-sm text-fog mt-0.5">Busca la familia para registrar la entrada</p>
      </div>

      <div className="relative">
        <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-mist" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null) }}
          placeholder="Nombre o teléfono..."
          className="w-full bg-surface border border-line rounded-2xl pl-11 pr-4 py-4 text-base text-snow placeholder:text-mist outline-none focus:border-line2"
          autoFocus
        />
      </div>

      {!selected && (
        <>
          {loading && <p className="text-sm text-mist text-center py-4">Buscando...</p>}
          {!loading && results.length > 0 && (
            <div className="space-y-2">
              {results.map(family => {
                const m = family.memberships?.[0]
                return (
                  <button
                    key={family.id}
                    onClick={() => setSelected(family)}
                    className="w-full text-left rounded-2xl border border-line bg-surface px-4 py-3 hover:border-line2 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-snow">{family.name}</p>
                      {family.phone && <p className="text-xs text-mist">{family.phone}</p>}
                    </div>
                    {m && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-lime/20 text-lime shrink-0 ml-3">
                        {m.membership_types?.name ?? 'Activo'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-center text-sm text-mist py-10">No se encontró ninguna familia</p>
          )}
        </>
      )}

      {selected && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-lime/40 bg-surface p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-snow">{selected.name}</h2>
                {selected.phone && <p className="text-sm text-mist">{selected.phone}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-mist hover:text-fog">Cambiar</button>
            </div>

            {selected.children?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.children.map((c, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs bg-surface2 border border-line rounded-lg px-2 py-1 text-fog">
                    <Baby size={11} className="text-iris" />
                    {c.name}{c.birth_date ? ` ${getAge(c.birth_date)}a` : ''}
                  </span>
                ))}
              </div>
            )}

            {selected.memberships?.[0] && (
              <div className="border-t border-line pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-mist">Bono</span>
                  <span className="text-fog font-medium">{selected.memberships[0].membership_types?.name}</span>
                </div>
                {selected.memberships[0].sessions_remaining !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-mist">Sesiones disponibles</span>
                    <span className={`font-bold ${selected.memberships[0].sessions_remaining <= 2 ? 'text-rose' : 'text-lime'}`}>
                      {selected.memberships[0].sessions_remaining}
                    </span>
                  </div>
                )}
              </div>
            )}

            {selected.memberships?.[0]?.sessions_remaining != null && selected.memberships[0].sessions_remaining <= 2 && selected.memberships[0].sessions_remaining > 0 && (
              <div className="flex items-center gap-2 bg-rose-soft border border-rose/20 rounded-xl px-3 py-2">
                <AlertTriangle size={13} className="text-rose shrink-0" />
                <p className="text-xs text-rose">Quedan pocas sesiones — recomienda renovar</p>
              </div>
            )}
          </div>

          <button
            onClick={handleCheckIn}
            disabled={registering || selected.memberships?.[0]?.sessions_remaining === 0}
            className={`w-full font-semibold rounded-2xl py-4 text-sm transition-transform active:scale-95 ${
              selected.memberships?.[0]?.sessions_remaining === 0
                ? 'bg-surface border border-line text-mist cursor-not-allowed'
                : 'bg-lime text-ink'
            }`}
            style={selected.memberships?.[0]?.sessions_remaining !== 0 ? { boxShadow: 'var(--shadow-lime)' } : {}}
          >
            {registering ? 'Registrando...' : selected.memberships?.[0]?.sessions_remaining === 0 ? 'Bono agotado' : 'Registrar entrada'}
          </button>
        </div>
      )}
    </div>
  )
}
