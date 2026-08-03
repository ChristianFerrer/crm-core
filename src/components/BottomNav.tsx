'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Home, Users, BarChart2, CalendarDays, MoreHorizontal, Settings, Tag, ShoppingBag } from 'lucide-react'
import { useNavBadges } from '@/lib/useNavBadges'
import { useLanguage } from '@/lib/i18n'

function Badge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="absolute -top-0.5 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-lime text-white text-xs font-bold flex items-center justify-center leading-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const badges = useNavBadges()
  const { t } = useLanguage()
  const [moreOpen, setMoreOpen] = useState(false)

  // Cierra el submenú al navegar
  useEffect(() => { setMoreOpen(false) }, [pathname])

  const navItems = [
    { href: '/',          label: t('nav_inicio'),   icon: Home,       badge: 0 },
    { href: '/miembros',  label: t('nav_miembros'), icon: Users,      badge: 0 },
    { href: '/calendario',label: t('nav_agenda'),   icon: CalendarDays, badge: badges.agenda },
    { href: '/panel',     label: t('nav_panel'),    icon: BarChart2,  badge: badges.panel },
  ]

  // Secciones secundarias — viven dentro de «Más».
  const moreItems = [
    { href: '/panel/servicios',    label: t('shared_nav_servicios'),    icon: Tag,         accent: 'text-lime', activeBorder: 'border-lime' },
    { href: '/panel/tienda',       label: t('shared_nav_tienda'),       icon: ShoppingBag, accent: 'text-iris', activeBorder: 'border-iris' },
    { href: '/panel/configuracion',label: t('shared_nav_configuracion'),icon: Settings,    accent: 'text-mint', activeBorder: 'border-mint' },
  ]

  const moreActive = moreItems.some(i => pathname.startsWith(i.href))

  return (
    <>
      {/* Bottom sheet «Más» */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-x border-line bg-surface pb-[76px] animate-[slideUp_.18s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-line2 mt-3 mb-4" />
            <div className="grid grid-cols-3 gap-3 px-5 pb-5">
              {moreItems.map(({ href, label, icon: Icon, accent, activeBorder }) => {
                const isActive = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`h-[88px] rounded-2xl border bg-surface px-2 py-3 flex flex-col items-center justify-center transition-colors ${
                      isActive ? activeBorder : 'border-line hover:border-line2'
                    }`}
                  >
                    <Icon size={26} strokeWidth={1.8} className={`${accent} shrink-0`} />
                    <span className={`h-8 mt-[5px] flex items-start justify-center text-center text-xs leading-tight ${isActive ? `${accent} font-semibold` : 'text-fog'}`}>
                      {label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-[70] border-t border-line bg-carbon/90 backdrop-blur-md lg:hidden">
        <div className="flex">
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const isActive = href === '/'
              ? pathname === '/'
              : href === '/panel'
                ? pathname === '/panel'
                : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-xs font-semibold transition-colors relative ${
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

          {/* Más */}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-xs font-semibold transition-colors relative ${
              moreOpen || moreActive ? 'text-lime' : 'text-mist hover:text-fog'
            }`}
          >
            <span className="relative">
              <MoreHorizontal className="w-5 h-5" strokeWidth={moreOpen || moreActive ? 2.4 : 1.8} />
            </span>
            {t('shared_nav_mas')}
          </button>
        </div>
      </nav>
    </>
  )
}

export default BottomNav
