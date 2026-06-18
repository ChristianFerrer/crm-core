import { supabase } from './supabase'

function parseUA(ua: string) {
  const isPwa = window.matchMedia('(display-mode: standalone)').matches

  // OS
  let os = 'Desconocido'
  if (/android/i.test(ua)) os = 'Android'
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'
  else if (/windows/i.test(ua)) os = 'Windows'
  else if (/mac os/i.test(ua)) os = 'macOS'
  else if (/linux/i.test(ua)) os = 'Linux'

  // Browser
  let browser = 'Desconocido'
  if (/edg\//i.test(ua)) browser = 'Edge'
  else if (/chrome/i.test(ua) && !/chromium/i.test(ua)) browser = 'Chrome'
  else if (/firefox/i.test(ua)) browser = 'Firefox'
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari'
  else if (/samsung/i.test(ua)) browser = 'Samsung'

  // Device type
  let device_type = 'desktop'
  if (/ipad|tablet/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) device_type = 'tablet'
  else if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) device_type = 'mobile'

  return { os, browser, device_type, is_pwa: isPwa }
}

export async function trackTenantSession(tenantId: string) {
  try {
    const ua = navigator.userAgent
    const { os, browser, device_type, is_pwa } = parseUA(ua)
    await supabase.from('tenant_sessions').insert({
      tenant_id: tenantId,
      user_agent: ua,
      device_type,
      browser,
      os,
      is_pwa,
    })
  } catch {
    // non-critical, fail silently
  }
}
