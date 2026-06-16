'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, LogIn, BarChart2 } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/miembros', label: 'Miembros', icon: Users },
  { href: '/checkin', label: 'Check-in', icon: LogIn },
  { href: '/panel', label: 'Panel', icon: BarChart2 },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-carbon/90 backdrop-blur-md lg:hidden">
      <div className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-lime' : 'text-mist hover:text-fog'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
