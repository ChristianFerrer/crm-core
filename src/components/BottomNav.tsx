'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, BarChart2, CalendarDays } from 'lucide-react'
import { useNavBadges } from '@/lib/useNavBadges'
import { useLanguage } from '@/lib/i18n'

function Badge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="absolute -top-0.5 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-lime text-ink text-[9px] font-bold flex items-center justify-center leading-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const badges = useNavBadges()
  const { t } = useLanguage()

  const navItems = [
    { href: '/',          label: t('nav_inicio'),   icon: Home,       badge: 0 },
    { href: '/miembros',  label: t('nav_miembros'), icon: Users,      badge: 0 },
    { href: '/calendario',label: t('nav_agenda'),   icon: CalendarDays, badge: badges.agenda },
    { href: '/panel',     label: t('nav_panel'),    icon: BarChart2,  badge: badges.panel },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-carbon/90 backdrop-blur-md lg:hidden">
      <div className="flex">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-[10px] font-semibold transition-colors relative ${
                isActive ? 'text-lime' : 'text-mist hover:text-fog'
              }`}
            >
              <span className="relative">
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
                <Badge count={badge} />
              </span>
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
