'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Plus, User } from 'lucide-react'
import Link from 'next/link'

type MemberRow = {
  id: string
  name: string
  phone: string | null
  birth_date: string | null
  created_at: string
  families: { name: string } | null
  memberships: {
    sessions_remaining: number | null
    membership_types: { name: string } | null
  }[]
}

function getAge(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

function statusDot(m: MemberRow) {
  const bono = m.memberships?.[0]
  if (!bono) return { cls: 'bg-rose', label: 'Sin bono' }
  const s = bono.sessions_remaining
  if (bono.membership_types?.name?.toLowerCase().includes('ilimitado')) return { cls: 'bg-iris', label: '∞' }
  if (s === 0) return { cls: 'bg-rose', label: '0 ses.' }
  if (s != null && s <= 2) return { cls: 'bg-amber', label: `${s} ses.` }
  if (s != null) return { cls: 'bg-mint', label: `${s} ses.` }
  return { cls: 'bg-fog', label: '-' }
}

export default function MiembrosPage() {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('members')
      .select('id, name, phone, birth_date, created_at, families(name), memberships(sessions_remaining, membership_types(name))')
      .order('name')
      .then(({ data }) => { setMembers((data as unknown as MemberRow[]) ?? []); setLoading(false) })
  }, [])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? members.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.phone ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
      )
    : members

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">Clientes</h1>
          <p className="text-sm text-fog mt-0.5">{filtered.length} miembros</p>
        </div>
        <Link
          href="/miembros/nuevo"
          className="flex items-center gap-2 bg-lime text-ink font-semibold rounded-xl px-4 py-2.5 text-sm active:scale-95 transition-transform shrink-0"
          style={{ boxShadow: 'var(--shadow-lime)' }}
        >
          <Plus size={16} strokeWidth={2.5} /> Nuevo
        </Link>
      </div>

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
          {filtered.map((m) => {
            const { cls, label } = statusDot(m)
            const isUnlimited = m.memberships?.[0]?.membership_types?.name?.toLowerCase().includes('ilimitado')
            return (
              <Link
                key={m.id}
                href={`/miembros/${m.id}`}
                className="rounded-2xl border border-line bg-surface px-4 py-3.5 hover:border-line2 transition-colors flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-iris/10 flex items-center justify-center shrink-0">
                  <User size={15} className="text-iris" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-snow">{m.name}</p>
                  <p className="text-xs text-mist mt-0.5">
                    {m.families?.name ?? 'Sin familia'}
                    {m.birth_date ? ` · ${getAge(m.birth_date)}a` : ''}
                    {m.phone ? ` · ${m.phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${isUnlimited ? 'text-iris' : m.memberships?.[0]?.sessions_remaining === 0 ? 'text-rose' : (m.memberships?.[0]?.sessions_remaining ?? 99) <= 2 ? 'text-amber' : 'text-fog'}`}>
                      {isUnlimited ? '∞ Ilimitado' : label}
                    </p>
                    {m.memberships?.[0]?.membership_types?.name && !isUnlimited && (
                      <p className="text-[10px] text-mist">{m.memberships[0].membership_types!.name}</p>
                    )}
                  </div>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cls}`} />
                </div>
              </Link>
            )
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-mist">
              {q ? 'Sin resultados para esta búsqueda' : 'Sin miembros registrados'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
