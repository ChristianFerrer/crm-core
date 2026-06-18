'use client'

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

type GrowthPoint = { label: string; total: number; nuevos: number }

export function MemberGrowthChart({
  data,
  lastMonthTotal,
  totalAdults,
  totalChildren,
  newThisMonth,
}: {
  data: GrowthPoint[]
  lastMonthTotal: number
  totalAdults: number
  totalChildren: number
  newThisMonth: number
}) {
  const delta = newThisMonth
  // Only show up to today
  const today = new Date().getDate()
  const visible = data.slice(0, today)

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-snow">Miembros · mes en curso</p>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${delta > 0 ? 'bg-lime/15 text-lime' : delta < 0 ? 'bg-rose/15 text-rose' : 'bg-fog/15 text-fog'}`}>
          {delta > 0 ? `+${delta}` : delta === 0 ? '0' : delta} este mes
        </span>
      </div>
      <p className="text-xs text-mist mb-4">{lastMonthTotal} al inicio del mes</p>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={visible} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
          <CartesianGrid stroke="#1e2530" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
            interval={Math.floor(visible.length / 6)} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, color: '#f0f4f8' }}
            labelStyle={{ color: '#6b7280', fontSize: 11 }}
            cursor={{ stroke: '#1e2530' }}
            formatter={(v: any, name: any) => [v, name === 'total' ? 'Total acumulado' : 'Nuevos ese día']}
          />
          <Line type="monotone" dataKey="total" stroke="#c6f24e" strokeWidth={2} dot={false} name="total" />
          <Line type="monotone" dataKey="nuevos" stroke="#67e8f9" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="nuevos" />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-3 pt-3 border-t border-line">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-lime shrink-0" />
          <span className="text-xs text-fog">Total acumulado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-cyan-300 shrink-0 border-dashed" />
          <span className="text-xs text-fog">Nuevos por día</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-fog"><span className="text-lime font-semibold">{totalAdults}</span> adultos</span>
          <span className="text-xs text-fog">·</span>
          <span className="text-xs text-fog"><span className="text-cyan-300 font-semibold">{totalChildren}</span> niños</span>
        </div>
      </div>
    </div>
  )
}

export function BonoDistChart({
  withFullBono,
  withLowBono,
  withoutBono,
}: {
  withFullBono: number
  withLowBono: number
  withoutBono: number
}) {
  const total = withFullBono + withLowBono + withoutBono
  const fullPct = total > 0 ? (withFullBono / total) * 100 : 0
  const lowPct  = total > 0 ? (withLowBono  / total) * 100 : 0

  const data = [
    { name: 'Bono activo',  value: withFullBono, fill: '#8b8bff' },
    { name: 'Bono bajo',    value: withLowBono,  fill: '#f59e0b' },
    { name: 'Sin bono',     value: withoutBono,  fill: '#6b7280' },
  ]

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-snow">Bonos activos</p>
        <span className="text-xs font-bold text-iris">{Math.round(fullPct + lowPct)}% con bono</span>
      </div>
      <p className="text-xs text-mist mb-3">Sobre el total de miembros</p>

      {/* Segmented bar */}
      <div className="h-3 w-full rounded-full bg-line overflow-hidden flex mb-4">
        <div className="h-full bg-iris transition-all duration-500" style={{ width: `${fullPct}%` }} />
        <div className="h-full bg-amber transition-all duration-500" style={{ width: `${lowPct}%` }} />
        <div className="h-full bg-fog/40 transition-all duration-500" style={{ width: `${100 - fullPct - lowPct}%` }} />
      </div>

      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, color: '#f0f4f8' }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(v: any) => [v, 'miembros']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex gap-3 mt-2 pt-3 border-t border-line flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-iris shrink-0" />
          <span className="text-xs text-fog"><span className="text-iris font-semibold">{withFullBono}</span> activo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber shrink-0" />
          <span className="text-xs text-fog"><span className="text-amber font-semibold">{withLowBono}</span> bajo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-fog/60 shrink-0" />
          <span className="text-xs text-fog"><span className="text-fog font-semibold">{withoutBono}</span> sin bono</span>
        </div>
      </div>
    </div>
  )
}
