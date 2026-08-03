'use client'

import { Building2, Mail, Phone, MapPin, User, Star, Users, Pencil, Check, X, LogOut, Languages, SunMoon, Sun, Moon, ShieldCheck, Clock, CalendarDays } from 'lucide-react'
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
  schedule_days: string | null
  schedule_hours: string | null
}

type EstablishmentForm = {
  city: string
  capacity: string
  schedule_days: string
  schedule_hours: string
}

type ContactForm = {
  owner_firstname: string
  owner_lastname: string
  owner_email: string
  phone: string
}

function InfoRow({ icon: Icon, label, value, tag }: { icon: typeof Building2; label: string; value: string | null | undefined; tag?: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-line last:border-0">
      <div className="w-8 h-8 rounded-xl bg-surface2 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className="text-fog" />
      </div>
      <div>
        <p className="text-xs text-mist mb-0.5">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-snow">{value || '—'}</p>
          {tag && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-white bg-iris rounded-full px-1.5 py-0.5">
              <ShieldCheck size={9} /> {tag}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-3 py-2 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'

export default function ConfiguracionPage() {
  const router = useRouter()
  const { lang, isAuto, setLang, t } = useLanguage()
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = useState<TenantProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const [editingEst, setEditingEst] = useState(false)
  const [savingEst, setSavingEst] = useState(false)
  const [estForm, setEstForm] = useState<EstablishmentForm>({ city: '', capacity: '', schedule_days: '', schedule_hours: '' })

  const [editingContact, setEditingContact] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [contactForm, setContactForm] = useState<ContactForm>({ owner_firstname: '', owner_lastname: '', owner_email: '', phone: '' })

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
        .select('id, name, admin_email, owner_firstname, owner_lastname, owner_email, phone, city, plan, capacity, schedule_days, schedule_hours')
        .eq('id', tenantId)
        .maybeSingle()

      if (data) {
        setProfile(data)
        setEstForm({
          city: data.city ?? '',
          capacity: data.capacity?.toString() ?? '',
          schedule_days: data.schedule_days ?? '',
          schedule_hours: data.schedule_hours ?? '',
        })
        setContactForm({
          owner_firstname: data.owner_firstname ?? '',
          owner_lastname: data.owner_lastname ?? '',
          owner_email: data.owner_email ?? '',
          phone: data.phone ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSaveEst() {
    if (!profile) return
    setSavingEst(true)
    const payload = {
      city: estForm.city || null,
      capacity: estForm.capacity ? parseInt(estForm.capacity) : null,
      schedule_days: estForm.schedule_days || null,
      schedule_hours: estForm.schedule_hours || null,
    }
    const { error } = await supabase.from('tenants').update(payload).eq('id', profile.id)
    if (!error) {
      setProfile(p => p ? { ...p, ...payload } : p)
      setEditingEst(false)
    }
    setSavingEst(false)
  }

  function handleCancelEst() {
    if (!profile) return
    setEstForm({
      city: profile.city ?? '',
      capacity: profile.capacity?.toString() ?? '',
      schedule_days: profile.schedule_days ?? '',
      schedule_hours: profile.schedule_hours ?? '',
    })
    setEditingEst(false)
  }

  async function handleSaveContact() {
    if (!profile) return
    setSavingContact(true)
    const payload = {
      owner_firstname: contactForm.owner_firstname || null,
      owner_lastname: contactForm.owner_lastname || null,
      owner_email: contactForm.owner_email || null,
      phone: contactForm.phone || null,
    }
    const { error } = await supabase.from('tenants').update(payload).eq('id', profile.id)
    if (!error) {
      setProfile(p => p ? { ...p, ...payload } : p)
      setEditingContact(false)
    }
    setSavingContact(false)
  }

  function handleCancelContact() {
    if (!profile) return
    setContactForm({
      owner_firstname: profile.owner_firstname ?? '',
      owner_lastname: profile.owner_lastname ?? '',
      owner_email: profile.owner_email ?? '',
      phone: profile.phone ?? '',
    })
    setEditingContact(false)
  }

  async function handleLogout() {
    localStorage.removeItem('viewingAsTenant')
    clearStoredTenant()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isAdminContact = !!profile?.admin_email && !!profile?.owner_email && profile.admin_email === profile.owner_email

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

          {/* Datos del establecimiento */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-fog uppercase tracking-wide">{t('panelcfg_datos_establecimiento')}</p>
              {!editingEst ? (
                <button
                  onClick={() => setEditingEst(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface2 px-3 py-1.5 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors"
                >
                  <Pencil size={11} /> {t('panelcfg_editar')}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelEst}
                    className="flex items-center gap-1 rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-xs font-semibold text-fog hover:text-snow transition-colors"
                  >
                    <X size={11} /> {t('panelcfg_cancelar')}
                  </button>
                  <button
                    onClick={handleSaveEst}
                    disabled={savingEst}
                    className="flex items-center gap-1 rounded-lg border border-lime bg-lime/10 px-3 py-1.5 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors disabled:opacity-60"
                  >
                    <Check size={11} /> {savingEst ? t('panelcfg_guardando') : t('panelcfg_guardar')}
                  </button>
                </div>
              )}
            </div>

            <InfoRow icon={Building2} label={t('panelcfg_nombre_label')} value={profile.name} />
            <InfoRow icon={Star} label={t('panelcfg_plan_label')} value={profile.plan} />

            {editingEst ? (
              <div className="space-y-3 pt-3">
                <div>
                  <label className="block text-xs text-fog mb-1">{t('panelcfg_direccion_label')}</label>
                  <input value={estForm.city} onChange={e => setEstForm(f => ({ ...f, city: e.target.value }))} placeholder={t('panelcfg_direccion_label')} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-fog mb-1">{t('panelcfg_aforo_maximo_label')}</label>
                  <input type="number" min="1" value={estForm.capacity} onChange={e => setEstForm(f => ({ ...f, capacity: e.target.value }))} placeholder={t('panelcfg_placeholder_ej30')} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-fog mb-1">{t('panelcfg_dias_operativos_label')}</label>
                  <input value={estForm.schedule_days} onChange={e => setEstForm(f => ({ ...f, schedule_days: e.target.value }))} placeholder={t('panelcfg_dias_operativos_placeholder')} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-fog mb-1">{t('panelcfg_horario_operativo_label')}</label>
                  <input value={estForm.schedule_hours} onChange={e => setEstForm(f => ({ ...f, schedule_hours: e.target.value }))} placeholder={t('panelcfg_horario_operativo_placeholder')} className={inputCls} />
                </div>
              </div>
            ) : (
              <>
                <InfoRow icon={MapPin} label={t('panelcfg_direccion_label')} value={profile.city} />
                <InfoRow icon={Users} label={t('panelcfg_aforo_maximo_label')} value={profile.capacity?.toString() ?? null} />
                <InfoRow icon={CalendarDays} label={t('panelcfg_dias_operativos_label')} value={profile.schedule_days} />
                <InfoRow icon={Clock} label={t('panelcfg_horario_operativo_label')} value={profile.schedule_hours} />
              </>
            )}
          </div>

          {/* Datos de contacto */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-fog uppercase tracking-wide">{t('panelcfg_datos_contacto')}</p>
              {!editingContact ? (
                <button
                  onClick={() => setEditingContact(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface2 px-3 py-1.5 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors"
                >
                  <Pencil size={11} /> {t('panelcfg_editar')}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelContact}
                    className="flex items-center gap-1 rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-xs font-semibold text-fog hover:text-snow transition-colors"
                  >
                    <X size={11} /> {t('panelcfg_cancelar')}
                  </button>
                  <button
                    onClick={handleSaveContact}
                    disabled={savingContact}
                    className="flex items-center gap-1 rounded-lg border border-lime bg-lime/10 px-3 py-1.5 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors disabled:opacity-60"
                  >
                    <Check size={11} /> {savingContact ? t('panelcfg_guardando') : t('panelcfg_guardar')}
                  </button>
                </div>
              )}
            </div>

            {editingContact ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-fog mb-1">{t('panelcfg_nombre_label')}</label>
                    <input value={contactForm.owner_firstname} onChange={e => setContactForm(f => ({ ...f, owner_firstname: e.target.value }))} placeholder={t('panelcfg_nombre_label')} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-fog mb-1">{t('panelcfg_apellido_label')}</label>
                    <input value={contactForm.owner_lastname} onChange={e => setContactForm(f => ({ ...f, owner_lastname: e.target.value }))} placeholder={t('panelcfg_placeholder_apellido')} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-fog mb-1">{t('panelcfg_email_contacto_label')}</label>
                  <input type="email" value={contactForm.owner_email} onChange={e => setContactForm(f => ({ ...f, owner_email: e.target.value }))} placeholder={t('panelcfg_placeholder_email_contacto')} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-fog mb-1">{t('panelcfg_telefono_label')}</label>
                  <input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="+34 600 000 000" className={inputCls} />
                </div>
              </div>
            ) : (
              <>
                <InfoRow icon={User} label={t('panelcfg_nombre_label')} value={[profile.owner_firstname, profile.owner_lastname].filter(Boolean).join(' ') || null} />
                <InfoRow icon={Mail} label={t('panelcfg_email_contacto_label')} value={profile.owner_email} tag={isAdminContact ? t('panelcfg_admin_tag') : undefined} />
                <InfoRow icon={Phone} label={t('panelcfg_telefono_label')} value={profile.phone} />
              </>
            )}
          </div>

          {/* Idioma */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Languages size={12} /> {t('idioma')}
            </p>

            {/* Idioma automático — switch */}
            <button
              onClick={() => setLang(isAuto ? lang : 'auto')}
              className="w-full flex items-center justify-between rounded-xl border border-line bg-surface2 px-3.5 py-3 mb-3"
            >
              <span className="text-sm font-medium text-snow text-left">{t('idioma_auto')}</span>
              <span className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${isAuto ? 'bg-lime' : 'bg-line'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isAuto ? 'translate-x-4' : ''}`} />
              </span>
            </button>

            {/* Selección manual — dropdown, deshabilitado si automático está activo */}
            <select
              value={lang}
              disabled={isAuto}
              onChange={e => setLang(e.target.value as typeof lang)}
              className={`w-full bg-surface2 border border-line rounded-xl px-3.5 py-3 text-sm outline-none transition-colors ${
                isAuto ? 'text-mist cursor-not-allowed opacity-60' : 'text-snow focus:border-line2'
              }`}
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
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

          {/* Cerrar sesión */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-rose bg-rose/10 px-4 py-3 text-sm font-semibold text-rose hover:bg-rose/20 transition-colors"
          >
            <LogOut size={15} /> {t('panelcfg_cerrar_sesion')}
          </button>

        </div>
      )}
    </div>
  )
}
