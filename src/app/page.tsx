import { supabase } from '@/lib/supabase'
import HomeClient from './HomeClient'

export const revalidate = 0

export default async function DashboardPage() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekFromNow = new Date(todayStart)
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  const [
    { data: todayVisits },
    { count: monthCount },
    { data: expiringMembers },
    { data: tenants },
  ] = await Promise.all([
    supabase
      .from('visits')
      .select('id, checked_in_at, checked_out_at, member_id, membership_id, visit_type, members(name)')
      .gte('checked_in_at', todayStart.toISOString())
      .order('checked_in_at', { ascending: false }),
    supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .gte('checked_in_at', monthStart.toISOString()),
    supabase
      .from('memberships')
      .select('id, expires_at, membership_types(name), members(id, name)')
      .lte('expires_at', weekFromNow.toISOString().split('T')[0])
      .gte('expires_at', todayStart.toISOString().split('T')[0])
      .limit(5),
    supabase
      .from('tenants')
      .select('capacity')
      .limit(1),
  ])

  const allVisits = (todayVisits ?? []) as any[]
  const todayCustodias = allVisits.filter((v: any) => v.visit_type === 'custodia')
  const dateLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const capacity: number | null = tenants?.[0]?.capacity ?? null

  return (
    <HomeClient
      todayVisits={allVisits}
      todayCustodias={todayCustodias}
      expiringMembers={(expiringMembers ?? []) as any}
      monthCount={monthCount ?? 0}
      dateLabel={dateLabel}
      capacity={capacity}
    />
  )
}
