/**
 * Gráficos diminutos para el pulso del mes.
 *
 * SVG a mano y sin librería: son treinta líneas y evitan meter Recharts —con su
 * ResponsiveContainer y su medida en dos pasadas— en seis tarjetas que se
 * pintan en la primera pantalla.
 *
 * Reglas comunes:
 * - `preserveAspectRatio="none"`: el dibujo se estira al ancho de la tarjeta.
 *   Por eso el grosor del trazo va en `vector-effect: non-scaling-stroke`, o
 *   saldría aplastado en horizontal.
 * - Sin ejes ni rótulos. La cifra grande ya está encima; esto solo aporta la
 *   FORMA, que es lo que dice si el mes es normal o raro.
 * - El último punto se marca: es el que corresponde a la cifra de la tarjeta.
 */

const ALTO = 28

/** Serie continua. Los `null` (meses sin muestra) parten la línea. */
export function SparkLine({
  datos, className = 'text-lime',
}: {
  datos: (number | null)[]
  className?: string
}) {
  const validos = datos.filter((d): d is number => d != null)
  if (validos.length < 2) return <div className="h-[28px]" />

  const max = Math.max(...validos)
  const min = Math.min(...validos)
  const rango = max - min || 1
  const paso = 100 / (datos.length - 1)
  const y = (v: number) => ALTO - 2 - ((v - min) / rango) * (ALTO - 4)

  // Cada tramo sin cortes es su propia polilínea: unir a través de un hueco
  // dibujaría una tendencia que no se ha medido.
  const tramos: string[] = []
  let actual: string[] = []
  datos.forEach((v, i) => {
    if (v == null) {
      if (actual.length > 1) tramos.push(actual.join(' '))
      actual = []
      return
    }
    actual.push(`${(i * paso).toFixed(1)},${y(v).toFixed(1)}`)
  })
  if (actual.length > 1) tramos.push(actual.join(' '))

  const ultimo = datos[datos.length - 1]

  return (
    <svg
      viewBox={`0 0 100 ${ALTO}`}
      preserveAspectRatio="none"
      className={`w-full h-[28px] ${className}`}
      aria-hidden="true"
    >
      {tramos.map((puntos, i) => (
        <polyline
          key={i}
          points={puntos}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {ultimo != null && (
        <circle cx="100" cy={y(ultimo)} r="2" fill="currentColor" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  )
}

/**
 * Barras. Se usa donde el eje es una categoría y no el tiempo —las horas del
 * día—, y donde importa comparar alturas más que ver una pendiente.
 */
export function SparkBars({
  datos, resaltar, className = 'text-amber', apagado = 'text-line2',
}: {
  datos: number[]
  /** Índice a destacar: la franja punta, o la última semana */
  resaltar?: number
  className?: string
  apagado?: string
}) {
  if (datos.length === 0) return <div className="h-[28px]" />
  const max = Math.max(...datos) || 1
  const ancho = 100 / datos.length

  return (
    <svg
      viewBox={`0 0 100 ${ALTO}`}
      preserveAspectRatio="none"
      className="w-full h-[28px]"
      aria-hidden="true"
    >
      {datos.map((v, i) => {
        const h = Math.max(1, (v / max) * (ALTO - 2))
        return (
          <rect
            key={i}
            x={i * ancho + ancho * 0.15}
            y={ALTO - h}
            width={ancho * 0.7}
            height={h}
            rx="0.6"
            className={i === resaltar ? className : apagado}
            fill="currentColor"
          />
        )
      })}
    </svg>
  )
}
