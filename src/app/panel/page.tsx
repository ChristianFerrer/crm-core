import { createServerSupabase } from '@/lib/supabase-server'
import { UrgentAlerts } from './UrgentAlerts'
import { PulseSection } from './PulseSection'
import { SegmentMap } from './SegmentMap'
import { ActionsSection } from './ActionsSection'
import { getT } from '@/lib/i18n-server'
import { actividad, delta, repeatRate, bonoRenewalRate, occupancyBySlot, franjaPunta, franjaValle, mediaPrevia, monthPeriod,
  serieVisitas, serieTasa, serieBonosVivos, serieActivas, perfilHorario } from '@/lib/metrics'
import { buildMemberStats, countBySegment, topVisitantes, hogaresPorMiembro } from '@/lib/segments'
import {
  suggestedActions, inicioSemana, proximaRevision, buildCaducados, buildSinBono,
  buildQueue, resolveRecipients, requiereConsentimiento, flujoDeCampana, TEMPLATES,
  type BirthdayLead, type BonoLead, type ContactLog, type PlantillaId,
} from '@/lib/campaigns'
import type { SendState } from '@/lib/campaign-sends'

export const revalidate = 0



export default async function PanelPage() {
  const t = await getT()
  const supabase = await createServerSupabase()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const [
    { data: allMembers },
    { data: paidVisits },
    { data: allMemberships },
    { data: membershipTypes },
    { data: membersForStats },
    { data: doneSends },
    { data: tenant },
    { data: servicios },
  ] = await Promise.all([
    supabase.from('members').select('id, name, created_at, children').is('deleted_at', null),
    // ── Fase 1 y 2: dinero y segmentación ──
    // Historial de cobros y visitas de los últimos 14 meses: da para comparar
    // con el mismo mes del año pasado y para calcular el ritmo de cada familia.
    supabase.from('visits')
      .select('id, member_id, checked_in_at, paid_at, paid_amount, adults_count, children_count')
      .gte('checked_in_at', new Date(now.getFullYear() - 1, now.getMonth() - 1, 1).toISOString())
      .limit(20000),
    supabase.from('memberships')
      .select('id, member_id, created_at, expires_at, sessions_remaining, membership_type_id')
      .limit(5000),
    supabase.from('membership_types').select('id, price'),
    supabase.from('members')
      .select('id, name, phone, created_at, family_id, marketing_consent_at, marketing_consent_revoked_at, families(name)')
      .is('deleted_at', null).limit(5000),
    // Fase 3: lo ya contactado, para no volver a proponerlo
    supabase.from('campaign_sends')
      .select('member_id, estado, enviado_at, created_at, campaigns(plantilla)')
      .neq('estado', 'pendiente').limit(5000),
    supabase.from('tenants').select('capacity').limit(1).maybeSingle(),
    // Precios configurados por la ludoteca: son el ancla del valor de las
    // campañas. Un precio que ha tecleado el cliente no se puede discutir; un
    // ingreso que calculamos nosotros, sí.
    supabase.from('services').select('name, price, category, tipo, flujo').eq('active', true),
  ])

  const capacity: number | null = (tenant as any)?.capacity ?? null

  // ── Fase 1: pulso del mes ─────────────────────────────────────────────────
  // Sin cifras económicas: los ingresos del panel salen de sumar lo que se haya
  // registrado en la aplicación, y un cobro hecho fuera (Bizum, efectivo sin
  // marcar) los deja bajos. Viven en Tendencias, con su aviso.
  const mesActual = monthPeriod(now)
  const mesAnterior = monthPeriod(now, -1)

  const vRows = (paidVisits ?? []) as any[]
  const mRows = (allMemberships ?? []) as any[]

  const actActual = actividad(vRows, mesActual)
  // Contra el mismo TRAMO del mes anterior, no contra el mes entero: el día 7
  // compararse con un mes completo siempre sale mal.
  const diaDelMes = now.getDate()
  const finTramoAnterior = new Date(mesAnterior.from.getFullYear(), mesAnterior.from.getMonth(), diaDelMes)
  const actAnterior = actividad(vRows, { from: mesAnterior.from, to: finTramoAnterior })

  const repeticion = repeatRate(vRows, now, 30)
  const renovacion = bonoRenewalRate(mRows, now, 30)

  // Referencia propia de los 3 meses anteriores: un 43 % no dice si es bueno
  const repeticionPrev = mediaPrevia(ref => repeatRate(vRows, ref, 30), now)
  const renovacionPrev = mediaPrevia(ref => bonoRenewalRate(mRows, ref, 30), now)

  const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
  const franjas = occupancyBySlot(vRows, capacity, mesActual)
  const punta = franjaPunta(franjas)
  // El hueco vacío es lo que se puede llenar; la punta ya no admite a nadie más
  const valle = franjaValle(franjas)

  // ── Fase 2: segmentación por ritmo propio ─────────────────────────────────
  const memberStats = buildMemberStats((membersForStats ?? []) as any[], vRows, now)
  const segCounts = countBySegment(memberStats)
  const top5 = topVisitantes(memberStats, vRows, now)
  const familiasActivas = memberStats.filter(
    s => s.diasDesdeUltima != null && s.diasDesdeUltima <= 60
  ).length

  // Hogares con bono en pie: es la ocupación que ya está comprada, y por tanto
  // la parte del mes que no depende de que entre nadie nuevo. Se cuenta por
  // casa, no por bono: dos padres con bono son un cliente, no dos.
  const hogarDe = hogaresPorMiembro((membersForStats ?? []) as any[])
  const hogaresConBono = new Set(
    mRows
      .filter(b => {
        const vivo = b.sessions_remaining == null || b.sessions_remaining > 0
        const vigente = !b.expires_at || new Date(b.expires_at) >= now
        return vivo && vigente
      })
      .map(b => hogarDe[b.member_id] ?? b.member_id)
  ).size

  // ── Fase 3: qué hacer hoy ─────────────────────────────────────────────────
  const in45 = new Date(now.getTime() + 45 * 86_400_000)
  const accionBirthdays: BirthdayLead[] = []
  const vistosCumple = new Set<string>()
  ;((allMembers ?? []) as any[]).forEach((m: any) => {
    ;((m.children as any[]) ?? []).forEach((c: any) => {
      if (!c.birth_date) return
      const dob = new Date(c.birth_date)
      const next = new Date(now.getFullYear(), dob.getUTCMonth(), dob.getUTCDate())
      if (next < now) next.setFullYear(next.getFullYear() + 1)
      if (next > in45) return
      const key = `${m.id}-${c.name}`
      if (vistosCumple.has(key)) return
      vistosCumple.add(key)
      accionBirthdays.push({ member_id: m.id, member_name: m.name, child_name: c.name, birthday_day: dob.getUTCDate() })
    })
  })

  const nombrePorId = new Map(((membersForStats ?? []) as any[]).map(m => [m.id, m.name]))
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000).toISOString().split('T')[0]
  const accionBonos: BonoLead[] = mRows
    .filter(b => {
      const pocas = b.sessions_remaining != null && b.sessions_remaining <= 2 && b.sessions_remaining > 0
      const caduca = !!b.expires_at && b.expires_at >= todayStr && b.expires_at <= weekAhead
      return pocas || caduca
    })
    .map(b => ({
      member_id: b.member_id,
      member_name: nombrePorId.get(b.member_id) ?? '—',
      sessions: b.sessions_remaining,
      expires_at: b.expires_at,
    }))

  // Fecha del último contacto por plantilla y familia: cada campaña tiene su
  // ventana de reintento, así que no basta con saber SI se contactó.
  const contactLog: ContactLog = {}
  for (const s2 of ((doneSends ?? []) as any[])) {
    const key = `${s2.campaigns?.plantilla ?? ''}:${s2.member_id}`
    const fecha = s2.enviado_at ?? s2.created_at
    if (!fecha) continue
    if (!contactLog[key] || fecha > contactLog[key]) contactLog[key] = fecha
  }

  // ── Precios configurados, para priorizar las campañas ─────────────────────
  // Todo lo económico de esta pantalla sale de precios que ha tecleado la
  // ludoteca, no de ingresos que calculemos nosotros. El importe se usa para
  // ORDENAR las campañas; lo que se enseña es el precio, no una estimación.
  const preciosBono = ((membershipTypes ?? []) as any[])
    .map(t => Number(t.price ?? 0)).filter(p => p > 0)
  const precioBono = preciosBono.length
    ? Math.round(preciosBono.reduce((s, p) => s + p, 0) / preciosBono.length)
    : 0

  const srv = (servicios ?? []) as any[]
  const precioDe = (pred: (s: any) => boolean, fallback: number) => {
    const p = srv.filter(pred).map(x => Number(x.price ?? 0)).filter(x => x > 0)
    return p.length ? Math.round(Math.min(...p)) : fallback
  }
  const precioEntrada = precioDe(s2 => s2.tipo === 'entrada', 8)
  const precioCumple = precioDe(s2 => s2.category === 'cumpleanos' || s2.flujo === 'cumpleanos', 180)

  const miembrosBasicos = ((allMembers ?? []) as any[]).map(m => ({ id: m.id, name: m.name }))

  const ctxCampanas = {
    stats: memberStats,
    hogares: hogaresPorMiembro((membersForStats ?? []) as any[]),
    birthdays: accionBirthdays,
    bonos: accionBonos,
    caducados: buildCaducados(mRows, miembrosBasicos, now),
    sinBono: buildSinBono(mRows, vRows, miembrosBasicos, now),
    // Sin ingresos, el ticket de referencia sale del precio de entrada configurado
    ticketMedio: precioEntrada,
    precioCumple,
    precioBono,
  }

  const acciones = suggestedActions(ctxCampanas, contactLog, now)

  // La cola mezcla campañas y ordena por dinero: es la unidad de trabajo real
  const cola = buildQueue(ctxCampanas, contactLog, now)

  // Estado ya guardado de cada familia en cada plantilla, para que la cola
  // arranque sabiendo a quién se escribió y quién reservó.
  const estadoCola: Record<string, SendState> = {}
  // El mismo dato indexado por plantilla, que es como lo necesita el flujo
  const estadoPorPlantilla: Record<string, Record<string, string>> = {}
  for (const s2 of ((doneSends ?? []) as any[])) {
    const plantilla = s2.campaigns?.plantilla as PlantillaId | undefined
    if (!plantilla) continue
    estadoCola[`${plantilla}:${s2.member_id}`] = s2.estado
    ;(estadoPorPlantilla[plantilla] ??= {})[s2.member_id] = s2.estado
  }

  // Cómo va cada campaña por dentro. Se calcula igual que en su pantalla y con
  // la MISMA lista de destinatarios: antes se contaban todos los envíos
  // guardados de la plantilla, incluidos los de familias que ya no entran en el
  // criterio, y el resumen enseñaba más contactadas de las que la campaña
  // listaba.
  const consentPorId = new Map(
    ((membersForStats ?? []) as any[]).map(m => [
      m.id, !!m.marketing_consent_at && !m.marketing_consent_revoked_at,
    ])
  )
  const flujo: Record<string, ReturnType<typeof flujoDeCampana>> = {}
  for (const tpl of TEMPLATES) {
    const todos = resolveRecipients(tpl.id, ctxCampanas)
    // La publicidad necesita permiso explícito; la gestión del servicio, no.
    const dest = requiereConsentimiento(tpl.id)
      ? todos.filter(r => consentPorId.get(r.memberId))
      : todos
    flujo[tpl.id] = flujoDeCampana(dest, estadoPorPlantilla[tpl.id] ?? {})
  }

  // Contexto de la revisión semanal
  const desdeLunes = inicioSemana(now)
  const contactadosEstaSemana = ((doneSends ?? []) as any[]).filter(s2 => {
    const f = s2.enviado_at ?? s2.created_at
    return f && new Date(f) >= desdeLunes
  }).length

  const pulse = {
    visitas: actActual.visitas,
    visitasDeltaMes: delta(actActual.visitas, actAnterior.visitas),
    familias: actActual.familias,
    porVisita: actActual.porVisita,
    familiasActivas,
    enRiesgo: segCounts.en_riesgo,
    hogaresConBono,
    repeticion: { rate: repeticion.rate, base: repeticion.base, previa: repeticionPrev },
    renovacion: { rate: renovacion.rate, base: renovacion.base, previa: renovacionPrev },
    punta: punta
      ? { dia: DIAS[punta.dow] ?? '', hora: punta.hour, personas: punta.avgPeople, pct: punta.pct }
      : null,
    valle: valle
      ? { dia: DIAS[valle.dow] ?? '', hora: valle.hour, personas: valle.avgPeople, pct: valle.pct }
      : null,
    serie: {
      visitas: serieVisitas(vRows, now, 12),
      bonos: serieBonosVivos(mRows, hogarDe, now, 6),
      repeticion: serieTasa(ref => repeatRate(vRows, ref, 30), now, 6),
      renovacion: serieTasa(ref => bonoRenewalRate(mRows, ref, 30), now, 6),
      activas: serieActivas(vRows, hogarDe, now, 6),
      // Perfil del día entero, no solo del día punta: es lo que enseña el hueco
      horas: perfilHorario(franjas),
    },
  }

  // ── Alertas urgentes ───────────────────────────────────────────────────────
  // Lo que pasa hoy o mañana y no admite esperar a la revisión semanal.
  const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const nombreMiembro = new Map(((allMembers ?? []) as any[]).map(m => [m.id, m.name]))
  const urgentAlerts: { id: string; type: 'bono' | 'birthday'; message: string }[] = []

  for (const b of mRows) {
    const nombre = nombreMiembro.get(b.member_id)
    if (!nombre) continue
    if (b.sessions_remaining === 1) {
      urgentAlerts.push({
        id: `bono-1-${b.member_id}`,
        type: 'bono',
        message: t('panelres_alerta_bono_1', { name: nombre }),
      })
    }
    if (b.expires_at === todayStr || b.expires_at === tomorrowStr) {
      urgentAlerts.push({
        id: `caducado-${b.member_id}`,
        type: 'bono',
        message: b.expires_at === todayStr
          ? t('panelres_alerta_bono_caduca_hoy', { name: nombre })
          : t('panelres_alerta_bono_caduca_manana', { name: nombre }),
      })
    }
  }

  const cumplesVistos = new Set<string>()
  for (const m of ((allMembers ?? []) as any[])) {
    for (const c of ((m.children as any[]) ?? [])) {
      if (!c.birth_date) continue
      const dob = new Date(c.birth_date)
      const next = new Date(now.getFullYear(), dob.getUTCMonth(), dob.getUTCDate())
      if (next < now || next > in7days) continue
      const key = `${m.id}-${c.name}`
      if (cumplesVistos.has(key)) continue
      cumplesVistos.add(key)
      urgentAlerts.push({
        id: `bday-${key}`,
        type: 'birthday',
        message: t('panelres_alerta_cumple', {
          child: c.name,
          age: now.getFullYear() - dob.getUTCFullYear(),
          day: dob.getUTCDate(),
          member: m.name,
        }),
      })
    }
  }

  // pb-6: las tarjetas de abajo no deben quedar pegadas al borde de la app
  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">{t('panelres_titulo')}</h1>
          <p className="text-sm text-fog mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <UrgentAlerts alerts={urgentAlerts} />
      </div>

      {/* Fase 1: el dinero primero */}
      <PulseSection data={pulse} />

      {/* Fase 3: de aquí se sale contactando */}
      <ActionsSection
        actions={acciones}
        contactadosEstaSemana={contactadosEstaSemana}
        proximaRevision={proximaRevision(now).toISOString()}
        cola={cola}
        estadoCola={estadoCola}
        flujo={flujo}
      />

      {/* Fase 2: a quién tienes y qué hacer con cada grupo */}
      <SegmentMap stats={memberStats} top={top5} />
    </div>
  )
}
