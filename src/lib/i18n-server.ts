import { cookies, headers } from 'next/headers'
import { translate, type Lang, type TranslationKey } from './i18n-core'

export async function getServerLang(): Promise<Lang> {
  const c = (await cookies()).get('wm_lang')?.value
  if (c === 'en' || c === 'ca' || c === 'es' || c === 'de') return c
  const al = ((await headers()).get('accept-language') || '').toLowerCase()
  if (al.includes('ca')) return 'ca'
  if (al.startsWith('en') || al.includes(',en')) return 'en'
  if (al.startsWith('de') || al.includes(',de')) return 'de'
  return 'es'
}

export async function getT() {
  const lang = await getServerLang()
  return (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
}
