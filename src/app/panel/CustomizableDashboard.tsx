'use client'

import { useEffect, useState } from 'react'
import { Responsive, WidthProvider, type Layout, type LayoutItem } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import { GripVertical, X, Plus, Settings2, Check } from 'lucide-react'
import { StatFlipCards } from './StatFlipCards'
import { MemberGrowthChart, BonoDistChart, VisitMiniChart, PeakHoursChart, VisitsPerMonthChart } from './PanelCharts'
import { getStoredTenant } from '@/lib/tenant'

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

const META: Record<PanelId, { title: string; defW: number; defH: number; minH: number; minW: number }> = {
  stats:      { title: 'Indicadores',      defW: 12, defH: 3, minH: 3, minW: 4 },
  growth:     { title: 'Miembros',         defW: 6,  defH: 8, minH: 6, minW: 3 },
  visitsYear: { title: 'Visitas por mes',  defW: 6,  defH: 8, minH: 6, minW: 3 },
  bono:       { title: 'Bonos',            defW: 4,  defH: 8, minH: 6, minW: 3 },
  visits7:    { title: 'Visitas 7 días',   defW: 4,  defH: 8, minH: 6, minW: 3 },
  peak:       { title: 'Horas pico',       defW: 4,  defH: 8, minH: 6, minW: 3 },
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

// Claves namespaced por tenant (evita que en un equipo compartido un usuario
// vea el layout de otro establecimiento).
function lsKeys() {
  const t = getStoredTenant()?.id ?? 'anon'
  return { layout: `wm_panel_layout_v1_${t}`, hidden: `wm_panel_hidden_v1_${t}` }
}

function stackLayout(visible: PanelId[], cols: number): LayoutItem[] {
  let y = 0
  return visible.map(id => {
    const h = META[id].defH
    const item: LayoutItem = { i: id, x: 0, y, w: cols, h, minH: META[id].minH }
    y += h
    return item
  })
}

export function CustomizableDashboard({ data }: { data: DashboardData }) {
  const [mounted, setMounted] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT)
  const [hidden, setHidden] = useState<PanelId[]>([])

  useEffect(() => {
    try {
      const { layout: kL, hidden: kH } = lsKeys()
      const rawL = localStorage.getItem(kL)
      if (rawL) setLayout(JSON.parse(rawL))
      const rawH = localStorage.getItem(kH)
      if (rawH) setHidden(JSON.parse(rawH))
    } catch {}
    setMounted(true)
  }, [])

  function persistLayout(l: LayoutItem[]) {
    setLayout(l)
    try { localStorage.setItem(lsKeys().layout, JSON.stringify(l)) } catch {}
  }
  function persistHidden(h: PanelId[]) {
    setHidden(h)
    try { localStorage.setItem(lsKeys().hidden, JSON.stringify(h)) } catch {}
  }

  function removePanel(id: PanelId) {
    persistHidden([...hidden, id])
    persistLayout(layout.filter(l => l.i !== id))
  }
  function addPanel(id: PanelId) {
    persistHidden(hidden.filter(h => h !== id))
    const maxY = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
    persistLayout([...layout, { i: id, x: 0, y: maxY, w: META[id].defW, h: META[id].defH, minH: META[id].minH, minW: META[id].minW }])
    setAddOpen(false)
  }
  function resetLayout() {
    persistHidden([])
    persistLayout(DEFAULT_LAYOUT)
  }

  const visible = ORDER.filter(id => !hidden.includes(id))
  // Asegura una entrada de layout por panel visible
  const lgLayout: LayoutItem[] = visible.map(id =>
    layout.find(l => l.i === id) ?? { i: id, x: 0, y: 999, w: META[id].defW, h: META[id].defH, minH: META[id].minH, minW: META[id].minW }
  )
  const layouts = {
    lg: lgLayout,
    md: lgLayout,
    sm: stackLayout(visible, 6),
    xs: stackLayout(visible, 2),
    xxs: stackLayout(visible, 2),
  }

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
        {visible.map(id => <div key={id}>{renderPanel(id)}</div>)}
      </div>
    )
  }

  return (
    <div>
      {/* Barra de control del layout — solo en pantallas donde la edición persiste */}
      <div className="hidden sm:flex items-center gap-2 mb-3">
        <button
          onClick={() => { setEditing(e => !e); setAddOpen(false) }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border ${
            editing ? 'border-lime bg-lime/10 text-lime' : 'border-line bg-surface text-fog hover:text-snow'
          }`}
        >
          {editing ? <><Check size={13} /> Listo</> : <><Settings2 size={13} /> Personalizar</>}
        </button>

        {editing && (
          <>
            <div className="relative">
              <button
                onClick={() => setAddOpen(o => !o)}
                disabled={hidden.length === 0}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-surface text-fog border border-line hover:text-snow transition-colors disabled:opacity-40"
              >
                <Plus size={13} /> Añadir
              </button>
              {addOpen && hidden.length > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAddOpen(false)} />
                  <div className="absolute left-0 z-50 mt-1 w-48 rounded-xl border border-line bg-surface shadow-2xl overflow-hidden py-1">
                    {hidden.map(id => (
                      <button key={id} onClick={() => addPanel(id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-fog hover:text-snow hover:bg-surface2 transition-colors">
                        <Plus size={12} /> {META[id].title}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button onClick={resetLayout}
              className="ml-auto text-xs font-semibold text-mist hover:text-fog transition-colors">
              Restablecer
            </button>
          </>
        )}
      </div>

      <ResponsiveGrid
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1024, md: 768, sm: 600, xs: 400, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 6, xs: 2, xxs: 2 }}
        rowHeight={30}
        margin={[16, 16]}
        isDraggable={editing}
        isResizable={editing}
        draggableHandle=".panel-drag"
        onLayoutChange={(_cur: Layout, all: Partial<Record<string, Layout>>) => { const lg = all?.lg; if (editing && lg) persistLayout([...lg]) }}
      >
        {visible.map(id => (
          <div key={id} className="relative">
            {editing && (
              <div className="panel-drag absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-2 py-1 rounded-t-2xl bg-carbon/70 backdrop-blur-sm cursor-move">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-fog">
                  <GripVertical size={12} /> {META[id].title}
                </span>
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => removePanel(id)}
                  className="text-mist hover:text-rose transition-colors"
                  title="Quitar"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            <div className={`h-full ${editing ? 'ring-1 ring-line2 rounded-2xl overflow-hidden pointer-events-none' : ''}`}>
              {renderPanel(id)}
            </div>
          </div>
        ))}
      </ResponsiveGrid>
    </div>
  )
}
