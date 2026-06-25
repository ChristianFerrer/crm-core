import { supabase } from '@/lib/supabase'
import { trackTenantSession } from '@/lib/trackSession'

export type CurrentTenant = { id: string; name: string; admin_email: string | null; terms_accepted_at: string | null }

export async function loadAndStoreTenant(email: string): Promise<CurrentTenant | null> {
  const { data } = await supabase
    .from('tenants')
    .select('id, name, admin_email, terms_accepted_at')
    .ilike('admin_email', email.trim())
    .limit(1)
    .maybeSingle()
  if (data) {
    localStorage.setItem('currentTenant', JSON.stringify(data))
    trackTenantSession(data.id)
    return data
  }
  return null
}

export function getStoredTenant(): CurrentTenant | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('currentTenant')
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

export function clearStoredTenant() {
  if (typeof window !== 'undefined') localStorage.removeItem('currentTenant')
}
