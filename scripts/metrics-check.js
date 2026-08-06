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
