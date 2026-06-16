'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, LogIn } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/familias', label: 'Familias', icon: Users },
  { href: '/checkin', label: 'Check-in', icon: LogIn },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-xs font-medium transition-colors ${
              isActive ? 'text-violet-600' : 'text-gray-500 hover:text-violet-500'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-violet-600' : 'text-gray-400'}`} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export default BottomNav
