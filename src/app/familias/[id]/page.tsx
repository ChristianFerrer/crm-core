import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone, FileText, CreditCard, Clock, User } from 'lucide-react'

export const revalidate = 0

function calcAge(d: string) {
  const b = new Date(d), now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() - b.getMonth() < 0 || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
  return age
}

export default async function FamiliaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: family }, { data: members }, { data: visits }] = await Promise.all([
    supabase.from('families').select('id, name, notes').eq('id', id).single(),
    supabase
      .from('members')
      .select('id, name, phone, email, birth_date, notes, memberships(id, sessions_remaining, expires_at, membership_types(name))')
      .eq('family_id', id)
      .order('name'),
    supabase
      .from('visits')
      .select('id, checked_in_at, member_id, members(name)')
      .in('member_id', (await supabase.from('members').select('id').eq('family_id', id)).data?.map(m => m.id) ?? [])
      .order('checked_in_at', { ascending: false })
      .limit(15),
  ])

  if (!family) notFound()

  const memberList = (members as any[]) ?? []

  return (
    <div className="space-y-4 lg:max-w-2xl">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/familias" className="w-8 h-8 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors">
          <ArrowLeft size={15} className="text-fog" />
        </Link>
        <h1 className="font-display text-xl font-semibold text-snow truncate">Familia {family.name}</h1>
      </div>

      {family.notes && (
        <div className="rounded-2xl border border-line bg-surface p-4 flex items-start gap-3">
          <FileText size={14} className="text-mist shrink-0 mt-0.5" />
          <span className="text-sm text-fog">{family.notes}</span>
        </div>
      )}

      {/* Members */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
          <User size={13} className="text-iris" /> Miembros ({memberList.length})
        </div>
        <div className="space-y-3">
          {memberList.map((m: any) => {
            const bono = m.memberships?.[0]
            const isUnlimited = bono?.membership_types?.name?.toLowerCase().includes('ilimitado')
            const s = bono?.sessions_remaining
            const isLow = !isUnlimited && s != null && s <= 2
            return (
              <Link
                key={m.id}
                href={`/miembros/${m.id}`}
                className="rounded-2xl border border-line bg-surface p-4 hover:border-line2 transition-colors block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-snow">{m.name}</p>
                    {m.birth_date && <p className="text-xs text-mist mt-0.5">{calcAge(m.birth_date)} años</p>}
                    {m.phone && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Phone size={11} className="text-mist" />
                        <span className="text-xs text-fog">{m.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {bono ? (
                      <>
                        <p className="text-xs text-fog">{bono.membership_types?.name}</p>
                        {isUnlimited ? (
                          <p className="text-base font-bold text-iris mt-0.5">∞</p>
                        ) : s != null ? (
                          <p className={`text-base font-bold mt-0.5 ${isLow ? 'text-amber' : 'text-lime'}`}>{s} ses.</p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-xs text-rose">Sin bono</p>
                    )}
                  </div>
                </div>
                {isLow && (
                  <p className="text-xs text-amber font-medium mt-2">⚠ Pocas sesiones restantes</p>
                )}
                {s === 0 && (
                  <p className="text-xs text-rose font-medium mt-2">⚠ Bono agotado — necesita renovar</p>
                )}
              </Link>
            )
          })}
          {memberList.length === 0 && (
            <div className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-mist">
              Sin miembros en esta familia
            </div>
          )}
        </div>
      </div>

      {/* Visits */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
          <Clock size={13} className="text-lime" /> Historial de visitas
        </div>
        {!(visits as any[])?.length ? (
          <div className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-mist">
            Sin visitas registradas
          </div>
        ) : (
          <div className="space-y-1">
            {(visits as any[]).map((v) => (
              <div key={v.id} className="rounded-xl border border-line bg-surface px-4 py-2.5 flex justify-between items-center text-sm">
                <div>
                  <span className="text-fog">{(v.members as any)?.name}</span>
                  <span className="text-mist ml-2 text-xs">
                    {new Date(v.checked_in_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <span className="text-mist text-xs">
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
