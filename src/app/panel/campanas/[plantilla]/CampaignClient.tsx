'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, MessageCircle, Check, Phone, ShieldAlert, Pencil, RotateCcw,
  CheckCheck, X, Clock, Calendar, BellRing, Reply, Sparkles,
} from 'lucide-react'
import { marcarEnvio, type SendState } from '@/lib/campaign-sends'
import {
  renderMessage, waLink, columnaDeEstado, resumenSeguimiento, DIAS_ESPERA_RESPUESTA,
  type CampaignTemplate, type Recipient, type ColumnaCampana, type SeguimientoFamilia,
} from '@/lib/campaigns'
import { ICONOS } from '../../ActionsSection'

export type ExistingSend = { member_id: string; estado: SendState; enviado_at: string | null }

/**
 * Columnas del tablero. La definición de cuáles son y a cuál va cada estado
 * vive en el dominio (`columnaDeEstado`), porque el resumen cuenta lo mismo y
 * las dos pantallas tienen que dar la misma cifra.
 *
 * Cada una con su color, y el color significa algo: azul lo que está por hacer,
 * lila lo que está en marcha, verde lo que ha salido bien y rojo lo que se
 * cierra sin venta. Antes las cuatro eran iguales y había que leer el rótulo
 * para saber en cuál estabas.
 *
 * `estado` es a qué estado pasa una tarjeta al soltarla en esa columna.
 */
type Columna = ColumnaCampana

const COLUMNAS: {
  id: Columna; label: string; corto: string; vacio: string
  estado: SendState
  text: string; border: string; bg: string; head: string; ring: string
}[] = [
  {
    id: 'pendiente', label: 'Por contactar', corto: 'Por contactar', vacio: 'Nadie pendiente',
    estado: 'pendiente',
    text: 'text-cyan-300', border: 'border-cyan-300/40', bg: 'bg-cyan-300/10',
    head: 'bg-cyan-300/15', ring: 'ring-cyan-300/50',
  },
  {
    id: 'contactada', label: 'Contactadas', corto: 'Contactadas', vacio: 'Aún no has escrito a nadie',
    estado: 'enviado',
    text: 'text-iris', border: 'border-iris/40', bg: 'bg-iris/10',
    head: 'bg-iris/15', ring: 'ring-iris/50',
  },
  {
    id: 'convertido', label: 'Reservaron', corto: 'Reservaron', vacio: 'Ninguna todavía',
    estado: 'convertido',
    text: 'text-mint', border: 'border-mint/40', bg: 'bg-mint/10',
    head: 'bg-mint/15', ring: 'ring-mint/50',
  },
  {
    id: 'descartado', label: 'Descartadas', corto: 'Descartadas', vacio: 'Ninguna',
    estado: 'descartado',
    text: 'text-rose', border: 'border-rose/40', bg: 'bg-rose/10',
    head: 'bg-rose/15', ring: 'ring-rose/50',
  },
]

const columnaDe = columnaDeEstado

const ACCENT: Record<string, { text: string; border: string; bg: string; barra: string }> = {
  lime:       { text: 'text-lime',      border: 'border-lime/40',      bg: 'bg-lime/10',      barra: 'bg-lime' },
  mint:       { text: 'text-mint',      border: 'border-mint/40',      bg: 'bg-mint/10',      barra: 'bg-mint' },
  'cyan-300': { text: 'text-cyan-300',  border: 'border-cyan-300/40',  bg: 'bg-cyan-300/10',  barra: 'bg-cyan-300' },
  amber:      { text: 'text-amber',     border: 'border-amber/40',     bg: 'bg-amber/10',     barra: 'bg-amber' },
  rose:       { text: 'text-rose',      border: 'border-rose/40',      bg: 'bg-rose/10',      barra: 'bg-rose' },
  iris:       { text: 'text-iris',      border: 'border-iris/40',      bg: 'bg-iris/10',      barra: 'bg-iris' },
  grape:      { text: 'text-grape',     border: 'border-grape/40',     bg: 'bg-grape/10',     barra: 'bg-grape' },
}

/**
 * Pantalla de campaña como tablero: cada familia es una tarjeta que avanza de
 * «por contactar» a «reservó». Los estados ya existían en `campaign_sends`; la
 * lista plana anterior los escondía detrás de una opacidad al 60 %.
 *
 * Cada tarjeta lleva sus botones, que es la única forma que funciona en móvil:
 * detrás del mostrador se usa con una mano y arrastrar entre pestañas es
 * imposible. En escritorio, donde las cuatro columnas se ven a la vez, además
 * se puede arrastrar — los botones siguen ahí, el arrastre es un atajo.
 */
export function CampaignClient({
  template, recipients, existingSends, seguimiento, sinConsentimiento,
  horizonte, reintentoDias,
}: {
  template: CampaignTemplate
  recipients: Recipient[]
  existingSends: ExistingSend[]
  /** Calculado en el servidor: quién no contesta y quién ya ha venido */
  seguimiento: Record<string, SeguimientoFamilia>
  sinConsentimiento: number
  horizonte: string
  reintentoDias: number
}) {
  const c = ACCENT[template.accent] ?? ACCENT.lime
  const TemplateIcon = ICONOS[template.icono] ?? MessageCircle
  const [mensaje, setMensaje] = useState(template.mensaje)
  const [editando, setEditando] = useState(false)
  const [sends, setSends] = useState<Record<string, SendState>>(
    () => Object.fromEntries(existingSends.map(s => [s.member_id, s.estado]))
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [tab, setTab] = useState<Columna>('pendiente')
  /** Sobre qué columna se está soltando; solo para resaltarla */
  const [sobre, setSobre] = useState<Columna | null>(null)

  const porColumna = useMemo(() => {
    const out: Record<Columna, Recipient[]> = {
      pendiente: [], contactada: [], convertido: [], descartado: [],
    }
    for (const r of recipients) out[columnaDe(sends[r.memberId] ?? 'pendiente')].push(r)
    return out
  }, [recipients, sends])

  // Si terminas la columna en la que estás, la pestaña se mueve sola a donde
  // queda trabajo: quedarse mirando un hueco vacío no ayuda a nadie.
  useEffect(() => {
    if (porColumna[tab].length > 0) return
    const siguiente = COLUMNAS.find(col => porColumna[col.id].length > 0)
    if (siguiente) setTab(siguiente.id)
  }, [porColumna, tab])

  const total = recipients.length
  const hechas = porColumna.convertido.length + porColumna.descartado.length + porColumna.contactada.length
  const pctTocadas = total ? (hechas / total) * 100 : 0
  const pctGanado = total ? (porColumna.convertido.length / total) * 100 : 0

  // El seguimiento viene del servidor; al marcar en local se recalcula la parte
  // que depende del estado, para que los avisos no se queden colgados.
  const res = useMemo(() => {
    const vivo: Record<string, SeguimientoFamilia> = {}
    for (const [id, f] of Object.entries(seguimiento)) {
      const columna = columnaDe(sends[id] ?? 'pendiente')
      vivo[id] = {
        ...f,
        columna,
        respondio: sends[id] === 'respondido',
        tocaInsistir: f.tocaInsistir && columna === 'contactada' && sends[id] !== 'respondido',
        conversionSinMarcar: !!f.vinoEl && columna === 'contactada',
      }
    }
    return resumenSeguimiento(vivo)
  }, [seguimiento, sends])

  /** Cierra de golpe las que ya vinieron: el dato ya estaba, solo faltaba anotarlo. */
  async function marcarLasQueVinieron() {
    const pendientes = recipients.filter(
      r => seguimiento[r.memberId]?.vinoEl && columnaDe(sends[r.memberId] ?? 'pendiente') === 'contactada'
    )
    for (const r of pendientes) await marcar(r, 'convertido')
  }

  async function marcar(r: Recipient, estado: SendState) {
    setSaving(r.memberId)
    // Optimista: el tablero responde al instante y la escritura va detrás. Si
    // falla, la próxima carga del servidor devuelve la verdad.
    setSends(prev => ({ ...prev, [r.memberId]: estado }))
    await marcarEnvio(template.id, r.memberId, estado, mensaje)
    setSaving(null)
  }

  const preview = useMemo(
    () => renderMessage(mensaje, recipients[0]?.vars ?? { nombre: 'María', niño: 'Pau', sesiones: '2', dias: '21' }),
    [mensaje, recipients],
  )

  return (
    <div className="space-y-5 pb-safe-nav">
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <Link href="/panel" aria-label="Volver al resumen"
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-line bg-surface2 text-fog hover:text-snow transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${c.bg}`}>
          <TemplateIcon size={24} className={c.text} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Campaña</p>
          <h1 className="font-display text-2xl font-semibold text-snow truncate">{template.nombre}</h1>
        </div>
      </div>

      <div className={`rounded-xl border ${c.border} ${c.bg} px-4 py-2.5`}>
        <p className={`text-xs ${c.text}`}>{template.porque}</p>
        <p className="text-[11px] text-fog mt-1">
          Plazo: {horizonte} · no se vuelve a proponer a la misma familia hasta
          pasados {reintentoDias} días
        </p>
      </div>

      {/* Progreso: lo único que dice si la campaña avanza */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-end justify-between gap-3 mb-2.5">
          <div>
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Progreso</p>
            <p className="font-display text-2xl font-bold text-snow leading-none mt-1 tabular-nums">
              {porColumna.convertido.length}<span className="text-fog text-lg"> / {total}</span>
              <span className="text-sm font-medium text-fog"> reservaron</span>
            </p>
          </div>
          <div className="text-right">
            <p className={`font-display text-xl font-bold tabular-nums ${c.text}`}>{porColumna.pendiente.length}</p>
            <p className="text-[10px] text-mist">por contactar</p>
          </div>
        </div>

        {/* Dos tramos: lo ya movido y, dentro, lo que acabó en reserva */}
        <div className="h-2 rounded-full bg-surface2 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 bg-fog/30 transition-all duration-500"
            style={{ width: `${pctTocadas}%` }} />
          <div className={`absolute inset-y-0 left-0 ${c.barra} transition-all duration-500`}
            style={{ width: `${pctGanado}%` }} />
        </div>
        <p className="text-[11px] text-mist mt-1.5">
          {porColumna.pendiente.length > 0
            ? `Quedan ${porColumna.pendiente.length} por contactar`
            : 'Todas contactadas'}
        </p>
      </div>

      {/* ── Lo que hay que hacer HOY con esta campaña ──────────────────────
          Una campaña no se muere porque las familias digan que no; se muere
          porque nadie vuelve a mirar a quien no contestó, y porque quien sí
          vino nunca se marca. Las dos cosas se avisan aquí, con su botón. */}
      {(res.sinMarcar > 0 || res.tocaInsistir > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {res.sinMarcar > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-mint/40 bg-mint/10 px-3 py-2.5">
              <Sparkles size={15} className="text-mint shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-mint">
                  {res.sinMarcar} {res.sinMarcar === 1 ? 'familia ha venido' : 'familias han venido'} después de escribirles
                </p>
                <p className="text-[11px] text-fog leading-snug mt-0.5">
                  La visita está registrada, pero la campaña sigue contándolas como pendientes de respuesta.
                </p>
                <button
                  onClick={marcarLasQueVinieron}
                  className="mt-1.5 rounded-md border border-mint/40 bg-mint/10 px-2 py-1 text-[11px] font-semibold text-mint hover:bg-mint/20 transition-colors"
                >
                  Marcar como reservaron
                </button>
              </div>
            </div>
          )}

          {res.tocaInsistir > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5">
              <BellRing size={15} className="text-amber shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber">
                  {res.tocaInsistir} sin contestar hace más de {DIAS_ESPERA_RESPUESTA} días
                </p>
                <p className="text-[11px] text-fog leading-snug mt-0.5">
                  Un segundo mensaje recupera parte de esto. Están marcadas en «Contactadas».
                </p>
                <button
                  onClick={() => setTab('contactada')}
                  className="mt-1.5 rounded-md border border-amber/40 bg-amber/10 px-2 py-1 text-[11px] font-semibold text-amber hover:bg-amber/20 transition-colors lg:hidden"
                >
                  Ver quiénes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mensaje, con vista previa en burbuja */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Mensaje</p>
          <button onClick={() => setEditando(e => !e)}
            className="flex items-center gap-1 text-[11px] font-semibold text-fog hover:text-snow transition-colors">
            <Pencil size={11} /> {editando ? 'Ver ejemplo' : 'Editar'}
          </button>
        </div>

        {editando ? (
          <>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm text-snow outline-none focus:border-line2 transition-colors resize-none"
            />
            <p className="text-[10px] text-mist mt-1.5">
              Variables disponibles: {'{nombre}'} {'{niño}'} {'{sesiones}'} {'{dias}'}
            </p>
          </>
        ) : (
          // Burbuja de WhatsApp: así se ve de un vistazo si el mensaje queda
          // largo o si una variable no se ha sustituido.
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-mint/15 border border-mint/25 px-3 py-2">
              <p className="text-sm text-snow whitespace-pre-wrap leading-snug">{preview}</p>
              <p className="flex items-center justify-end gap-1 text-[10px] text-mist mt-1">
                12:04 <CheckCheck size={11} className="text-cyan-300" />
              </p>
            </div>
          </div>
        )}

        {template.incentivo && (
          <p className="text-[11px] text-mist mt-2">Incentivo sugerido: {template.incentivo}</p>
        )}
      </div>

      {sinConsentimiento > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5">
          <ShieldAlert size={14} className="text-amber shrink-0 mt-0.5" />
          <p className="text-xs text-amber/90">
            {sinConsentimiento} familia{sinConsentimiento !== 1 ? 's' : ''} queda fuera por no tener
            consentimiento de marketing. Se pide al dar de alta o desde su ficha.
          </p>
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-4 py-10 text-center">
          <p className="text-sm text-mist">No hay familias para esta campaña ahora mismo.</p>
        </div>
      ) : (
        <>
          {/* Móvil: una columna cada vez, seleccionada arriba */}
          <div className="lg:hidden sticky top-0 z-20 -mx-4 px-4 py-2 bg-carbon/95 backdrop-blur">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {COLUMNAS.map(col => {
                const n = porColumna[col.id].length
                const activa = tab === col.id
                return (
                  <button
                    key={col.id}
                    onClick={() => setTab(col.id)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activa ? `${col.bg} ${col.text}` : 'text-fog hover:text-snow'
                    }`}
                  >
                    {col.corto}
                    <span className={`tabular-nums ${activa ? col.text : 'text-mist'}`}>{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="lg:hidden space-y-2">
            {porColumna[tab].length === 0 ? (
              <p className="py-8 text-center text-sm text-mist">
                {COLUMNAS.find(col => col.id === tab)?.vacio}
              </p>
            ) : porColumna[tab].map(r => (
              <TarjetaFamilia
                key={r.memberId} r={r} estado={sends[r.memberId] ?? 'pendiente'}
                seg={seguimiento[r.memberId]}
                mensaje={mensaje} guardando={saving === r.memberId} onMarcar={marcar}
              />
            ))}
          </div>

          {/* Escritorio: las cuatro a la vez, y se puede arrastrar entre ellas */}
          <div className="hidden lg:grid grid-cols-4 gap-3 items-start">
            {COLUMNAS.map(col => {
              const lista = porColumna[col.id]
              const activa = sobre === col.id
              return (
                <div
                  key={col.id}
                  onDragOver={e => { e.preventDefault(); setSobre(col.id) }}
                  onDragLeave={() => setSobre(s2 => (s2 === col.id ? null : s2))}
                  onDrop={e => {
                    e.preventDefault()
                    setSobre(null)
                    const id = e.dataTransfer.getData('text/plain')
                    const r = recipients.find(x => x.memberId === id)
                    // Soltar donde ya estaba no es un cambio: evita una
                    // escritura y un parpadeo por nada.
                    if (r && columnaDe(sends[r.memberId] ?? 'pendiente') !== col.id) {
                      marcar(r, col.estado)
                    }
                  }}
                  className={`rounded-2xl border bg-surface/60 overflow-hidden transition-all ${
                    activa ? `${col.border} ring-2 ${col.ring}` : 'border-line'
                  }`}
                >
                  <div className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${col.border} ${col.head}`}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide truncate ${col.text}`}>
                      {col.label}
                    </p>
                    <span className={`text-xs font-bold tabular-nums ${lista.length > 0 ? col.text : 'text-mist'}`}>
                      {lista.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[80px]">
                    {lista.length === 0 ? (
                      <p className="py-6 text-center text-[11px] text-mist">
                        {activa ? 'Suelta aquí' : col.vacio}
                      </p>
                    ) : lista.map(r => (
                      <TarjetaFamilia
                        key={r.memberId} r={r} estado={sends[r.memberId] ?? 'pendiente'}
                        seg={seguimiento[r.memberId]}
                        mensaje={mensaje} guardando={saving === r.memberId} onMarcar={marcar} compacta
                        arrastrable
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Tarjeta de familia. Lleva el porqué está en la lista y su historial, para no
 * tener que abrir la ficha antes de escribir.
 *
 * En escritorio es arrastrable: se coge y se suelta en otra columna. Es un
 * atajo, no la única vía — los botones se quedan, porque en móvil el arrastre
 * entre pestañas no existe y porque «WhatsApp» tiene que abrir WhatsApp.
 */
function TarjetaFamilia({
  r, estado, seg, mensaje, guardando, onMarcar, compacta = false, arrastrable = false,
}: {
  r: Recipient
  estado: SendState
  /** Cuánto lleva esperando y si ya ha aparecido por la ludoteca */
  seg?: SeguimientoFamilia
  mensaje: string
  guardando: boolean
  onMarcar: (r: Recipient, estado: SendState) => void
  compacta?: boolean
  arrastrable?: boolean
}) {
  const col = columnaDe(estado)
  const link = waLink(r.phone, renderMessage(mensaje, r.vars))

  return (
    <div
      draggable={arrastrable}
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', r.memberId)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`rounded-xl border border-line bg-surface ${compacta ? 'p-2.5' : 'p-3'} ${
        guardando ? 'opacity-60' : ''
      } ${arrastrable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <Link href={`/miembros/${r.memberId}`} className="block min-w-0 group">
        <p className="text-sm font-medium text-snow truncate group-hover:text-lime transition-colors">
          {r.name}
        </p>
      </Link>

      <p className="text-[11px] text-fog mt-0.5 leading-snug">{r.contexto}</p>

      {r.visitas != null && (
        <p className="flex items-center gap-2.5 text-[10px] text-mist mt-1">
          <span className="flex items-center gap-1"><Calendar size={9} />{r.visitas} visitas</span>
          {r.diasDesdeUltima != null && (
            <span className="flex items-center gap-1"><Clock size={9} />hace {r.diasDesdeUltima} d</span>
          )}
        </p>
      )}

      {/* ── Seguimiento: el tiempo que lleva ahí y qué ha pasado desde ──
          Sin esto, «contactada» es un cajón donde todo parece igual: la que
          respondió ayer y la que lleva nueve días en silencio. */}
      {col === 'contactada' && seg && (
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          {seg.vinoEl ? (
            <span className="flex items-center gap-1 rounded-md bg-mint/15 px-1.5 py-0.5 text-[10px] font-semibold text-mint">
              <Sparkles size={9} /> Vino el {new Date(seg.vinoEl).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </span>
          ) : seg.respondio ? (
            <span className="flex items-center gap-1 rounded-md bg-iris/15 px-1.5 py-0.5 text-[10px] font-semibold text-iris">
              <Reply size={9} /> Respondió
            </span>
          ) : seg.tocaInsistir ? (
            <span className="flex items-center gap-1 rounded-md bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber">
              <BellRing size={9} /> Sin contestar · {seg.diasDesdeContacto} d
            </span>
          ) : (
            <span className="text-[10px] text-mist">
              Escrita hace {seg.diasDesdeContacto ?? 0} d
            </span>
          )}
        </div>
      )}

      {/* Fila de acciones compacta: los botones eran de 32 px de alto en una
          tarjeta de tres líneas, y en la columna de escritorio eso hacía que la
          acción pesara más que el nombre de la familia. */}
      <div className="flex items-center gap-1 mt-2">
        {col === 'pendiente' && (
          link ? (
            <>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onMarcar(r, 'enviado')}
                className="flex items-center justify-center gap-1 rounded-md border border-lime bg-lime/10 px-2 py-1 text-[11px] font-semibold text-lime hover:bg-lime/20 transition-colors"
              >
                <MessageCircle size={11} /> WhatsApp
              </a>
              <BotonDescartar r={r} onMarcar={onMarcar} />
            </>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-mist" title="Sin teléfono válido">
              <Phone size={11} /> Sin móvil
            </span>
          )
        )}

        {col === 'contactada' && (
          <>
            <button
              onClick={() => onMarcar(r, 'convertido')}
              className="flex items-center justify-center gap-1 rounded-md border border-mint/40 px-2 py-1 text-[11px] font-semibold text-mint hover:bg-mint/10 transition-colors"
            >
              <Check size={11} /> Reservó
            </button>
            {/* «Respondió» no cambia de columna: cambia lo que sabes de ella.
                Estaba en los datos desde el principio y no se podía marcar. */}
            {!seg?.respondio && (
              <button
                onClick={() => onMarcar(r, 'respondido')}
                title="Ha contestado al mensaje"
                className="flex items-center justify-center gap-1 rounded-md border border-iris/40 px-2 py-1 text-[11px] font-semibold text-iris hover:bg-iris/10 transition-colors"
              >
                <Reply size={11} /> Respondió
              </button>
            )}
            <BotonDescartar r={r} onMarcar={onMarcar} />
            <button
              onClick={() => onMarcar(r, 'pendiente')}
              aria-label={`Deshacer contacto con ${r.name}`}
              title="Deshacer"
              className="ml-auto w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-mist hover:text-snow transition-colors"
            >
              <RotateCcw size={12} />
            </button>
          </>
        )}

        {(col === 'convertido' || col === 'descartado') && (
          <>
            <span className={`flex-1 text-[11px] font-semibold ${col === 'convertido' ? 'text-mint' : 'text-rose'}`}>
              {col === 'convertido' ? 'Reservó ✓' : 'Descartada'}
            </span>
            <button
              onClick={() => onMarcar(r, 'enviado')}
              aria-label={`Devolver a contactadas a ${r.name}`}
              title="Devolver a contactadas"
              className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-mist hover:text-snow transition-colors"
            >
              <RotateCcw size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Descartar, con su palabra y en rojo.
 *
 * Era una «✕» gris del mismo tono que «deshacer», así que había que adivinar
 * cuál cerraba la familia y cuál solo daba marcha atrás. Descartar la saca de
 * la campaña: eso se dice, no se insinúa.
 */
function BotonDescartar({
  r, onMarcar,
}: {
  r: Recipient
  onMarcar: (r: Recipient, estado: SendState) => void
}) {
  return (
    <button
      onClick={() => onMarcar(r, 'descartado')}
      aria-label={`Descartar a ${r.name}`}
      title="Sacar de esta campaña"
      className="flex items-center justify-center gap-1 rounded-md border border-rose/30 px-2 py-1 text-[11px] font-semibold text-rose hover:bg-rose/10 transition-colors"
    >
      <X size={11} /> Descartar
    </button>
  )
}
