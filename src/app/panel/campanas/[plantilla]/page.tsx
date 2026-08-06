import { createServerSupabase } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { buildMemberStats } from '@/lib/segments'
import { revenue, monthPeriod } from '@/lib/metrics'
import { resolveRecipients, templateById, type BirthdayLead, type BonoLead, type PlantillaId } from '@/lib/campaigns'
import { CampaignClient, type ExistingSend } from './CampaignClient'

export const revalidate = 0

/**
 * Una campaña por plantilla. Los destinatarios se resuelven en el servidor con
 * los mismos módulos que el panel, así que quien aparece aquí es exactamente
 * quien cuenta allí.
 */
export default async function CampaignPage({ params }: { params: Promise<{ plantilla: string }> }) {
  const { plantilla } = await params
  const template = templateById(plantilla)
  if (!template || template.id === 'manual') notFound()

  const supabase = await createServerSupabase()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const in45 = new Date(now.getTime() + 45 * 86_400_000)
  const weekFromNow = new Date(now.getTime() + 7 * 86_400_000).toISOString().split('T')[0]

  const [
    { data: members },
    { data: visits },
    { data: memberships },
    { data: types },
    { data: bookings },
    { data: checks },
    { data: campaign },
  ] = await Promise.all([
    supabase.from('members').select('id, name, phone, created_at, children, marketing_consent_at, marketing_consent_revoked_at, families(name)').limit(5000),
    supabase.from('visits').select('id, member_id, checked_in_at, paid_at, paid_amount, adults_count, children_count')
      .gte('checked_in_at', new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString()).limit(20000),
    supabase.from('memberships').select('id, member_id, created_at, expires_at, sessions_remaining, membership_type_id').limit(5000),
    supabase.from('membership_types').select('id, price'),
    supabase.from('bookings').select('id, date, status, amount, deposit_amount, deposit_paid_at, payment_status').limit(5000),
    supabase.from('open_checks').select('id, closed_at, products_cost').not('closed_at', 'is', null).limit(5000),
    supabase.from('campaigns').select('id').eq('plantilla', plantilla).eq('estado', 'activa')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const memberRows = (members ?? []) as any[]
  const visitRows = (visits ?? []) as any[]
  const membershipRows = (memberships ?? []) as any[]

  const stats = buildMemberStats(memberRows, visitRows, now)

  // ── Cumpleaños en los próximos 45 días ──────────────────────────────────
  const birthdays: BirthdayLead[] = []
  const vistos = new Set<string>()
  for (const m of memberRows) {
    for (const c of (m.children ?? []) as any[]) {
      if (!c.birth_date) continue
      const dob = new Date(c.birth_date)
      const next = new Date(now.getFullYear(), dob.getUTCMonth(), dob.getUTCDate())
      if (next < now) next.setFullYear(next.getFullYear() + 1)
      if (next > in45) continue
      const key = `${m.id}-${c.name}`
      if (vistos.has(key)) continue
      vistos.add(key)
      birthdays.push({
        member_id: m.id, member_name: m.name,
        child_name: c.name, birthday_day: dob.getUTCDate(),
      })
    }
  }

  // ── Bonos con 2 sesiones o menos, o que caducan esta semana ─────────────
  const nameById = new Map(memberRows.map(m => [m.id, m.name]))
  const bonos: BonoLead[] = membershipRows
    .filter(b => {
      const pocas = b.sessions_remaining != null && b.sessions_remaining <= 2 && b.sessions_remaining > 0
      const caduca = !!b.expires_at && b.expires_at >= todayStr && b.expires_at <= weekFromNow
      return pocas || caduca
    })
    .map(b => ({
      member_id: b.member_id,
      member_name: nameById.get(b.member_id) ?? '—',
      sessions: b.sessions_remaining,
      expires_at: b.expires_at,
    }))

  // Ticket medio del mes: sirve para estimar el dinero en juego por familia
  const typePrices: Record<string, number> = Object.fromEntries(
    ((types ?? []) as any[]).map(t => [t.id, Number(t.price ?? 0)])
  )
  const rev = revenue(visitRows, (bookings ?? []) as any[], membershipRows, (checks ?? []) as any[], typePrices, monthPeriod(now))
  const precioCumple = Math.max(
    120,
    ((bookings ?? []) as any[]).filter(b => b.amount).reduce((s, b, _i, arr) => s + Number(b.amount) / arr.length, 0),
  )

  const todos = resolveRecipients(template.id as PlantillaId, {
    stats, birthdays, bonos,
    ticketMedio: rev.ticketMedio || 12,
    precioCumple,
  })

  // ── Consentimiento de marketing ────────────────────────────────────────
  // Un contacto sobre SU reserva o SU bono es gestión del servicio; mandar una
  // promoción necesita permiso explícito. Solo se filtra en las campañas que
  // son publicidad.
  const esPublicidad = template.id === 'valle' || template.id === 'segunda_visita'
  const consentById = new Map(
    memberRows.map(m => [m.id, !!m.marketing_consent_at && !m.marketing_consent_revoked_at])
  )
  const recipients = esPublicidad ? todos.filter(r => consentById.get(r.memberId)) : todos
  const sinConsentimiento = esPublicidad ? todos.length - recipients.length : 0

  // Envíos ya registrados de la campaña activa de esta plantilla
  let existingSends: ExistingSend[] = []
  const campaignId = (campaign as any)?.id ?? null
  if (campaignId) {
    const { data } = await supabase
      .from('campaign_sends')
      .select('member_id, estado, enviado_at')
      .eq('campaign_id', campaignId)
    existingSends = (data ?? []) as ExistingSend[]
  }

  return (
    <CampaignClient
      template={template}
      recipients={recipients.sort((a, b) => b.valor - a.valor)}
      existingSends={existingSends}
      campaignId={campaignId}
      sinConsentimiento={sinConsentimiento}
    />
  )
}
