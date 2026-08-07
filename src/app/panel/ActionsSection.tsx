'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Zap, ChevronRight, Cake, AlertTriangle, RefreshCw, Ticket, HeartPulse,
  CalendarClock, Repeat, Megaphone, LayoutGrid, List, ListChecks,
} from 'lucide-react'
import type { ActionSuggestion, QueueItem } from '@/lib/campaigns'
import type { SendState } from '@/lib/campaign-sends'
import { CampaignQueue } from './CampaignQueue'
import { formatEur } from '@/lib/metrics'

const ACCENT: Record<string, { text: string; border: string; bg: string; barra: string }> = {
  lime:       { text: 'text-lime',      border: 'border-lime/40',      bg: 'bg-lime/10',      barra: 'bg-lime' },
  mint:       { text: 'text-mint',      border: 'border-mint/40',      bg: 'bg-mint/10',      barra: 'bg-mint' },
  'cyan-300': { text: 'text-cyan-300',  border: 'border-cyan-300/40',  bg: 'bg-cyan-300/10',  barra: 'bg-cyan-300' },
  amber:      { text: 'text-amber',     border: 'border-amber/40',     bg: 'bg-amber/10',     barra: 'bg-amber' },
  rose:       { text: 'text-rose',      border: 'border-rose/40',      bg: 'bg-rose/10',      barra: 'bg-rose' },
  iris:       { text: 'text-iris',      border: 'border-iris/40',      bg: 'bg-iris/10',      barra: 'bg-iris' },
  grape:      { text: 'text-grape',     border: 'border-grape/40',     bg: 'bg-grape/10',     barra: 'bg-grape' },
}

/** El dominio guarda el nombre del icono; aquí se resuelve al componente. */
export const ICONOS: Record<string, React.ElementType> = {
  Cake, AlertTriangle, RefreshCw, Ticket, HeartPulse, CalendarClock, Repeat,
}

type Vista = 'tarjetas' | 'tabla' | 'cola'
const CLAVE_VISTA = 'wm_campanas_vista'

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

function iconoDe(nombre: string): React.ElementType {
  return ICONOS[nombre] ?? Megaphone
}

/**
 * Campañas de esta semana, ordenadas por euros en juego.
 *
 * Están las siete siempre, también las que no tienen a nadie. Una campaña que
 * desaparece se lee como «esto ya no existe» y no como «hoy no toca», y el cero
 * es información: dice que el criterio se ha revisado y está limpio.
 *
 * En móvil se apilan a lo ancho, que es donde esa forma funciona. En escritorio
 * esa misma barra deja el título en un extremo y el importe en el otro, a 1.700
 * píxeles, y siete colores plenos apilados dejan de discriminar. Por eso el
 * escritorio tiene su propia disposición, conmutable entre rejilla y tabla.
 */
export function ActionsSection({
  actions, contactadosEstaSemana, proximaRevision, cola, estadoCola,
}: {
  actions: ActionSuggestion[]
  contactadosEstaSemana: number
  proximaRevision: string
  cola: QueueItem[]
  estadoCola: Record<string, SendState>
}) {
  const [vista, setVista] = useState<Vista>('tarjetas')

  useEffect(() => {
    const guardada = localStorage.getItem(CLAVE_VISTA)
    if (guardada === 'tabla' || guardada === 'tarjetas' || guardada === 'cola') setVista(guardada)
  }, [])

  function cambiar(v: Vista) {
    setVista(v)
    localStorage.setItem(CLAVE_VISTA, v)
  }

  const conTrabajo = actions.filter(a => a.destinatarios > 0)
  const vacias = actions.filter(a => a.destinatarios === 0)

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
          <Zap size={12} className="text-amber" /> Campañas de esta semana
        </p>

        <div className="flex items-center gap-3">
          <p className="text-[11px] text-mist">
            {contactadosEstaSemana > 0
              ? `${contactadosEstaSemana} contactada${contactadosEstaSemana === 1 ? '' : 's'} · por dinero en juego`
              : 'Ordenado por dinero en juego'}
          </p>
          {/* Solo en escritorio: en móvil hay una única forma que funciona */}
          <div className="hidden lg:flex items-center rounded-lg border border-line bg-surface p-0.5">
            <button
              onClick={() => cambiar('tarjetas')}
              aria-pressed={vista === 'tarjetas'}
              title="Ver como tarjetas"
              className={`w-7 h-6 flex items-center justify-center rounded transition-colors ${
                vista === 'tarjetas' ? 'bg-surface2 text-snow' : 'text-fog hover:text-snow'
              }`}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => cambiar('tabla')}
              aria-pressed={vista === 'tabla'}
              title="Ver como tabla"
              className={`w-7 h-6 flex items-center justify-center rounded transition-colors ${
                vista === 'tabla' ? 'bg-surface2 text-snow' : 'text-fog hover:text-snow'
              }`}
            >
              <List size={13} />
            </button>
            <button
              onClick={() => cambiar('cola')}
              aria-pressed={vista === 'cola'}
              title="Ver como cola de trabajo"
              className={`w-7 h-6 flex items-center justify-center rounded transition-colors ${
                vista === 'cola' ? 'bg-surface2 text-snow' : 'text-fog hover:text-snow'
              }`}
            >
              <ListChecks size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* «Esta semana» es cuándo te toca revisarlo, no el plazo de cada campaña:
          un cumpleaños se prepara con 45 días y un bono caduca el viernes. */}
      <p className="text-[11px] text-mist -mt-1 mb-2">
        Lo que toca mover esta semana. Cada campaña lleva su propio plazo.
      </p>

      {/* ── Móvil: la barra a lo ancho, que aquí sí funciona ── */}
      <div className="lg:hidden space-y-2">
        {actions.map(a => <BarraMovil key={a.plantilla} a={a} />)}
      </div>

      {/* ── Escritorio ── */}
      <div className="hidden lg:block">
        {vista === 'tarjetas' && <VistaTarjetas conTrabajo={conTrabajo} vacias={vacias} />}
        {vista === 'tabla' && <VistaTabla actions={actions} />}
        {vista === 'cola' && <CampaignQueue cola={cola} estadoInicial={estadoCola} />}
      </div>

      {conTrabajo.length === 0 && vista !== 'cola' && (
        <p className="text-[11px] text-mist mt-2">
          Semana cerrada: no queda nadie a quien escribir.
          {contactadosEstaSemana > 0 && ` Has contactado a ${contactadosEstaSemana} ${contactadosEstaSemana === 1 ? 'familia' : 'familias'}.`}
          {' '}Próxima revisión: {fechaCorta(proximaRevision)}
        </p>
      )}
    </section>
  )
}

/** La barra original, que en pantalla estrecha es la forma correcta. */
function BarraMovil({ a }: { a: ActionSuggestion }) {
  const c = ACCENT[a.accent] ?? ACCENT.lime
  const Icon = iconoDe(a.icono)
  const vacia = a.destinatarios === 0

  return (
    <Link
      href={`/panel/campanas/${a.plantilla}`}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
        vacia ? 'border-line bg-surface' : `${c.border} ${c.bg}`
      }`}
    >
      <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${vacia ? 'bg-surface2' : c.bg}`}>
        <Icon size={22} className={vacia ? 'text-mist' : c.text} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate ${vacia ? 'text-fog' : 'text-snow'}`}>{a.titulo}</p>
        <p className="text-[11px] text-fog truncate">
          <span className={`font-semibold ${vacia ? 'text-mist' : c.text}`}>{a.horizonte}</span> · {a.detalle}
        </p>
      </div>
      <div className="text-right shrink-0">
        {vacia ? (
          <p className="text-sm font-bold text-mist tabular-nums">0</p>
        ) : (
          <>
            <p className={`text-sm font-bold ${c.text} tabular-nums`}>~{formatEur(a.valor)}</p>
            <p className="text-[10px] text-mist">en juego</p>
          </>
        )}
      </div>
      <ChevronRight size={16} className={vacia ? 'text-mist shrink-0' : 'text-fog shrink-0'} />
    </Link>
  )
}

/**
 * Opción A — rejilla con destacada.
 *
 * La primera ocupa el doble y enseña ya las tres familias de más valor: el
 * tamaño hace visible el orden por dinero, que en siete barras iguales solo
 * existía en los datos. El color se reduce al icono y a un filete lateral para
 * que siga identificando sin competir consigo mismo siete veces.
 */
function VistaTarjetas({
  conTrabajo, vacias,
}: {
  conTrabajo: ActionSuggestion[]
  vacias: ActionSuggestion[]
}) {
  const [destacada, ...resto] = conTrabajo

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2.5 items-start">
        {destacada && <TarjetaDestacada a={destacada} />}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 col-span-2">
          {resto.map(a => <TarjetaNormal key={a.plantilla} a={a} />)}
        </div>
      </div>

      {vacias.length > 0 && (
        <p className="text-[11px] text-mist">
          Sin trabajo esta semana:{' '}
          {vacias.map((a, i) => (
            <span key={a.plantilla}>
              {i > 0 && ' · '}
              <Link href={`/panel/campanas/${a.plantilla}`} className="hover:text-fog transition-colors">
                {a.titulo.toLowerCase()}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

function TarjetaDestacada({ a }: { a: ActionSuggestion }) {
  const c = ACCENT[a.accent] ?? ACCENT.lime
  const Icon = iconoDe(a.icono)

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${c.bg}`}>
            <Icon size={22} className={c.text} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-snow">{a.titulo}</p>
            <p className={`text-[11px] font-semibold ${c.text}`}>{a.horizonte}</p>
          </div>
          <div className="text-right shrink-0">
            <p className={`font-display text-xl font-bold ${c.text} tabular-nums leading-none`}>
              ~{formatEur(a.valor)}
            </p>
            <p className="text-[10px] text-mist mt-0.5">en juego</p>
          </div>
        </div>

        {a.top.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-line pt-2.5">
            {a.top.map(f => (
              <Link
                key={f.memberId}
                href={`/miembros/${f.memberId}`}
                className="flex items-baseline gap-2 group"
              >
                <span className="text-xs text-snow truncate group-hover:text-lime transition-colors">
                  {f.name}
                </span>
                <span className="text-[10px] text-mist truncate flex-1">{f.contexto}</span>
              </Link>
            ))}
            {a.destinatarios > a.top.length && (
              <p className="text-[10px] text-mist">y {a.destinatarios - a.top.length} más</p>
            )}
          </div>
        )}
      </div>

      <Link
        href={`/panel/campanas/${a.plantilla}`}
        className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold ${c.bg} ${c.text} hover:brightness-110 transition-all`}
      >
        Abrir campaña <ChevronRight size={14} />
      </Link>
    </div>
  )
}

function TarjetaNormal({ a }: { a: ActionSuggestion }) {
  const c = ACCENT[a.accent] ?? ACCENT.lime
  const Icon = iconoDe(a.icono)

  return (
    <Link
      href={`/panel/campanas/${a.plantilla}`}
      className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 hover:border-line2 transition-colors"
    >
      <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${c.bg}`}>
        <Icon size={20} className={c.text} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-snow leading-snug">{a.titulo}</p>
        <p className={`text-[11px] font-semibold ${c.text}`}>{a.horizonte}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${c.text} tabular-nums`}>~{formatEur(a.valor)}</p>
        <p className="text-[10px] text-mist">en juego</p>
      </div>
    </Link>
  )
}

/**
 * Opción B — tabla densa.
 *
 * Menos presencia, más velocidad: las siete caben sin scroll y las columnas
 * alinean los importes, que es lo que permite compararlos de un vistazo. La
 * barra proporcional convierte el color en información en vez de decoración.
 */
function VistaTabla({ actions }: { actions: ActionSuggestion[] }) {
  const maxValor = Math.max(...actions.map(a => a.valor), 1)

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden">
      <table className="data-table w-full">
        <thead>
          <tr>
            <th className="text-left px-4 py-2">Campaña</th>
            <th className="text-left px-3 py-2">Plazo</th>
            <th className="text-right px-3 py-2">Familias</th>
            <th className="text-right px-3 py-2">En juego</th>
            <th className="px-3 py-2 w-[28%]" />
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {actions.map(a => {
            const c = ACCENT[a.accent] ?? ACCENT.lime
            const Icon = iconoDe(a.icono)
            const vacia = a.destinatarios === 0
            return (
              <tr key={a.plantilla} className={`hover:bg-surface2/60 transition-colors ${vacia ? 'opacity-55' : ''}`}>
                <td className="px-4 py-2">
                  <Link href={`/panel/campanas/${a.plantilla}`} className="flex items-center gap-2.5 group">
                    <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${vacia ? 'bg-surface2' : c.bg}`}>
                      <Icon size={14} className={vacia ? 'text-mist' : c.text} />
                    </span>
                    <span className="font-medium text-snow group-hover:text-lime transition-colors">
                      {a.titulo}
                    </span>
                  </Link>
                </td>
                <td className={`px-3 py-2 font-semibold ${vacia ? 'text-mist' : c.text}`}>{a.horizonte}</td>
                <td className="px-3 py-2 text-right tabular-nums text-fog">{a.destinatarios}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-bold ${vacia ? 'text-mist' : 'text-snow'}`}>
                  {vacia ? '—' : `~${formatEur(a.valor)}`}
                </td>
                <td className="px-3 py-2">
                  {/* El largo es el dinero: el color pasa de adorno a dato */}
                  <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                    <div className={`h-full ${c.barra} transition-all`}
                      style={{ width: `${(a.valor / maxValor) * 100}%` }} />
                  </div>
                </td>
                <td className="pr-3">
                  <Link href={`/panel/campanas/${a.plantilla}`}
                    className="w-8 h-8 flex items-center justify-center text-mist hover:text-snow transition-colors"
                    aria-label={`Abrir ${a.titulo}`}>
                    <ChevronRight size={15} />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
