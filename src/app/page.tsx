import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Users, Calendar, AlertTriangle, LogIn } from 'lucide-react'

export const revalidate = 0

export default async function DashboardPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  const [
    { data: todayVisits },
    { count: monthCount },
    { count: expiringCount },
  ] = await Promise.all([
    supabase
      .from('visits')
      .select('id, checked_in_at, family_id, membership_id, families(name), memberships(sessions_remaining)')
      .gte('checked_in_at', todayIso)
      .order('checked_in_at', { ascending: false }),
    supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .gte('checked_in_at', firstOfMonth),
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .lte('sessions_remaining', 2)
      .not('sessions_remaining', 'is', null),
  ])

  const uniqueFamiliesHoy = new Set(todayVisits?.map(v => v.family_id) ?? []).size

  const dateLabel = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6 pt-4">
        <h1 className="text-2xl font-bold text-violet-700">El Bosc Màgic</h1>
        <p className="text-sm text-gray-500 capitalize">{dateLabel}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="text-center">
          <CardContent className="pt-4 pb-4 px-2">
            <Users className="w-5 h-5 text-violet-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-gray-900">{uniqueFamiliesHoy}</div>
            <div className="text-xs text-gray-500 leading-tight">Familias hoy</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-4 px-2">
            <Calendar className="w-5 h-5 text-violet-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-gray-900">{monthCount ?? 0}</div>
            <div className="text-xs text-gray-500 leading-tight">Visitas mes</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-4 px-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-gray-900">{expiringCount ?? 0}</div>
            <div className="text-xs text-gray-500 leading-tight">Bonos bajos</div>
          </CardContent>
        </Card>
      </div>

      {/* Today's check-ins */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-700 mb-3">Entradas de hoy</h2>
        {todayVisits && todayVisits.length > 0 ? (
          <div className="space-y-2">
            {todayVisits.map((visit: any) => (
              <Card key={visit.id}>
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{visit.families?.name}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(visit.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {visit.memberships?.sessions_remaining !== null && visit.memberships?.sessions_remaining !== undefined && (
                    <span className={`text-sm font-semibold ${
                      visit.memberships.sessions_remaining <= 2 ? 'text-red-500' : 'text-violet-600'
                    }`}>
                      {visit.memberships.sessions_remaining} ses.
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">No hay entradas hoy todavía</p>
        )}
      </div>

      {/* CTA */}
      <Link href="/checkin">
        <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white h-12 text-base">
          <LogIn className="w-5 h-5 mr-2" />
          Registrar entrada
        </Button>
      </Link>
    </div>
  )
}
