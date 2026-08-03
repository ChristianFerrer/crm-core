'use client'

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, color: 'var(--color-snow)', fontSize: 12 },
  labelStyle: { color: 'var(--color-mist)', fontSize: 12 },
}

type GrowthPoint = { label: string; adultos: number | null; ninos: number | null }

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

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col h-full">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-snow">Miembros · este año</p>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white border-2 border-surface ${delta > 0 ? 'bg-lime' : delta < 0 ? 'bg-rose' : 'bg-fog'}`}>
          {delta > 0 ? `+${delta}` : delta === 0 ? '±0' : delta} este año
        </span>
      </div>
      <p className="text-xs text-mist mb-4">
        {lastMonthAdults} adultos · {lastMonthChildren} niños al inicio del año
      </p>

      <div className="flex-1 min-h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--color-mist)', fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fill: 'var(--color-mist)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...TOOLTIP_STYLE} cursor={{ stroke: 'var(--color-line)' }}
              formatter={(v: any, name: any) => [v, name === 'adultos' ? 'Adultos' : 'Niños']} />
            <Line type="monotone" dataKey="adultos" stroke="var(--color-lime)" strokeWidth={2} dot={false} name="adultos" />
            <Line type="monotone" dataKey="ninos" stroke="var(--color-cyan-300)" strokeWidth={2} dot={false} name="ninos" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-4 mt-3 pt-3 border-t border-line">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-lime inline-block shrink-0" />
          <span className="text-xs text-fog">Adultos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-cyan-300 inline-block shrink-0" />
          <span className="text-xs text-fog">Niños</span>
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
    <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col h-full">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-snow">Visitas · últimos 7 días</p>
        {capacity != null && (
          <span className="text-xs font-semibold text-amber">Aforo {capacity}</span>
        )}
      </div>
      <p className="text-xs text-mist mb-4">Adultos y niños por día</p>

      <div className="flex-1 min-h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--color-mist)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--color-mist)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, Math.ceil(max * 1.15)]} />
            <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'var(--color-surface2)' }}
              formatter={(v: any, key: any) => [v, key === 'adultos' ? 'Adultos' : 'Niños']} />
            {capacity != null && (
              <ReferenceLine y={capacity} stroke="var(--color-amber)" strokeDasharray="4 3" strokeWidth={1.5} />
            )}
            <Bar dataKey="adultos" stackId="a" fill="var(--color-lime)" />
            <Bar dataKey="ninos" stackId="a" fill="var(--color-cyan-300)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

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
  const data = [
    { name: 'Con bono', ok: withFullBono, bajo: withLowBono },
    { name: 'Sin bono', ok: withoutBono,  bajo: 0 },
  ]
  const bonoPct = total > 0 ? Math.round(((withFullBono + withLowBono) / total) * 100) : 0

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col h-full">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-snow">Bonos activos</p>
        <span className="text-xs font-bold text-iris">{bonoPct}% con bono</span>
      </div>
      <p className="text-xs text-mist mb-4">Sobre el total de miembros</p>

      <div className="flex-1 min-h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fill: 'var(--color-mist)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'var(--color-mist)', fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
            <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'var(--color-surface2)' }}
              formatter={(v: any, key: any) =>
                key === 'ok'
                  ? [v, data[0]?.name === 'Con bono' ? 'Bono activo' : 'Sin bono']
                  : [v, 'Bono bajo']
              }
            />
            <Bar dataKey="ok" stackId="a" fill="transparent">
              {data.map((_, i) => (
                <Cell key={i} fill={i === 0 ? 'var(--color-iris)' : 'var(--color-amber)'} />
              ))}
            </Bar>
            <Bar dataKey="bajo" stackId="a" radius={[0, 4, 4, 0]} fill="var(--color-rose)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-3 mt-3 pt-3 border-t border-line flex-wrap">
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

type HourPoint = { hour: string; visitas: number }

export function PeakHoursChart({ data }: { data: HourPoint[] }) {
  const max = Math.max(1, ...data.map(d => d.visitas))
  const peak = data.reduce((a, b) => (b.visitas > a.visitas ? b : a), { hour: '', visitas: 0 } as HourPoint)

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col h-full">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-snow">Horas pico</p>
        {peak.visitas > 0 && <span className="text-xs font-semibold text-iris">Pico {peak.hour}</span>}
      </div>
      <p className="text-xs text-mist mb-4">Frecuencia de visitas por hora (últimos 30 días)</p>

      <div className="flex-1 min-h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: 'var(--color-mist)', fontSize: 12 }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fill: 'var(--color-mist)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, Math.ceil(max * 1.15)]} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [v, 'Visitas']} />
            <Line type="monotone" dataKey="visitas" stroke="var(--color-iris)" strokeWidth={2.5}
              dot={(props: any) => {
                const isPeak = peak.visitas > 0 && props.payload.visitas === peak.visitas
                return <circle key={props.key ?? props.index} cx={props.cx} cy={props.cy} r={isPeak ? 4 : 0} fill="var(--color-iris)" stroke="var(--color-surface)" strokeWidth={1.5} />
              }}
              activeDot={{ r: 4, fill: 'var(--color-iris)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-fog mt-3 pt-3 border-t border-line">
        {peak.visitas > 0
          ? <>Mayor afluencia alrededor de las <span className="text-iris font-semibold">{peak.hour}</span>.</>
          : 'Aún no hay suficientes visitas registradas.'}
      </p>
    </div>
  )
}

type MonthVisitPoint = { label: string; visitas: number | null }

export function VisitsPerMonthChart({ data }: { data: MonthVisitPoint[] }) {
  const max = Math.max(1, ...data.map(d => d.visitas ?? 0))
  const total = data.reduce((s, d) => s + (d.visitas ?? 0), 0)

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col h-full">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-snow">Visitas · este año</p>
        <span className="text-xs font-bold text-lime">{total} en total</span>
      </div>
      <p className="text-xs text-mist mb-4">Afluencia mensual (enero – diciembre)</p>

      <div className="flex-1 min-h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--color-mist)', fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fill: 'var(--color-mist)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, Math.ceil(max * 1.15)]} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [v, 'Visitas']} />
            <Line type="monotone" dataKey="visitas" stroke="var(--color-lime)" strokeWidth={2.5} dot={{ r: 2.5, fill: 'var(--color-lime)' }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
