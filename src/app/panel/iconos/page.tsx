'use client'

import { useMemo, useState } from 'react'
import * as Lucide from 'lucide-react'
import { Search, Check, Copy } from 'lucide-react'

type IconEntry = { name: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }

/**
 * Catálogo de iconos disponibles (lucide-react). Es una herramienta interna:
 * sirve para elegir un icono por nombre y usarlo en cualquier pantalla.
 *
 * lucide-react exporta además alias (`XIcon`, `LucideX`) y utilidades que no
 * son iconos; se filtran para que la lista no tenga duplicados.
 */
const ICONS: IconEntry[] = Object.entries(Lucide)
  .filter(([name, value]) =>
    /^[A-Z][A-Za-z0-9]*$/.test(name) &&
    !name.endsWith('Icon') &&
    !name.startsWith('Lucide') &&
    (typeof value === 'object' || typeof value === 'function')
  )
  .map(([name, Icon]) => ({ name, Icon: Icon as IconEntry['Icon'] }))
  .sort((a, b) => a.name.localeCompare(b.name))

const PAGE_SIZE = 240

/** "ShoppingBag" -> "shopping bag" para poder buscar en minúsculas y por palabras. */
function searchable(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
}

export default function IconosPage() {
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [copied, setCopied] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ICONS
    return ICONS.filter(i => searchable(i.name).includes(q) || i.name.toLowerCase().includes(q))
  }, [query])

  const shown = filtered.slice(0, visible)

  async function copy(name: string) {
    try { await navigator.clipboard.writeText(name) } catch {}
    setCopied(name)
    setTimeout(() => setCopied(c => (c === name ? null : c)), 1200)
  }

  return (
    <div className="flex flex-col gap-4 pb-safe-nav">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">Catálogo de iconos</h1>
        <p className="text-sm text-fog mt-0.5">
          {filtered.length} iconos disponibles. Toca uno para copiar su nombre y dímelo para usarlo.
        </p>
      </div>

      <div className="relative shrink-0">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setVisible(PAGE_SIZE) }}
          placeholder="Buscar icono (en inglés): calendar, user, bag…"
          className="w-full bg-surface2 border border-line rounded-xl pl-9 pr-4 py-2.5 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors"
        />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {shown.map(({ name, Icon }) => (
          <button
            key={name}
            onClick={() => copy(name)}
            title={`Copiar «${name}»`}
            className="group relative flex flex-col items-center justify-center gap-2 h-24 rounded-xl border border-line bg-surface px-1 hover:border-line2 transition-colors"
          >
            <Icon size={24} strokeWidth={1.8} className="text-snow shrink-0" />
            <span className="w-full px-1 text-[10px] leading-tight text-fog break-words text-center">{name}</span>
            <span className="absolute top-1.5 right-1.5 text-mist opacity-0 group-hover:opacity-100 transition-opacity">
              {copied === name ? <Check size={12} className="text-lime" /> : <Copy size={12} />}
            </span>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="text-sm text-fog text-center py-10">Ningún icono coincide con «{query}».</p>
      )}

      {visible < filtered.length && (
        <button
          onClick={() => setVisible(v => v + PAGE_SIZE)}
          className="mx-auto rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fog hover:text-snow transition-colors"
        >
          Mostrar más ({filtered.length - visible} restantes)
        </button>
      )}
    </div>
  )
}
