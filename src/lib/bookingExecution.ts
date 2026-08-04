import { supabase } from '@/lib/supabase'

export type ExecutableBooking = {
  id: string
  member_id: string | null
  type: 'birthday' | 'custodia' | 'other'
  guest_adults: number | null
  guest_children: number | null
  guests: number | null
}

/**
 * Calcula cuántos adultos y niños entran en sala al ejecutar una reserva.
 * Fuente ÚNICA de verdad — usada por Inicio y Agenda para que el aforo
 * cuente igual desde cualquier pantalla.
 *
 * Usa guest_adults / guest_children (no `guests`, que es el total combinado).
 */
export function bookingAttendance(b: ExecutableBooking): { adults: number; children: number } {
  const gAdults = b.guest_adults ?? 0
  const gChildren = b.guest_children ?? 0
  if (b.type === 'custodia') {
    // Custodia: sin adultos; los niños ya vienen agregados en guest_children
    return { adults: 0, children: gChildren > 0 ? gChildren : (b.guests ?? 1) }
  }
  if (b.type === 'birthday') {
    // Cumpleaños: titular + adultos invitados / niño del cumple + niños invitados
    return { adults: 1 + gAdults, children: 1 + gChildren }
  }
  // Otro: titular + adultos invitados; niños invitados aparte
  return { adults: 1 + gAdults, children: gChildren }
}

/**
 * Nº de personas que se muestra en la ficha/listado de una reserva.
 *
 * En custodia son SOLO niños, así que hay que leer `guest_children` — no
 * `guests`, que es el total e incluye adultos: con 2 adultos y 3 niños la
 * ficha decía "5 niños" mientras la sala (que sí usa `guest_children`)
 * mostraba 3.
 */
export function bookingGuestCount(b: Pick<ExecutableBooking, 'type' | 'guest_adults' | 'guest_children' | 'guests'>): number {
  const gAdults = b.guest_adults ?? 0
  const gChildren = b.guest_children ?? 0
  if (b.type === 'custodia') return gChildren > 0 ? gChildren : (b.guests ?? 0)
  return b.guests ?? gAdults + gChildren
}

/**
 * Ejecuta una reserva: crea la visita en sala y marca la reserva como ejecutada.
 * Orden seguro: primero inserta la visita y solo si tiene éxito marca executed_at,
 * para no dejar reservas "ejecutadas" sin visita asociada.
 * Devuelve un error legible si algo falla.
 */
export async function executeBooking(b: ExecutableBooking): Promise<{ error: string | null }> {
  const now = new Date().toISOString()

  if (b.member_id) {
    const { adults, children } = bookingAttendance(b)
    const { error } = await supabase.from('visits').insert({
      member_id: b.member_id,
      visit_type: b.type === 'custodia' ? 'custodia' : 'entrada',
      checked_in_at: now,
      adults_count: adults,
      children_count: children,
      children_present: [],
      booking_id: b.id,
    })
    if (error) return { error: error.message }
  }

  const { error: updErr } = await supabase
    .from('bookings')
    .update({ executed_at: now, status: 'confirmed' })
    .eq('id', b.id)
  if (updErr) return { error: updErr.message }

  return { error: null }
}
