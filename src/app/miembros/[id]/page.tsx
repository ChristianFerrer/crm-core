import { createServerSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone, Mail, FileText, CreditCard, Clock, Users, Calendar, AlertTriangle, Pencil, LogIn, ShieldCheck } from 'lucide-react'
import { MemberQr } from '@/components/MemberQr'
import { AssignMembership } from '@/components/AssignMembership'
import { DeleteMemberButton } from './DeleteMemberButton'

export const revalidate = 0

function calcAge(d: string) {
  const b = new Date(d), now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() - b.getMonth() < 0 || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
  return age
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { id } = await params

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [{ data: member }, { data: visits }, { count: monthVisitsCount }] = await Promise.all([
    supabase
      .from('members')
      .select('id, name, phone, email, birth_date, notes, qr_code, created_at, consent_accepted_at, children, children_count, families(id, name), memberships(id, sessions_remaining, expires_at, created_at, membership_types(name))')
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
  // El bono vigente es el más reciente (evita mostrar uno viejo/caducado como activo)
  const bono = [...(m.memberships ?? [])].sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
  const isUnlimited = bono?.membership_types?.name?.toLowerCase().includes('ilimitado')
  const s = bono?.sessions_remaining
  const isLow = !isUnlimited && s != null && s <= 2

  // Expiry warning: within 7 days
  const expiresAt = bono?.expires_at ? new Date(bono.expires_at) : null
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
  const isExpiringSoon = daysLeft != null && daysLeft <= 7 && daysLeft >= 0
  const isExpired = daysLeft != null && daysLeft < 0
  // Un bono caducado o sin sesiones es inservible, aunque queden sesiones
  const isDepleted = s === 0 || isExpired

  // Other adult members in the same family (papá + mamá)
  let familyAdults: any[] = []
  if (m.families?.id) {
    const { data } = await supabase
      .from('members')
      .select('id, name')
      .eq('family_id', m.families.id)
      .neq('id', id)
    familyAdults = (data as any[]) ?? []
  }

  type Child = { name: string; sex: 'M' | 'F' | ''; birth_date: string }
  const childrenList: Child[] = Array.isArray(m.children) && m.children.length > 0
    ? m.children
    : []
  const childrenCount: number = childrenList.length || (m.children_count ?? 0)

  function calcChildAge(d: string) {
    if (!d) return null
    const b = new Date(d), now = new Date()
    let age = now.getFullYear() - b.getFullYear()
    if (now.getMonth() - b.getMonth() < 0 || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
    return age
  }

  return (
    <div className="space-y-4 lg:max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link href="/miembros" className="w-8 h-8 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors shrink-0">
          <ArrowLeft size={15} className="text-fog" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-semibold text-snow leading-tight truncate">{m.name}</h1>
        </div>
        <DeleteMemberButton memberId={id} />
        <Link
          href={`/miembros/${id}/editar`}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors shrink-0"
        >
          <Pencil size={13} /> Editar
        </Link>
        <Link
          href={`/?checkin=${id}`}
          className="flex items-center gap-1.5 rounded-xl border border-lime bg-lime/10 px-3 py-2 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors shrink-0"
          style={{ boxShadow: 'var(--shadow-lime)' }}
        >
          <LogIn size={13} /> Entrada
        </Link>
      </div>

      {/* Contact info — teléfono + alta + email + notas */}
      <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
        {/* Teléfono destacado */}
        {m.phone ? (
          <a href={`tel:${m.phone}`} className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-lime/10 flex items-center justify-center shrink-0">
              <Phone size={14} className="text-lime" />
            </div>
            <div>
              <p className="text-base font-semibold text-lime group-hover:underline">{m.phone}</p>
              <p className="text-[10px] text-mist">Teléfono de contacto</p>
            </div>
          </a>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface2 flex items-center justify-center shrink-0">
              <Phone size={14} className="text-mist" />
            </div>
            <span className="text-sm text-mist">Sin teléfono registrado</span>
          </div>
        )}

        <div className="border-t border-line" />

        {/* Fecha de alta */}
        <div className="flex items-center gap-3">
          <Calendar size={14} className="text-mist shrink-0" />
          <span className="text-sm text-fog">
            Miembro desde {new Date(m.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {m.email && (
          <div className="flex items-center gap-3">
            <Mail size={14} className="text-mist shrink-0" />
            <span className="text-sm text-fog truncate">{m.email}</span>
          </div>
        )}

        {m.notes && (
          <div className="flex items-start gap-3 border-t border-line pt-3">
            <FileText size={14} className="text-mist shrink-0 mt-0.5" />
            <span className="text-sm text-fog">{m.notes}</span>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-line pt-3">
          <ShieldCheck size={13} className={m.consent_accepted_at ? 'text-lime' : 'text-amber'} />
          {m.consent_accepted_at ? (
            <span className="text-xs text-fog">
              Consentimiento RGPD registrado el{' '}
              {new Date(m.consent_accepted_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          ) : (
            <span className="text-xs text-amber font-medium">Consentimiento RGPD pendiente</span>
          )}
        </div>
      </div>

      {/* Familia + hijos */}
      {(m.families || childrenCount > 0) && (
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
          {m.families && (
            <>
              <p className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
                <Users size={12} className="text-iris" />
                Familia · {m.families.name.replace(/^Familia(s)?\s*/i, '')}
              </p>
              {familyAdults.length > 0 ? (
                <div className="space-y-1">
                  {familyAdults.map((a: any) => (
                    <Link key={a.id} href={`/miembros/${a.id}`} className="flex items-center justify-between rounded-lg hover:bg-surface2 -mx-1 px-2 py-1.5 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-iris shrink-0" />
                        <span className="text-sm text-snow">{a.name}</span>
                      </div>
                      <span className="text-xs text-lime">Ver →</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-mist">Único titular de la familia</p>
              )}
            </>
          )}

          {childrenCount > 0 && (
            <>
              {m.families && <div className="border-t border-line" />}
              <p className="text-xs font-semibold text-fog uppercase tracking-wide">Hijos · {childrenCount}</p>
              {childrenList.length > 0 ? (
                <div className="space-y-2">
                  {childrenList.map((child, i) => {
                    const age = child.birth_date ? calcChildAge(child.birth_date) : null
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${child.sex === 'F' ? 'bg-iris/20 text-iris' : 'bg-lime/20 text-lime'}`}>
                          {child.sex === 'F' ? '♀' : child.sex === 'M' ? '♂' : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-snow">{child.name || `Hijo/a ${i + 1}`}</span>
                          {age !== null && <span className="text-xs text-mist ml-2">{age} años</span>}
                          {child.birth_date && (
                            <span className="text-xs text-fog ml-2">
                              · {new Date(child.birth_date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-mist">{childrenCount} hijo{childrenCount !== 1 ? 's' : ''} registrado{childrenCount !== 1 ? 's' : ''}</p>
              )}
            </>
          )}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        {/* Left col: stats + bono */}
        <div className="space-y-3">
          {/* Monthly visits */}
          <div className="rounded-2xl border border-line bg-surface p-4 grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="font-display text-3xl font-semibold text-lime">{monthVisitsCount ?? 0}</p>
              <p className="text-xs text-mist mt-1">Visitas este mes</p>
            </div>
            <div className="text-center">
              <p className="font-display text-3xl font-semibold text-fog">{(visits as any[])?.length ?? 0}</p>
              <p className="text-xs text-mist mt-1">Total visitas</p>
            </div>
          </div>

          {/* Membership */}
          <div className={`rounded-2xl border p-4 ${isDepleted ? 'border-rose/30 bg-rose-soft' : (isLow || isExpiringSoon) ? 'border-amber/30 bg-amber/5' : 'border-line bg-surface'}`}>
            <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
              <CreditCard size={13} className="text-lime" /> Bono activo
            </div>
            {bono ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-snow">{bono.membership_types?.name}</p>
                    {expiresAt && daysLeft !== null && (
                      <p className={`text-xs mt-0.5 font-medium ${daysLeft <= 0 ? 'text-rose' : daysLeft <= 7 ? 'text-amber' : 'text-mist'}`}>
                        {daysLeft <= 0 ? 'Vencido' : daysLeft === 1 ? 'Vence mañana' : `Vence en ${daysLeft} días`}
                        {' · '}{expiresAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                  {isUnlimited ? (
                    <span className="text-2xl font-bold text-iris">∞</span>
                  ) : s != null ? (
                    <span className={`text-2xl font-bold ${isDepleted ? 'text-rose' : isLow ? 'text-amber' : 'text-lime'}`}>{s}</span>
                  ) : null}
                </div>
                {isExpired && <p className="text-xs text-rose font-medium mt-3 flex items-center gap-1"><AlertTriangle size={11} /> Bono caducado — necesita renovar</p>}
                {isLow && s !== 0 && !isExpired && <p className="text-xs text-amber font-medium mt-3 flex items-center gap-1"><AlertTriangle size={11} /> Quedan pocas sesiones</p>}
                {s === 0 && <p className="text-xs text-rose font-medium mt-3 flex items-center gap-1"><AlertTriangle size={11} /> Bono agotado — necesita renovar</p>}
                {isExpiringSoon && <p className="text-xs text-amber font-medium mt-3 flex items-center gap-1"><AlertTriangle size={11} /> Vence en {daysLeft} día{daysLeft === 1 ? '' : 's'}</p>}
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
        </div>

        {/* Right col: QR + última visita */}
        <div className="space-y-3">
          {/* QR code */}
          <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col items-center gap-3">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">Código QR de acceso</p>
            <MemberQr qrCode={m.qr_code} />
          </div>

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
              <div key={v.id} className="rounded-xl border border-line bg-surface px-4 py-2.5 flex justify-between gap-2 text-sm">
                <span className="text-fog truncate min-w-0">
                  {new Date(v.checked_in_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className="text-mist shrink-0">
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
