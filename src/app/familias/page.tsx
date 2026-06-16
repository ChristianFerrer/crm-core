'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Family } from '@/lib/types'
import Link from 'next/link'
import { Search, ChevronRight } from 'lucide-react'

function getAge(birthDate: string) {
  const diff = Date.now() - new Date(birthDate).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

function formatLastVisit(iso: string) {
  const date = new Date(iso)
  const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7) return `Hace ${diff} días`
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function FamiliasPage() {
  const [query, setQuery] = useState('')
  const [families, setFamilies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      let q = supabase
        .from('families')
        .select(`
          id, name, phone,
          children(name, birth_date),
          memberships(sessions_remaining, expires_at, membership_types(name)),
          visits(checked_in_at)
        `)
        .order('name')
        .limit(50)

      if (query.length > 1) {
        q = q.or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      }

      const { data } = await q
      setFamilies(data ?? [])
      setLoading(false)
    }
    load()
  }, [query])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Familias</h1>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-2xl pl-9 pr-4 py-3 text-sm outline-none focus:border-violet-400 shadow-sm"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {families.map((family) => {
            const activeMembership = family.memberships?.find((m: any) => m.sessions_remaining > 0 || m.membership_types?.name?.includes('ilimitado'))
            const lastVisit = family.visits?.sort((a: any, b: any) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime())[0]
            const sessionsLeft = activeMembership?.sessions_remaining

            return (
              <Link
                key={family.id}
                href={`/familias/${family.id}`}
                className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center justify-between block"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm text-gray-900 truncate">{family.name}</p>
                    {sessionsLeft != null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        sessionsLeft <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {sessionsLeft} ses.
                      </span>
                    )}
                    {activeMembership?.membership_types?.name?.includes('ilimitado') && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0">∞</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {family.children?.slice(0, 2).map((c: any, i: number) => (
                      <span key={i}>{c.name}{c.birth_date ? ` (${getAge(c.birth_date)}a)` : ''}</span>
                    ))}
                    {lastVisit && <span>· {formatLastVisit(lastVisit.checked_in_at)}</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0 ml-2" />
              </Link>
            )
          })}
          {families.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No se encontraron familias</p>
          )}
        </div>
      )}
    </div>
  )
}
