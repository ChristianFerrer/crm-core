'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Users, LogIn, BarChart2, CalendarDays, LogOut, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/miembros', label: 'Miembros', icon: Users },
  { href: '/checkin', label: 'Visitas', icon: LogIn },
  { href: '/calendario', label: 'Agenda', icon: CalendarDays },
  { href: '/panel', label: 'Panel', icon: BarChart2 },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('viewingAsTenant')
    if (stored) {
      try { setTenantName(JSON.parse(stored).name) } catch {}
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null)
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
        <div className="px-5 py-6 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-lime flex items-center justify-center shrink-0" style={{ boxShadow: 'var(--shadow-lime)' }}>
              <span className="text-ink font-bold text-sm">B</span>
            </div>
            <div>
              <p className="font-display font-semibold text-snow text-sm leading-tight">
                {tenantName ?? 'El Bosc Màgic'}
              </p>
              <p className="text-[10px] text-mist">CRM Ludoteca</p>
            </div>
          </div>
        </div>

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

        {/* User + logout */}
        <div className="px-3 py-4 border-t border-line space-y-2">
          {userEmail && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-surface2">
              <div className="w-6 h-6 rounded-full bg-iris/20 flex items-center justify-center shrink-0">
                <User size={12} className="text-iris" />
              </div>
              <p className="text-[11px] text-fog truncate">{userEmail}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-fog hover:text-rose hover:bg-rose/10 transition-colors"
          >
            <LogOut size={15} /> Cerrar sesión
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
