'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, ChevronRight, Baby } from 'lucide-react'
import Link from 'next/link'

type FamilyRow = {
  id: string
  name: string
  phone: string | null
  children: { name: string; birth_date: string | null }[]
  memberships: { sessions_remaining: number | null; expires_at: string; membership_types: { name: string } | null }[]
  visits: { checked_in_at: string }[]
}

function getAge(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

function lastVisitLabel(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7) return `Hace ${diff}d`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function FamiliasPage() {
  const [families, setFamilies] = useState<FamilyRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('families')
      .select('id, name, phone, children(name, birth_date), memberships(sessions_remaining, expires_at, membership_types(name)), visits(checked_in_at)')
      .order('name')
      .then(({ data }) => { setFamilies((data as unknown as FamilyRow[]) ?? []); setLoading(false) })
  }, [])

  const filtered = families.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.phone && f.phone.includes(search))
  )

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-snow pt-2">Familias</h1>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="w-full bg-surface border border-line rounded-xl pl-9 pr-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-2xl bg-surface border border-line animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((family) => {
            const m = family.memberships?.[0]
            const isUnlimited = m?.membership_types?.name?.toLowerCase().includes('ilimitado')
            const sessions = m?.sessions_remaining
            const lastVisit = family.visits?.sort((a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime())[0]

            return (
              <Link
                key={family.id}
                href={`/familias/${family.id}`}
                className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 hover:border-line2 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-snow truncate">{family.name}</span>
                    {isUnlimited && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-iris/20 text-iris shrink-0">∞</span>
                    )}
                    {!isUnlimited && sessions != null && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${sessions <= 2 ? 'bg-rose/20 text-rose' : 'bg-lime/20 text-lime'}`}>
                        {sessions} ses.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-mist">
                    {family.children?.slice(0, 2).map((c, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <Baby size={10} />{c.name}{c.birth_date ? ` ${getAge(c.birth_date)}a` : ''}
                      </span>
                    ))}
                    {lastVisit && <span>· {lastVisitLabel(lastVisit.checked_in_at)}</span>}
                  </div>
                </div>
                <ChevronRight size={15} className="text-mist shrink-0 ml-2" />
              </Link>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-mist py-10">No se encontraron familias</p>
          )}
        </div>
      )}
    </div>
  )
}
