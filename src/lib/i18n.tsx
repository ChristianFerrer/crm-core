'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Lang = 'es' | 'en' | 'ca'
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'ca', label: 'Català' },
]

const STORAGE_KEY = 'wm_language'

const dict = {
  nav_inicio:   { es: 'Inicio',   en: 'Home',    ca: 'Inici' },
  nav_miembros: { es: 'Miembros', en: 'Members', ca: 'Membres' },
  nav_agenda:   { es: 'Agenda',   en: 'Schedule', ca: 'Agenda' },
  nav_panel:    { es: 'Panel',    en: 'Dashboard', ca: 'Tauler' },
  cerrar_sesion:{ es: 'Cerrar sesión', en: 'Log out', ca: 'Tanca la sessió' },
  expandir_menu:{ es: 'Expandir menú', en: 'Expand menu', ca: 'Expandeix el menú' },
  contraer_menu:{ es: 'Contraer menú', en: 'Collapse menu', ca: 'Redueix el menú' },
  idioma:       { es: 'Idioma', en: 'Language', ca: 'Idioma' },
  idioma_auto:  { es: 'Automático (dispositivo)', en: 'Automatic (device)', ca: 'Automàtic (dispositiu)' },
} as const

export type TranslationKey = keyof typeof dict

function detectDeviceLang(): Lang {
  if (typeof navigator === 'undefined') return 'es'
  const raw = (navigator.language || 'es').toLowerCase()
  if (raw.startsWith('ca')) return 'ca'
  if (raw.startsWith('en')) return 'en'
  return 'es'
}

type LanguageContextValue = {
  lang: Lang
  isAuto: boolean
  setLang: (lang: Lang | 'auto') => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'es',
  isAuto: true,
  setLang: () => {},
  t: key => dict[key].es,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es')
  const [isAuto, setIsAuto] = useState(true)

  useEffect(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem(STORAGE_KEY) } catch {}
    if (stored === 'en' || stored === 'ca' || stored === 'es') {
      setLangState(stored)
      setIsAuto(false)
    } else {
      setLangState(detectDeviceLang())
      setIsAuto(true)
    }
  }, [])

  function setLang(next: Lang | 'auto') {
    if (next === 'auto') {
      try { localStorage.removeItem(STORAGE_KEY) } catch {}
      setLangState(detectDeviceLang())
      setIsAuto(true)
    } else {
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      setLangState(next)
      setIsAuto(false)
    }
  }

  function t(key: TranslationKey) {
    return dict[key][lang]
  }

  return (
    <LanguageContext.Provider value={{ lang, isAuto, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
