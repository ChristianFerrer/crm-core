/**
 * Utilidades de la agenda: solapes, huecos y resumen del día.
 *
 * Van aparte de la pantalla porque las usan tanto la agenda como el
 * formulario de reserva (que valida el solape antes de guardar) y así el
 * criterio de "esto choca" es exactamente el mismo en los dos sitios.
 */

export type TimedBooking = {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  status: string | null
  service_id: string | null
  title?: string
}

/** Minutos desde medianoche; null si no hay hora. */
export function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

export function minutesToLabel(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Duración por defecto cuando la reserva no tiene hora de fin. */
const DEFAULT_DURATION = 120

export function bookingRange(b: TimedBooking): { start: number; end: number } | null {
  const start = toMinutes(b.start_time)
  if (start == null) return null
  const end = toMinutes(b.end_time) ?? start + DEFAULT_DURATION
  return { start, end: Math.max(end, start + 15) }
}

/**
 * Recurso (sala) que ocupa una reserva. Si el servicio no declara ninguno se
 * usa `__sin_recurso__`, de modo que las reservas sin sala asignada siguen
 * comparándose entre ellas y no contra las que sí la tienen.
 */
export function bookingResource(b: TimedBooking, resourceByService: Record<string, string | null>): string {
  const r = b.service_id ? resourceByService[b.service_id] : null
  return r && r.trim() ? r.trim().toLowerCase() : '__sin_recurso__'
}

/**
 * Reservas del mismo día que chocan con `b`: mismo recurso y horas que se
 * pisan. Las canceladas no cuentan ni como origen ni como destino.
 */
export function findConflicts<T extends TimedBooking>(
  b: T,
  sameDay: T[],
  resourceByService: Record<string, string | null>,
): T[] {
  if (b.status === 'cancelled') return []
  const range = bookingRange(b)
  if (!range) return []
  const res = bookingResource(b, resourceByService)
  return sameDay.filter(o => {
    if (o.id === b.id || o.status === 'cancelled') return false
    if (bookingResource(o, resourceByService) !== res) return false
    const r = bookingRange(o)
    return !!r && r.start < range.end && range.start < r.end
  })
}

/** Índice id → conflictos, para pintar la lista de un día en una pasada. */
export function conflictMap<T extends TimedBooking>(
  dayBookings: T[],
  resourceByService: Record<string, string | null>,
): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const b of dayBookings) {
    const c = findConflicts(b, dayBookings, resourceByService)
    if (c.length > 0) out[b.id] = c
  }
  return out
}

/** Horario del establecimiento "08:00-20:00" → [480, 1200]. */
export function parseSchedule(hours: string | null | undefined): { open: number; close: number } {
  const fallback = { open: 9 * 60, close: 21 * 60 }
  if (!hours) return fallback
  const [a, b] = hours.split('-')
  const open = toMinutes(a?.trim())
  const close = toMinutes(b?.trim())
  if (open == null || close == null || close <= open) return fallback
  return { open, close }
}

const DOW_CODES = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']

/** ¿El establecimiento abre ese día? Sin configuración, se asume que sí. */
export function isOpenOn(dateStr: string, scheduleDays: string | null | undefined): boolean {
  if (!scheduleDays) return true
  const days = scheduleDays.split(',').map(s => s.trim()).filter(Boolean)
  if (days.length === 0) return true
  const dow = (new Date(dateStr + 'T12:00:00').getDay() + 6) % 7
  return days.includes(DOW_CODES[dow])
}

export type DaySummary = {
  count: number
  adults: number
  children: number
  people: number
  pending: number
  cancelled: number
}

/** Resumen operativo de una jornada: cuánta gente y cuánto queda por cobrar. */
export function daySummary(
  dayBookings: { status: string | null; guest_adults: number | null; guest_children: number | null; guests: number | null; amount: number | null; deposit_amount: number | null; payment_status: string | null }[],
): DaySummary {
  let count = 0, adults = 0, children = 0, pending = 0, cancelled = 0
  for (const b of dayBookings) {
    if (b.status === 'cancelled') { cancelled++; continue }
    count++
    const a = b.guest_adults ?? 0
    const c = b.guest_children ?? 0
    adults += a
    children += c
    if (b.payment_status !== 'paid') pending += Math.max(0, (b.amount ?? 0) - (b.deposit_amount ?? 0))
  }
  return { count, adults, children, people: adults + children, pending, cancelled }
}

/** Huecos libres de al menos `minGap` minutos dentro del horario de apertura. */
export function freeGaps(
  dayBookings: TimedBooking[],
  open: number,
  close: number,
  minGap = 30,
): { start: number; end: number }[] {
  const busy = dayBookings
    .filter(b => b.status !== 'cancelled')
    .map(bookingRange)
    .filter((r): r is { start: number; end: number } => !!r)
    .sort((a, b) => a.start - b.start)

  const gaps: { start: number; end: number }[] = []
  let cursor = open
  for (const r of busy) {
    if (r.start - cursor >= minGap) gaps.push({ start: cursor, end: r.start })
    cursor = Math.max(cursor, r.end)
  }
  if (close - cursor >= minGap) gaps.push({ start: cursor, end: close })
  return gaps
}

/** "2 h 30 min" a partir de una cantidad de minutos. */
export function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/**
 * Reparte en columnas las reservas que se pisan, como hace Outlook: las que
 * comparten franja se muestran una al lado de otra en vez de taparse.
 *
 * Devuelve por id la columna que ocupa y en cuántas se divide su grupo.
 */
export function layoutColumns<T extends TimedBooking>(
  dayBookings: T[],
): Record<string, { col: number; cols: number }> {
  const items = dayBookings
    .filter(b => b.status !== 'cancelled')
    .map(b => ({ b, r: bookingRange(b) }))
    .filter((x): x is { b: T; r: { start: number; end: number } } => !!x.r)
    .sort((a, b) => a.r.start - b.r.start || a.r.end - b.r.end)

  const out: Record<string, { col: number; cols: number }> = {}
  let group: typeof items = []
  let groupEnd = -1

  const flush = () => {
    if (group.length === 0) return
    // Asignación voraz: cada reserva ocupa la primera columna libre
    const colEnds: number[] = []
    const assigned: { id: string; col: number }[] = []
    for (const { b, r } of group) {
      let col = colEnds.findIndex(end => end <= r.start)
      if (col === -1) { col = colEnds.length; colEnds.push(r.end) }
      else colEnds[col] = r.end
      assigned.push({ id: b.id, col })
    }
    const cols = colEnds.length
    for (const a of assigned) out[a.id] = { col: a.col, cols }
    group = []
    groupEnd = -1
  }

  for (const item of items) {
    if (group.length > 0 && item.r.start >= groupEnd) flush()
    group.push(item)
    groupEnd = Math.max(groupEnd, item.r.end)
  }
  flush()
  return out
}
