'use client'

/**
 * Registro de envíos de campaña, compartido por la pantalla de campaña y por la
 * cola del resumen.
 *
 * Vive aparte porque desde que se puede marcar en los dos sitios, la creación
 * diferida de la campaña es estado compartido: si cada pantalla llevara su
 * propia copia, dos marcados casi simultáneos crearían dos filas de `campaigns`
 * para la misma plantilla y el histórico quedaría partido.
 */

import { supabase } from './supabase'
import { getStoredTenant } from './tenant'
import { templateById, type PlantillaId } from './campaigns'

export type SendState = 'pendiente' | 'enviado' | 'respondido' | 'convertido' | 'descartado'

/** Campañas ya resueltas en esta sesión, para no ir a la base cada vez. */
const cache = new Map<PlantillaId, string>()

/**
 * Devuelve el id de la campaña activa de esta plantilla, creándola si hace
 * falta. Antes de insertar vuelve a consultar: es lo que evita el duplicado
 * cuando la otra pantalla la ha creado mientras tanto.
 */
async function ensureCampaign(
  plantilla: PlantillaId,
  tenantId: string,
  mensaje?: string,
): Promise<string | null> {
  const enCache = cache.get(plantilla)
  if (enCache) return enCache

  const { data: existente } = await supabase
    .from('campaigns')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('plantilla', plantilla)
    .eq('estado', 'activa')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente?.id) {
    cache.set(plantilla, existente.id)
    return existente.id
  }

  const tpl = templateById(plantilla)
  const { data, error } = await supabase.from('campaigns').insert({
    tenant_id: tenantId,
    nombre: tpl?.nombre ?? plantilla,
    plantilla,
    mensaje: mensaje ?? tpl?.mensaje ?? '',
    incentivo: tpl?.incentivo ?? '',
    canal: 'whatsapp',
    estado: 'activa',
    enviada_at: new Date().toISOString(),
  }).select('id').single()

  if (error || !data) return null
  cache.set(plantilla, data.id)
  return data.id
}

/** Marca a una familia en una plantilla. Devuelve false si no se pudo guardar. */
export async function marcarEnvio(
  plantilla: PlantillaId,
  memberId: string,
  estado: SendState,
  mensaje?: string,
): Promise<boolean> {
  const tenantId = getStoredTenant()?.id
  if (!tenantId) return false

  const campaignId = await ensureCampaign(plantilla, tenantId, mensaje)
  if (!campaignId) return false

  const ahora = new Date().toISOString()
  const { error } = await supabase.from('campaign_sends').upsert({
    tenant_id: tenantId,
    campaign_id: campaignId,
    member_id: memberId,
    estado,
    enviado_at: estado === 'enviado' ? ahora : null,
    respondido_at: estado === 'respondido' ? ahora : null,
    convertido_at: estado === 'convertido' ? ahora : null,
  }, { onConflict: 'campaign_id,member_id' })

  return !error
}

/** Se llama al cambiar de ludoteca: el id cacheado ya no vale. */
export function limpiarCacheCampanas() {
  cache.clear()
}
