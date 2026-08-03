'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Search, Filter, Download } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'

/**
 * Barra estándar de las tablas del Panel: búsqueda a la izquierda, botón de
 * filtros (embudo, con desplegable) y botón de exportar a Excel a la derecha.
 */
export function TableFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  showFilter = true,
  activeFilterCount = 0,
  onExport,
  exporting = false,
  exportDisabled = false,
}: {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  /** Contenido del desplegable de filtros (selects, pills, etc.) */
  filters?: ReactNode
  /** Oculta el botón de embudo cuando esta vista no tiene filtros que ofrecer */
  showFilter?: boolean
  /** Nº de filtros activos, para el indicador sobre el botón de embudo */
  activeFilterCount?: number
  /** Si se omite, no se muestra el botón de exportar */
  onExport?: () => void
  exporting?: boolean
  exportDisabled?: boolean
}) {
  const { t } = useLanguage()
  const [filterOpen, setFilterOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // El popover se monta vía portal en <body> con position:fixed, calculado a
  // partir del botón — así nunca lo recorta un contenedor con overflow-hidden
  // (p.ej. la tarjeta de "En sala ahora"), sin importar dónde viva la barra.
  function openFilters() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    setFilterOpen(o => !o)
  }

  useEffect(() => {
    if (!filterOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setFilterOpen(false) }
    function onReflow() { setFilterOpen(false) }
    function onScroll(e: Event) {
      // Ignora el scroll interno del propio popover (su lista de filtros puede ser larga)
      if (popoverRef.current && e.target instanceof Node && popoverRef.current.contains(e.target)) return
      setFilterOpen(false)
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [filterOpen])

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder ?? t('accion_buscar')}
          className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-10 pr-4 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors"
        />
      </div>

      {showFilter && (
        <div className="relative shrink-0">
          <button
            ref={btnRef}
            onClick={openFilters}
            title={t('accion_filtros')}
            aria-label={t('accion_filtros')}
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${
              activeFilterCount > 0 || filterOpen
                ? 'border-lime bg-lime/10 text-lime'
                : 'border-line bg-surface2 text-fog hover:text-snow'
            }`}
          >
            <Filter size={16} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-rose border-2 border-surface text-white text-xs font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {filterOpen && pos && typeof document !== 'undefined' && createPortal(
            <>
              <div className="fixed inset-0 z-[90]" onClick={() => setFilterOpen(false)} />
              <div
                ref={popoverRef}
                className="fixed z-[91] w-72 max-w-[85vw] max-h-[min(70vh,420px)] overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl p-4 space-y-4"
                style={{ top: pos.top, right: pos.right }}
              >
                {filters}
              </div>
            </>,
            document.body
          )}
        </div>
      )}

      {onExport && (
        <button
          onClick={onExport}
          disabled={exporting || exportDisabled}
          title={t('accion_exportar')}
          aria-label={t('accion_exportar')}
          className="flex items-center justify-center w-10 h-10 rounded-xl border border-lime bg-lime/10 text-lime hover:bg-lime/20 transition-colors disabled:opacity-50 shrink-0"
        >
          <Download size={16} />
        </button>
      )}
    </div>
  )
}
