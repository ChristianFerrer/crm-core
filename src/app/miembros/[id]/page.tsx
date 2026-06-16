import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone, Mail, FileText, CreditCard, Clock, Users, Calendar, AlertTriangle, Pencil } from 'lucide-react'
import { MemberQr } from '@/components/MemberQr'
import { AssignMembership } from '@/components/AssignMembership'

export const revalidate = 0

function calcAge(d: string) {
  const b = new Date(d), now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() - b.getMonth() < 0 || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
  return age
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [{ data: member }, { data: visits }, { data: monthVisits }] = await Promise.all([
    supabase
      .from('members')
      .select('id, name, phone, email, birth_date, notes, qr_code, created_at, families(id, name), memberships(id, sessions_remaining, expires_at, created_at, membership_types(name))')
      .eq('id', id)
      .single(),
    supabase
      .from('visits')
      .select('id, checked_in_at')
      .eq('member_id', id)
      .order('checked_in_at', { ascending: false })
      .limit(20),
    supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', id)
      .gte('checked_in_at', startOfMonth.toISOString()),
  ])

  if (!member) notFound()

  const m = member as any
  const bono = m.memberships?.[0]
  const isUnlimited = bono?.membership_types?.name?.toLowerCase().includes('ilimitado')
  const s = bono?.sessions_remaining
  const isLow = !isUnlimited && s != null && s <= 2

  // Expiry warning: within 7 days
  const expiresAt = bono?.expires_at ? new Date(bono.expires_at) : null
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
  const isExpiringSoon = daysLeft != null && daysLeft <= 7 && daysLeft >= 0

  // Family members (other than this member)
  let familyMembers: any[] = []
  if (m.families?.id) {
    const { data } = await supabase
      .from('members')
      .select('id, name, birth_date')
      .eq('family_id', m.families.id)
      .neq('id', id)
      .order('birth_date', { ascending: false })
    familyMembers = (data as any[]) ?? []
  }

  const children = familyMembers.filter(fm => fm.birth_date && calcAge(fm.birth_date) < 18)
  const adults = familyMembers.filter(fm => !fm.birth_date || calcAge(fm.birth_date) >= 18)

  return (
    <div className="space-y-4 lg:max-w-2xl">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/miembros" className="w-8 h-8 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors shrink-0">
          <ArrowLeft size={15} className="text-fog" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-semibold text-snow leading-tight truncate">{m.name}</h1>
        </div>
        <Link
          href={`/miembros/${id}/editar`}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors shrink-0"
        >
          <Pencil size={13} /> Editar
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        {/* Left col: info + QR */}
        <div className="space-y-3">
          {/* Personal info */}
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
            {m.phone ? (
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-mist shrink-0" />
                <a href={`tel:${m.phone}`} className="text-sm text-lime font-medium">{m.phone}</a>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-mist shrink-0" />
                <span className="text-sm text-mist italic">Sin teléfono</span>
              </div>
            )}
            {m.email && (
              <div className="flex items-center gap-3">
                <Mail size={14} className="text-mist shrink-0" />
                <span className="text-sm text-fog truncate">{m.email}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar size={14} className="text-mist shrink-0" />
              <span className="text-sm text-fog">
                Alta: {new Date(m.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            {m.birth_date && (
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                  <span className="text-mist text-xs">🎂</span>
                </span>
                <span className="text-sm text-fog">{calcAge(m.birth_date)} años</span>
              </div>
            )}
            {m.notes && (
              <div className="flex items-start gap-3 border-t border-line pt-3">
                <FileText size={14} className="text-mist shrink-0 mt-0.5" />
                <span className="text-sm text-fog">{m.notes}</span>
              </div>
            )}
          </div>

          {/* Family box — always show if member belongs to a family */}
          {m.families && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Users size={12} className="text-iris" />
                Familia · {m.families.name.replace(/^Familia(s)?\s*/i, '')}
              </p>
              {familyMembers.length > 0 ? (
                <div className="space-y-1">
                  {adults.map((a: any) => (
                    <Link key={a.id} href={`/miembros/${a.id}`} className="flex items-center justify-between rounded-lg hover:bg-surface2 -mx-1 px-2 py-1.5 transition-colors">
                      <span className="text-sm text-snow">{a.name}</span>
                      <span className="text-xs text-mist">{a.birth_date ? `${calcAge(a.birth_date)} años` : 'adulto/a'}</span>
                    </Link>
                  ))}
                  {children.length > 0 && adults.length > 0 && (
                    <div className="border-t border-line my-1" />
                  )}
                  {children.map((c: any) => (
                    <Link key={c.id} href={`/miembros/${c.id}`} className="flex items-center justify-between rounded-lg hover:bg-surface2 -mx-1 px-2 py-1.5 transition-colors">
                      <span className="text-sm text-snow">{c.name}</span>
                      <span className="text-xs text-mist">{calcAge(c.birth_date)} años · niño/a</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-mist">Único miembro de la familia</p>
              )}
            </div>
          )}

          {/* QR code */}
          <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col items-center gap-3">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">Código QR de acceso</p>
            <MemberQr qrCode={m.qr_code} />
          </div>
        </div>

        {/* Right col: bono + stats */}
        <div className="space-y-3">
          {/* Monthly visits */}
          <div className="rounded-2xl border border-line bg-surface p-4 grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="font-display text-3xl font-semibold text-lime">{(monthVisits as any)?.count ?? 0}</p>
              <p className="text-xs text-mist mt-1">Visitas este mes</p>
            </div>
            <div className="text-center">
              <p className="font-display text-3xl font-semibold text-fog">{(visits as any[])?.length ?? 0}</p>
              <p className="text-xs text-mist mt-1">Total visitas</p>
            </div>
          </div>

          {/* Membership */}
          <div className={`rounded-2xl border p-4 ${isLow && s !== 0 ? 'border-amber/30 bg-amber/5' : s === 0 ? 'border-rose/30 bg-rose-soft' : isExpiringSoon ? 'border-amber/30 bg-amber/5' : 'border-line bg-surface'}`}>
            <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
              <CreditCard size={13} className="text-lime" /> Bono activo
            </div>
            {bono ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-snow">{bono.membership_types?.name}</p>
                    {expiresAt && (
                      <p className="text-xs text-mist mt-0.5">
                        Vence {expiresAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  {isUnlimited ? (
                    <span className="text-2xl font-bold text-iris">∞</span>
                  ) : s != null ? (
                    <span className={`text-2xl font-bold ${isLow ? (s === 0 ? 'text-rose' : 'text-amber') : 'text-lime'}`}>{s}</span>
                  ) : null}
                </div>
                {isLow && s !== 0 && (
                  <p className="text-xs text-amber font-medium mt-3 flex items-center gap-1">
                    <AlertTriangle size={11} /> Quedan pocas sesiones — avisar al cliente
                  </p>
                )}
                {s === 0 && (
                  <p className="text-xs text-rose font-medium mt-3 flex items-center gap-1">
                    <AlertTriangle size={11} /> Bono agotado — necesita renovar
                  </p>
                )}
                {isExpiringSoon && (
                  <p className="text-xs text-amber font-medium mt-3 flex items-center gap-1">
                    <AlertTriangle size={11} /> Vence en {daysLeft} día{daysLeft === 1 ? '' : 's'}
                  </p>
                )}
                <div className="mt-3 pt-3 border-t border-line">
                  <AssignMembership memberId={m.id} />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-mist">Sin bono asignado</p>
                <AssignMembership memberId={m.id} />
              </div>
            )}
          </div>

          {/* Last visit */}
          {(visits as any[])?.[0] && (
            <div className="rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="text-xs text-mist">Última visita</p>
              <p className="text-sm font-semibold text-snow mt-0.5">
                {new Date((visits as any[])[0].checked_in_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Visit history */}
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
              <div key={v.id} className="rounded-xl border border-line bg-surface px-4 py-2.5 flex justify-between text-sm">
                <span className="text-fog">
                  {new Date(v.checked_in_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className="text-mist">
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
