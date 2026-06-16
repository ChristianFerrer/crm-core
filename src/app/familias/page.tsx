'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Family, Membership } from '@/lib/types'
import FamilyCard from '@/components/FamilyCard'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

type FamilyWithMembership = Family & {
  memberships: (Membership & { membership_types: { name: string; sessions: number | null } | null })[]
}

export default function FamiliasPage() {
  const [families, setFamilies] = useState<FamilyWithMembership[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('families')
        .select('*, memberships(*, membership_types(name, sessions))')
        .order('name')
      setFamilies((data as FamilyWithMembership[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = families.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.phone && f.phone.includes(search))
  )

  return (
    <div className="p-4">
      <div className="pt-4 mb-4">
        <h1 className="text-xl font-bold text-gray-900 mb-3">Familias</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-sm">No se encontraron familias</div>
      ) : (
        <div>
          {filtered.map(family => {
            const activeMembership = family.memberships?.[0]
            return (
              <FamilyCard
                key={family.id}
                family={family}
                membership={activeMembership ? {
                  ...activeMembership,
                  membership_types: activeMembership.membership_types ?? undefined
                } : undefined}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
