'use client'

import { useEffect, useState } from 'react'
import { Responsive, WidthProvider, type LayoutItem } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import { StatFlipCards } from './StatFlipCards'
import { MemberGrowthChart, BonoDistChart, VisitMiniChart, PeakHoursChart, VisitsPerMonthChart } from './PanelCharts'

const ResponsiveGrid = WidthProvider(Responsive)

type GrowthPoint = { label: string; adultos: number | null; ninos: number | null }
type VisitBucket = { label: string; adultos: number; ninos: number }
type HourPoint = { hour: string; visitas: number }
type MonthVisitPoint = { label: string; visitas: number | null }

export type DashboardData = {
  stats: { totalMembers: number; todayCount: number; monthCount: number }
  growth: { data: GrowthPoint[]; lastMonthAdults: number; lastMonthChildren: number; newThisMonth: number }
  bono: { withFullBono: number; withLowBono: number; withoutBono: number }
  visit7: { data: VisitBucket[]; capacity: number | null }
  peak: { data: HourPoint[] }
  visitsYear: { data: MonthVisitPoint[] }
}

type PanelId = 'stats' | 'growth' | 'visitsYear' | 'bono' | 'visits7' | 'peak'

const META: Record<PanelId, { defW: number; defH: number; minH: number; minW: number }> = {
  stats:      { defW: 12, defH: 3, minH: 3, minW: 4 },
  growth:     { defW: 6,  defH: 8, minH: 6, minW: 3 },
  visitsYear: { defW: 6,  defH: 8, minH: 6, minW: 3 },
  bono:       { defW: 4,  defH: 8, minH: 6, minW: 3 },
  visits7:    { defW: 4,  defH: 8, minH: 6, minW: 3 },
  peak:       { defW: 4,  defH: 8, minH: 6, minW: 3 },
}
const ORDER: PanelId[] = ['stats', 'growth', 'visitsYear', 'bono', 'visits7', 'peak']

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'stats',      x: 0, y: 0,  w: 12, h: 3, minH: 3, minW: 4 },
  { i: 'growth',     x: 0, y: 3,  w: 6,  h: 8, minH: 6, minW: 3 },
  { i: 'visitsYear', x: 6, y: 3,  w: 6,  h: 8, minH: 6, minW: 3 },
  { i: 'bono',       x: 0, y: 11, w: 4,  h: 8, minH: 6, minW: 3 },
  { i: 'visits7',    x: 4, y: 11, w: 4,  h: 8, minH: 6, minW: 3 },
  { i: 'peak',       x: 8, y: 11, w: 4,  h: 8, minH: 6, minW: 3 },
]

function stackLayout(cols: number): LayoutItem[] {
  let y = 0
  return ORDER.map(id => {
    const h = META[id].defH
    const item: LayoutItem = { i: id, x: 0, y, w: cols, h, minH: META[id].minH }
    y += h
    return item
  })
}

const layouts = {
  lg: DEFAULT_LAYOUT,
  md: DEFAULT_LAYOUT,
  sm: stackLayout(6),
  xs: stackLayout(2),
  xxs: stackLayout(2),
}

export function CustomizableDashboard({ data }: { data: DashboardData }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  function renderPanel(id: PanelId) {
    switch (id) {
      case 'stats': return <StatFlipCards totalMembers={data.stats.totalMembers} todayCount={data.stats.todayCount} monthCount={data.stats.monthCount} />
      case 'growth': return <MemberGrowthChart data={data.growth.data} lastMonthAdults={data.growth.lastMonthAdults} lastMonthChildren={data.growth.lastMonthChildren} newThisMonth={data.growth.newThisMonth} />
      case 'visitsYear': return <VisitsPerMonthChart data={data.visitsYear.data} />
      case 'bono': return <BonoDistChart withFullBono={data.bono.withFullBono} withLowBono={data.bono.withLowBono} withoutBono={data.bono.withoutBono} />
      case 'visits7': return <VisitMiniChart data={data.visit7.data} capacity={data.visit7.capacity} />
      case 'peak': return <PeakHoursChart data={data.peak.data} />
    }
  }

  if (!mounted) {
    // Fallback estático para SSR / primer render
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {ORDER.map(id => <div key={id}>{renderPanel(id)}</div>)}
      </div>
    )
  }

  return (
    <ResponsiveGrid
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1024, md: 768, sm: 600, xs: 400, xxs: 0 }}
      cols={{ lg: 12, md: 12, sm: 6, xs: 2, xxs: 2 }}
      rowHeight={30}
      margin={[16, 16]}
      isDraggable={false}
      isResizable={false}
    >
      {ORDER.map(id => (
        <div key={id} className="h-full">
          {renderPanel(id)}
        </div>
      ))}
    </ResponsiveGrid>
  )
}
