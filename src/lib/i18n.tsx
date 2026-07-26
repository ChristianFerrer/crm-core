'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { dictCommon } from './i18n-dicts/common'
import { dictHome } from './i18n-dicts/home'
import { dictMiembros } from './i18n-dicts/miembros'
import { dictCalendario } from './i18n-dicts/calendario'
import { dictPanelResumen } from './i18n-dicts/panel-resumen'
import { dictPanelConfig } from './i18n-dicts/panel-config'
import { dictFamilias } from './i18n-dicts/familias'
import { dictLogin } from './i18n-dicts/login'
import { dictShared } from './i18n-dicts/shared'

export type Lang = 'es' | 'en' | 'ca'
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'ca', label: 'Català' },
]

const STORAGE_KEY = 'wm_language'
const COOKIE_KEY = 'wm_lang'

export const dict = {
  ...dictCommon,
  ...dictHome,
  ...dictMiembros,
  ...dictCalendario,
  ...dictPanelResumen,
  ...dictPanelConfig,
  ...dictFamilias,
  ...dictLogin,
  ...dictShared,
} as const

export type TranslationKey = keyof typeof dict

export function translate(lang: Lang, key: TranslationKey, vars?: Record<string, string | number>): string {
  let str: string = dict[key][lang] ?? dict[key].es
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, String(v))
  }
  return str
}

export function detectDeviceLang(): Lang {
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
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'es',
  isAuto: true,
  setLang: () => {},
  t: key => translate('es', key),
})

function syncCookie(lang: Lang) {
  try { document.cookie = `${COOKIE_KEY}=${lang}; path=/; max-age=31536000` } catch {}
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es')
  const [isAuto, setIsAuto] = useState(true)

  useEffect(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem(STORAGE_KEY) } catch {}
    const resolved = stored === 'en' || stored === 'ca' || stored === 'es' ? stored : detectDeviceLang()
    setLangState(resolved)
    setIsAuto(!(stored === 'en' || stored === 'ca' || stored === 'es'))
    syncCookie(resolved)
  }, [])

  function setLang(next: Lang | 'auto') {
    if (next === 'auto') {
      try { localStorage.removeItem(STORAGE_KEY) } catch {}
      const resolved = detectDeviceLang()
      setLangState(resolved)
      setIsAuto(true)
      syncCookie(resolved)
    } else {
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      setLangState(next)
      setIsAuto(false)
      syncCookie(next)
    }
  }

  function t(key: TranslationKey, vars?: Record<string, string | number>) {
    return translate(lang, key, vars)
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
