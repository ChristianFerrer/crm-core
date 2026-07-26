'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Search, Filter, Download } from 'lucide-react'

/**
 * Barra estándar de las tablas del Panel: búsqueda a la izquierda, botón de
 * filtros (embudo, con desplegable) y botón de exportar a Excel a la derecha.
 */
export function TableFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
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
  onExport: () => void
  exporting?: boolean
  exportDisabled?: boolean
}) {
  const [filterOpen, setFilterOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!filterOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setFilterOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [filterOpen])

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-10 pr-4 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors"
        />
      </div>

      {showFilter && (
        <div className="relative shrink-0" ref={popoverRef}>
          <button
            onClick={() => setFilterOpen(o => !o)}
            title="Filtros"
            aria-label="Filtros"
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${
              activeFilterCount > 0 || filterOpen
                ? 'border-lime bg-lime/10 text-lime'
                : 'border-line bg-surface2 text-fog hover:text-snow'
            }`}
          >
            <Filter size={16} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-rose text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {filterOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 z-50 mt-2 w-72 max-w-[85vw] rounded-2xl border border-line2 bg-surface shadow-2xl p-4 space-y-4">
                {filters}
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={onExport}
        disabled={exporting || exportDisabled}
        title="Exportar a Excel"
        aria-label="Exportar a Excel"
        className="flex items-center justify-center w-10 h-10 rounded-xl border border-lime bg-lime/10 text-lime hover:bg-lime/20 transition-colors disabled:opacity-50 shrink-0"
      >
        <Download size={16} />
      </button>
    </div>
  )
}
