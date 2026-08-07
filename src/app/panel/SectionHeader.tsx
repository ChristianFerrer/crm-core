'use client'

/**
 * Cabecera común de las secciones del resumen.
 *
 * Antes cada sección resolvía su título a su manera: una con icono, otra sin
 * él, y la explicación a veces a la derecha y a veces debajo. Con tres bloques
 * que se leen seguidos, esa irregularidad se nota — y además el rótulo solo no
 * dice qué mide la sección, que es lo que hace falta la primera vez que se
 * entra.
 */
export function SectionHeader({
  icon: Icon, iconClass = 'text-fog', title, subtitle, right,
}: {
  icon: React.ElementType
  /** Color del icono: cada sección lleva el suyo para distinguirlas de un vistazo */
  iconClass?: string
  title: string
  subtitle: string
  /** Contenido opcional a la derecha (cifra de contexto, conmutador de vista…) */
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-2.5">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="mt-px shrink-0">
          <Icon size={16} className={iconClass} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide leading-tight">
            {title}
          </p>
          <p className="text-[11px] text-mist leading-snug mt-0.5">{subtitle}</p>
        </div>
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </div>
  )
}
