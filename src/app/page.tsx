import { supabase } from '@/lib/supabase'
import HomeClient from './HomeClient'

export const revalidate = 0

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: dateParam } = await searchParams

  // Determine selected date — fallback to today if param is absent or malformed
  const todayStr = new Date().toISOString().split('T')[0]
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr

  const dayStart = new Date(selectedDate + 'T00:00:00')
  const dayEnd   = new Date(selectedDate + 'T23:59:59.999')
  const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1)

  const selectedMonth = dayStart.getMonth() + 1
  const selectedDay   = dayStart.getDate()

  const dateLabel = dayStart.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

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
      .select('id, checked_in_at, checked_out_at, member_id, membership_id, visit_type, children_present, adults_count, children_count, members(name), memberships(sessions_remaining, membership_types(name, sessions, price))')
      // Visits active during the selected day:
      // started before/on dayEnd AND (still open OR checked out during/after dayStart)
      .lte('checked_in_at', dayEnd.toISOString())
      .or(`checked_out_at.is.null,checked_out_at.gte.${dayStart.toISOString()}`)
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
      .select('id, name, family_id, families(name), children'),
    supabase
      .from('bookings')
      .select('id, title, start_time, end_time, guests, member_id, members(name)')
      .eq('date', selectedDate)
      .eq('type', 'birthday'),
    supabase
      .from('bookings')
      .select('id, type, title, start_time, end_time, guests, executed_at, member_id, members(name)')
      .eq('date', selectedDate)
      .neq('status', 'cancelled'),
  ])

  const allVisits = (todayVisits ?? []) as any[]
  const todayCustodias = allVisits.filter((v: any) => v.visit_type === 'custodia')
  const capacity: number | null = tenants?.[0]?.capacity ?? null

  // Children with birthday on the selected day
  const todayBirthdays: { name: string; birth_date: string; titularName: string; booking: { start_time: string | null; end_time: string | null; guests: number | null; title: string } | null }[] = []
  for (const member of (allMembers ?? []) as any[]) {
    for (const child of (member.children ?? []) as any[]) {
      if (!child.birth_date) continue
      const dob = new Date(child.birth_date)
      if (dob.getUTCMonth() + 1 !== selectedMonth || dob.getUTCDate() !== selectedDay) continue
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
      selectedDate={selectedDate}
      todayStr={todayStr}
      allMembers={(allMembers ?? []) as any[]}
    />
  )
}
