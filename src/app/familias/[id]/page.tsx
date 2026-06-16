import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone, Mail, FileText, Baby, CreditCard, Clock } from 'lucide-react'

export const revalidate = 0

function calcAge(d: string) {
  const b = new Date(d), now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() - b.getMonth() < 0 || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
  return age
}

export default async function FamiliaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: family }, { data: children }, { data: memberships }, { data: visits }] = await Promise.all([
    supabase.from('families').select('*').eq('id', id).single(),
    supabase.from('children').select('*').eq('family_id', id).order('birth_date'),
    supabase.from('memberships').select('*, membership_types(*)').eq('family_id', id).order('created_at', { ascending: false }).limit(1),
    supabase.from('visits').select('*').eq('family_id', id).order('checked_in_at', { ascending: false }).limit(10),
  ])

  if (!family) notFound()

  const m = (memberships as any)?.[0]
  const isUnlimited = m?.membership_types?.name?.toLowerCase().includes('ilimitado')
  const sessionsLeft = m?.sessions_remaining
  const isLow = !isUnlimited && sessionsLeft != null && sessionsLeft <= 2

  return (
    <div className="space-y-4 lg:max-w-2xl">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/familias" className="w-8 h-8 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors">
          <ArrowLeft size={15} className="text-fog" />
        </Link>
        <h1 className="font-display text-xl font-semibold text-snow truncate">{family.name}</h1>
      </div>

      {/* Contact */}
      <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
        {family.phone && (
          <div className="flex items-center gap-3">
            <Phone size={14} className="text-mist shrink-0" />
            <a href={`tel:${family.phone}`} className="text-sm text-lime font-medium">{family.phone}</a>
          </div>
        )}
        {family.email && (
          <div className="flex items-center gap-3">
            <Mail size={14} className="text-mist shrink-0" />
            <span className="text-sm text-fog">{family.email}</span>
          </div>
        )}
        {family.notes && (
          <div className="flex items-start gap-3">
            <FileText size={14} className="text-mist shrink-0 mt-0.5" />
            <span className="text-sm text-fog">{family.notes}</span>
          </div>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
      {/* Children */}
      {(children as any[])?.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
            <Baby size={13} className="text-iris" /> Niños
          </div>
          <div className="space-y-2">
            {(children as any[]).map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <span className="text-sm text-snow">{c.name}</span>
                {c.birth_date && <span className="text-xs text-mist">{calcAge(c.birth_date)} años</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Membership */}
      {m && (
        <div className={`rounded-2xl border p-4 ${isLow ? 'border-rose/30 bg-rose-soft' : 'border-line bg-surface'}`}>
          <div className="flex items-center gap-2 text-xs font-semibold text-fog uppercase tracking-wide mb-3">
            <CreditCard size={13} className="text-lime" /> Bono activo
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-snow">{m.membership_types?.name}</p>
              {m.expires_at && (
                <p className="text-xs text-mist mt-0.5">
                  Vence {new Date(m.expires_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
            {isUnlimited ? (
              <span className="text-2xl font-bold text-iris">∞</span>
            ) : sessionsLeft != null ? (
              <span className={`text-2xl font-bold ${isLow ? 'text-rose' : 'text-lime'}`}>{sessionsLeft}</span>
            ) : null}
          </div>
          {isLow && <p className="text-xs text-rose font-medium mt-3">⚠ Quedan pocas sesiones, avisa a la familia</p>}
        </div>
      )}

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
