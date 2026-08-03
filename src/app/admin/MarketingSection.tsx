'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, UserPlus, CheckCircle2, TrendingDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type EventRow = { event_type: string; path: string | null; session_id: string | null; referrer: string | null; utm_source: string | null; created_at: string }

export function MarketingSection() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const since = new Date(Date.now() - days * 86400000).toISOString()
      const { data } = await supabase
        .from('landing_events')
        .select('event_type, path, session_id, referrer, utm_source, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
      setEvents((data as EventRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [days])

  const pageViews = events.filter(e => e.event_type === 'page_view')
  const altaStarts = events.filter(e => e.event_type === 'alta_start')
  const altaCompletes = events.filter(e => e.event_type === 'alta_complete')

  const uniqueVisitors = new Set(pageViews.map(e => e.session_id)).size

  const funnel = [
    { label: 'Visitas a landing', value: pageViews.length, icon: Eye, color: 'text-iris' },
    { label: 'Inician registro', value: altaStarts.length, icon: UserPlus, color: 'text-amber' },
    { label: 'Completan registro', value: altaCompletes.length, icon: CheckCircle2, color: 'text-lime' },
  ]

  const conv1 = pageViews.length > 0 ? Math.round((altaStarts.length / pageViews.length) * 100) : 0
  const conv2 = altaStarts.length > 0 ? Math.round((altaCompletes.length / altaStarts.length) * 100) : 0

  // Visitas por día
  const byDay: Record<string, number> = {}
  pageViews.forEach(e => {
    const day = e.created_at.slice(0, 10)
    byDay[day] = (byDay[day] ?? 0) + 1
  })
  const dailyData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day: new Date(day + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), visitas: count }))

  // Fuentes de tráfico
  const bySource: Record<string, number> = {}
  pageViews.forEach(e => {
    const source = e.utm_source || (e.referrer ? new URL(e.referrer, 'https://x.com').hostname.replace('www.', '') : 'Directo')
    bySource[source] = (bySource[source] ?? 0) + 1
  })
  const sourceRows = Object.entries(bySource).sort(([, a], [, b]) => b - a).slice(0, 8)

  const chartProps = { style: { fontSize: 12 }, margin: { top: 5, right: 10, left: -20, bottom: 0 } }
  const axisProps = { stroke: 'var(--color-line2)', tick: { fill: 'var(--color-mist)', fontSize: 12 } }
  const gridProps = { stroke: 'var(--color-line)', strokeDasharray: '3 3' }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-semibold text-snow">Marketing</h2>
          <p className="text-sm text-fog mt-0.5">Tráfico de landing y funnel de conversión</p>
        </div>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="bg-surface2 border border-line rounded-lg px-3 py-2 text-xs text-fog outline-none shrink-0"
        >
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-48 rounded-2xl bg-surface border border-line animate-pulse" />)}</div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-mist">
          Aún no hay datos de tráfico registrados. El tracking se activó en esta actualización — vuelve a revisar en unos días.
        </div>
      ) : (
        <>
          {/* Funnel */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-snow mb-1">Funnel de adquisición</p>
            <p className="text-xs text-mist mb-4">{uniqueVisitors} visitantes únicos en el período</p>
            <div className="space-y-3">
              {funnel.map((step, i) => (
                <div key={step.label}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-surface2 flex items-center justify-center shrink-0`}>
                      <step.icon size={14} className={step.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-snow">{step.label}</span>
                        <span className={`text-lg font-bold ${step.color}`}>{step.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-line mt-1 overflow-hidden">
                        <div
                          className={`h-full ${step.color.replace('text-', 'bg-')}`}
                          style={{ width: `${pageViews.length > 0 ? Math.max(2, (step.value / pageViews.length) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {i < funnel.length - 1 && (
                    <p className="text-xs text-mist ml-11 mt-1 flex items-center gap-1">
                      <TrendingDown size={10} /> {i === 0 ? conv1 : conv2}% de conversión al siguiente paso
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Visitas por día */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-snow mb-5">Visitas a landing por día</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyData} {...chartProps}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="visitas" fill="var(--color-iris)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Fuentes de tráfico */}
          <div className="rounded-2xl border border-line bg-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <p className="text-sm font-semibold text-snow">Fuentes de tráfico</p>
            </div>
            <div className="divide-y divide-line">
              {sourceRows.map(([source, count]) => (
                <div key={source} className="px-5 py-3 flex items-center justify-between">
                  <span className="text-sm text-snow">{source}</span>
                  <span className="text-sm font-semibold text-iris">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
