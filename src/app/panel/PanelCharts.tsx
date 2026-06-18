'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

type GrowthPoint = { label: string; nuevos: number }
type BonoPoint = { name: string; value: number; fill: string }

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
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-snow">Miembros · mes en curso</p>
        <div className="text-right">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${delta > 0 ? 'bg-lime/15 text-lime' : delta < 0 ? 'bg-rose/15 text-rose' : 'bg-fog/15 text-fog'}`}>
            {delta > 0 ? `+${delta}` : delta} este mes
          </span>
        </div>
      </div>
      <p className="text-xs text-mist mb-4">{lastMonthTotal} al inicio del mes</p>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 0, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke="#1e2530" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, color: '#f0f4f8' }}
            labelStyle={{ color: '#6b7280', fontSize: 11 }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(v: any) => [v, 'Nuevos miembros']}
          />
          <Bar dataKey="nuevos" fill="#c6f24e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-3 pt-3 border-t border-line">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-lime shrink-0" />
          <span className="text-xs text-fog"><span className="text-lime font-semibold">{totalAdults}</span> adultos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-300 shrink-0" />
          <span className="text-xs text-fog"><span className="text-cyan-300 font-semibold">{totalChildren}</span> niños</span>
        </div>
      </div>
    </div>
  )
}

export function BonoDistChart({ withBono, withoutBono }: { withBono: number; withoutBono: number }) {
  const total = withBono + withoutBono
  const bonoPct = total > 0 ? Math.round((withBono / total) * 100) : 0

  const data: BonoPoint[] = [
    { name: 'Con bono', value: withBono, fill: '#8b8bff' },
    { name: 'Sin bono', value: withoutBono, fill: '#f59e0b' },
  ]

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-snow">Bonos activos</p>
        <span className="text-xs font-bold text-iris">{bonoPct}% con bono</span>
      </div>
      <p className="text-xs text-mist mb-4">Sobre el total de miembros</p>

      <div className="h-3 w-full rounded-full bg-line overflow-hidden flex mb-4">
        <div className="h-full bg-iris transition-all duration-500" style={{ width: `${bonoPct}%` }} />
        <div className="h-full bg-amber transition-all duration-500" style={{ width: `${100 - bonoPct}%` }} />
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
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

      <div className="flex gap-4 mt-2 pt-3 border-t border-line">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-iris shrink-0" />
          <span className="text-xs text-fog"><span className="text-iris font-semibold">{withBono}</span> con bono</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber shrink-0" />
          <span className="text-xs text-fog"><span className="text-amber font-semibold">{withoutBono}</span> sin bono</span>
        </div>
      </div>
    </div>
  )
}
