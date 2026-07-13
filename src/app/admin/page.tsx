'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/roles'
import {
  LayoutDashboard, Building2, BarChart3, Settings, Plus, X, Shield,
  Users, TrendingUp, Calendar, Activity, Pencil,
  CheckCircle, AlertTriangle, XCircle, Clock, Eye, HelpCircle, LogOut, ChevronDown,
  Smartphone, Monitor, Tablet, Globe, Wifi, WifiOff
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

type Tab = 'dashboard' | 'tenants' | 'metrics' | 'accesos' | 'config'

type Tenant = {
  id: string
  created_at: string
  name: string
  slug: string | null
  owner_name: string | null
  owner_firstname: string | null
  owner_lastname: string | null
  owner_email: string | null
  admin_email: string | null
  phone: string | null
  city: string | null
  plan: 'trial' | 'starter' | 'pro' | 'enterprise'
  status: 'active' | 'trial' | 'suspended' | 'cancelled'
  trial_ends_at: string | null
  notes: string | null
  last_activity_at: string | null
}

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-fog/20 text-fog border-fog/30',
  starter: 'bg-mint/20 text-mint border-mint/30',
  pro: 'bg-iris/20 text-iris border-iris/30',
  enterprise: 'bg-lime/20 text-lime border-lime/30',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-lime/20 text-lime border-lime/30',
  trial: 'bg-amber/20 text-amber border-amber/30',
  suspended: 'bg-rose/20 text-rose border-rose/30',
  cancelled: 'bg-fog/20 text-fog border-fog/30',
}

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  active: CheckCircle,
  trial: Clock,
  suspended: AlertTriangle,
  cancelled: XCircle,
}

const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
const labelCls = 'block text-xs font-semibold text-fog uppercase tracking-wide mb-1.5'

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ─── Dashboard Section ────────────────────────────────────────────────────────

function DashboardSection({ tenants }: { tenants: Tenant[] }) {
  const [stats, setStats] = useState({ members: 0, visitsToday: 0, visitsMonth: 0, bookings: 0 })

  useEffect(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    Promise.all([
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', todayStart),
      supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', monthStart),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]).then(([{ count: m }, { count: vd }, { count: vm }, { count: b }]) => {
      setStats({ members: m ?? 0, visitsToday: vd ?? 0, visitsMonth: vm ?? 0, bookings: b ?? 0 })
    })
  }, [])

  const activeCount = tenants.filter(t => t.status === 'active').length
  const trialCount = tenants.filter(t => t.status === 'trial').length

  const cards = [
    { label: 'Establecimientos', value: tenants.length, sub: `${activeCount} activos · ${trialCount} en prueba`, color: 'text-lime', bg: 'bg-lime/10', icon: Building2 },
    { label: 'Miembros totales', value: stats.members, sub: 'en la plataforma', color: 'text-iris', bg: 'bg-iris/10', icon: Users },
    { label: 'Visitas hoy', value: stats.visitsToday, sub: 'entradas registradas', color: 'text-mint', bg: 'bg-mint/10', icon: TrendingUp },
    { label: 'Visitas este mes', value: stats.visitsMonth, sub: 'sesiones consumidas', color: 'text-amber', bg: 'bg-amber/10', icon: Activity },
    { label: 'Reservas pendientes', value: stats.bookings, sub: 'por confirmar', color: 'text-rose', bg: 'bg-rose/10', icon: Calendar },
    { label: 'Establ. activos', value: activeCount, sub: 'con plan activo', color: 'text-lime', bg: 'bg-lime/10', icon: CheckCircle },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-semibold text-snow">Dashboard</h2>
        <p className="text-sm text-fog mt-0.5">Visión general de la plataforma</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(({ label, value, sub, color, bg, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-5">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <div className={`font-display text-3xl font-semibold ${color}`}>{value}</div>
            <div className="text-sm font-semibold text-snow mt-1">{label}</div>
            <div className="text-xs text-mist mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <p className="text-sm font-semibold text-snow">Establecimientos recientes</p>
        </div>
        <div className="divide-y divide-line">
          {tenants.slice(0, 8).map(t => {
            const StatusIcon = STATUS_ICONS[t.status] ?? CheckCircle
            return (
              <div key={t.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-xl bg-iris/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-iris">{t.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-snow truncate">{t.name}</p>
                  <p className="text-xs text-mist">{t.city ?? '—'} · {t.owner_email ?? '—'}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PLAN_COLORS[t.plan]}`}>{t.plan}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border hidden sm:inline ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                <span className="text-xs text-mist shrink-0">{new Date(t.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Tenants Section ──────────────────────────────────────────────────────────

type TenantForm = {
  name: string; slug: string
  owner_firstname: string; owner_lastname: string; owner_email: string
  admin_email: string; phone: string; city: string
  plan: Tenant['plan']; notes: string
}

const emptyForm: TenantForm = {
  name: '', slug: '', owner_firstname: '', owner_lastname: '', owner_email: '',
  admin_email: '', phone: '', city: '', plan: 'trial', notes: '',
}

function TenantModal({
  mode, initial, onClose, onSaved,
}: {
  mode: 'create' | 'edit'
  initial: TenantForm & { id?: string }
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<TenantForm>(initial)
  const [saving, setSaving] = useState(false)

  function upd(field: string, value: string) {
    setForm(f => {
      const next = { ...f, [field]: value }
      if (field === 'name' && mode === 'create') next.slug = toSlug(value)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const fullName = [form.owner_firstname, form.owner_lastname].filter(Boolean).join(' ')
    const payload = {
      name: form.name, slug: form.slug || null,
      owner_firstname: form.owner_firstname || null, owner_lastname: form.owner_lastname || null,
      owner_name: fullName || null, owner_email: form.owner_email || null,
      admin_email: form.admin_email || null, phone: form.phone || null,
      city: form.city || null, plan: form.plan, notes: form.notes || null,
    }
    if (mode === 'create') {
      await supabase.from('tenants').insert({ ...payload, status: form.plan === 'trial' ? 'trial' : 'active' })
    } else {
      await supabase.from('tenants').update(payload).eq('id', (initial as any).id)
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border border-line rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <h3 className="text-base font-semibold text-snow">
            {mode === 'create' ? 'Nuevo establecimiento' : `Editar · ${initial.name}`}
          </h3>
          <button onClick={onClose} className="text-mist hover:text-fog"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
          {/* Nombre establecimiento */}
          <div>
            <label className={labelCls + ' flex items-center gap-1'}>
              Nombre del establecimiento *
              <span title="Nombre comercial del establecimiento tal como aparecerá en la app."><HelpCircle size={11} className="text-mist" /></span>
            </label>
            <input required value={form.name} onChange={e => upd('name', e.target.value)}
              placeholder="El Bosc Màgic" className={inputCls} />
          </div>

          {/* Slug */}
          <div>
            <label className={labelCls + ' flex items-center gap-1'}>
              Slug (identificador URL)
              <span title="Identificador único en minúsculas sin espacios. Se genera automáticamente a partir del nombre."><HelpCircle size={11} className="text-mist" /></span>
            </label>
            <input value={form.slug} onChange={e => upd('slug', e.target.value)}
              placeholder="el-bosc-magic" className={inputCls} />
          </div>

          {/* Nombre + Apellido responsable */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls + ' flex items-center gap-1'}>
                Nombre contacto
                <span title="Nombre de la persona responsable del establecimiento."><HelpCircle size={11} className="text-mist" /></span>
              </label>
              <input value={form.owner_firstname} onChange={e => upd('owner_firstname', e.target.value)}
                placeholder="María" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Apellido contacto</label>
              <input value={form.owner_lastname} onChange={e => upd('owner_lastname', e.target.value)}
                placeholder="García" className={inputCls} />
            </div>
          </div>

          {/* Email contacto */}
          <div>
            <label className={labelCls + ' flex items-center gap-1'}>
              Email de contacto
              <span title="Correo del responsable para comunicaciones y soporte. No da acceso a la app."><HelpCircle size={11} className="text-mist" /></span>
            </label>
            <input type="email" value={form.owner_email} onChange={e => upd('owner_email', e.target.value)}
              placeholder="contacto@establecimiento.com" className={inputCls} />
          </div>

          {/* Admin email — destacado */}
          <div className="rounded-xl border border-iris/30 bg-iris/5 p-4 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-iris uppercase tracking-wide">
              Email administrador (acceso a la app)
              <span title="Este correo puede iniciar sesión en Watermelon y acceder al CRM del establecimiento. Distinto al email de contacto."><HelpCircle size={11} className="text-iris/60" /></span>
            </label>
            <input type="email" value={form.admin_email} onChange={e => upd('admin_email', e.target.value)}
              placeholder="admin@establecimiento.com"
              className="w-full bg-surface2 border border-iris/30 rounded-xl px-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-iris/60 transition-colors" />
            <p className="text-[11px] text-iris/70">
              Este correo podrá iniciar sesión en Watermelon y acceder a la vista del establecimiento.
            </p>
          </div>

          {/* Teléfono + ciudad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls + ' flex items-center gap-1'}>
                Teléfono
                <span title="Teléfono principal del establecimiento para contacto."><HelpCircle size={11} className="text-mist" /></span>
              </label>
              <input type="tel" value={form.phone} onChange={e => upd('phone', e.target.value)}
                placeholder="612 345 678" className={inputCls} />
            </div>
            <div>
              <label className={labelCls + ' flex items-center gap-1'}>
                Ciudad
                <span title="Ciudad donde está ubicado el establecimiento."><HelpCircle size={11} className="text-mist" /></span>
              </label>
              <input value={form.city} onChange={e => upd('city', e.target.value)}
                placeholder="Barcelona" className={inputCls} />
            </div>
          </div>

          {/* Plan */}
          <div>
            <label className={labelCls + ' flex items-center gap-1'}>
              Plan de suscripción
              <span title="Trial: 30 días gratis. Starter: funciones básicas. Pro: completo. Enterprise: personalizado."><HelpCircle size={11} className="text-mist" /></span>
            </label>
            <select value={form.plan} onChange={e => upd('plan', e.target.value as Tenant['plan'])} className={inputCls}>
              <option value="trial">Trial (prueba gratuita)</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className={labelCls + ' flex items-center gap-1'}>
              Notas internas
              <span title="Notas privadas del equipo de Watermelon. No visibles para el cliente."><HelpCircle size={11} className="text-mist" /></span>
            </label>
            <textarea rows={2} value={form.notes} onChange={e => upd('notes', e.target.value)}
              placeholder="Observaciones..." className={inputCls + ' resize-none'} />
          </div>

          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-lime bg-lime/10 py-3.5 font-semibold text-lime text-sm transition hover:bg-lime/20 disabled:opacity-60">
            {saving ? 'Guardando...' : mode === 'create' ? 'Crear establecimiento' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  )
}

function TenantsSection({ tenants, onReload }: { tenants: Tenant[]; onReload: () => void }) {
  const router = useRouter()
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; initial: TenantForm & { id?: string } } | null>(null)

  function openCreate() {
    setModal({ mode: 'create', initial: { ...emptyForm } })
  }

  function openEdit(t: Tenant) {
    setModal({
      mode: 'edit',
      initial: {
        id: t.id, name: t.name, slug: t.slug ?? '',
        owner_firstname: t.owner_firstname ?? '', owner_lastname: t.owner_lastname ?? '',
        owner_email: t.owner_email ?? '', admin_email: t.admin_email ?? '',
        phone: t.phone ?? '', city: t.city ?? '', plan: t.plan, notes: t.notes ?? '',
      },
    })
  }

  async function toggleStatus(t: Tenant) {
    const next = t.status === 'active' ? 'suspended' : 'active'
    await supabase.from('tenants').update({ status: next }).eq('id', t.id)
    onReload()
  }

  function enterAsTenant(t: Tenant) {
    localStorage.setItem('viewingAsTenant', JSON.stringify({ id: t.id, name: t.name }))
    router.push('/')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-semibold text-snow">Establecimientos</h2>
          <p className="text-sm text-fog mt-0.5">{tenants.length} registrados</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 border border-lime bg-lime/10 text-lime font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-lime/20 transition-colors">
          <Plus size={15} /> Nuevo
        </button>
      </div>

      <div className="space-y-3">
        {tenants.map(t => (
          <div key={t.id} className="rounded-2xl border border-line bg-surface p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-iris/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-iris">{t.name[0]}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-snow truncate">{t.name}</p>
                  <p className="text-xs text-mist mt-0.5">
                    {[t.city, t.owner_email].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PLAN_COLORS[t.plan]}`}>{t.plan}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[t.status]}`}>{t.status}</span>
              </div>
            </div>

            {/* Detail rows */}
            <div className="mt-3 space-y-1">
              {t.admin_email && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-iris uppercase tracking-wide w-24 shrink-0">Admin email</span>
                  <span className="text-xs text-snow font-medium">{t.admin_email}</span>
                </div>
              )}
              {t.phone && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-fog uppercase tracking-wide w-24 shrink-0">Teléfono</span>
                  <span className="text-xs text-fog">{t.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-fog uppercase tracking-wide w-24 shrink-0">Alta</span>
                <span className="text-xs text-fog">{new Date(t.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              {t.trial_ends_at && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-amber uppercase tracking-wide w-24 shrink-0">Trial hasta</span>
                  <span className="text-xs text-amber">{new Date(t.trial_ends_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                </div>
              )}
            </div>

            {t.notes && <p className="mt-3 text-xs text-fog border-t border-line pt-3">{t.notes}</p>}

            {/* Actions */}
            <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
              <button onClick={() => openEdit(t)}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border border-line text-fog hover:text-snow hover:border-line2 transition-colors">
                <Pencil size={12} /> Editar
              </button>
              <button onClick={() => enterAsTenant(t)}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border border-iris/30 text-iris hover:bg-iris/20 transition-colors">
                <Eye size={12} /> Ver cliente
              </button>
              <button onClick={() => toggleStatus(t)}
                className={`ml-auto flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                  t.status === 'active'
                    ? 'border-rose/30 text-rose hover:bg-rose/20'
                    : 'border-lime/30 text-lime hover:bg-lime/20'
                }`}>
                {t.status === 'active' ? 'Suspender' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <TenantModal
          mode={modal.mode}
          initial={modal.initial}
          onClose={() => setModal(null)}
          onSaved={onReload}
        />
      )}
    </div>
  )
}

// ─── Metrics Section ──────────────────────────────────────────────────────────

function MetricsSection() {
  const [visitData, setVisitData] = useState<{ month: string; visitas: number }[]>([])
  const [memberData, setMemberData] = useState<{ month: string; miembros: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date()
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

      const [{ data: visits }, { data: members }] = await Promise.all([
        supabase.from('visits').select('checked_in_at').gte('checked_in_at', sixMonthsAgo.toISOString()),
        supabase.from('members').select('created_at').gte('created_at', sixMonthsAgo.toISOString()),
      ])

      const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
      const buckets = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        return { month: monthNames[d.getMonth()], year: d.getFullYear(), m: d.getMonth(), visitas: 0, miembros: 0 }
      })

      visits?.forEach((v: any) => {
        const d = new Date(v.checked_in_at)
        const b = buckets.find(x => x.m === d.getMonth() && x.year === d.getFullYear())
        if (b) b.visitas++
      })
      members?.forEach((m: any) => {
        const d = new Date(m.created_at)
        const b = buckets.find(x => x.m === d.getMonth() && x.year === d.getFullYear())
        if (b) b.miembros++
      })

      setVisitData(buckets.map(b => ({ month: b.month, visitas: b.visitas })))
      setMemberData(buckets.map(b => ({ month: b.month, miembros: b.miembros })))
      setLoading(false)
    }
    load()
  }, [])

  const chartProps = {
    style: { fontSize: 11 },
    margin: { top: 5, right: 10, left: -20, bottom: 0 },
  }
  const axisProps = { stroke: '#4b5563', tick: { fill: '#6b7280', fontSize: 11 } }
  const gridProps = { stroke: '#1e2530', strokeDasharray: '3 3' }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-semibold text-snow">Métricas de plataforma</h2>
        <p className="text-sm text-fog mt-0.5">Últimos 6 meses</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-48 rounded-2xl bg-surface border border-line animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-snow mb-5">Visitas mensuales</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={visitData} {...chartProps}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={{ background: '#0f1419', border: '1px solid #1e2530', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="visitas" fill="#84cc16" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-snow mb-5">Nuevos miembros por mes</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={memberData} {...chartProps}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={{ background: '#0f1419', border: '1px solid #1e2530', borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="miembros" stroke="#818cf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total visitas 6m', value: visitData.reduce((s, d) => s + d.visitas, 0), color: 'text-lime' },
              { label: 'Nuevos miembros 6m', value: memberData.reduce((s, d) => s + d.miembros, 0), color: 'text-iris' },
              { label: 'Media visitas/mes', value: Math.round(visitData.reduce((s, d) => s + d.visitas, 0) / 6), color: 'text-mint' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl border border-line bg-surface p-4 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-mist mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Accesos Section ─────────────────────────────────────────────────────────

type TenantAccess = {
  tenant_id: string
  tenant_name: string
  last_access: string | null
  sessions_30d: number
  devices: { device_type: string; browser: string; os: string; is_pwa: boolean; logged_in_at: string }[]
}

function DeviceIcon({ type }: { type: string }) {
  if (type === 'mobile') return <Smartphone size={13} className="text-iris" />
  if (type === 'tablet') return <Tablet size={13} className="text-amber" />
  return <Monitor size={13} className="text-mint" />
}

function AccesosSection({ tenants }: { tenants: Tenant[] }) {
  const [data, setData] = useState<TenantAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: sessions } = await supabase
        .from('tenant_sessions')
        .select('tenant_id, logged_in_at, device_type, browser, os, is_pwa')
        .gte('logged_in_at', since30d)
        .order('logged_in_at', { ascending: false })

      // Also get last access ever
      const { data: allLast } = await supabase
        .from('tenant_sessions')
        .select('tenant_id, logged_in_at')
        .order('logged_in_at', { ascending: false })

      const lastByTenant: Record<string, string> = {}
      allLast?.forEach((s: any) => {
        if (!lastByTenant[s.tenant_id]) lastByTenant[s.tenant_id] = s.logged_in_at
      })

      const byTenant: Record<string, TenantAccess> = {}
      tenants.forEach(t => {
        byTenant[t.id] = {
          tenant_id: t.id,
          tenant_name: t.name,
          last_access: lastByTenant[t.id] ?? null,
          sessions_30d: 0,
          devices: [],
        }
      })

      sessions?.forEach((s: any) => {
        if (!byTenant[s.tenant_id]) return
        byTenant[s.tenant_id].sessions_30d++
        byTenant[s.tenant_id].devices.push(s)
      })

      setData(Object.values(byTenant).sort((a, b) => {
        if (!a.last_access) return 1
        if (!b.last_access) return -1
        return new Date(b.last_access).getTime() - new Date(a.last_access).getTime()
      }))
      setLoading(false)
    }
    load()
  }, [tenants])

  function activityStatus(last: string | null) {
    if (!last) return { label: 'Sin accesos', cls: 'bg-fog/20 text-fog border-fog/30', icon: WifiOff }
    const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
    if (days <= 3) return { label: 'Activo', cls: 'bg-lime/20 text-lime border-lime/30', icon: Wifi }
    if (days <= 14) return { label: `Hace ${days}d`, cls: 'bg-amber/20 text-amber border-amber/30', icon: Wifi }
    return { label: `Hace ${days}d`, cls: 'bg-rose/20 text-rose border-rose/30', icon: WifiOff }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-display font-semibold text-snow">Accesos</h2>
        <p className="text-sm text-fog mt-0.5">Actividad de sesiones por establecimiento · últimos 30 días</p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-surface border border-line animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {data.map(t => {
            const { label, cls, icon: StatusIcon } = activityStatus(t.last_access)
            const isOpen = expanded === t.tenant_id
            const uniqueDevices = t.devices.reduce<Record<string, number>>((acc, d) => {
              const key = `${d.device_type}|${d.browser}|${d.os}|${d.is_pwa}`
              acc[key] = (acc[key] ?? 0) + 1
              return acc
            }, {})

            return (
              <div key={t.tenant_id} className="rounded-2xl border border-line bg-surface overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : t.tenant_id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface2 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-iris/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-iris">{t.tenant_name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-snow">{t.tenant_name}</p>
                    <p className="text-xs text-mist mt-0.5">
                      {t.last_access
                        ? `Último acceso: ${new Date(t.last_access).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                        : 'Sin accesos registrados'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-fog">{t.sessions_30d} sesiones</span>
                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
                      <StatusIcon size={9} /> {label}
                    </span>
                    <ChevronDown size={13} className={`text-mist transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-line px-4 py-3 space-y-3">
                    {t.devices.length === 0 ? (
                      <p className="text-xs text-mist">Sin sesiones en los últimos 30 días</p>
                    ) : (
                      <>
                        {/* Device summary */}
                        <div>
                          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">Terminales detectados</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(uniqueDevices).map(([key, count]) => {
                              const [device, browser, os, pwa] = key.split('|')
                              return (
                                <div key={key} className="flex items-center gap-1.5 rounded-xl border border-line bg-surface2 px-3 py-1.5">
                                  <DeviceIcon type={device} />
                                  <span className="text-xs text-snow font-medium">
                                    {pwa === 'true' ? 'PWA' : browser}
                                  </span>
                                  <span className="text-xs text-fog">· {os}</span>
                                  {count > 1 && <span className="text-[10px] font-bold text-lime ml-1">×{count}</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Last 5 sessions */}
                        <div>
                          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">Últimas sesiones</p>
                          <div className="space-y-1">
                            {t.devices.slice(0, 5).map((s, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-fog">
                                <DeviceIcon type={s.device_type} />
                                <span className="text-snow">{s.is_pwa ? 'PWA' : s.browser}</span>
                                <span>· {s.os}</span>
                                <span className="ml-auto text-mist shrink-0">
                                  {new Date(s.logged_in_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Config Section ───────────────────────────────────────────────────────────

function ConfigSection() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-display font-semibold text-snow">Configuración</h2>
        <p className="text-sm text-fog mt-0.5">Parámetros de la plataforma</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
        <div><label className={labelCls}>Nombre de la plataforma</label><input defaultValue="El Bosc Màgic CRM" className={inputCls} /></div>
        <div><label className={labelCls}>Versión</label><input defaultValue="v0.1" disabled className={inputCls + ' opacity-50'} /></div>
        <div><label className={labelCls}>Supabase Project URL</label><input defaultValue="https://nylqzrr*****" disabled className={inputCls + ' opacity-50 font-mono text-xs'} /></div>
        <div><label className={labelCls}>Email de administrador</label><input type="email" defaultValue="admin@elboscmagic.cat" className={inputCls} /></div>
        <button disabled className="w-full flex items-center justify-center gap-2 rounded-xl bg-surface2 py-3 text-sm font-semibold text-mist cursor-not-allowed border border-line">
          Guardar — Próximamente
        </button>
      </div>

      <div className="rounded-2xl border border-amber/20 bg-amber/5 p-5 space-y-2">
        <p className="text-sm font-semibold text-amber">Funciones en desarrollo</p>
        <ul className="text-xs text-fog space-y-1">
          <li>· Autenticación multi-tenant con Row Level Security</li>
          <li>· Facturación automática por plan (Stripe)</li>
          <li>· Subdominios por establecimiento</li>
          <li>· Exportación de datos (CSV/Excel)</li>
          <li>· Notificaciones push y email automáticas</li>
          <li>· API pública con tokens por establecimiento</li>
        </ul>
      </div>
    </div>
  )
}

// ─── Main admin page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()

  async function loadTenants() {
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
    setTenants((data as Tenant[]) ?? [])
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email ?? ''
      if (!isSuperAdmin(email)) {
        router.replace('/')
        return
      }
      setUserEmail(email)
      loadTenants()
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenants' as Tab, label: 'Establecimientos', icon: Building2 },
    { id: 'metrics' as Tab, label: 'Métricas', icon: BarChart3 },
    { id: 'accesos' as Tab, label: 'Accesos', icon: Activity },
    { id: 'config' as Tab, label: 'Configuración', icon: Settings },
  ]

  return (
    <div className="flex min-h-screen bg-carbon">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-line bg-surface flex flex-col sticky top-0 h-screen hidden lg:flex">
        <div className="px-5 py-6 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber/15 flex items-center justify-center shrink-0">
              <Shield size={15} className="text-amber" />
            </div>
            <div>
              <p className="font-display font-semibold text-snow text-sm leading-tight">Admin</p>
              <p className="text-[10px] text-mist">Plataforma SaaS</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left ${
                tab === id ? 'bg-amber/15 text-amber' : 'text-fog hover:text-snow hover:bg-surface2'
              }`}>
              <Icon size={17} strokeWidth={tab === id ? 2.4 : 1.8} />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-line space-y-2">
          {userEmail && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-surface2">
              <div className="w-6 h-6 rounded-full bg-amber/20 flex items-center justify-center shrink-0">
                <Shield size={12} className="text-amber" />
              </div>
              <p className="text-[11px] text-fog truncate">{userEmail}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-fog hover:text-rose hover:bg-rose/20 transition-colors"
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-line px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber/15 flex items-center justify-center shrink-0">
              <Shield size={13} className="text-amber" />
            </div>
            <span className="font-semibold text-snow text-sm">Admin</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface2 border border-line"
          >
            <div className="w-5 h-5 rounded-full bg-amber/20 flex items-center justify-center">
              <Shield size={11} className="text-amber" />
            </div>
            <ChevronDown size={12} className={`text-fog transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-surface border-b border-line px-4 py-3 space-y-2 shadow-lg">
            {userEmail && (
              <div className="flex items-center gap-2 py-1">
                <Shield size={12} className="text-mist shrink-0" />
                <p className="text-xs text-fog truncate">{userEmail}</p>
              </div>
            )}
            <button
              onClick={() => { setMobileMenuOpen(false); handleLogout() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-fog hover:text-rose hover:bg-rose/20 transition-colors border border-line"
            >
              <LogOut size={14} /> Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <main className="flex-1 min-w-0 px-4 pt-16 pb-8 lg:px-8 lg:pt-8 overflow-y-auto">
        {/* Mobile tab bar */}
        <div className="lg:hidden flex gap-1 bg-surface rounded-xl p-1 border border-line mb-5 overflow-x-auto">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === id ? 'bg-surface2 text-snow' : 'text-fog hover:text-snow'
              }`}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && <DashboardSection tenants={tenants} />}
        {tab === 'tenants' && <TenantsSection tenants={tenants} onReload={loadTenants} />}
        {tab === 'metrics' && <MetricsSection />}
        {tab === 'accesos' && <AccesosSection tenants={tenants} />}
        {tab === 'config' && <ConfigSection />}
      </main>
    </div>
  )
}
