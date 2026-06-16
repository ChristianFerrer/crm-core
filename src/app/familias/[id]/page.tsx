import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone, Mail, FileText, Baby, Calendar, Clock } from 'lucide-react'
import Link from 'next/link'

export const revalidate = 0

function getAge(birthDate: string) {
  const diff = Date.now() - new Date(birthDate).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

export default async function FamilyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [familyRes, visitsRes] = await Promise.all([
    supabase
      .from('families')
      .select(`
        id, name, phone, email, notes,
        children(id, name, birth_date),
        memberships(id, sessions_remaining, expires_at, membership_types(name, sessions))
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('visits')
      .select('id, checked_in_at')
      .eq('family_id', id)
      .order('checked_in_at', { ascending: false })
      .limit(20),
  ])

  if (!familyRes.data) notFound()

  const family = familyRes.data as any
  const visits = visitsRes.data ?? []
  const membership = family.memberships?.[0]
  const isUnlimited = membership?.membership_types?.name?.toLowerCase().includes('ilimitado')
  const sessionsLeft = membership?.sessions_remaining
  const isLow = !isUnlimited && sessionsLeft != null && sessionsLeft <= 2
  const isExpiringSoon = membership?.expires_at &&
    new Date(membership.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/familias" className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
          <ArrowLeft size={16} className="text-gray-600" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 truncate">{family.name}</h1>
      </div>

      {/* Contact */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        {family.phone && (
          <div className="flex items-center gap-3">
            <Phone size={15} className="text-gray-400 shrink-0" />
            <a href={`tel:${family.phone}`} className="text-sm text-violet-600 font-medium">{family.phone}</a>
          </div>
        )}
        {family.email && (
          <div className="flex items-center gap-3">
            <Mail size={15} className="text-gray-400 shrink-0" />
            <span className="text-sm text-gray-700">{family.email}</span>
          </div>
        )}
        {family.notes && (
          <div className="flex items-start gap-3">
            <FileText size={15} className="text-gray-400 shrink-0 mt-0.5" />
            <span className="text-sm text-gray-600">{family.notes}</span>
          </div>
        )}
      </div>

      {/* Children */}
      {family.children?.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Niños</h2>
          <div className="space-y-2">
            {family.children.map((child: any) => (
              <div key={child.id} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center">
                  <Baby size={13} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{child.name}</p>
                  {child.birth_date && (
                    <p className="text-xs text-gray-400">{getAge(child.birth_date)} años</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Membership */}
      {membership && (
        <div className={`rounded-2xl p-4 shadow-sm border ${isLow || isExpiringSoon ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Bono activo</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{membership.membership_types?.name}</p>
              {membership.expires_at && (
                <div className="flex items-center gap-1 mt-1">
                  <Calendar size={12} className="text-gray-400" />
                  <p className="text-xs text-gray-500">Vence {formatDate(membership.expires_at)}</p>
                </div>
              )}
            </div>
            {isUnlimited ? (
              <span className="text-lg font-bold text-violet-600">∞</span>
            ) : sessionsLeft != null ? (
              <div className="text-right">
                <p className={`text-2xl font-bold ${isLow ? 'text-amber-600' : 'text-violet-600'}`}>{sessionsLeft}</p>
                <p className="text-xs text-gray-400">sesiones</p>
              </div>
            ) : null}
          </div>
          {isLow && (
            <p className="text-xs text-amber-600 font-medium mt-2">⚠ Quedan pocas sesiones, avisa a la familia</p>
          )}
        </div>
      )}

      {/* Visit history */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Historial de visitas ({visits.length})</h2>
        {visits.length === 0 ? (
          <div className="bg-white rounded-2xl p-4 text-center text-sm text-gray-400 border border-gray-100">
            Sin visitas registradas
          </div>
        ) : (
          <div className="space-y-2">
            {visits.map((visit: any) => (
              <div key={visit.id} className="bg-white rounded-xl px-4 py-3 border border-gray-100 flex items-center gap-3">
                <Clock size={14} className="text-gray-300 shrink-0" />
                <p className="text-sm text-gray-700">{formatDateTime(visit.checked_in_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
