/**
 * Métricas de negocio del Resumen (Fase 1).
 *
 * Funciones puras: reciben filas ya leídas de Supabase y devuelven números.
 * Así el cálculo se puede probar y reutilizar sin depender de la pantalla.
 *
 * De dónde sale el dinero, para no contarlo dos veces:
 *  - `visits.paid_amount` es el cobro de caja de una visita y YA incluye los
 *    consumos y descuenta el adelanto de la reserva.
 *  - `bookings.deposit_amount` (con `deposit_paid_at`) es el adelanto, que se
 *    cobró antes y no está en la visita.
 *  - La venta de bonos se estima con el precio del tipo de bono, porque hoy no
 *    se registra un cobro propio al asignarlo.
 */

export type VisitRow = {
  id: string
  member_id: string | null
  checked_in_at: string
  paid_at: string | null
  paid_amount: number | null
  adults_count: number | null
  children_count: number | null
}

export type BookingRow = {
  id: string
  date: string
  status: string | null
  amount: number | null
  deposit_amount: number | null
  deposit_paid_at: string | null
  payment_status: string | null
}

export type MembershipRow = {
  id: string
  member_id: string | null
  created_at: string
  expires_at: string | null
  sessions_remaining: number | null
  membership_type_id: string | null
}

export type CheckRow = {
  id: string
  closed_at: string | null
  products_cost: number | null
}

export type Period = { from: Date; to: Date }

const inRange = (iso: string | null | undefined, p: Period) => {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= p.from.getTime() && t < p.to.getTime()
}

/** Mes natural que contiene a `d`, desplazado `offsetMonths`. */
export function monthPeriod(d: Date, offsetMonths = 0): Period {
  const from = new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1)
  const to = new Date(d.getFullYear(), d.getMonth() + offsetMonths + 1, 1)
  return { from, to }
}

/** Mismo mes del año anterior, para comparar estacionalidad. */
export function lastYearPeriod(d: Date): Period {
  const from = new Date(d.getFullYear() - 1, d.getMonth(), 1)
  const to = new Date(d.getFullYear() - 1, d.getMonth() + 1, 1)
  return { from, to }
}

export type Revenue = {
  total: number
  visitas: number      // cobros de caja (entradas, tarifas por tiempo…)
  consumos: number     // parte estimada de tienda dentro de esos cobros
  adelantos: number    // señales de reserva cobradas en el periodo
  bonos: number        // venta estimada de bonos
  ticketMedio: number
  numVisitas: number
}

export function revenue(
  visits: VisitRow[],
  bookings: BookingRow[],
  memberships: MembershipRow[],
  checks: CheckRow[],
  typePrices: Record<string, number>,
  p: Period,
): Revenue {
  const paid = visits.filter(v => inRange(v.paid_at, p))
  const visitas = paid.reduce((s, v) => s + Number(v.paid_amount ?? 0), 0)

  // Los consumos ya están dentro de `paid_amount`; se aíslan solo para el desglose
  const consumos = checks
    .filter(c => inRange(c.closed_at, p))
    .reduce((s, c) => s + Number(c.products_cost ?? 0), 0)

  const adelantos = bookings
    .filter(b => b.status !== 'cancelled' && inRange(b.deposit_paid_at, p))
    .reduce((s, b) => s + Number(b.deposit_amount ?? 0), 0)

  const bonos = memberships
    .filter(m => inRange(m.created_at, p))
    .reduce((s, m) => s + (m.membership_type_id ? (typePrices[m.membership_type_id] ?? 0) : 0), 0)

  const numVisitas = visits.filter(v => inRange(v.checked_in_at, p)).length
  const total = visitas + adelantos + bonos

  return {
    total,
    visitas: visitas - consumos,
    consumos,
    adelantos,
    bonos,
    numVisitas,
    ticketMedio: numVisitas > 0 ? total / numVisitas : 0,
  }
}

/** Variación relativa; null cuando no hay base con la que comparar. */
export function delta(actual: number, previo: number): number | null {
  if (previo <= 0) return null
  return (actual - previo) / previo
}

export type RateResult = { rate: number; base: number; hits: number }

/**
 * Repetición: de las familias cuya PRIMERA visita cae en la ventana indicada,
 * cuántas volvieron dentro de los `days` días siguientes.
 *
 * La ventana termina hace `days` días para no contar familias que aún están a
 * tiempo de volver, que inflaría la cifra a la baja.
 */
export function repeatRate(visits: VisitRow[], now: Date, days = 30): RateResult {
  const firstByMember = new Map<string, number>()
  const allByMember = new Map<string, number[]>()
  for (const v of visits) {
    if (!v.member_id) continue
    const t = new Date(v.checked_in_at).getTime()
    const prev = firstByMember.get(v.member_id)
    if (prev == null || t < prev) firstByMember.set(v.member_id, t)
    const list = allByMember.get(v.member_id) ?? []
    list.push(t)
    allByMember.set(v.member_id, list)
  }

  const windowEnd = now.getTime() - days * 86_400_000
  const windowStart = windowEnd - 60 * 86_400_000

  let base = 0, hits = 0
  for (const [member, first] of firstByMember) {
    if (first < windowStart || first > windowEnd) continue
    base++
    const others = allByMember.get(member) ?? []
    if (others.some(t => t > first && t <= first + days * 86_400_000)) hits++
  }
  return { rate: base > 0 ? hits / base : 0, base, hits }
}

/**
 * Renovación de bonos: de los bonos que se agotaron o caducaron en el periodo,
 * cuántos titulares compraron otro dentro de los 30 días siguientes.
 */
export function bonoRenewalRate(memberships: MembershipRow[], now: Date, days = 30): RateResult {
  const from = new Date(now.getTime() - days * 86_400_000)
  const byMember = new Map<string, MembershipRow[]>()
  for (const m of memberships) {
    if (!m.member_id) continue
    const list = byMember.get(m.member_id) ?? []
    list.push(m)
    byMember.set(m.member_id, list)
  }

  let base = 0, hits = 0
  for (const [, list] of byMember) {
    const sorted = [...list].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i]
      const agotado = (m.sessions_remaining ?? 1) <= 0
      const caducado = !!m.expires_at && new Date(m.expires_at) < now
      if (!agotado && !caducado) continue
      // Fin aproximado del bono: la fecha de caducidad, o "ahora" si se agotó
      const fin = caducado && m.expires_at ? new Date(m.expires_at) : now
      if (fin < from) continue
      base++
      const siguiente = sorted[i + 1]
      if (siguiente && +new Date(siguiente.created_at) - +fin <= days * 86_400_000) hits++
    }
  }
  return { rate: base > 0 ? hits / base : 0, base, hits }
}

/** Dinero comprometido en reservas activas que aún no se ha cobrado. */
export function pendingRevenue(bookings: BookingRow[], p: Period): number {
  return bookings
    .filter(b => b.status !== 'cancelled' && b.payment_status !== 'paid')
    .filter(b => {
      const t = new Date(b.date + 'T12:00:00').getTime()
      return t >= p.from.getTime() && t < p.to.getTime()
    })
    .reduce((s, b) => s + Math.max(0, Number(b.amount ?? 0) - Number(b.deposit_amount ?? 0)), 0)
}

export type OccupancySlot = { dow: number; hour: number; avgPeople: number; pct: number; samples: number }

/**
 * Ocupación media por franja (día de la semana × hora), en % sobre el aforo.
 * Sirve para detectar los valles que se pueden llenar con una promoción.
 */
export function occupancyBySlot(visits: VisitRow[], capacity: number | null, p: Period): OccupancySlot[] {
  const acc = new Map<string, { people: number; days: Set<string> }>()
  for (const v of visits) {
    if (!inRange(v.checked_in_at, p)) continue
    const d = new Date(v.checked_in_at)
    const dow = (d.getDay() + 6) % 7
    const hour = d.getHours()
    const key = `${dow}-${hour}`
    const cur = acc.get(key) ?? { people: 0, days: new Set<string>() }
    cur.people += (v.adults_count ?? 1) + (v.children_count ?? 0)
    cur.days.add(d.toISOString().slice(0, 10))
    acc.set(key, cur)
  }

  const out: OccupancySlot[] = []
  for (const [key, val] of acc) {
    const [dow, hour] = key.split('-').map(Number)
    const samples = val.days.size
    const avgPeople = samples > 0 ? val.people / samples : 0
    out.push({
      dow,
      hour,
      avgPeople,
      pct: capacity && capacity > 0 ? avgPeople / capacity : 0,
      samples,
    })
  }
  return out.sort((a, b) => a.dow - b.dow || a.hour - b.hour)
}

/**
 * Con pocos datos un porcentaje engaña más de lo que informa: por debajo de
 * este umbral la pantalla lo dice en vez de mostrar la cifra.
 */
/** Actividad de un periodo, sin una sola cifra económica. */
export type Actividad = {
  visitas: number
  /** Familias distintas que han venido */
  familias: number
  /** Personas que han pisado la sala, adultos y niños */
  personas: number
  ninos: number
  /** Media de personas por visita */
  porVisita: number
}

/**
 * Lo que el CRM sí sabe con certeza: quién ha entrado y cuándo.
 *
 * A diferencia de `revenue()`, esto no depende de que el cobro se haya
 * registrado en la aplicación. Un cumpleaños cobrado por Bizum y no anotado
 * falsea los ingresos; la visita, en cambio, queda registrada siempre porque
 * es la que abre la puerta.
 */
export function actividad(visits: VisitRow[], p: Period): Actividad {
  const familias = new Set<string>()
  let visitas = 0, adultos = 0, ninos = 0
  for (const v of visits) {
    if (!inRange(v.checked_in_at, p)) continue
    visitas++
    if (v.member_id) familias.add(v.member_id)
    adultos += v.adults_count ?? 0
    ninos += v.children_count ?? 0
  }
  const personas = adultos + ninos
  return {
    visitas,
    familias: familias.size,
    personas,
    ninos,
    porVisita: visitas > 0 ? personas / visitas : 0,
  }
}

/** Franja con más ocupación media del periodo. Null si no hay datos. */
export function franjaPunta(slots: OccupancySlot[]): OccupancySlot | null {
  const conMuestra = slots.filter(s => s.samples >= 2)
  if (conMuestra.length === 0) return null
  return conMuestra.reduce((a, b) => (b.avgPeople > a.avgPeople ? b : a))
}

/**
 * Franja con MENOS ocupación media, entre las que tienen gente.
 *
 * Es la mitad accionable del par: en la punta ya no cabe nadie, así que ahí no
 * hay nada que ganar. El hueco del martes por la tarde es el que se puede
 * llenar con una oferta, y es el que alimenta la campaña de valle.
 *
 * Se exige un mínimo de muestra para no señalar como «valle» una hora en la que
 * simplemente no se abre.
 */
export function franjaValle(slots: OccupancySlot[]): OccupancySlot | null {
  const conMuestra = slots.filter(s => s.samples >= 2)
  if (conMuestra.length === 0) return null
  return conMuestra.reduce((a, b) => (b.avgPeople < a.avgPeople ? b : a))
}

/**
 * Referencia propia: la misma tasa en los meses anteriores.
 *
 * Un 43 % de repetición no dice nada por sí solo —¿es bueno?— y sin punto de
 * comparación no cambia ninguna decisión. En vez de inventar un dato de sector,
 * se compara con su propio historial.
 *
 * Se acumulan casos y aciertos en vez de promediar porcentajes: un mes con tres
 * casos no puede pesar lo mismo que uno con cuarenta.
 */
export function mediaPrevia(
  calc: (ref: Date) => RateResult,
  now: Date,
  meses = 3,
): number | null {
  let base = 0, hits = 0
  for (let i = 1; i <= meses; i++) {
    const r = calc(new Date(now.getTime() - i * 30 * 86_400_000))
    base += r.base
    hits += r.hits
  }
  return base >= MIN_SAMPLE ? hits / base : null
}

export const MIN_SAMPLE = 8

export function isReliable(base: number): boolean {
  return base >= MIN_SAMPLE
}

export function formatEur(n: number): string {
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}€`
}
