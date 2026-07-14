'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, ChevronRight, Users } from 'lucide-react'
import Link from 'next/link'

type FamilyRow = {
  id: string
  name: string
  notes: string | null
  members: {
    id: string
    name: string
    birth_date: string | null
    memberships: { sessions_remaining: number | null; membership_types: { name: string } | null }[]
  }[]
}

function getAge(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

export default function FamiliasPage() {
  const [families, setFamilies] = useState<FamilyRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('families')
      .select('id, name, notes, members(id, name, birth_date, memberships(sessions_remaining, membership_types(name)))')
      .order('name')
      .then(({ data }) => { setFamilies((data as unknown as FamilyRow[]) ?? []); setLoading(false) })
  }, [])

  const filtered = families.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.members?.some(m => m.name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">Familias</h1>
        <span className="text-sm text-mist">{filtered.length} familias</span>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por familia o miembro..."
          className="w-full bg-surface border border-line rounded-xl pl-9 pr-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2"
        />
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-surface border border-line animate-pulse" />)}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((family) => {
            const lowBono = family.members?.filter(m =>
              m.memberships?.[0]?.sessions_remaining != null && m.memberships[0].sessions_remaining <= 2
            ).length ?? 0

            return (
              <Link
                key={family.id}
                href={`/familias/${family.id}`}
                className="rounded-2xl border border-line bg-surface p-4 hover:border-line2 transition-colors block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-iris/10 flex items-center justify-center shrink-0">
                      <Users size={14} className="text-iris" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-snow">{family.name}</p>
                      <p className="text-xs text-mist">{family.members?.length ?? 0} miembros</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {lowBono > 0 && (
                      <span className="text-[10px] font-bold text-amber">{lowBono} bono bajo</span>
                    )}
                    <ChevronRight size={14} className="text-mist" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {family.members?.map(m => {
                    const s = m.memberships?.[0]?.sessions_remaining
                    const isUnlimited = m.memberships?.[0]?.membership_types?.name?.toLowerCase().includes('ilimitado')
                    return (
                      <span key={m.id} className={`text-xs px-2 py-1 rounded-lg border flex items-center gap-1 ${
                        s === 0 ? 'border-rose/30 bg-rose/10 text-rose' :
                        isUnlimited ? 'border-iris/30 bg-iris/10 text-iris' :
                        s != null && s <= 2 ? 'border-amber/30 bg-amber/10 text-amber' :
                        'border-line bg-surface2 text-fog'
                      }`}>
                        {m.name}{m.birth_date ? ` · ${getAge(m.birth_date)}a` : ''}
                        {isUnlimited ? ' ∞' : s != null ? ` · ${s}` : ''}
                      </span>
                    )
                  })}
                </div>
              </Link>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-mist py-10 col-span-2">No se encontraron familias</p>
          )}
        </div>
      )}
    </div>
  )
}
