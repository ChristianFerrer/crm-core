import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone, Mail, FileText, CreditCard, Clock, Users } from 'lucide-react'
import { MemberQr } from '@/components/MemberQr'

export const revalidate = 0

function calcAge(d: string) {
  const b = new Date(d), now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() - b.getMonth() < 0 || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
  return age
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: member }, { data: visits }] = await Promise.all([
    supabase
      .from('members')
      .select('id, name, phone, email, birth_date, notes, qr_code, families(id, name), memberships(id, sessions_remaining, expires_at, membership_types(name))')
      .eq('id', id)
      .single(),
    supabase
      .from('visits')
      .select('id, checked_in_at')
      .eq('member_id', id)
      .order('checked_in_at', { ascending: false })
      .limit(15),
  ])

  if (!member) notFound()

  const m = member as any
  const bono = m.memberships?.[0]
  const isUnlimited = bono?.membership_types?.name?.toLowerCase().includes('ilimitado')
  const s = bono?.sessions_remaining
  const isLow = !isUnlimited && s != null && s <= 2

  return (
    <div className="space-y-4 lg:max-w-2xl">
      <div className="flex items-center gap-3 pt-2">
        <Link
          href={m.families ? `/familias/${m.families.id}` : '/familias'}
          className="w-8 h-8 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors"
        >
          <ArrowLeft size={15} className="text-fog" />
        </Link>
        <div>
          <h1 className="font-display text-xl font-semibold text-snow leading-tight">{m.name}</h1>
          {m.families && (
            <Link href={`/familias/${m.families.id}`} className="text-xs text-mist hover:text-fog flex items-center gap-1 mt-0.5">
              <Users size={10} /> Familia {m.families.name}
            </Link>
          )}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        {/* Info + QR */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
            {m.birth_date && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-fog">Edad</span>
                <span className="text-sm font-semibold text-snow">{calcAge(m.birth_date)} años</span>
              </div>
            )}
            {m.phone && (
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-mist shrink-0" />
                <a href={`tel:${m.phone}`} className="text-sm text-lime font-medium">{m.phone}</a>
              </div>
            )}
            {m.email && (
              <div className="flex items-center gap-3">
                <Mail size={14} className="text-mist shrink-0" />
                <span className="text-sm text-fog truncate">{m.email}</span>
              </div>
            )}
            {m.notes && (
              <div className="flex items-start gap-3">
                <FileText size={14} className="text-mist shrink-0 mt-0.5" />
                <span className="text-sm text-fog">{m.notes}</span>
              </div>
            )}
          </div>

          {/* QR code */}
          <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col items-center gap-3">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">Código QR de acceso</p>
            <MemberQr qrCode={m.qr_code} />
            <p className="text-[10px] text-mist text-center">{m.qr_code}</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Membership */}
          <div className={`rounded-2xl border p-4 ${isLow ? 'border-amber/30 bg-amber/5' : s === 0 ? 'border-rose/30 bg-rose-soft' : 'border-line bg-surface'}`}>
            <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
              <CreditCard size={13} className="text-lime" /> Bono activo
            </div>
            {bono ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-snow">{bono.membership_types?.name}</p>
                    {bono.expires_at && (
                      <p className="text-xs text-mist mt-0.5">
                        Vence {new Date(bono.expires_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  {isUnlimited ? (
                    <span className="text-2xl font-bold text-iris">∞</span>
                  ) : s != null ? (
                    <span className={`text-2xl font-bold ${isLow ? 'text-amber' : s === 0 ? 'text-rose' : 'text-lime'}`}>{s}</span>
                  ) : null}
                </div>
                {isLow && s !== 0 && <p className="text-xs text-amber font-medium mt-3">⚠ Quedan pocas sesiones</p>}
                {s === 0 && <p className="text-xs text-rose font-medium mt-3">⚠ Bono agotado — hay que renovar</p>}
              </>
            ) : (
              <p className="text-sm text-mist">Sin bono asignado</p>
            )}
          </div>

          {/* Visit stats */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-snow">Total visitas</p>
              <p className="text-2xl font-bold font-display text-lime">{(visits as any[])?.length ?? 0}</p>
            </div>
            {(visits as any[])?.[0] && (
              <p className="text-xs text-mist mt-1">
                Última: {new Date((visits as any[])[0].checked_in_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            )}
          </div>
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
