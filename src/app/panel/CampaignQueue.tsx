'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  MessageCircle, Check, CheckCheck, X, RotateCcw, Phone, Megaphone,
  Cake, AlertTriangle, RefreshCw, Ticket, HeartPulse, CalendarClock, Repeat,
} from 'lucide-react'
import { waLink, type QueueItem, type PlantillaId } from '@/lib/campaigns'
import { marcarEnvio, type SendState } from '@/lib/campaign-sends'

const ICONOS: Record<string, React.ElementType> = {
  Cake, AlertTriangle, RefreshCw, Ticket, HeartPulse, CalendarClock, Repeat,
}

/** Literales a propósito: Tailwind escanea el fuente, no compone en runtime. */
const ACCENT: Record<string, { text: string; bg: string; border: string; chip: string }> = {
  lime:       { text: 'text-lime',     bg: 'bg-lime/10',     border: 'border-lime/40',     chip: 'bg-lime/15 text-lime' },
  mint:       { text: 'text-mint',     bg: 'bg-mint/10',     border: 'border-mint/40',     chip: 'bg-mint/15 text-mint' },
  'cyan-300': { text: 'text-cyan-300', bg: 'bg-cyan-300/10', border: 'border-cyan-300/40', chip: 'bg-cyan-300/15 text-cyan-300' },
  amber:      { text: 'text-amber',    bg: 'bg-amber/10',    border: 'border-amber/40',    chip: 'bg-amber/15 text-amber' },
  rose:       { text: 'text-rose',     bg: 'bg-rose/10',     border: 'border-rose/40',     chip: 'bg-rose/15 text-rose' },
  iris:       { text: 'text-iris',     bg: 'bg-iris/10',     border: 'border-iris/40',     chip: 'bg-iris/15 text-iris' },
  grape:      { text: 'text-grape',    bg: 'bg-grape/10',    border: 'border-grape/40',    chip: 'bg-grape/15 text-grape' },
}

type Pestana = 'pendiente' | 'contactada' | 'convertido' | 'descartado'

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'pendiente',  label: 'Por contactar' },
  { id: 'contactada', label: 'Contactadas' },
  { id: 'convertido', label: 'Reservaron' },
  { id: 'descartado', label: 'Descartadas' },
]

function pestanaDe(estado: SendState | undefined): Pestana {
  if (estado === 'convertido') return 'convertido'
  if (estado === 'descartado') return 'descartado'
  if (estado === 'enviado' || estado === 'respondido') return 'contactada'
  return 'pendiente'
}

const clave = (i: QueueItem) => `${i.plantilla}:${i.memberId}`

/**
 * Opción C — la cola de trabajo.
 *
 * La sección no lista campañas: lista familias a contactar, mezclando campañas
 * y ordenando por euros. La campaña es cómo el sistema agrupa el trabajo por
 * dentro; lo que el dueño hace el lunes es escribir a gente. Las siete siguen
 * visibles arriba, como chips-filtro con su contador.
 *
 * El estado del flujo se ve y se mueve aquí mismo, sin entrar al detalle: la
 * cinta de arriba resume la semana, la fila cambia de estado en el sitio y las
 * pestañas son las cuatro columnas del tablero vistas como filtro.
 */
export function CampaignQueue({
  cola, estadoInicial,
}: {
  cola: QueueItem[]
  /** Estado ya guardado, por `plantilla:memberId` */
  estadoInicial: Record<string, SendState>
}) {
  const [sends, setSends] = useState<Record<string, SendState>>(estadoInicial)
  const [pestana, setPestana] = useState<Pestana>('pendiente')
  const [filtro, setFiltro] = useState<PlantillaId | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  // El orden viene fijado del servidor y aquí solo se filtra: reordenar a cada
  // clic haría saltar la fila siguiente bajo el cursor.
  const porPestana = useMemo(() => {
    const out: Record<Pestana, QueueItem[]> = {
      pendiente: [], contactada: [], convertido: [], descartado: [],
    }
    for (const i of cola) out[pestanaDe(sends[clave(i)])].push(i)
    return out
  }, [cola, sends])

  const campanas = useMemo(() => {
    const m = new Map<PlantillaId, { item: QueueItem; pendientes: number; cerradas: number }>()
    for (const i of cola) {
      const p = pestanaDe(sends[clave(i)])
      const e = m.get(i.plantilla) ?? { item: i, pendientes: 0, cerradas: 0 }
      if (p === 'pendiente') e.pendientes++
      if (p === 'convertido') e.cerradas++
      m.set(i.plantilla, e)
    }
    return [...m.values()]
  }, [cola, sends])

  const visibles = porPestana[pestana].filter(i => !filtro || i.plantilla === filtro)

  const totalTocables = cola.length || 1
  const pctTocadas = ((cola.length - porPestana.pendiente.length) / totalTocables) * 100
  const pctCerradas = (porPestana.convertido.length / totalTocables) * 100

  async function marcar(i: QueueItem, estado: SendState) {
    const k = clave(i)
    setGuardando(k)
    // Optimista: la fila responde al instante y la escritura va detrás
    setSends(prev => ({ ...prev, [k]: estado }))
    await marcarEnvio(i.plantilla, i.memberId, estado, i.mensaje)
    setGuardando(null)
  }

  return (
    <div className="space-y-2.5">
      {/* ── Cinta de embudo: el estado de la semana de un vistazo ── */}
      <div className="rounded-2xl border border-line bg-surface px-4 py-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
          <p className="text-sm text-snow">
            <span className="font-display text-xl font-bold tabular-nums">{porPestana.pendiente.length}</span>
            <span className="text-fog"> por contactar</span>
          </p>
          <p className="text-[11px] text-mist">
            {porPestana.contactada.length} contactada{porPestana.contactada.length === 1 ? '' : 's'} ·{' '}
            <span className="text-mint font-semibold">{porPestana.convertido.length} reservaron</span>
            {' · '}{cola.length} en total
          </p>
        </div>
        <div className="h-2 rounded-full bg-surface2 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 bg-fog/30 transition-all duration-500" style={{ width: `${pctTocadas}%` }} />
          <div className="absolute inset-y-0 left-0 bg-mint transition-all duration-500" style={{ width: `${pctCerradas}%` }} />
        </div>
      </div>

      {/* ── Pestañas de estado: las cuatro columnas del tablero como filtro ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {PESTANAS.map(p => {
          const n = porPestana[p.id].length
          const activa = pestana === p.id
          return (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              aria-pressed={activa}
              className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activa ? 'bg-surface2 text-snow' : 'text-fog hover:text-snow'
              }`}
            >
              {p.label}
              <span className={activa ? 'text-lime tabular-nums' : 'text-mist tabular-nums'}>{n}</span>
            </button>
          )
        })}
      </div>

      {/* ── Chips de campaña: las siete siempre, con su progreso ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setFiltro(null)}
          aria-pressed={filtro === null}
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            filtro === null ? 'border-line2 bg-surface2 text-snow' : 'border-line text-fog hover:text-snow'
          }`}
        >
          Todas <span className="tabular-nums">{cola.length}</span>
        </button>

        {campanas.map(({ item, pendientes, cerradas }) => {
          const c = ACCENT[item.accent] ?? ACCENT.lime
          const Icon = ICONOS[item.icono] ?? Megaphone
          const activo = filtro === item.plantilla
          const vacia = pendientes === 0 && cerradas === 0
          return (
            <button
              key={item.plantilla}
              onClick={() => setFiltro(activo ? null : item.plantilla)}
              aria-pressed={activo}
              title={item.campana}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                activo ? `${c.border} ${c.bg} ${c.text}`
                       : vacia ? 'border-line text-mist' : `border-line text-fog hover:text-snow`}`}
            >
              <Icon size={12} className={vacia ? 'text-mist' : c.text} />
              <span className="tabular-nums">{pendientes}</span>
              {cerradas > 0 && <span className="text-mint tabular-nums">·{cerradas}✓</span>}
            </button>
          )
        })}
      </div>

      {/* ── La cola ── */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-mist">
            {pestana === 'pendiente'
              ? 'Nada pendiente aquí. Semana cerrada.'
              : 'Ninguna familia en este estado.'}
          </p>
        ) : (
          <div className="divide-y divide-line/60 max-h-[32rem] overflow-y-auto">
            {visibles.map(i => (
              <Fila
                key={clave(i)}
                i={i}
                estado={sends[clave(i)] ?? 'pendiente'}
                guardando={guardando === clave(i)}
                onMarcar={marcar}
              />
            ))}
          </div>
        )}
      </div>

      {cola.length >= 60 && pestana === 'pendiente' && (
        <p className="text-[11px] text-mist">
          Se muestran las 60 familias de más valor. El resto está en cada campaña.
        </p>
      )}
    </div>
  )
}

/**
 * Una familia. Al marcarla no desaparece: cambia de estado en el sitio, para
 * que se vea que el envío quedó registrado y se pueda deshacer.
 */
function Fila({
  i, estado, guardando, onMarcar,
}: {
  i: QueueItem
  estado: SendState
  guardando: boolean
  onMarcar: (i: QueueItem, estado: SendState) => void
}) {
  const c = ACCENT[i.accent] ?? ACCENT.lime
  const Icon = ICONOS[i.icono] ?? Megaphone
  const col = pestanaDe(estado)
  const link = waLink(i.phone, i.mensaje)

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 transition-opacity ${guardando ? 'opacity-50' : ''}`}>
      <Link href={`/miembros/${i.memberId}`} className="min-w-0 flex-1 group">
        <p className="text-sm font-medium text-snow truncate group-hover:text-lime transition-colors">
          {i.name}
        </p>
        <p className="text-[11px] text-mist truncate flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-px ${c.chip}`}>
            <Icon size={10} /> {i.campana}
          </span>
          {i.contexto}
        </p>
      </Link>

      <div className="flex items-center gap-1.5 shrink-0 w-[9.5rem] justify-end">
        {col === 'pendiente' && (link ? (
          <>
            <a
              href={link} target="_blank" rel="noopener noreferrer"
              onClick={() => onMarcar(i, 'enviado')}
              className="flex items-center gap-1.5 rounded-lg border border-lime bg-lime/10 px-2.5 py-1.5 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors"
            >
              <MessageCircle size={13} /> WhatsApp
            </a>
            <button onClick={() => onMarcar(i, 'descartado')} title="Descartar"
              aria-label={`Descartar a ${i.name}`}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-mist hover:text-rose transition-colors">
              <X size={14} />
            </button>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] text-mist" title="Sin teléfono válido">
            <Phone size={13} /> Sin móvil
          </span>
        ))}

        {col === 'contactada' && (
          <>
            <CheckCheck size={14} className="text-cyan-300 shrink-0" />
            <button onClick={() => onMarcar(i, 'convertido')}
              className="rounded-lg border border-mint/40 px-2.5 py-1.5 text-[11px] font-semibold text-mint hover:bg-mint/10 transition-colors">
              Reservó
            </button>
            <button onClick={() => onMarcar(i, 'descartado')} title="No le interesa"
              aria-label={`Descartar a ${i.name}`}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-mist hover:text-rose transition-colors">
              <X size={14} />
            </button>
            <button onClick={() => onMarcar(i, 'pendiente')} title="Deshacer"
              aria-label={`Deshacer contacto con ${i.name}`}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-mist hover:text-snow transition-colors">
              <RotateCcw size={13} />
            </button>
          </>
        )}

        {(col === 'convertido' || col === 'descartado') && (
          <>
            <span className={`text-[11px] font-semibold flex items-center gap-1 ${col === 'convertido' ? 'text-mint' : 'text-mist'}`}>
              {col === 'convertido' ? <><Check size={13} /> Reservó</> : 'Descartada'}
            </span>
            <button onClick={() => onMarcar(i, 'enviado')} title="Devolver a contactadas"
              aria-label={`Devolver a contactadas a ${i.name}`}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-mist hover:text-snow transition-colors">
              <RotateCcw size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
