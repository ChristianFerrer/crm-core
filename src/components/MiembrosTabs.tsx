'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Users, History } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

export function MiembrosTabs({ active }: { active: 'miembros' | 'familias' | 'historico' }) {
  const { t } = useLanguage()
  const router = useRouter()

  function goTo(v: 'miembros' | 'familias') {
    router.push(v === 'familias' ? '/miembros?view=familias' : '/miembros')
  }

  const cls = (isActive: boolean) =>
    `flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
      isActive ? 'border border-lime bg-lime/10 text-lime' : 'border border-transparent text-fog hover:text-snow'
    }`

  return (
    <div className="flex lg:inline-flex gap-1 bg-surface rounded-xl p-1 border border-line shrink-0">
      <button onClick={() => goTo('miembros')} className={cls(active === 'miembros')}>
        <User size={14} /> {t('miembros_tab_miembros')}
      </button>
      <button onClick={() => goTo('familias')} className={cls(active === 'familias')}>
        <Users size={14} /> {t('miembros_tab_familias')}
      </button>
      <Link href="/miembros/historico" className={cls(active === 'historico')}>
        <History size={14} /> {t('shared_nav_historico_visitas')}
      </Link>
    </div>
  )
}
