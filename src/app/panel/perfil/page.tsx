'use client'

import Link from 'next/link'
import { BarChart2, Tag, Building2, Mail, Phone, MapPin, User, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant, loadAndStoreTenant } from '@/lib/tenant'

type TenantProfile = {
  id: string
  name: string
  admin_email: string | null
  owner_firstname: string | null
  owner_lastname: string | null
  owner_email: string | null
  phone: string | null
  city: string | null
  plan: string | null
  notes: string | null
}

function Row({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-line last:border-0">
      <div className="w-8 h-8 rounded-xl bg-surface2 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className="text-fog" />
      </div>
      <div>
        <p className="text-xs text-mist mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-snow">{value || '—'}</p>
      </div>
    </div>
  )
}

export default function PerfilPage() {
  const [profile, setProfile] = useState<TenantProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const impersonating = localStorage.getItem('viewingAsTenant')
      let tenantId: string | null = null

      if (impersonating) {
        try { tenantId = JSON.parse(impersonating).id } catch {}
      } else {
        let tenant = getStoredTenant()
        if (!tenant) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user?.email) tenant = await loadAndStoreTenant(session.user.email)
        }
        tenantId = tenant?.id ?? null
      }

      if (!tenantId) { setLoading(false); return }

      const { data } = await supabase
        .from('tenants')
        .select('id, name, admin_email, owner_firstname, owner_lastname, owner_email, phone, city, plan, notes')
        .eq('id', tenantId)
        .maybeSingle()

      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-snow">Panel</h1>
        <p className="text-fog mt-1 text-sm">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="flex gap-1 bg-surface rounded-xl p-1 border border-line mb-6">
        <Link href="/panel" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <BarChart2 size={13} /> Resumen
        </Link>
        <Link href="/panel/servicios" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <Tag size={13} /> Servicios
        </Link>
        <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-surface2 text-snow">
          <Building2 size={13} /> Perfil
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-mist">Cargando...</div>
      ) : !profile ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-mist">No se encontraron datos del establecimiento.</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1">Establecimiento</p>
            <Row icon={Building2} label="Nombre" value={profile.name} />
            <Row icon={Star} label="Plan" value={profile.plan} />
            <Row icon={MapPin} label="Ciudad" value={profile.city} />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1">Persona de contacto</p>
            <Row icon={User} label="Nombre" value={[profile.owner_firstname, profile.owner_lastname].filter(Boolean).join(' ') || null} />
            <Row icon={Mail} label="Email de contacto" value={profile.owner_email} />
            <Row icon={Phone} label="Teléfono" value={profile.phone} />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1">Acceso</p>
            <Row icon={Mail} label="Email de administrador" value={profile.admin_email} />
          </div>

        </div>
      )}
    </div>
  )
}
