'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { User, Users, History } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage, type TranslationKey } from '@/lib/i18n'

type Tab = 'miembros' | 'familias' | 'historico'

/**
 * Cifras que acompañan a cada pestaña.
 *
 * Los tiles ocupaban 68 px de alto para no decir más que su nombre, y el nombre
 * ya está en el menú. Con el recuento y una segunda línea, el espacio pasa a
 * responder lo que uno se pregunta antes de entrar: cuántos hay y cuántos están
 * en condiciones de venir.
 */
type Cifras = {
  miembros: number
  conBono: number
  ninos: number
  familias: number
  /**
   * Miembros que pertenecen a alguna familia. Es distinto del total: una
   * familia agrupa a los adultos de una misma casa, y la mayoría de altas no
   * están agrupadas. Dividir el total entre las familias daba disparates —
   * 117 miembros entre 8 familias, «14,6 adultos por familia».
   */
  agrupados: number
  visitasMes: number
  visitasHoy: number
}

const TILES: {
  id: Tab
  href: string
  labelKey: TranslationKey
  icon: typeof User
  accent: string
  activeBorder: string
}[] = [
  { id: 'miembros',  href: '/miembros',               labelKey: 'miembros_tab_miembros',        icon: User,    accent: 'text-lime', activeBorder: 'border-lime' },
  { id: 'familias',  href: '/miembros?view=familias', labelKey: 'miembros_tab_familias',        icon: Users,   accent: 'text-iris', activeBorder: 'border-iris' },
  { id: 'historico', href: '/miembros/historico',     labelKey: 'shared_nav_historico_visitas', icon: History, accent: 'text-mint', activeBorder: 'border-mint' },
]

/** Un bono sirve si le quedan sesiones y no ha caducado. */
function bonoVigente(m: { sessions_remaining: number | null; expires_at: string | null }, hoy: string) {
  const quedan = m.sessions_remaining == null || m.sessions_remaining > 0
  const enFecha = !m.expires_at || m.expires_at >= hoy
  return quedan && enFecha
}

export function MiembrosTabs({ active }: { active: Tab }) {
  const { t } = useLanguage()
  const router = useRouter()
  const [c, setC] = useState<Cifras | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ahora = new Date()
      const hoy = ahora.toISOString().split('T')[0]
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
      const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).toISOString()

      const [miembros, familias, bonos, visitasMes, visitasHoy] = await Promise.all([
        supabase.from('members').select('children_count, family_id').is('deleted_at', null),
        supabase.from('families').select('id', { count: 'exact', head: true }),
        supabase.from('memberships').select('member_id, sessions_remaining, expires_at'),
        supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', inicioMes),
        supabase.from('visits').select('id', { count: 'exact', head: true }).gte('checked_in_at', inicioDia),
      ])
      if (cancelled) return

      const filas = (miembros.data ?? []) as { children_count: number | null; family_id: string | null }[]
      // Una familia puede tener varios bonos; cuenta la persona, no el bono
      const conBono = new Set(
        ((bonos.data ?? []) as any[]).filter(b => bonoVigente(b, hoy)).map(b => b.member_id)
      ).size

      setC({
        miembros: filas.length,
        conBono,
        familias: familias.count ?? 0,
        agrupados: filas.filter(m => m.family_id).length,
        ninos: filas.reduce((s, m) => s + (m.children_count ?? 0), 0),
        visitasMes: visitasMes.count ?? 0,
        visitasHoy: visitasHoy.count ?? 0,
      })
    })()
    return () => { cancelled = true }
  }, [])

  function contenido(id: Tab): { cifra: string; detalle: string } {
    if (!c) return { cifra: '—', detalle: '' }
    switch (id) {
      case 'miembros':
        return {
          cifra: String(c.miembros),
          detalle: c.miembros > 0
            ? `${c.ninos} niño${c.ninos === 1 ? '' : 's'} · ${c.conBono} con bono · ${c.miembros - c.conBono} sin bono`
            : 'Aún no hay nadie dado de alta',
        }
      case 'familias': {
        // La media se calcula sobre los miembros AGRUPADOS, no sobre el total
        const media = c.familias > 0 ? c.agrupados / c.familias : 0
        return {
          cifra: String(c.familias),
          detalle: c.familias === 0
            ? 'Ninguna familia agrupada todavía'
            : `${c.agrupados} miembro${c.agrupados === 1 ? '' : 's'} agrupado${c.agrupados === 1 ? '' : 's'} · ${media.toFixed(1)} por familia`,
        }
      }
      case 'historico':
        return {
          cifra: String(c.visitasMes),
          detalle: c.visitasHoy > 0
            ? `visitas este mes · ${c.visitasHoy} hoy`
            : 'visitas este mes · ninguna hoy todavía',
        }
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2 shrink-0">
      {TILES.map(tile => {
        const Icon = tile.icon
        const isActive = tile.id === active
        const { cifra, detalle } = contenido(tile.id)

        const cls = `rounded-xl border bg-surface px-2 lg:px-4 py-2.5 transition-colors text-center lg:text-left ${
          isActive ? tile.activeBorder : 'border-line hover:border-line2'
        }`

        const inner = (
          <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3">
            <Icon size={20} strokeWidth={1.8} className={`${tile.accent} shrink-0 mx-auto lg:mx-0`} />
            <div className="min-w-0 lg:flex-1">
              <p className={`text-[10px] leading-tight truncate ${isActive ? `${tile.accent} font-semibold` : 'text-fog'}`}>
                {t(tile.labelKey)}
              </p>
              {/* La cifra en móvil va debajo del rótulo; en escritorio, al lado
                  del detalle, que es donde hay sitio para explicarla. */}
              <p className="flex items-baseline justify-center lg:justify-start gap-2 mt-0.5">
                <span className="font-display text-lg lg:text-xl font-bold text-snow leading-none tabular-nums">
                  {cifra}
                </span>
                <span className="hidden lg:block text-[11px] text-mist truncate">{detalle}</span>
              </p>
            </div>
          </div>
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
