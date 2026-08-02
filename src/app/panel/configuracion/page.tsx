'use client'

import Link from 'next/link'
import { BarChart2, Tag, Building2, Mail, Phone, MapPin, User, Star, Users, Pencil, Check, X, ShoppingBag, LogOut, Languages, SunMoon, Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getStoredTenant, loadAndStoreTenant, clearStoredTenant } from '@/lib/tenant'
import { useLanguage, LANGUAGES } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'

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
  capacity: number | null
}

type ContactForm = {
  owner_firstname: string
  owner_lastname: string
  owner_email: string
  phone: string
  capacity: string
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | null | undefined }) {
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

const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-3 py-2 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'

export default function PerfilPage() {
  const router = useRouter()
  const { lang, isAuto, setLang, t } = useLanguage()
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = useState<TenantProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ContactForm>({ owner_firstname: '', owner_lastname: '', owner_email: '', phone: '', capacity: '' })

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
        .select('id, name, admin_email, owner_firstname, owner_lastname, owner_email, phone, city, plan, capacity')
        .eq('id', tenantId)
        .maybeSingle()

      if (data) {
        setProfile(data)
        setForm({
          owner_firstname: data.owner_firstname ?? '',
          owner_lastname: data.owner_lastname ?? '',
          owner_email: data.owner_email ?? '',
          phone: data.phone ?? '',
          capacity: data.capacity?.toString() ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase.from('tenants').update({
      owner_firstname: form.owner_firstname || null,
      owner_lastname: form.owner_lastname || null,
      owner_email: form.owner_email || null,
      phone: form.phone || null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
    }).eq('id', profile.id)

    if (!error) {
      setProfile(p => p ? {
        ...p,
        owner_firstname: form.owner_firstname || null,
        owner_lastname: form.owner_lastname || null,
        owner_email: form.owner_email || null,
        phone: form.phone || null,
        capacity: form.capacity ? parseInt(form.capacity) : null,
      } : p)
      setEditing(false)
    }
    setSaving(false)
  }

  function handleCancel() {
    if (!profile) return
    setForm({
      owner_firstname: profile.owner_firstname ?? '',
      owner_lastname: profile.owner_lastname ?? '',
      owner_email: profile.owner_email ?? '',
      phone: profile.phone ?? '',
      capacity: profile.capacity?.toString() ?? '',
    })
    setEditing(false)
  }

  async function handleLogout() {
    localStorage.removeItem('viewingAsTenant')
    clearStoredTenant()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">{t('panelcfg_configuracion_titulo')}</h1>
        <p className="text-sm text-fog mt-0.5">{t('panelcfg_perfil_subtitulo')}</p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-mist">{t('panelcfg_cargando')}</div>
      ) : !profile ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-mist">{t('panelcfg_no_datos_establecimiento')}</div>
      ) : (
        <div className="space-y-4">

          {/* Establecimiento — read only */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1">{t('panelcfg_establecimiento')}</p>
            <InfoRow icon={Building2} label={t('panelcfg_nombre_label')} value={profile.name} />
            <InfoRow icon={Star} label={t('panelcfg_plan_label')} value={profile.plan} />
            <InfoRow icon={MapPin} label={t('panelcfg_ciudad_label')} value={profile.city} />
          </div>

          {/* Persona de contacto + Capacidad — editable */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-fog uppercase tracking-wide">{t('panelcfg_contacto_capacidad')}</p>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface2 px-3 py-1.5 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors"
                >
                  <Pencil size={11} /> {t('panelcfg_editar')}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-1 rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-xs font-semibold text-fog hover:text-snow transition-colors"
                  >
                    <X size={11} /> {t('panelcfg_cancelar')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1 rounded-lg border border-lime bg-lime/10 px-3 py-1.5 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors disabled:opacity-60"
                  >
                    <Check size={11} /> {saving ? t('panelcfg_guardando') : t('panelcfg_guardar')}
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-fog mb-1">{t('panelcfg_nombre_label')}</label>
                    <input value={form.owner_firstname} onChange={e => setForm(f => ({ ...f, owner_firstname: e.target.value }))} placeholder={t('panelcfg_nombre_label')} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-fog mb-1">{t('panelcfg_apellido_label')}</label>
                    <input value={form.owner_lastname} onChange={e => setForm(f => ({ ...f, owner_lastname: e.target.value }))} placeholder={t('panelcfg_placeholder_apellido')} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-fog mb-1">{t('panelcfg_email_contacto_label')}</label>
                  <input type="email" value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))} placeholder={t('panelcfg_placeholder_email_contacto')} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-fog mb-1">{t('panelcfg_telefono_label')}</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+34 600 000 000" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-fog mb-1">{t('panelcfg_capacidad_local_label')}</label>
                  <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder={t('panelcfg_placeholder_ej30')} className={inputCls} />
                </div>
              </div>
            ) : (
              <>
                <InfoRow icon={User} label={t('panelcfg_nombre_label')} value={[profile.owner_firstname, profile.owner_lastname].filter(Boolean).join(' ') || null} />
                <InfoRow icon={Mail} label={t('panelcfg_email_contacto_label')} value={profile.owner_email} />
                <InfoRow icon={Phone} label={t('panelcfg_telefono_label')} value={profile.phone} />
                <InfoRow icon={Users} label={t('panelcfg_aforo_maximo_label')} value={profile.capacity?.toString() ?? null} />
              </>
            )}
          </div>

          {/* Idioma */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Languages size={12} /> {t('idioma')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLang('auto')}
                className={`col-span-2 rounded-xl border px-3 py-2.5 text-xs font-semibold text-left transition-colors ${
                  isAuto ? 'border-lime bg-lime/10 text-lime' : 'border-line bg-surface2 text-fog hover:text-snow'
                }`}
              >
                {t('idioma_auto')}
              </button>
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                    !isAuto && lang === l.code ? 'border-lime bg-lime/10 text-lime' : 'border-line bg-surface2 text-fog hover:text-snow'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Apariencia */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <SunMoon size={12} /> Apariencia
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                  theme === 'dark' ? 'border-lime bg-lime/10 text-lime' : 'border-line bg-surface2 text-fog hover:text-snow'
                }`}
              >
                <Moon size={12} /> Oscuro
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                  theme === 'light' ? 'border-lime bg-lime/10 text-lime' : 'border-line bg-surface2 text-fog hover:text-snow'
                }`}
              >
                <Sun size={12} /> Claro
              </button>
            </div>
          </div>

          {/* Acceso — read only */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1">{t('panelcfg_acceso')}</p>
            <InfoRow icon={Mail} label={t('panelcfg_email_administrador_label')} value={profile.admin_email} />
          </div>

          {/* Cerrar sesión */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-fog hover:text-rose hover:border-rose/40 transition-colors"
          >
            <LogOut size={15} /> {t('panelcfg_cerrar_sesion')}
          </button>

        </div>
      )}
    </div>
  )
}
