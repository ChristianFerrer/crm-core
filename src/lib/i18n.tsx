'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { type Lang, type TranslationKey, LANGUAGES, translate, detectDeviceLang, dict } from './i18n-core'

export type { Lang, TranslationKey }
export { LANGUAGES, translate, detectDeviceLang, dict }

const STORAGE_KEY = 'wm_language'
const COOKIE_KEY = 'wm_lang'

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
