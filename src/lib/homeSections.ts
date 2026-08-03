'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getStoredTenant, loadAndStoreTenant } from './tenant'

/** Secciones de la pantalla de Inicio que se pueden mostrar u ocultar. */
export type HomeSections = {
  agenda: boolean
  metricas: boolean
  nuevaReserva: boolean
}

export const HOME_SECTION_DEFAULTS: HomeSections = { agenda: true, metricas: true, nuevaReserva: true }

/** Resuelve el establecimiento activo (contempla la vista de super admin). */
async function resolveTenantId(): Promise<string | null> {
  try {
    const impersonating = localStorage.getItem('viewingAsTenant')
    if (impersonating) return JSON.parse(impersonating).id ?? null
  } catch {}
  let tenant = getStoredTenant()
  if (!tenant) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) tenant = await loadAndStoreTenant(session.user.email)
  }
  return tenant?.id ?? null
}

/**
 * Preferencia del establecimiento (columna `tenants.home_sections`), por lo que
 * se comparte entre dispositivos y usuarios del mismo centro.
 *
 * `initial` permite pintar el valor ya resuelto en el servidor y evitar el
 * parpadeo de mostrar las secciones antes de saber si están desactivadas.
 */
export function useHomeSections(initial?: HomeSections) {
  const [sections, setSections] = useState<HomeSections>(initial ?? HOME_SECTION_DEFAULTS)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(!!initial)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const id = await resolveTenantId()
      if (cancelled || !id) { setLoaded(true); return }
      setTenantId(id)
      // Con `initial` ya tenemos el valor del servidor; no hace falta releer
      if (initial) { setLoaded(true); return }
      const { data } = await supabase.from('tenants').select('home_sections').eq('id', id).maybeSingle()
      if (cancelled) return
      setSections({ ...HOME_SECTION_DEFAULTS, ...((data?.home_sections as Partial<HomeSections>) ?? {}) })
      setLoaded(true)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggle(key: keyof HomeSections) {
    const next = { ...sections, [key]: !sections[key] }
    setSections(next) // optimista: el interruptor responde al instante
    if (!tenantId) return
    const { error } = await supabase.from('tenants').update({ home_sections: next }).eq('id', tenantId)
    if (error) setSections(sections) // revierte si la escritura falla
  }

  return { sections, toggle, loaded }
}
