'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Users, Repeat, RefreshCw, Clock, Ticket,
  Info, Activity,
} from 'lucide-react'
import { isReliable, MIN_SAMPLE } from '@/lib/metrics'
import { SparkLine, SparkBars } from '@/components/Spark'
import { SectionHeader } from './SectionHeader'

/**
 * Pulso del mes: conducta y ocupación, sin una sola cifra económica.
 *
 * Los ingresos vivían aquí y se han movido a Tendencias. El motivo no es de
 * diseño: el importe del panel sale de sumar lo que se haya registrado en la
 * aplicación, y basta con un cumpleaños cobrado por Bizum sin anotar para que
 * la cifra salga baja. Una cifra de caja equivocada, todos los días y en la
 * primera pantalla, no cae sola: arrastra la credibilidad de todo lo demás.
 *
 * Además compite con el cierre de mes del gestor, que ya lo tiene y lo tiene
 * bien. Lo que sí sabe el CRM con certeza —quién entró y cuándo, quién repite,
 * quién renueva— no lo tiene nadie más. Eso es lo que se muestra.
 */
export type Franja = { dia: string; hora: number; personas: number; pct: number }

export type PulseData = {
  visitas: number
  visitasDeltaMes: number | null
  familias: number
  porVisita: number
  familiasActivas: number
  enRiesgo: number
  /** Hogares con un bono en pie: ocupación ya comprada */
  hogaresConBono: number
  /** `previa` es la misma tasa en los 3 meses anteriores; null si no hay base */
  repeticion: { rate: number; base: number; previa: number | null }
  renovacion: { rate: number; base: number; previa: number | null }
  /** Franja de más ocupación del mes; null si aún no hay muestra */
  punta: Franja | null
  /** La de menos: es la que se puede llenar con una oferta */
  valle: Franja | null
  /**
   * Series de los gráficos. Una cifra sola no dice si el mes es normal; la
   * forma de los últimos meses sí, y cabe debajo del número.
   */
  serie: {
    visitas: number[]
    bonos: number[]
    repeticion: (number | null)[]
    renovacion: (number | null)[]
    activas: number[]
    /** Gente media por hora del día, y cuál es la punta */
    horas: { hora: number; personas: number }[]
  }
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[11px] text-mist">sin base</span>
  const up = value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-mint' : 'text-rose'}`}>
      <Icon size={11} />{Math.abs(value * 100).toFixed(0)}%
    </span>
  )
}

/**
 * Tarjeta con dos caras: delante la cifra, detrás qué significa y de dónde sale.
 *
 * La cara delantera ES un enlace a donde se actúa sobre esa cifra, y la
 * explicación se abre con la ⓘ. Antes toda la tarjeta volteaba y no llevaba a
 * ningún sitio: el dueño leía «12 en riesgo», entendía que había un problema, y
 * tenía que ir a buscar por su cuenta dónde se arreglaba. Esa distancia es la
 * que separa un panel que se mira de uno que se usa.
 *
 * El alto sale de la cara más alta (ver `.flip-inner` en globals.css). Las
 * tarjetas de una misma fila se igualan solas porque la rejilla las estira.
 */
function FlipCard({
  icon: Icon, label, value, sub, foot, accent = 'text-fog', desc, href, accion, grafico,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: React.ReactNode
  foot?: React.ReactNode
  accent?: string
  desc: string
  /** Dónde se actúa sobre esta cifra */
  href: string
  /** Qué se va a encontrar allí; se dice en el dorso */
  accion: string
  /** Miniatura de la evolución; va entre la cifra y el pie */
  grafico?: React.ReactNode
}) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div className="flip-card h-full" data-flipped={flipped}>
      <div className="flip-inner">
        {/* Frente */}
        <div className="flip-face w-full h-full relative" aria-hidden={flipped}>
          <Link
            href={href}
            tabIndex={flipped ? -1 : 0}
            className="group w-full h-full flex flex-col rounded-2xl border border-line bg-surface p-4 text-left hover:border-line2 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Icon size={13} className={accent} />
              <p className="text-[10px] font-semibold text-fog uppercase tracking-wide truncate flex-1">{label}</p>
              {/* Hueco de la ⓘ, que va por encima en su propio botón */}
              <span className="w-[11px] shrink-0" />
            </div>
            <p className="font-display text-2xl font-bold text-snow leading-none tabular-nums">{value}</p>
            {/* Alto mínimo reservado aunque no haya subtítulo: así la cifra y el
                pie quedan a la misma altura en las seis tarjetas. */}
            <div className="mt-1.5 min-h-[18px] flex items-center gap-2 flex-wrap">{sub}</div>
            {/* El gráfico va pegado al pie y con alto fijo: así las seis
                tarjetas siguen alineadas aunque una serie esté vacía. */}
            <div className="mt-2 opacity-80 group-hover:opacity-100 transition-opacity">{grafico}</div>
            <p className="mt-auto pt-1.5 text-[11px] text-mist leading-tight group-hover:text-fog transition-colors">
              {foot}
            </p>
          </Link>

          {/* La ⓘ va aparte del enlace: un botón dentro de un enlace no es HTML
              válido, y además pulsar «explicar» no debería navegar. */}
          <button
            onClick={() => setFlipped(true)}
            tabIndex={flipped ? -1 : 0}
            aria-label={`${label}: ${value}. Ver explicación`}
            className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded text-mist hover:text-snow transition-colors"
          >
            <Info size={11} />
          </button>
        </div>

        {/* Dorso */}
        <button
          onClick={() => setFlipped(false)}
          aria-hidden={!flipped}
          tabIndex={flipped ? 0 : -1}
          aria-label={`${label}. Volver a la cifra`}
          className="flip-face flip-face--back w-full h-full rounded-2xl border border-line2 bg-surface2 p-4 text-left"
        >
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${accent}`}>{label}</p>
          <p className="text-[11px] text-fog leading-snug">{desc}</p>
          <p className="text-[11px] text-mist leading-snug mt-1.5">{accion}</p>
        </button>
      </div>
    </div>
  )
}

/**
 * Base de la tasa. Cuando no llega al mínimo dice CUÁNTO falta en vez de un
 * guion mudo: una tarjeta que lleva tres meses con «—» enseña a ignorar esa
 * esquina de la pantalla.
 */
function Rate({ base }: { base: number }) {
  if (!isReliable(base)) {
    return <span className="text-[11px] text-mist">faltan {MIN_SAMPLE - base} casos</span>
  }
  return <span className="text-[11px] text-fog">sobre {base} casos</span>
}

/** Comparación con su propio historial: sin referencia, un % no decide nada. */
function Referencia({ rate, previa }: { rate: number; previa: number | null }) {
  if (previa == null) return <span className="text-[11px] text-mist">sin histórico</span>
  const dif = (rate - previa) * 100
  const igual = Math.abs(dif) < 1
  return (
    <span className={`text-[11px] font-semibold ${igual ? 'text-fog' : dif > 0 ? 'text-mint' : 'text-rose'}`}>
      {igual ? '=' : dif > 0 ? '+' : '−'}{igual ? '' : Math.abs(dif).toFixed(0)}
      {igual ? '' : ' pts'} vs. su media
    </span>
  )
}

function horas(f: Franja): string {
  return `${f.dia} ${f.hora}h`
}

export function PulseSection({ data }: { data: PulseData }) {
  const d = data
  return (
    <section>
      <SectionHeader
        icon={Activity}
        iconClass="text-lime"
        title="Pulso del mes"
        right={<p className="text-[11px] text-mist">Cada tarjeta lleva a donde se actúa · ⓘ explica qué mide</p>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 items-stretch">
        <FlipCard
          icon={Activity}
          label="Visitas"
          value={String(d.visitas)}
          accent="text-lime"
          href="/panel/tendencias"
          sub={<><span className="text-[11px] text-mist">vs. mes ant.</span><Delta value={d.visitasDeltaMes} /></>}
          foot={<>{d.familias} familias · {d.porVisita.toFixed(1)} personas por visita</>}
          desc="Entradas registradas este mes. Es la cifra más fiable del panel: una visita queda registrada siempre, porque es la que abre la puerta. Se compara con el mismo tramo del mes anterior. Si «personas por visita» sube, los grupos vienen más grandes."
          accion="Lleva a Tendencias, con la serie de los últimos meses."
          grafico={<SparkBars datos={d.serie.visitas} resaltar={d.serie.visitas.length - 1} className="text-lime" />}
        />

        <FlipCard
          icon={Ticket}
          label="Con bono activo"
          value={String(d.hogaresConBono)}
          accent="text-grape"
          href="/panel/campanas/upsell_bono"
          sub={<span className="text-[11px] text-fog">de {d.familiasActivas} activas</span>}
          foot="Ocupación ya comprada"
          desc="Familias con un bono en pie: sesiones sin gastar y sin caducar. Es la parte del mes que no depende de que entre nadie nuevo, así que cuanto más alta, más predecible es la ocupación. Se cuenta por casa: dos padres con bono son un cliente, no dos."
          accion="Lleva a la campaña de bonos, para proponerlo a quien viene sin él."
          grafico={<SparkLine datos={d.serie.bonos} className="text-grape" />}
        />

        <FlipCard
          icon={Repeat}
          label="Repetición 30d"
          value={isReliable(d.repeticion.base) ? `${(d.repeticion.rate * 100).toFixed(0)}%` : '—'}
          accent="text-cyan-300"
          href="/panel/campanas/segunda_visita"
          sub={isReliable(d.repeticion.base)
            ? <Referencia rate={d.repeticion.rate} previa={d.repeticion.previa} />
            : <Rate base={d.repeticion.base} />}
          foot={isReliable(d.repeticion.base) ? `Sobre ${d.repeticion.base} familias nuevas` : 'Familias nuevas que volvieron'}
          desc="De las familias que vinieron por primera vez, cuántas volvieron en los 30 días siguientes. Es el mejor indicador de si la experiencia gusta: si cae, el problema está dentro, no en la captación. Se compara con su propia media de los 3 meses anteriores."
          accion="Lleva a la campaña de segunda visita, que es la que la sube."
          grafico={<SparkLine datos={d.serie.repeticion} className="text-cyan-300" />}
        />

        <FlipCard
          icon={RefreshCw}
          label="Renueva bono"
          value={isReliable(d.renovacion.base) ? `${(d.renovacion.rate * 100).toFixed(0)}%` : '—'}
          accent="text-iris"
          href="/panel/campanas/renovacion_caducada"
          sub={isReliable(d.renovacion.base)
            ? <Referencia rate={d.renovacion.rate} previa={d.renovacion.previa} />
            : <Rate base={d.renovacion.base} />}
          foot={isReliable(d.renovacion.base) ? `Sobre ${d.renovacion.base} bonos agotados` : 'Bonos agotados que se renovaron'}
          desc="De los bonos que se agotaron o caducaron, cuántos titulares contrataron otro en el mes siguiente. Mide la retención de quien ya se comprometió, que es la que sostiene la ocupación de los días flojos."
          accion="Lleva a la campaña de renovación, con los bonos caducados sin reponer."
          grafico={<SparkLine datos={d.serie.renovacion} className="text-iris" />}
        />

        <FlipCard
          icon={Clock}
          label="Punta y valle"
          value={d.punta ? `${d.punta.hora}h` : '—'}
          accent="text-amber"
          href="/panel/campanas/valle"
          sub={d.punta
            ? <span className="text-[11px] text-fog">{horas(d.punta)} · {d.punta.personas.toFixed(0)} personas</span>
            : <span className="text-[11px] text-mist">sin muestra</span>}
          foot={d.valle
            ? <>Más vacío: <span className="text-fog">{horas(d.valle)}</span></>
            : 'Momento de más ocupación'}
          desc="La franja con más gente en sala y la que menos, de media este mes. La punta dice cuándo hace falta más personal. El valle es el que mueve dinero: en la punta ya no cabe nadie, así que lo que se puede ganar está en llenar el hueco."
          accion="Lleva a la campaña de valle, para ofrecer esa franja a quien puede venir."
          grafico={<SparkBars
            datos={d.serie.horas.map(h => h.personas)}
            resaltar={d.punta ? d.serie.horas.findIndex(h => h.hora === d.punta!.hora) : undefined}
          />}
        />

        <FlipCard
          icon={Users}
          label="Familias activas"
          value={String(d.familiasActivas)}
          accent="text-mint"
          href={d.enRiesgo > 0 ? '/panel/campanas/reactivacion' : '/miembros'}
          sub={d.enRiesgo > 0
            ? <span className="text-[11px] font-semibold text-amber">{d.enRiesgo} en riesgo</span>
            : <span className="text-[11px] text-mist">ninguna en riesgo</span>}
          foot="Han venido en los últimos 60 días"
          desc="Familias que han venido en los últimos 60 días. «En riesgo» son las que llevan sin aparecer más del doble de su ritmo habitual: para una que viene cada semana, dos semanas; para una mensual, dos meses."
          grafico={<SparkLine datos={d.serie.activas} className="text-mint" />}
          accion={d.enRiesgo > 0
            ? 'Lleva a la campaña de reactivación, con las que han roto su ritmo.'
            : 'Lleva a la lista de miembros.'}
        />
      </div>

      {(!isReliable(d.repeticion.base) || !isReliable(d.renovacion.base)) && (
        <p className="mt-2 text-[11px] text-mist">
          Los porcentajes calculados sobre menos de {MIN_SAMPLE} casos no se muestran: con tan pocos
          datos oscilan demasiado como para decidir con ellos.
        </p>
      )}
    </section>
  )
}
