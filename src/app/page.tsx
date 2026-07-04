import { supabase } from '@/lib/supabase'
import HomeClient from './HomeClient'

export const revalidate = 0

export default async function DashboardPage() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekFromNow = new Date(todayStart)
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  const todayMonth = now.getMonth() + 1  // 1-12
  const todayDay = now.getDate()

  const todayStr = todayStart.toISOString().split('T')[0]

  const [
    { data: todayVisits },
    { count: monthCount },
    { data: tenants },
    { data: allMembers },
    { data: birthdayBookings },
    { data: todayBookingsData },
  ] = await Promise.all([
    supabase
      .from('visits')
      .select('id, checked_in_at, checked_out_at, member_id, membership_id, visit_type, children_present, adults_count, children_count, members(name)')
      .gte('checked_in_at', todayStart.toISOString())
      .order('checked_in_at', { ascending: false }),
    supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .gte('checked_in_at', monthStart.toISOString()),
    supabase
      .from('tenants')
      .select('capacity')
      .limit(1),
    supabase
      .from('members')
      .select('id, name, families(name), children'),
    supabase
      .from('bookings')
      .select('id, title, start_time, end_time, guests, member_id, members(name)')
      .eq('date', todayStr)
      .eq('type', 'birthday'),
    supabase
      .from('bookings')
      .select('id, type, start_time, end_time, guests, executed_at')
      .eq('date', todayStr)
      .neq('status', 'cancelled'),
  ])

  const allVisits = (todayVisits ?? []) as any[]
  const todayCustodias = allVisits.filter((v: any) => v.visit_type === 'custodia')
  const dateLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const capacity: number | null = tenants?.[0]?.capacity ?? null

  // Collect children with today's birthday from all members
  const todayBirthdays: { name: string; birth_date: string; titularName: string; booking: { start_time: string | null; end_time: string | null; guests: number | null; title: string } | null }[] = []
  for (const member of (allMembers ?? []) as any[]) {
    for (const child of (member.children ?? []) as any[]) {
      if (!child.birth_date) continue
      const dob = new Date(child.birth_date)
      if (dob.getUTCMonth() + 1 !== todayMonth || dob.getUTCDate() !== todayDay) continue
      const booking = ((birthdayBookings ?? []) as any[]).find((b: any) => b.member_id === member.id) ?? null
      todayBirthdays.push({
        name: child.name,
        birth_date: child.birth_date,
        titularName: member.name,
        booking: booking ? { start_time: booking.start_time, end_time: booking.end_time, guests: booking.guests, title: booking.title } : null,
      })
    }
  }

  return (
    <HomeClient
      todayVisits={allVisits}
      todayCustodias={todayCustodias}
      monthCount={monthCount ?? 0}
      dateLabel={dateLabel}
      capacity={capacity}
      todayBirthdays={todayBirthdays}
      todayBookings={(todayBookingsData ?? []) as any[]}
    />
  )
}
