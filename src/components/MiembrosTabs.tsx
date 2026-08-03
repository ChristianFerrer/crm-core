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
    `flex-1 min-w-[104px] flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-semibold transition-colors ${
      isActive
        ? 'border-lime bg-lime/10 text-lime'
        : 'border-line bg-surface text-fog hover:text-snow hover:border-line2'
    }`

  return (
    <div className="flex gap-2 shrink-0 overflow-x-auto scrollbar-hide">
      <button onClick={() => goTo('miembros')} className={cls(active === 'miembros')}>
        <User size={18} strokeWidth={1.8} />
        <span className="whitespace-nowrap">{t('miembros_tab_miembros')}</span>
      </button>
      <button onClick={() => goTo('familias')} className={cls(active === 'familias')}>
        <Users size={18} strokeWidth={1.8} />
        <span className="whitespace-nowrap">{t('miembros_tab_familias')}</span>
      </button>
      <Link href="/miembros/historico" className={cls(active === 'historico')}>
        <History size={18} strokeWidth={1.8} />
        <span className="whitespace-nowrap">{t('shared_nav_historico_visitas')}</span>
      </Link>
    </div>
  )
}
