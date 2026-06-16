'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Family, Membership } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, CheckCircle, LogIn } from 'lucide-react'

type FamilyResult = Family & {
  memberships: (Membership & { membership_types: { name: string; sessions: number | null } | null })[]
}

export default function CheckInPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FamilyResult[]>([])
  const [selected, setSelected] = useState<FamilyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [success, setSuccess] = useState<{ familyName: string; sessionsRemaining: number | null } | null>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('families')
        .select('*, memberships(*, membership_types(name, sessions))')
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5)
      setResults((data as FamilyResult[]) ?? [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function handleCheckIn() {
    if (!selected) return
    setRegistering(true)

    const membership = selected.memberships?.[0]

    // Insert visit
    const { error: visitError } = await supabase.from('visits').insert({
      family_id: selected.id,
      membership_id: membership?.id ?? null,
      checked_in_at: new Date().toISOString(),
    })

    if (visitError) {
      alert('Error al registrar la entrada: ' + visitError.message)
      setRegistering(false)
      return
    }

    let newSessions: number | null = null

    // Decrement sessions if applicable
    if (membership && membership.sessions_remaining !== null) {
      const newCount = Math.max(0, membership.sessions_remaining - 1)
      await supabase
        .from('memberships')
        .update({ sessions_remaining: newCount })
        .eq('id', membership.id)
      newSessions = newCount
    }

    setSuccess({
      familyName: selected.name,
      sessionsRemaining: newSessions,
    })
    setRegistering(false)
  }

  function reset() {
    setQuery('')
    setResults([])
    setSelected(null)
    setSuccess(null)
  }

  if (success) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Entrada registrada!</h2>
        <p className="text-lg text-gray-700 mb-1">{success.familyName}</p>
        {success.sessionsRemaining !== null && (
          <p className={`text-base font-medium mb-6 ${
            success.sessionsRemaining <= 2 ? 'text-red-500' : 'text-violet-600'
          }`}>
            Sesiones restantes: {success.sessionsRemaining}
          </p>
        )}
        {success.sessionsRemaining === null && (
          <p className="text-sm text-green-600 mb-6">Bono mensual ilimitado</p>
        )}
        {success.sessionsRemaining !== null && success.sessionsRemaining <= 2 && (
          <div className="mb-6 p-3 bg-red-50 rounded-lg text-sm text-red-600">
            Quedan pocas sesiones. Recomienda renovar el bono.
          </div>
        )}
        <Button onClick={reset} className="bg-violet-600 hover:bg-violet-700 text-white w-full max-w-xs">
          Nueva entrada
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="pt-4 mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Check-in</h1>
        <p className="text-sm text-gray-500">Busca la familia para registrar la entrada</p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null) }}
          placeholder="Nombre o teléfono..."
          className="pl-10 h-12 text-base"
          autoFocus
        />
      </div>

      {/* Search results */}
      {!selected && (
        <>
          {loading && <p className="text-sm text-gray-400 text-center py-4">Buscando...</p>}
          {!loading && results.length > 0 && (
            <div className="space-y-2 mb-4">
              {results.map(family => {
                const membership = family.memberships?.[0]
                return (
                  <Card
                    key={family.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-violet-300"
                    onClick={() => setSelected(family)}
                  >
                    <CardContent className="py-3 px-4 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-gray-900">{family.name}</div>
                        {family.phone && <div className="text-sm text-gray-500">{family.phone}</div>}
                      </div>
                      {membership && (
                        <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-xs">
                          {membership.membership_types?.name ?? 'Activo'}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No se encontraron familias</p>
          )}
        </>
      )}

      {/* Selected family */}
      {selected && (
        <div className="space-y-4">
          <Card className="border-2 border-violet-400">
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                  {selected.phone && <p className="text-sm text-gray-500">{selected.phone}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="text-xs text-gray-400">
                  Cambiar
                </Button>
              </div>
              {selected.memberships?.[0] && (
                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Bono</span>
                    <span className="font-medium">{selected.memberships[0].membership_types?.name}</span>
                  </div>
                  {selected.memberships[0].sessions_remaining !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Sesiones disponibles</span>
                      <span className={`font-semibold ${
                        selected.memberships[0].sessions_remaining <= 2 ? 'text-red-500' : 'text-violet-600'
                      }`}>
                        {selected.memberships[0].sessions_remaining}
                      </span>
                    </div>
                  )}
                  {selected.memberships[0].sessions_remaining === null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Tipo</span>
                      <span className="text-green-600 font-medium">Ilimitado</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            onClick={handleCheckIn}
            disabled={registering}
            className="w-full h-14 text-base bg-violet-600 hover:bg-violet-700 text-white"
          >
            <LogIn className="w-5 h-5 mr-2" />
            {registering ? 'Registrando...' : 'Registrar entrada'}
          </Button>
        </div>
      )}
    </div>
  )
}
