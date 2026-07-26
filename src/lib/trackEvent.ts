import { supabase } from './supabase'

const SESSION_KEY = 'wm_anon_session'

function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'unknown'
  }
}

function getUtm(): { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null } {
  try {
    const params = new URLSearchParams(window.location.search)
    return {
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
    }
  } catch {
    return { utm_source: null, utm_medium: null, utm_campaign: null }
  }
}

// Evento público, fire-and-forget — no bloquea ni rompe la UI si falla.
export function trackEvent(eventType: 'page_view' | 'alta_start' | 'alta_step' | 'alta_complete', metadata: Record<string, unknown> = {}) {
  try {
    const path = window.location.pathname
    const referrer = document.referrer || null
    const session_id = getSessionId()
    const utm = getUtm()
    supabase.from('landing_events').insert({
      event_type: eventType,
      path,
      session_id,
      referrer,
      ...utm,
      metadata,
    }).then(() => {}, () => {})
  } catch {
    // no-op: el tracking nunca debe romper la experiencia del usuario
  }
}
