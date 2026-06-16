import { supabase } from '@/lib/supabase'
import { Users, CalendarCheck, AlertTriangle, Clock } from 'lucide-react'
import Link from 'next/link'

export const revalidate = 0

async function getDashboardData() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [visitsToday, visitsMonth, expiringBonos, todayCheckins] = await Promise.all([
    supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .gte('checked_in_at', startOfDay),
    supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .gte('checked_in_at', startOfMonth),
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .lte('sessions_remaining', 2)
      .gt('sessions_remaining', 0),
    supabase
      .from('visits')
      .select('id, checked_in_at, families(name), memberships(sessions_remaining)')
      .gte('checked_in_at', startOfDay)
      .order('checked_in_at', { ascending: false })
      .limit(10),
  ])

  return {
    visitsToday: visitsToday.count ?? 0,
    visitsMonth: visitsMonth.count ?? 0,
    expiringBonos: expiringBonos.count ?? 0,
    todayCheckins: todayCheckins.data ?? [],
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function formatDate() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default async function DashboardPage() {
  const { visitsToday, visitsMonth, expiringBonos, todayCheckins } = await getDashboardData()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">El Bosc Màgic</h1>
        <p className="text-sm text-gray-500 capitalize">{formatDate()}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
          <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Users size={16} className="text-violet-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{visitsToday}</p>
          <p className="text-xs text-gray-500 leading-tight">Hoy</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
          <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <CalendarCheck size={16} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{visitsMonth}</p>
          <p className="text-xs text-gray-500 leading-tight">Este mes</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{expiringBonos}</p>
          <p className="text-xs text-gray-500 leading-tight">Bonos bajos</p>
        </div>
      </div>

      <Link
        href="/checkin"
        className="flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold rounded-2xl py-4 text-sm active:scale-95 transition-transform shadow-md w-full block"
        style={{ boxShadow: '0 4px 16px rgba(124,58,237,0.25)' }}
      >
        <Clock size={18} />
        Registrar entrada
      </Link>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Entradas de hoy</h2>
        {todayCheckins.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-400 border border-gray-100">
            Sin entradas todavía
          </div>
        ) : (
          <div className="space-y-2">
            {(todayCheckins as any[]).map((visit) => (
              <div
                key={visit.id}
                className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-sm text-gray-900">{visit.families?.name}</p>
                  <p className="text-xs text-gray-500">{formatTime(visit.checked_in_at)}</p>
                </div>
                {visit.memberships?.sessions_remaining != null && (
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      visit.memberships.sessions_remaining <= 2
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {visit.memberships.sessions_remaining} ses.
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
