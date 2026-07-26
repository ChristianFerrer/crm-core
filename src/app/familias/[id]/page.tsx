import { createServerSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone, Mail, CreditCard, Clock, Users, Baby, AlertTriangle } from 'lucide-react'
import FamiliaActions from './FamiliaActions'
import { getT } from '@/lib/i18n-server'

export const revalidate = 0

function calcAge(d: string) {
  const b = new Date(d + 'T12:00:00'), now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() - b.getMonth() < 0 || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
  return age
}

type Child = { name: string; sex: 'M' | 'F' | ''; birth_date: string }

export default async function FamiliaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { id } = await params
  const t = await getT()

  const [{ data: family }, { data: members }] = await Promise.all([
    supabase.from('families').select('id, name, notes').eq('id', id).single(),
    supabase
      .from('members')
      .select('id, name, phone, email, children, memberships(id, sessions_remaining, expires_at, membership_types(name, price))')
      .eq('family_id', id)
      .order('name'),
  ])

  if (!family) notFound()

  const memberList = (members as any[]) ?? []

  // Collect all children across titulares (deduplicated by name)
  const allChildren: Child[] = []
  const seen = new Set<string>()
  for (const m of memberList) {
    for (const c of (m.children as Child[]) ?? []) {
      const key = c.name.trim().toLowerCase()
      if (key && !seen.has(key)) { seen.add(key); allChildren.push(c) }
    }
  }

  // Last 15 visits across all family members
  const memberIds = memberList.map((m: any) => m.id)
  const { data: visits } = memberIds.length
    ? await supabase
        .from('visits')
        .select('id, checked_in_at, member_id, members(name)')
        .in('member_id', memberIds)
        .order('checked_in_at', { ascending: false })
        .limit(15)
    : { data: [] }

  return (
    <div className="space-y-4 lg:max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link href="/miembros?view=familias" className="w-9 h-9 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors shrink-0">
          <ArrowLeft size={15} className="text-fog" />
        </Link>
        <h1 className="font-display text-xl font-semibold text-snow truncate flex-1">
          {family.name.replace(/^Familia(s)?\s*/i, t('familia_prefijo'))}
        </h1>
        <FamiliaActions id={id} />
      </div>

      {/* Titulares */}
      <div className="rounded-2xl border border-line bg-surface p-4 space-y-4">
        <p className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
          <Users size={12} className="text-iris" /> {t('familia_titulares')}
        </p>

        {memberList.length === 0 && (
          <p className="text-sm text-mist">{t('familia_sin_titulares')}</p>
        )}

        {memberList.map((m: any, idx: number) => {
          const bono = m.memberships?.[0]
          const isUnlimited = bono?.membership_types?.name?.toLowerCase().includes('ilimitado')
          const s = bono?.sessions_remaining
          const isLow = !isUnlimited && s != null && s <= 2
          const isExhausted = s === 0
          const expiresAt = bono?.expires_at ? new Date(bono.expires_at) : null
          const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400000) : null
          const isExpiringSoon = daysLeft != null && daysLeft <= 7 && daysLeft >= 0

          return (
            <div key={m.id}>
              {idx > 0 && <div className="border-t border-line" />}
              <Link
                href={`/miembros/${m.id}`}
                className="flex items-start gap-3 rounded-xl hover:bg-surface2 -mx-2 px-2 py-2 transition-colors group"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-iris/15 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-iris">{m.name[0]}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-snow truncate group-hover:text-lime transition-colors">{m.name}</p>
                    <span className="text-xs text-lime shrink-0">{t('familia_ver')}</span>
                  </div>

                  {m.phone && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Phone size={11} className="text-mist shrink-0" />
                      <span className="text-xs text-fog">{m.phone}</span>
                    </div>
                  )}
                  {m.email && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Mail size={11} className="text-mist shrink-0" />
                      <span className="text-xs text-fog truncate">{m.email}</span>
                    </div>
                  )}

                  {/* Bono */}
                  <div className={`mt-2 inline-flex items-center gap-2 text-xs font-medium ${
                    isExhausted ? 'text-rose' :
                    isLow || isExpiringSoon ? 'text-amber' :
                    bono ? 'text-lime' : 'text-mist'
                  }`}>
                    <CreditCard size={11} />
                    {bono ? (
                      <>
                        {bono.membership_types?.name}
                        {isUnlimited ? ' · ∞' : s != null ? ` · ${s} ${t('familia_sesiones_abbr')}` : ''}
                        {isExhausted && ` · ${t('familia_agotado')}`}
                        {isExpiringSoon && !isExhausted && ` · ${t('familia_vence_en', { n: daysLeft })}`}
                      </>
                    ) : t('familia_sin_bono')}
                    {(isLow && !isExhausted) || isExpiringSoon ? <AlertTriangle size={10} /> : null}
                  </div>
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      {/* Hijos */}
      {allChildren.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
          <p className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
            <Baby size={12} className="text-lime" /> {t('familia_hijos', { n: allChildren.length })}
          </p>
          <div className="space-y-2">
            {allChildren.map((c, i) => {
              const age = c.birth_date ? calcAge(c.birth_date) : null
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    c.sex === 'F' ? 'bg-iris/20 text-iris' : 'bg-lime/20 text-lime'
                  }`}>
                    {c.sex === 'F' ? '♀' : c.sex === 'M' ? '♂' : '?'}
                  </div>
                  <div>
                    <span className="text-sm text-snow">{c.name}</span>
                    {age !== null && <span className="text-xs text-mist ml-2">{t('familia_anios', { n: age })}</span>}
                    {!c.birth_date && c.sex && <span className="text-xs text-mist ml-2">{c.sex === 'M' ? t('familia_nino') : t('familia_nina')}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Historial de visitas */}
      <div>
        <p className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5 mb-3">
          <Clock size={13} className="text-lime" /> {t('familia_historial_visitas')}
        </p>
        {!(visits as any[])?.length ? (
          <div className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-mist">
            {t('familia_sin_visitas')}
          </div>
        ) : (
          <div className="space-y-1">
            {(visits as any[]).map((v: any) => (
              <div key={v.id} className="rounded-xl border border-line bg-surface px-4 py-2.5 flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-snow text-xs font-medium truncate">{(v.members as any)?.name}</span>
                  <span className="text-mist text-xs shrink-0">
                    {new Date(v.checked_in_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <span className="text-mist text-xs shrink-0">
                  {new Date(v.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
