'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, MessageCircle, Check, Phone, ShieldAlert, Pencil, RotateCcw,
  CheckCheck, X, Clock, Calendar,
} from 'lucide-react'
import { marcarEnvio, type SendState } from '@/lib/campaign-sends'
import {
  renderMessage, waLink, type CampaignTemplate, type Recipient,
} from '@/lib/campaigns'
import { ICONOS } from '../../ActionsSection'

export type ExistingSend = { member_id: string; estado: SendState; enviado_at: string | null }

/** Columnas del tablero. «Respondió» vive dentro de «Contactadas»: son cinco
 *  estados en los datos, pero cinco columnas no caben ni en escritorio. */
type Columna = 'pendiente' | 'contactada' | 'convertido' | 'descartado'

const COLUMNAS: { id: Columna; label: string; corto: string; vacio: string }[] = [
  { id: 'pendiente',  label: 'Por contactar', corto: 'Por contactar', vacio: 'Nadie pendiente' },
  { id: 'contactada', label: 'Contactadas',   corto: 'Contactadas',   vacio: 'Aún no has escrito a nadie' },
  { id: 'convertido', label: 'Reservaron',    corto: 'Reservaron',    vacio: 'Ninguna todavía' },
  { id: 'descartado', label: 'Descartadas',   corto: 'Descartadas',   vacio: 'Ninguna' },
]

function columnaDe(estado: SendState): Columna {
  if (estado === 'convertido') return 'convertido'
  if (estado === 'descartado') return 'descartado'
  if (estado === 'enviado' || estado === 'respondido') return 'contactada'
  return 'pendiente'
}

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
 * Nada se arrastra. Cada tarjeta lleva su botón, porque esto se usa desde el
 * móvil detrás del mostrador y arrastrar entre pestañas es imposible.
 */
export function CampaignClient({
  template, recipients, existingSends, sinConsentimiento,
  horizonte, reintentoDias,
}: {
  template: CampaignTemplate
  recipients: Recipient[]
  existingSends: ExistingSend[]
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
                      activa ? 'bg-surface2 text-snow' : 'text-fog hover:text-snow'
                    }`}
                  >
                    {col.corto}
                    <span className={`tabular-nums ${activa ? c.text : 'text-mist'}`}>{n}</span>
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
                mensaje={mensaje} guardando={saving === r.memberId} onMarcar={marcar}
              />
            ))}
          </div>

          {/* Escritorio: las cuatro a la vez */}
          <div className="hidden lg:grid grid-cols-4 gap-3 items-start">
            {COLUMNAS.map(col => (
              <div key={col.id} className="rounded-2xl border border-line bg-surface/60 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line">
                  <p className="text-[10px] font-semibold text-fog uppercase tracking-wide truncate">{col.label}</p>
                  <span className={`text-xs font-bold tabular-nums ${
                    porColumna[col.id].length > 0 ? c.text : 'text-mist'
                  }`}>
                    {porColumna[col.id].length}
                  </span>
                </div>
                <div className="p-2 space-y-2 min-h-[80px]">
                  {porColumna[col.id].length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-mist">{col.vacio}</p>
                  ) : porColumna[col.id].map(r => (
                    <TarjetaFamilia
                      key={r.memberId} r={r} estado={sends[r.memberId] ?? 'pendiente'}
                      mensaje={mensaje} guardando={saving === r.memberId} onMarcar={marcar} compacta
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Tarjeta de familia. Lleva el porqué está en la lista y su historial, para no
 * tener que abrir la ficha antes de escribir.
 */
function TarjetaFamilia({
  r, estado, mensaje, guardando, onMarcar, compacta = false,
}: {
  r: Recipient
  estado: SendState
  mensaje: string
  guardando: boolean
  onMarcar: (r: Recipient, estado: SendState) => void
  compacta?: boolean
}) {
  const col = columnaDe(estado)
  const link = waLink(r.phone, renderMessage(mensaje, r.vars))

  return (
    <div className={`rounded-xl border border-line bg-surface p-3 ${guardando ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/miembros/${r.memberId}`} className="min-w-0 flex-1 group">
          <p className="text-sm font-medium text-snow truncate group-hover:text-lime transition-colors">
            {r.name}
          </p>
        </Link>
      </div>

      <p className="text-[11px] text-fog mt-0.5 leading-snug">{r.contexto}</p>

      {r.visitas != null && (
        <p className="flex items-center gap-2.5 text-[10px] text-mist mt-1">
          <span className="flex items-center gap-1"><Calendar size={9} />{r.visitas} visitas</span>
          {r.diasDesdeUltima != null && (
            <span className="flex items-center gap-1"><Clock size={9} />hace {r.diasDesdeUltima} d</span>
          )}
        </p>
      )}

      <div className={`flex items-center gap-1.5 mt-2.5 ${compacta ? 'flex-wrap' : ''}`}>
        {col === 'pendiente' && (
          link ? (
            <>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onMarcar(r, 'enviado')}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-lime bg-lime/10 px-2.5 py-1.5 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors"
              >
                <MessageCircle size={13} /> WhatsApp
              </a>
              <button
                onClick={() => onMarcar(r, 'descartado')}
                aria-label={`Descartar a ${r.name}`}
                title="Descartar"
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-mist hover:text-rose transition-colors"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] text-mist" title="Sin teléfono válido">
              <Phone size={13} /> Sin móvil
            </span>
          )
        )}

        {col === 'contactada' && (
          <>
            <button
              onClick={() => onMarcar(r, 'convertido')}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-mint/40 px-2.5 py-1.5 text-xs font-semibold text-mint hover:bg-mint/10 transition-colors"
            >
              <Check size={13} /> Reservó
            </button>
            <button
              onClick={() => onMarcar(r, 'descartado')}
              aria-label={`Descartar a ${r.name}`}
              title="No le interesa"
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-mist hover:text-rose transition-colors"
            >
              <X size={14} />
            </button>
            <button
              onClick={() => onMarcar(r, 'pendiente')}
              aria-label={`Deshacer contacto con ${r.name}`}
              title="Deshacer"
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-mist hover:text-snow transition-colors"
            >
              <RotateCcw size={14} />
            </button>
          </>
        )}

        {(col === 'convertido' || col === 'descartado') && (
          <>
            <span className={`flex-1 text-[11px] font-semibold ${col === 'convertido' ? 'text-mint' : 'text-mist'}`}>
              {col === 'convertido' ? 'Reservó ✓' : 'Descartada'}
            </span>
            <button
              onClick={() => onMarcar(r, 'enviado')}
              aria-label={`Devolver a contactadas a ${r.name}`}
              title="Devolver a contactadas"
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-mist hover:text-snow transition-colors"
            >
              <RotateCcw size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
