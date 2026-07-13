'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Users, BarChart2, CalendarDays, LogOut, User, Building2, ShieldCheck, Check, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant, loadAndStoreTenant, clearStoredTenant } from '@/lib/tenant'
import { useEffect, useState } from 'react'
import { useNavBadges } from '@/lib/useNavBadges'

function Badge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-lime/20 text-lime text-[10px] font-bold flex items-center justify-center leading-none shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)
  const [termsAccepting, setTermsAccepting] = useState(false)
  const badges = useNavBadges()

  useEffect(() => {
    async function load(email: string) {
      setUserEmail(email)
      // Check impersonation first (super admin viewing a tenant)
      const impersonating = localStorage.getItem('viewingAsTenant')
      if (impersonating) {
        try { setTenantName(JSON.parse(impersonating).name); return } catch {}
      }
      // Use cached tenant, or fetch and cache if missing
      let tenant = getStoredTenant()
      if (!tenant) tenant = await loadAndStoreTenant(email)
      if (tenant) {
        setTenantName(tenant.name)
        setTenantId(tenant.id)
        if (!tenant.terms_accepted_at) setShowTerms(true)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) load(session.user.email)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) load(session.user.email)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('wm_sidebar_collapsed') === '1') } catch {}
  }, [])

  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem('wm_sidebar_collapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  async function handleAcceptTerms() {
    if (!termsChecked || !tenantId) return
    setTermsAccepting(true)
    await supabase.from('tenants').update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: 'v1.0',
    }).eq('id', tenantId)
    // Refresh cached tenant
    if (userEmail) {
      const updated = await loadAndStoreTenant(userEmail)
      if (updated) setTenantName(updated.name)
    }
    setShowTerms(false)
    setTermsAccepting(false)
  }

  async function handleLogout() {
    localStorage.removeItem('viewingAsTenant')
    clearStoredTenant()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (showTerms) {
    return (
      <div className="min-h-screen bg-carbon flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-line bg-surface p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime/15 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} className="text-lime" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-snow">Antes de continuar</h1>
              <p className="text-xs text-mist">Protección de datos · RGPD</p>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface2 p-4 space-y-3 text-xs text-fog leading-relaxed">
            <p>Al usar Watermelon CRM, tu centro actúa como <strong className="text-snow">responsable del tratamiento</strong> de los datos personales de tus clientes y sus hijos.</p>
            <p>Esto implica que:</p>
            <ul className="space-y-1.5 list-disc list-inside ml-1">
              <li>Debes informar a tus clientes sobre el uso de sus datos.</li>
              <li>Debes obtener su consentimiento antes de registrarlos.</li>
              <li>Debes atender sus solicitudes de acceso, rectificación o borrado.</li>
            </ul>
            <p>Watermelon CRM actúa como encargado del tratamiento y garantiza la seguridad técnica de los datos (cifrado, acceso restringido, copias de seguridad).</p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input type="checkbox" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)} className="sr-only" />
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${termsChecked ? 'bg-lime border-lime' : 'bg-surface2 border-line group-hover:border-line2'}`}>
                {termsChecked && <Check size={12} className="text-ink" strokeWidth={3} />}
              </div>
            </div>
            <p className="text-xs text-fog leading-relaxed">
              Acepto los{' '}
              <a href="/privacidad" target="_blank" className="text-iris underline hover:text-iris/80">Términos y Condiciones</a>
              {' '}y el Contrato de Encargo de Tratamiento de datos, asumiendo la responsabilidad como responsable del tratamiento.
            </p>
          </label>

          <button
            onClick={handleAcceptTerms}
            disabled={!termsChecked || termsAccepting}
            className="w-full rounded-xl border border-lime bg-transparent py-3 text-sm font-semibold text-lime transition hover:bg-lime/10 disabled:opacity-50"
            style={{ boxShadow: 'var(--shadow-lime)' }}
          >
            {termsAccepting ? 'Registrando aceptación...' : 'Acepto y continúo'}
          </button>

          <p className="text-[10px] text-mist text-center">
            Esta aceptación queda registrada con fecha y hora. Puedes consultar la{' '}
            <a href="/privacidad" target="_blank" className="underline">política de privacidad</a>{' '}en cualquier momento.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="lg:flex lg:min-h-screen">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex lg:flex-col lg:shrink-0 border-r border-line bg-surface sticky top-0 h-screen transition-[width] duration-200 ${collapsed ? 'lg:w-16' : 'lg:w-56'}`}>

        {/* Brand + collapse toggle */}
        <div className={`py-5 border-b border-line ${collapsed ? 'px-2' : 'px-5'}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-xl bg-lime flex items-center justify-center shrink-0" style={{ boxShadow: 'var(--shadow-lime)' }}>
              <span className="text-ink font-bold text-sm">W</span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-snow text-sm leading-tight">Watermelon</p>
                <p className="text-[10px] text-mist">CRM</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={toggleCollapsed} aria-label="Contraer menú"
                className="text-mist hover:text-snow transition-colors shrink-0">
                <PanelLeftClose size={16} />
              </button>
            )}
          </div>
          {collapsed && (
            <button onClick={toggleCollapsed} aria-label="Expandir menú"
              className="w-full mt-3 flex items-center justify-center text-mist hover:text-snow transition-colors">
              <PanelLeftOpen size={16} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {[
            { href: '/',           label: 'Inicio',   icon: Home,        badge: 0 },
            { href: '/miembros',   label: 'Miembros', icon: Users,       badge: 0 },
            { href: '/calendario', label: 'Agenda',   icon: CalendarDays,badge: badges.agenda },
            { href: '/panel',      label: 'Panel',    icon: BarChart2,   badge: badges.panel },
          ].map(({ href, label, icon: Icon, badge }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center rounded-xl text-sm font-semibold transition-colors relative ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} ${
                  isActive
                    ? 'bg-lime/15 text-lime'
                    : 'text-fog hover:text-snow hover:bg-surface2'
                }`}
              >
                <Icon size={17} strokeWidth={isActive ? 2.4 : 1.8} className="shrink-0" />
                {!collapsed && label}
                {collapsed
                  ? (badge > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-lime" />)
                  : <Badge count={badge} />}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: establishment name + user + logout */}
        <div className={`py-4 border-t border-line space-y-2 ${collapsed ? 'px-2' : 'px-3'}`}>
          {!collapsed && tenantName && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-surface2">
              <div className="w-6 h-6 rounded-full bg-lime/20 flex items-center justify-center shrink-0">
                <Building2 size={11} className="text-lime" />
              </div>
              <p className="text-xs font-semibold text-snow truncate">{tenantName}</p>
            </div>
          )}
          {!collapsed && userEmail && (
            <div className="flex items-center gap-2 px-2">
              <User size={11} className="text-mist shrink-0" />
              <p className="text-[11px] text-mist truncate">{userEmail}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Cerrar sesión' : undefined}
            className={`w-full flex items-center rounded-xl text-sm font-semibold text-fog hover:text-rose hover:bg-rose/10 transition-colors ${collapsed ? 'justify-center py-2' : 'gap-2 px-3 py-2'}`}
          >
            <LogOut size={14} /> {!collapsed && 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
