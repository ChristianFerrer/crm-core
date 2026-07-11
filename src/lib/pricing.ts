// Tarifas y cálculo de coste de visita — fuente única.
// Resuelve tarifas por TIPO/FLUJO del servicio (no por el nombre de categoría,
// que es renombrable), evitando que Inicio, Agenda e Histórico difieran.

export const FALLBACK_RATE = 5

export type Rates = { adult: number; child: number; custodia: number }

type ServiceRow = {
  name?: string | null
  price?: number | null
  price_unit?: string | null
  tipo?: string | null
  flujo?: string | null
}

/** Deriva las tarifas (adulto/niño/custodia por hora) a partir de los servicios activos. */
export function resolveRates(rows: ServiceRow[] | null | undefined, fallback = FALLBACK_RATE): Rates {
  const list = rows ?? []
  const entradas = list.filter(r => r.tipo === 'entrada')
  const adult = entradas.find(r => /adult/i.test(r.name ?? '')) ?? entradas.find(r => r.price_unit !== 'hora')
  const child = entradas.find(r => /ni[ñn]/i.test(r.name ?? '')) ?? entradas.find(r => r.price_unit === 'hora')
  const cust = list.find(r => r.flujo === 'custodia' && r.price_unit === 'hora')
  return {
    adult: adult?.price != null ? Number(adult.price) : fallback,
    child: child?.price != null ? Number(child.price) : fallback,
    custodia: cust?.price != null ? Number(cust.price) : fallback,
  }
}

/** Coste de una visita por tiempo, por hora o fracción. */
export function calcHourlyCost(
  minutes: number,
  numChildren: number,
  visitType: 'entrada' | 'custodia',
  rates: Rates
): number {
  const fractions = Math.ceil(minutes / 60)
  if (visitType === 'custodia') {
    // Custodia: tarifa/hora × niños (el adulto acompañante no se cobra aparte)
    return fractions * rates.custodia * Math.max(1, numChildren)
  }
  // Entrada: adulto + cada niño, por hora o fracción
  return fractions * (rates.adult + numChildren * rates.child)
}
