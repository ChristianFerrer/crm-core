'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Users, History } from 'lucide-react'
import { useLanguage, type TranslationKey } from '@/lib/i18n'

type Tab = 'miembros' | 'familias' | 'historico'

// Cada tile lleva su acento propio, como las tarjetas del Panel.
const TILES: { id: Tab; href: string; labelKey: TranslationKey; icon: typeof User; accent: string; activeBorder: string }[] = [
  { id: 'miembros',  href: '/miembros',                  labelKey: 'miembros_tab_miembros',      icon: User,    accent: 'text-lime', activeBorder: 'border-lime' },
  { id: 'familias',  href: '/miembros?view=familias',    labelKey: 'miembros_tab_familias',      icon: Users,   accent: 'text-iris', activeBorder: 'border-iris' },
  { id: 'historico', href: '/miembros/historico',        labelKey: 'shared_nav_historico_visitas', icon: History, accent: 'text-mint', activeBorder: 'border-mint' },
]

export function MiembrosTabs({ active }: { active: Tab }) {
  const { t } = useLanguage()
  const router = useRouter()

  return (
    <div className="grid grid-cols-3 gap-2 shrink-0">
      {TILES.map(tile => {
        const Icon = tile.icon
        const isActive = tile.id === active
        const cls = `h-[88px] rounded-2xl border bg-surface px-2 py-3 flex flex-col items-center justify-center transition-colors ${
          isActive ? `${tile.activeBorder}` : 'border-line hover:border-line2'
        }`
        const inner = (
          <>
            <Icon size={26} strokeWidth={1.8} className={`${tile.accent} shrink-0`} />
            <span className={`h-8 mt-[5px] flex items-start justify-center text-center text-[11px] leading-tight ${isActive ? `${tile.accent} font-semibold` : 'text-fog'}`}>
              {t(tile.labelKey)}
            </span>
          </>
        )

        // Miembros y Familias comparten ruta (query param), así que navegan por router
        return tile.id === 'historico' ? (
          <Link key={tile.id} href={tile.href} className={cls}>{inner}</Link>
        ) : (
          <button key={tile.id} onClick={() => router.push(tile.href)} className={cls}>{inner}</button>
        )
      })}
    </div>
  )
}
