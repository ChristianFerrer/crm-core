'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getStoredTenant, loadAndStoreTenant } from './tenant'

/**
 * Preferencias de interfaz de toda la aplicación, guardadas por ludoteca
 * (`tenants.ui_prefs`), no por dispositivo: si el dueño oculta algo, queda
 * oculto también en la tablet del mostrador.
 *
 * Distinto de `home_sections`, que solo afecta a la pantalla de Inicio.
 */
export type UiPrefs = {
  /**
   * Catálogo de iconos. Es una herramienta de diseño, no una pantalla del
   * negocio, así que por defecto está oculta: un menú con «Iconos» en medio
   * resta credibilidad delante de un cliente.
   */
  mostrarIconos: boolean
}

export const UI_PREF_DEFAULTS: UiPrefs = { mostrarIconos: false }

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

export function useUiPrefs() {
  const [prefs, setPrefs] = useState<UiPrefs>(UI_PREF_DEFAULTS)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const id = await resolveTenantId()
      if (cancelled || !id) { setLoaded(true); return }
      setTenantId(id)
      const { data } = await supabase.from('tenants').select('ui_prefs').eq('id', id).maybeSingle()
      if (cancelled) return
      setPrefs({ ...UI_PREF_DEFAULTS, ...((data?.ui_prefs as Partial<UiPrefs>) ?? {}) })
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [])

  async function toggle(key: keyof UiPrefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next) // optimista: el interruptor responde al instante
    if (!tenantId) return
    const { error } = await supabase.from('tenants').update({ ui_prefs: next }).eq('id', tenantId)
    if (error) setPrefs(prefs) // revierte si la escritura falla
  }

  return { prefs, toggle, loaded }
}
