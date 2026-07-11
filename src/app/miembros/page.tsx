'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { memberMatchesQuery, normalizeSearch } from '@/lib/searchMembers'
import { bonoStatus, activeBono } from '@/lib/bonoStatus'
import { Search, Plus, User, Users, ChevronRight, LogIn } from 'lucide-react'
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
    created_at: string
    expires_at: string | null
    membership_types: { name: string } | null
  }[]
}

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

function statusDot(m: MemberRow) {
  const st = bonoStatus(activeBono(m.memberships))
  return { cls: `bg-${st.color}`, label: st.label }
}

export default function MiembrosPage() {
  const [view, setView] = useState<'miembros' | 'familias'>('miembros')
  const [members, setMembers] = useState<MemberRow[]>([])
  const [families, setFamilies] = useState<FamilyRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'todos' | 'sin_bono' | 'bono_bajo'>('todos')

  useEffect(() => {
    Promise.all([
      supabase
        .from('members')
        .select('id, name, phone, birth_date, created_at, families(name), memberships(sessions_remaining, created_at, expires_at, membership_types(name))')
        .order('name'),
      supabase
        .from('families')
        .select('id, name, notes, members(id, name, birth_date, memberships(sessions_remaining, membership_types(name)))')
        .order('name'),
    ]).then(([{ data: m }, { data: f }]) => {
      setMembers((m as unknown as MemberRow[]) ?? [])
      setFamilies((f as unknown as FamilyRow[]) ?? [])
      setLoading(false)
    })
  }, [])

  const q = normalizeSearch(search.trim())

  const filteredMembers = (q
    ? members.filter(m => memberMatchesQuery(search, m))
    : members
  ).filter(m => {
    const st = bonoStatus(activeBono(m.memberships))
    if (filter === 'sin_bono') return !st.has
    if (filter === 'bono_bajo') return st.low
    return true
  })

  const filteredFamilies = q
    ? families.filter(f =>
        normalizeSearch(f.name).includes(q) ||
        f.members?.some(m => normalizeSearch(m.name).includes(q))
      )
    : families

  const count = view === 'miembros' ? filteredMembers.length : filteredFamilies.length
  const countLabel = view === 'miembros' ? `${count} miembros` : `${count} familias`

  return (
    <div className="flex flex-col h-[calc(100svh-5rem)] gap-4">
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">Miembros</h1>
          <p className="text-sm text-fog mt-0.5">{countLabel}</p>
        </div>
        {view === 'miembros' && (
          <Link
            href="/miembros/nuevo"
            className="flex items-center gap-2 bg-lime text-ink font-semibold rounded-xl px-4 py-2.5 text-sm active:scale-95 transition-transform shrink-0"
            style={{ boxShadow: 'var(--shadow-lime)' }}
          >
            <Plus size={16} strokeWidth={2.5} /> Nuevo
          </Link>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex lg:inline-flex gap-1 bg-surface rounded-xl p-1 border border-line shrink-0">
        <button
          onClick={() => { setView('miembros'); setSearch('') }}
          className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            view === 'miembros' ? 'bg-lime text-ink' : 'text-fog hover:text-snow'
          }`}
        >
          <User size={14} /> Miembros
        </button>
        <button
          onClick={() => { setView('familias'); setSearch('') }}
          className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            view === 'familias' ? 'bg-lime text-ink' : 'text-fog hover:text-snow'
          }`}
        >
          <Users size={14} /> Familias
        </button>
      </div>

      <div className="relative shrink-0">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={view === 'miembros' ? 'Buscar por nombre o teléfono...' : 'Buscar por familia o miembro...'}
          className="w-full bg-surface border border-line rounded-xl pl-9 pr-4 py-2 text-sm text-snow placeholder:text-mist outline-none focus:border-line2"
        />
      </div>

      {view === 'miembros' && (
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-0.5">
          {([
            { key: 'todos', label: 'Todos' },
            { key: 'sin_bono', label: 'Sin bono' },
            { key: 'bono_bajo', label: 'Bono bajo' },
          ] as { key: typeof filter; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
                filter === f.key
                  ? f.key === 'sin_bono' ? 'bg-rose/20 text-rose border-rose/30'
                  : f.key === 'bono_bajo' ? 'bg-amber/20 text-amber border-amber/30'
                  : 'bg-lime/20 text-lime border-lime/30'
                  : 'bg-surface border-line text-fog hover:text-snow'
              }`}
            >
              {f.label}
              {filter === f.key && f.key !== 'todos' && (
                <span className="ml-1 opacity-70">({filteredMembers.length})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2 overflow-y-auto">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-2xl bg-surface border border-line animate-pulse" />)}
        </div>
      ) : view === 'miembros' ? (
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
          {filteredMembers.map((m) => {
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
          {filteredMembers.length === 0 && (
            <div className="py-12 text-center text-sm text-mist">
              {q ? 'Sin resultados para esta búsqueda' : 'Sin miembros registrados'}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 grid gap-3 lg:grid-cols-2 content-start">
          {filteredFamilies.map((family) => {
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
                      <p className="text-xs text-mist">{family.members?.length ?? 0} titulares</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {lowBono > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber/20 text-amber">{lowBono} bono bajo</span>
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
          {filteredFamilies.length === 0 && (
            <p className="text-center text-sm text-mist py-10 col-span-2">No se encontraron familias</p>
          )}
        </div>
      )}
    </div>
  )
}

