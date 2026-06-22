'use client'

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

type GrowthPoint = { label: string; adultos: number; ninos: number }

export function MemberGrowthChart({
  data,
  lastMonthAdults,
  lastMonthChildren,
  newThisMonth,
}: {
  data: GrowthPoint[]
  lastMonthAdults: number
  lastMonthChildren: number
  newThisMonth: number
}) {
  const delta = newThisMonth
  const today = new Date().getDate()
  const visible = data.slice(0, today)

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-snow">Miembros · mes en curso</p>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${delta > 0 ? 'bg-lime/15 text-lime' : delta < 0 ? 'bg-rose/15 text-rose' : 'bg-fog/15 text-fog'}`}>
          {delta > 0 ? `+${delta}` : delta === 0 ? '±0' : delta} este mes
        </span>
      </div>
      <p className="text-xs text-mist mb-4">
        {lastMonthAdults} adultos · {lastMonthChildren} niños al inicio del mes
      </p>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={visible} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
          <CartesianGrid stroke="#1e2530" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
            interval={Math.max(0, Math.floor(visible.length / 6) - 1)} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, color: '#f0f4f8' }}
            labelStyle={{ color: '#6b7280', fontSize: 11 }}
            cursor={{ stroke: '#1e2530' }}
            formatter={(v: any, name: any) => [v, name === 'adultos' ? 'Adultos' : 'Niños']}
          />
          <Line type="monotone" dataKey="adultos" stroke="#c6f24e" strokeWidth={2} dot={false} name="adultos" />
          <Line type="monotone" dataKey="ninos" stroke="#67e8f9" strokeWidth={2} dot={false} name="ninos" />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-3 pt-3 border-t border-line">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-lime inline-block shrink-0" />
          <span className="text-xs text-fog">Adultos acumulado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-cyan-300 inline-block shrink-0" />
          <span className="text-xs text-fog">Niños acumulado</span>
        </div>
      </div>
    </div>
  )
}

type VisitBucket = { label: string; adultos: number; ninos: number }

export function VisitMiniChart({
  data,
  capacity,
}: {
  data: VisitBucket[]
  capacity: number | null
}) {
  const max = Math.max(1, ...data.map(d => d.adultos + d.ninos), capacity ?? 0)

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between mb-5">
        <p className="text-sm font-semibold text-snow">Visitas · últimos 7 días</p>
        {capacity && (
          <span className="text-xs font-semibold text-amber">Aforo {capacity}</span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid stroke="#1e2530" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, Math.ceil(max * 1.15)]} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, color: '#f0f4f8', fontSize: 12 }}
            labelStyle={{ color: '#6b7280', fontSize: 11 }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(v: any, key: any) => [v, key === 'adultos' ? 'Adultos' : 'Niños']}
          />
          {capacity != null && (
            <ReferenceLine y={capacity} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} />
          )}
          <Bar dataKey="adultos" stackId="a" fill="#c6f24e" />
          <Bar dataKey="ninos" stackId="a" fill="#67e8f9" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-3 pt-3 border-t border-line">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-lime shrink-0" />
          <span className="text-xs text-fog">Adultos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-cyan-300 shrink-0" />
          <span className="text-xs text-fog">Niños</span>
        </div>
        {capacity != null && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-amber shrink-0" />
            <span className="text-xs text-fog">Aforo máx.</span>
          </div>
        )}
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

  // 2 stacked bars: "Con bono" (healthy iris + low rose) and "Sin bono" (fog)
  const data = [
    { name: 'Con bono', ok: withFullBono, bajo: withLowBono },
    { name: 'Sin bono', ok: withoutBono,  bajo: 0 },
  ]

  const bonoPct = total > 0 ? Math.round(((withFullBono + withLowBono) / total) * 100) : 0

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-snow">Bonos activos</p>
        <span className="text-xs font-bold text-iris">{bonoPct}% con bono</span>
      </div>
      <p className="text-xs text-mist mb-4">Sobre el total de miembros</p>

      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, color: '#f0f4f8' }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(v: any, key: any) =>
              key === 'ok'
                ? [v, data[0]?.name === 'Con bono' ? 'Bono activo' : 'Sin bono']
                : [v, 'Bono bajo']
            }
          />
          <Bar dataKey="ok" stackId="a" radius={[0, 0, 0, 0]}
            fill="transparent"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? '#8b8bff' : '#f59e0b'} />
            ))}
          </Bar>
          <Bar dataKey="bajo" stackId="a" radius={[0, 4, 4, 0]} fill="#f43f5e" />
        </BarChart>
      </ResponsiveContainer>

      <div className="flex gap-3 mt-2 pt-3 border-t border-line flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-iris shrink-0" />
          <span className="text-xs text-fog"><span className="text-iris font-semibold">{withFullBono}</span> bono activo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose shrink-0" />
          <span className="text-xs text-fog"><span className="text-rose font-semibold">{withLowBono}</span> bono bajo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber shrink-0" />
          <span className="text-xs text-fog"><span className="text-amber font-semibold">{withoutBono}</span> sin bono</span>
        </div>
      </div>
    </div>
  )
}
