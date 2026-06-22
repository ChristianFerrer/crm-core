'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Users, LogIn, BarChart2, CalendarDays, LogOut, User, Building2, ChevronDown } from 'lucide-react'
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
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
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
      if (tenant) setTenantName(tenant.name)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) load(session.user.email)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) load(session.user.email)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    localStorage.removeItem('viewingAsTenant')
    clearStoredTenant()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="lg:flex lg:min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:shrink-0 border-r border-line bg-surface sticky top-0 h-screen">

        {/* Brand — always Watermelon */}
        <div className="px-5 py-5 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-lime flex items-center justify-center shrink-0" style={{ boxShadow: 'var(--shadow-lime)' }}>
              <span className="text-ink font-bold text-sm">W</span>
            </div>
            <div>
              <p className="font-display font-semibold text-snow text-sm leading-tight">Watermelon</p>
              <p className="text-[10px] text-mist">CRM</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { href: '/',           label: 'Inicio',   icon: Home,        badge: 0 },
            { href: '/miembros',   label: 'Miembros', icon: Users,       badge: 0 },
            { href: '/checkin',    label: 'Visitas',  icon: LogIn,       badge: badges.visitas },
            { href: '/calendario', label: 'Agenda',   icon: CalendarDays,badge: badges.agenda },
            { href: '/panel',      label: 'Panel',    icon: BarChart2,   badge: badges.panel },
          ].map(({ href, label, icon: Icon, badge }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-lime/15 text-lime'
                    : 'text-fog hover:text-snow hover:bg-surface2'
                }`}
              >
                <Icon size={17} strokeWidth={isActive ? 2.4 : 1.8} />
                {label}
                <Badge count={badge} />
              </Link>
            )
          })}
        </nav>

        {/* Bottom: establishment name + user + logout */}
        <div className="px-3 py-4 border-t border-line space-y-2">
          {tenantName && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-surface2">
              <div className="w-6 h-6 rounded-full bg-lime/20 flex items-center justify-center shrink-0">
                <Building2 size={11} className="text-lime" />
              </div>
              <p className="text-xs font-semibold text-snow truncate">{tenantName}</p>
            </div>
          )}
          {userEmail && (
            <div className="flex items-center gap-2 px-2">
              <User size={11} className="text-mist shrink-0" />
              <p className="text-[11px] text-mist truncate">{userEmail}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-fog hover:text-rose hover:bg-rose/10 transition-colors"
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-line px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Brand + tenant */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-lime flex items-center justify-center shrink-0">
              <span className="text-ink font-bold text-xs">W</span>
            </div>
            <div>
              <p className="text-xs font-bold text-snow leading-tight">{tenantName ?? 'Watermelon'}</p>
              <p className="text-[10px] text-mist leading-tight">CRM</p>
            </div>
          </div>
          {/* User menu toggle */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface2 border border-line"
          >
            <div className="w-5 h-5 rounded-full bg-iris/20 flex items-center justify-center">
              <User size={11} className="text-iris" />
            </div>
            <ChevronDown size={12} className={`text-fog transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dropdown user menu */}
        {menuOpen && (
          <div className="absolute top-full left-0 right-0 bg-surface border-b border-line px-4 py-3 space-y-2 shadow-lg">
            {userEmail && (
              <div className="flex items-center gap-2 py-1">
                <User size={12} className="text-mist shrink-0" />
                <p className="text-xs text-fog truncate">{userEmail}</p>
              </div>
            )}
            <button
              onClick={() => { setMenuOpen(false); handleLogout() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-fog hover:text-rose hover:bg-rose/10 transition-colors border border-line"
            >
              <LogOut size={14} /> Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
