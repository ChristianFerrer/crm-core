'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Users, LogIn, BarChart2, CalendarDays, LogOut, User, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/miembros', label: 'Miembros', icon: Users },
  { href: '/checkin', label: 'Visitas', icon: LogIn },
  { href: '/calendario', label: 'Agenda', icon: CalendarDays },
  { href: '/panel', label: 'Panel', icon: BarChart2 },
]

async function resolveTenantName(userEmail: string): Promise<string | null> {
  // Super admin impersonating
  const stored = localStorage.getItem('viewingAsTenant')
  if (stored) {
    try { return JSON.parse(stored).name } catch {}
  }
  // Establishment admin: look up their tenant
  const { data } = await supabase
    .from('tenants')
    .select('name')
    .eq('admin_email', userEmail)
    .single()
  return data?.name ?? null
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const email = session?.user?.email ?? null
      setUserEmail(email)
      if (email) {
        const name = await resolveTenantName(email)
        setTenantName(name)
      }
    })
  }, [pathname])

  async function handleLogout() {
    localStorage.removeItem('viewingAsTenant')
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
          {navItems.map(({ href, label, icon: Icon }) => {
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

      {/* Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
