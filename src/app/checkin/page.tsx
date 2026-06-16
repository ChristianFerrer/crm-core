'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, CheckCircle, Baby, AlertTriangle } from 'lucide-react'

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

function getAge(birthDate: string) {
  const diff = Date.now() - new Date(birthDate).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

export default function CheckInPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Family[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ familyName: string; sessionsLeft: number | null } | null>(null)
  const [checking, setChecking] = useState(false)

  async function search(value: string) {
    setQuery(value)
    setSuccess(null)
    if (value.length < 2) { setResults([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('families')
      .select(`
        id, name, phone,
        children(name, birth_date),
        memberships(id, sessions_remaining, expires_at, membership_types(name))
      `)
      .or(`name.ilike.%${value}%,phone.ilike.%${value}%`)
      .limit(5)
    setResults((data as any[]) ?? [])
    setLoading(false)
  }

  async function doCheckIn(family: Family) {
    setChecking(true)
    const membership = family.memberships?.[0]
    const isUnlimited = membership?.membership_types?.name?.toLowerCase().includes('ilimitado')

    // Insert visit
    await supabase.from('visits').insert({
      family_id: family.id,
      membership_id: membership?.id ?? null,
    })

    // Decrement sessions if not unlimited
    if (membership && !isUnlimited && membership.sessions_remaining != null) {
      await supabase
        .from('memberships')
        .update({ sessions_remaining: membership.sessions_remaining - 1 })
        .eq('id', membership.id)
    }

    const newSessions = !isUnlimited && membership?.sessions_remaining != null
      ? membership.sessions_remaining - 1
      : null

    setSuccess({ familyName: family.name, sessionsLeft: newSessions })
    setResults([])
    setQuery('')
    setChecking(false)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Registrar entrada</h1>

      {success ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle size={40} className="text-green-500 mx-auto" />
            <div>
              <p className="text-lg font-bold text-gray-900">{success.familyName}</p>
              <p className="text-sm text-green-600 font-medium">Entrada registrada</p>
            </div>
            {success.sessionsLeft != null && (
              <div className={`inline-block px-4 py-2 rounded-xl text-sm font-semibold ${
                success.sessionsLeft <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              }`}>
                {success.sessionsLeft === 0
                  ? '⚠ Bono agotado'
                  : `Quedan ${success.sessionsLeft} sesiones`}
              </div>
            )}
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="w-full bg-violet-600 text-white font-semibold rounded-2xl py-4 text-sm"
          >
            Nueva entrada
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar familia por nombre o teléfono..."
              value={query}
              onChange={(e) => search(e.target.value)}
              autoFocus
              className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-4 text-base outline-none focus:border-violet-400 shadow-sm"
            />
          </div>

          {loading && (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse h-20" />
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((family) => {
                const membership = family.memberships?.[0]
                const isUnlimited = membership?.membership_types?.name?.toLowerCase().includes('ilimitado')
                const sessionsLeft = membership?.sessions_remaining
                const isLow = !isUnlimited && sessionsLeft != null && sessionsLeft <= 2
                const hasNoSessions = !isUnlimited && sessionsLeft === 0

                return (
                  <div key={family.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{family.name}</p>
                        {family.phone && <p className="text-sm text-gray-400">{family.phone}</p>}
                        {family.children?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {family.children.map((c, i) => (
                              <span key={i} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1">
                                <Baby size={11} />
                                {c.name}{c.birth_date ? ` ${getAge(c.birth_date)}a` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        {membership ? (
                          <>
                            <p className="text-xs text-gray-400">{membership.membership_types?.name}</p>
                            {isUnlimited ? (
                              <p className="text-lg font-bold text-violet-600">∞</p>
                            ) : sessionsLeft != null ? (
                              <p className={`text-xl font-bold ${isLow ? 'text-amber-600' : 'text-violet-600'}`}>{sessionsLeft}</p>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Sin bono</span>
                        )}
                      </div>
                    </div>

                    {isLow && !hasNoSessions && (
                      <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
                        <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-700">Quedan pocas sesiones</p>
                      </div>
                    )}

                    <button
                      onClick={() => doCheckIn(family)}
                      disabled={checking || hasNoSessions}
                      className={`w-full font-semibold rounded-xl py-3 text-sm transition-transform active:scale-95 ${
                        hasNoSessions
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-violet-600 text-white'
                      }`}
                    >
                      {checking ? 'Registrando...' : hasNoSessions ? 'Bono agotado' : 'Registrar entrada'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {query.length > 1 && !loading && results.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No se encontró ninguna familia</p>
          )}
        </>
      )}
    </div>
  )
}
