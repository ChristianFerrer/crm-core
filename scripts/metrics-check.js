/**
 * Comprobación de las métricas y la segmentación con casos conocidos.
 *
 *   npx esbuild src/lib/metrics.ts src/lib/segments.ts --outdir=.tmp --format=cjs --platform=node
 *   node scripts/metrics-check.js
 *
 * No es un runner de tests (el proyecto no tiene uno); es una red de seguridad
 * para no romper el cálculo sin enterarse. Ya cazó un fallo: los campeones
 * caían en «fieles» con un umbral fijo de visitas/mes.
 */
const M = require('../.tmp/metrics.js')
const S = require('../.tmp/segments.js')

const now = new Date('2026-08-06T12:00:00Z')

// ── revenue ──
const visits = [
  { id:'1', member_id:'a', checked_in_at:'2026-08-01T10:00:00Z', paid_at:'2026-08-01T12:00:00Z', paid_amount:20, adults_count:1, children_count:2 },
  { id:'2', member_id:'b', checked_in_at:'2026-08-02T10:00:00Z', paid_at:'2026-08-02T12:00:00Z', paid_amount:30, adults_count:2, children_count:1 },
  { id:'3', member_id:'a', checked_in_at:'2026-07-02T10:00:00Z', paid_at:'2026-07-02T12:00:00Z', paid_amount:10, adults_count:1, children_count:1 },
]
const bookings = [{ id:'b1', date:'2026-08-10', status:'confirmed', amount:100, deposit_amount:50, deposit_paid_at:'2026-08-03T10:00:00Z', payment_status:'partial' }]
const memberships = [{ id:'m1', member_id:'a', created_at:'2026-08-04T10:00:00Z', expires_at:'2026-09-04', sessions_remaining:10, membership_type_id:'t1' }]
const checks = [{ id:'c1', closed_at:'2026-08-01T13:00:00Z', products_cost:8 }]
const r = M.revenue(visits, bookings, memberships, checks, { t1: 60 }, M.monthPeriod(now))
console.log('revenue', JSON.stringify(r))
console.assert(r.total === 20+30+50+60, 'total mal: ' + r.total)
console.assert(r.consumos === 8 && r.visitas === 42, 'desglose mal')
console.assert(r.numVisitas === 2, 'numVisitas mal')
console.log('pendiente', M.pendingRevenue(bookings, M.monthPeriod(now)))
console.assert(M.pendingRevenue(bookings, M.monthPeriod(now)) === 50)
console.log('delta', M.delta(100, 80), M.delta(10, 0))

// ── repeat rate: primera visita hace 45 días, repitió a los 10 ──
const d = (n) => new Date(now.getTime() - n*86400000).toISOString()
const rr = M.repeatRate([
  { id:'x1', member_id:'x', checked_in_at:d(45), paid_at:null, paid_amount:null, adults_count:1, children_count:0 },
  { id:'x2', member_id:'x', checked_in_at:d(35), paid_at:null, paid_amount:null, adults_count:1, children_count:0 },
  { id:'y1', member_id:'y', checked_in_at:d(50), paid_at:null, paid_amount:null, adults_count:1, children_count:0 },
], now, 30)
console.log('repeatRate', JSON.stringify(rr))
console.assert(rr.base === 2 && rr.hits === 1, 'repeatRate mal')

// ── segmentos ──
const members = [
  { id:'camp', name:'Campeona', phone:'600111222', created_at:d(200), families:null },
  { id:'riesgo', name:'Riesgo', phone:'600333444', created_at:d(300), families:null },
  { id:'nuevo', name:'Nuevo', phone:null, created_at:d(30), families:null },
  { id:'dormido', name:'Dormido', phone:'600555666', created_at:d(400), families:null },
]
const vs = []
// campeona: cada 5 días, 24 visitas, última ayer
for (let i=0;i<24;i++) vs.push({ member_id:'camp', checked_in_at:d(1+i*5), paid_amount:15 })
// riesgo: ritmo 7 días pero última hace 30
for (let i=0;i<6;i++) vs.push({ member_id:'riesgo', checked_in_at:d(30+i*7), paid_amount:10 })
// nuevo: una visita hace 25 días
vs.push({ member_id:'nuevo', checked_in_at:d(25), paid_amount:12 })
// dormido: varias, la última hace 120
for (let i=0;i<5;i++) vs.push({ member_id:'dormido', checked_in_at:d(120+i*10), paid_amount:9 })

const stats = S.buildMemberStats(members, vs, now)
for (const s of stats) console.log(s.name.padEnd(10), s.segmento.padEnd(20), 'ritmo', s.ritmoDias, 'ult', Math.round(s.diasDesdeUltima), 'ltv', s.ltv)
const by = Object.fromEntries(stats.map(s => [s.memberId, s.segmento]))
console.assert(by.camp === 'campeones', 'campeon mal: ' + by.camp)
console.assert(by.riesgo === 'en_riesgo', 'riesgo mal: ' + by.riesgo)
console.assert(by.nuevo === 'nuevos_sin_repetir', 'nuevo mal: ' + by.nuevo)
console.assert(by.dormido === 'dormidos', 'dormido mal: ' + by.dormido)
console.log('counts', JSON.stringify(S.countBySegment(stats)))
console.log('avgLtv', S.avgLtv(stats).toFixed(2))
console.log('\nOK')

// ── Fase 3: campañas ──
const C = require('../.tmp/campaigns.js')
const ctx = {
  stats,
  birthdays: [{ member_id: 'b1', member_name: 'Laura Mas', child_name: 'Aina', birthday_day: 22 }],
  bonos: [{ member_id: 'riesgo', member_name: 'Riesgo', sessions: 2, expires_at: null }],
  ticketMedio: 14,
  precioCumple: 130,
}
const cumple = C.resolveRecipients('cumpleanos', ctx)
console.log('\ncumpleaños ->', JSON.stringify(cumple))
console.assert(cumple.length === 1 && cumple[0].vars.niño === 'Aina', 'destinatarios cumpleaños mal')
console.assert(cumple[0].valor === 130, 'valor cumpleaños mal')

const react = C.resolveRecipients('reactivacion', ctx)
console.assert(react.length === 1 && react[0].memberId === 'riesgo', 'reactivación mal')

const msg = C.renderMessage('Hola {nombre}, el cumple de {niño} y {noexiste}', cumple[0].vars)
console.log('mensaje ->', msg)
console.assert(msg === 'Hola Laura, el cumple de Aina y ', 'render mal: ' + msg)

console.assert(C.waLink('600 111 222', 'hola').startsWith('https://wa.me/34600111222?text='), 'waLink mal')
console.assert(C.waLink('123', 'x') === null, 'waLink debería rechazar móviles cortos')

const acciones = C.suggestedActions(ctx, {}, now)
console.log('acciones ->', acciones.map(a => `${a.titulo} (${a.valor.toFixed(0)}€)`))
console.assert(acciones.length > 0 && acciones[0].valor >= acciones[acciones.length-1].valor, 'orden por valor mal')
console.assert(acciones.every(a => !!a.horizonte), 'falta el horizonte en alguna acción')
// Una campaña con pocos destinatarios pero valiosa no debe quedar fuera de corte
console.assert(acciones.some(a => a.plantilla === 'cumpleanos'), 'el cumpleaños no debería recortarse')

// Contactada ayer: dentro de la ventana de reintento del cumpleaños (300 días)
const acciones2 = C.suggestedActions(ctx, { 'cumpleanos:b1': d(1) }, now)
console.assert(!acciones2.some(a => a.plantilla === 'cumpleanos'), 'lo contactado debería desaparecer')
console.log('tras contactar ->', acciones2.map(a => a.plantilla))

// Pasada la ventana vuelve a proponerse: es lo que evita que el bloque se vacíe para siempre
const acciones3 = C.suggestedActions(ctx, { 'cumpleanos:b1': d(320) }, now)
console.assert(acciones3.some(a => a.plantilla === 'cumpleanos'), 'pasada la ventana debería reaparecer')

// El bono se puede repetir al mes, el cumpleaños no
const tplBono = C.templateById('bono_bajo')
const tplCumple = C.templateById('cumpleanos')
console.assert(C.puedeReproponer(tplBono, 'riesgo', { 'bono_bajo:riesgo': d(40) }, now), 'bono a los 40 días debería reproponerse')
console.assert(!C.puedeReproponer(tplBono, 'riesgo', { 'bono_bajo:riesgo': d(10) }, now), 'bono a los 10 días no debería reproponerse')
console.assert(!C.puedeReproponer(tplCumple, 'b1', { 'cumpleanos:b1': d(100) }, now), 'cumpleaños a los 100 días no debería reproponerse')

// ── cadencia semanal ──
const lunes = C.inicioSemana(now)           // 6 ago 2026 es jueves -> lunes 3
console.assert(lunes.getDay() === 1, 'inicioSemana debería caer en lunes')
console.assert(lunes.getDate() === 3 && lunes.getMonth() === 7, 'inicioSemana mal: ' + lunes.toDateString())
const prox = C.proximaRevision(now)
console.assert(prox.getDay() === 1 && prox.getDate() === 10, 'proximaRevision mal: ' + prox.toDateString())
// Un lunes es su propio inicio de semana
console.assert(C.inicioSemana(new Date(2026, 7, 10, 9)).getDate() === 10, 'lunes debería ser su propio inicio')
// Y un domingo pertenece a la semana que empezó el lunes anterior
console.assert(C.inicioSemana(new Date(2026, 7, 9, 9)).getDate() === 3, 'domingo debería colgar del lunes anterior')
console.log('semana ->', lunes.toDateString(), '→ revisión', prox.toDateString())

console.log('\nOK fase 3')
