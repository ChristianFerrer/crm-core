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
