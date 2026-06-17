'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Users, LogIn, BarChart2, CalendarDays, LogOut } from 'lucide-react'
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

  useEffect(() => {
    const stored = localStorage.getItem('viewingAsTenant')
    if (stored) {
      try { setTenantName(JSON.parse(stored).name) } catch {}
    }
  }, [pathname])

  async function handleLogout() {
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
        <div className="px-5 py-4 border-t border-line">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-mist">v0.1</p>
            <button onClick={handleLogout} className="flex items-center gap-1 text-[10px] text-mist hover:text-rose transition-colors">
              <LogOut size={11} /> Salir
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
