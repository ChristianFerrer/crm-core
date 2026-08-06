'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, MessageCircle, Check, Phone, ShieldAlert, Pencil, Users, Euro, RotateCcw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant } from '@/lib/tenant'
import { formatEur } from '@/lib/metrics'
import {
  renderMessage, waLink, type CampaignTemplate, type Recipient,
} from '@/lib/campaigns'

type SendState = 'pendiente' | 'enviado' | 'respondido' | 'convertido' | 'descartado'

export type ExistingSend = { member_id: string; estado: SendState; enviado_at: string | null }

const ACCENT: Record<string, { text: string; border: string; bg: string }> = {
  lime:       { text: 'text-lime',      border: 'border-lime/40',      bg: 'bg-lime/10' },
  mint:       { text: 'text-mint',      border: 'border-mint/40',      bg: 'bg-mint/10' },
  'cyan-300': { text: 'text-cyan-300',  border: 'border-cyan-300/40',  bg: 'bg-cyan-300/10' },
  amber:      { text: 'text-amber',     border: 'border-amber/40',     bg: 'bg-amber/10' },
  rose:       { text: 'text-rose',      border: 'border-rose/40',      bg: 'bg-rose/10' },
  iris:       { text: 'text-iris',      border: 'border-iris/40',      bg: 'bg-iris/10' },
  grape:      { text: 'text-grape',     border: 'border-grape/40',     bg: 'bg-grape/10' },
}

/**
 * Pantalla de campaña: mensaje editable arriba, lista de familias abajo.
 *
 * Cada envío se registra en `campaign_sends` al pulsar WhatsApp, que es lo que
 * permite saber a quién ya escribiste; sin ese registro la lista se vuelve
 * inútil a la segunda semana.
 */
export function CampaignClient({
  template, recipients, existingSends, campaignId: initialCampaignId, sinConsentimiento,
}: {
  template: CampaignTemplate
  recipients: Recipient[]
  existingSends: ExistingSend[]
  campaignId: string | null
  sinConsentimiento: number
}) {
  const c = ACCENT[template.accent] ?? ACCENT.lime
  const [mensaje, setMensaje] = useState(template.mensaje)
  const [editando, setEditando] = useState(false)
  const [campaignId, setCampaignId] = useState<string | null>(initialCampaignId)
  const [sends, setSends] = useState<Record<string, SendState>>(
    () => Object.fromEntries(existingSends.map(s => [s.member_id, s.estado]))
  )
  const [saving, setSaving] = useState<string | null>(null)

  const pendientes = recipients.filter(r => !sends[r.memberId] || sends[r.memberId] === 'pendiente')
  const contactados = recipients.filter(r => sends[r.memberId] && sends[r.memberId] !== 'pendiente')
  const valorPendiente = pendientes.reduce((s, r) => s + r.valor, 0)

  /** Crea la campaña la primera vez que se envía algo, no antes. */
  async function ensureCampaign(): Promise<string | null> {
    if (campaignId) return campaignId
    const tenantId = getStoredTenant()?.id
    if (!tenantId) return null
    const { data, error } = await supabase.from('campaigns').insert({
      tenant_id: tenantId,
      nombre: template.nombre,
      plantilla: template.id,
      mensaje,
      incentivo: template.incentivo,
      canal: 'whatsapp',
      estado: 'activa',
      enviada_at: new Date().toISOString(),
    }).select('id').single()
    if (error || !data) return null
    setCampaignId(data.id)
    return data.id
  }

  async function marcar(r: Recipient, estado: SendState) {
    setSaving(r.memberId)
    const cid = await ensureCampaign()
    const tenantId = getStoredTenant()?.id
    if (cid && tenantId) {
      await supabase.from('campaign_sends').upsert({
        tenant_id: tenantId,
        campaign_id: cid,
        member_id: r.memberId,
        estado,
        enviado_at: estado === 'enviado' ? new Date().toISOString() : null,
        respondido_at: estado === 'respondido' ? new Date().toISOString() : null,
        convertido_at: estado === 'convertido' ? new Date().toISOString() : null,
      }, { onConflict: 'campaign_id,member_id' })
    }
    setSends(prev => ({ ...prev, [r.memberId]: estado }))
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
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Campaña</p>
          <h1 className="font-display text-2xl font-semibold text-snow truncate">{template.nombre}</h1>
        </div>
      </div>

      <p className={`rounded-xl border ${c.border} ${c.bg} px-4 py-2.5 text-xs ${c.text}`}>
        {template.porque}
      </p>

      {/* Resumen de la campaña */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
            <Users size={12} /> Por contactar
          </p>
          <p className="font-display text-2xl font-bold text-snow mt-1.5 tabular-nums">{pendientes.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
            <Euro size={12} /> En juego
          </p>
          <p className={`font-display text-2xl font-bold mt-1.5 tabular-nums ${c.text}`}>{formatEur(valorPendiente)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
            <Check size={12} /> Contactados
          </p>
          <p className="font-display text-2xl font-bold text-mint mt-1.5 tabular-nums">{contactados.length}</p>
        </div>
      </div>

      {/* Mensaje */}
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
          <p className="text-sm text-snow whitespace-pre-wrap leading-snug">{preview}</p>
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

      {/* Lista de envío */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <div className="px-4 py-2.5 border-b border-line flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Lista de envío</p>
          <p className="text-[11px] text-mist">Al pulsar WhatsApp se marca como contactado</p>
        </div>

        {recipients.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-mist">
            No hay familias para esta campaña ahora mismo.
          </p>
        ) : (
          <div className="divide-y divide-line/60">
            {recipients.map(r => {
              const estado = sends[r.memberId] ?? 'pendiente'
              const hecho = estado !== 'pendiente'
              const texto = renderMessage(mensaje, r.vars)
              const link = waLink(r.phone, texto)
              return (
                <div key={r.memberId} className={`flex items-center gap-3 px-4 py-2.5 ${hecho ? 'opacity-60' : ''}`}>
                  <Link href={`/miembros/${r.memberId}`} className="min-w-0 flex-1 group">
                    <p className="text-sm font-medium text-snow truncate group-hover:text-lime transition-colors">
                      {r.name}
                    </p>
                    <p className="text-[11px] text-mist truncate">
                      {hecho ? estadoLabel(estado) : `~${formatEur(r.valor)} en juego`}
                      {r.vars.niño && ` · ${r.vars.niño}`}
                    </p>
                  </Link>

                  {hecho ? (
                    <button
                      onClick={() => marcar(r, 'pendiente')}
                      disabled={saving === r.memberId}
                      aria-label={`Deshacer contacto con ${r.name}`}
                      title="Deshacer"
                      className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-mist hover:text-snow transition-colors"
                    >
                      <RotateCcw size={14} />
                    </button>
                  ) : link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => marcar(r, 'enviado')}
                      className="flex items-center gap-1.5 shrink-0 rounded-lg border border-lime bg-lime/10 px-3 py-1.5 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors"
                    >
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  ) : (
                    <span className="flex items-center gap-1.5 shrink-0 text-[11px] text-mist" title="Sin teléfono válido">
                      <Phone size={13} /> Sin móvil
                    </span>
                  )}

                  {hecho && estado === 'enviado' && (
                    <button
                      onClick={() => marcar(r, 'convertido')}
                      disabled={saving === r.memberId}
                      className="shrink-0 rounded-lg border border-mint/40 px-2.5 py-1.5 text-[11px] font-semibold text-mint hover:bg-mint/10 transition-colors"
                    >
                      Reservó
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function estadoLabel(e: SendState): string {
  switch (e) {
    case 'enviado':    return 'Contactado'
    case 'respondido': return 'Respondió'
    case 'convertido': return 'Reservó ✓'
    case 'descartado': return 'Descartado'
    default:           return 'Pendiente'
  }
}
