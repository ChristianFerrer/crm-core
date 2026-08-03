'use client'

import { useEffect, useState } from 'react'

/** Secciones de la pantalla de Inicio que se pueden mostrar u ocultar. */
export type HomeSections = {
  agenda: boolean
  metricas: boolean
}

const STORAGE_KEY = 'wm_home_sections'
const DEFAULTS: HomeSections = { agenda: true, metricas: true }

export function readHomeSections(): HomeSections {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULTS
}

/**
 * Preferencia por dispositivo, igual que el tema y el idioma. Se lee en un
 * efecto (no en el primer render) para no romper la hidratación del servidor.
 */
export function useHomeSections() {
  const [sections, setSections] = useState<HomeSections>(DEFAULTS)

  useEffect(() => { setSections(readHomeSections()) }, [])

  function toggle(key: keyof HomeSections) {
    setSections(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  return { sections, toggle }
}
