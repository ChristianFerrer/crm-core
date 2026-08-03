import Link from 'next/link'
import {
  LogIn, Users, CalendarDays, BarChart2, CheckCircle,
  ArrowRight, Gift, Bell,
  Timer, AlertTriangle, Search, QrCode, CreditCard,
  Clock, ChevronRight, User, Phone, Pencil,
} from 'lucide-react'
import { TrackPageView } from '@/components/TrackPageView'

// ─── Mini mockups ────────────────────────────────────────────────────────────

function MockCheckin() {
  return (
    <div className="rounded-xl border border-line bg-carbon p-3 space-y-2 text-xs">
      {/* search */}
      <div className="flex items-center gap-2 rounded-lg border border-line2 bg-surface px-2.5 py-1.5">
        <Search size={11} className="text-mist shrink-0" />
        <span className="text-mist">Buscar por nombre o teléfono…</span>
      </div>
      {/* members */}
      {[
        { name: 'Noa Puig', family: 'Familia Puig', dot: 'bg-iris', label: '∞', labelColor: 'text-iris' },
        { name: 'Marc Torres', family: 'Familia Torres', dot: 'bg-amber', label: '2 ses.', labelColor: 'text-amber' },
        { name: 'Sara Vidal', family: 'Familia Vidal', dot: 'bg-mint', label: '8 ses.', labelColor: 'text-fog' },
      ].map(m => (
        <div key={m.name} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 border border-line">
          <div className="w-5 h-5 rounded-lg bg-iris/10 flex items-center justify-center shrink-0">
            <User size={10} className="text-iris" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-snow truncate">{m.name}</p>
            <p className="text-mist truncate">{m.family}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`font-semibold ${m.labelColor}`}>{m.label}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
          </div>
        </div>
      ))}
      {/* legend */}
      <div className="flex gap-3 pt-0.5 px-1">
        <span className="flex items-center gap-1 text-mist"><span className="w-1.5 h-1.5 rounded-full bg-iris" />Ilimitado</span>
        <span className="flex items-center gap-1 text-mist"><span className="w-1.5 h-1.5 rounded-full bg-mint" />Activo</span>
        <span className="flex items-center gap-1 text-mist"><span className="w-1.5 h-1.5 rounded-full bg-amber" />Bajo</span>
        <span className="flex items-center gap-1 text-mist"><span className="w-1.5 h-1.5 rounded-full bg-rose" />Agotado</span>
      </div>
    </div>
  )
}

function MockMember() {
  return (
    <div className="rounded-xl border border-line bg-carbon p-3 space-y-2 text-xs">
      {/* header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg bg-iris/10 flex items-center justify-center">
          <User size={11} className="text-iris" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-snow">Laura Mas</p>
          <p className="text-mist">Familia Mas · 34 años</p>
        </div>
        <div className="w-5 h-5 rounded-lg border border-line bg-surface flex items-center justify-center">
          <Pencil size={9} className="text-fog" />
        </div>
      </div>
      <div className="border-t border-line" />
      {/* phone */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-lime/10 flex items-center justify-center shrink-0">
          <Phone size={9} className="text-lime" />
        </div>
        <span className="text-lime font-semibold">+34 612 345 678</span>
      </div>
      {/* bono */}
      <div className="rounded-lg border border-line bg-surface px-2.5 py-2 flex items-center justify-between">
        <div>
          <p className="font-semibold text-snow">Bono 10 sesiones</p>
          <p className="text-mist">Vence 30 jul. 2026</p>
        </div>
        <span className="font-display text-xl font-bold text-lime">7</span>
      </div>
      {/* hijos */}
      <div className="space-y-1">
        <p className="text-fog font-semibold uppercase tracking-wide" style={{ fontSize: 12 }}>Hijos · 2</p>
        {[
          { name: 'Aina Mas', age: '4 años', date: '22 jun. 2022', sex: 'F' },
          { name: 'Pau Mas', age: '7 años', date: '10 mar. 2019', sex: 'M' },
        ].map(c => (
          <div key={c.name} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center font-bold shrink-0 text-white ${c.sex === 'F' ? 'bg-iris' : 'bg-lime'}`} style={{ fontSize: 12 }}>
              {c.sex === 'F' ? '♀' : '♂'}
            </div>
            <span className="text-snow">{c.name}</span>
            <span className="text-mist">{c.age} · {c.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MockAgenda() {
  return (
    <div className="rounded-xl border border-line bg-carbon p-3 space-y-2 text-xs">
      {/* day header */}
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-snow">Lunes 22 de junio</p>
        <div className="flex gap-1">
          {['L','M','X','J','V','S','D'].map((d, i) => (
            <span key={d} className={`w-5 h-5 rounded-md flex items-center justify-center font-semibold ${i === 0 ? 'bg-lime text-white' : 'text-fog'}`} style={{ fontSize: 12 }}>{d}</span>
          ))}
        </div>
      </div>
      {/* events */}
      {[
        { time: '10:30', title: 'Cumpleaños Aina', type: 'birthday', guests: 12, color: 'border-iris/30 bg-iris/5', dot: 'bg-iris', badge: 'Confirmado', badgeColor: 'bg-lime text-white' },
        { time: '16:00', title: 'Custodia · Marc Torres', type: 'custodia', guests: 1, color: 'border-mint/30 bg-mint/5', dot: 'bg-mint', badge: 'Pendiente', badgeColor: 'bg-amber text-white' },
        { time: '18:30', title: 'Cumpleaños Leo', type: 'birthday', guests: 8, color: 'border-iris/30 bg-iris/5', dot: 'bg-iris', badge: 'Pendiente', badgeColor: 'bg-amber text-white' },
      ].map(e => (
        <div key={e.title} className={`rounded-lg border ${e.color} px-2.5 py-2 flex items-center gap-2`}>
          <span className={`w-1.5 h-1.5 rounded-full ${e.dot} shrink-0`} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-snow truncate">{e.title}</p>
            <p className="text-mist">{e.time} · {e.guests} invitados</p>
          </div>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${e.badgeColor} shrink-0`}>{e.badge}</span>
        </div>
      ))}
    </div>
  )
}

function MockPanel() {
  return (
    <div className="rounded-xl border border-line bg-carbon p-3 space-y-2 text-xs">
      {/* opportunity boxes */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Bonos bajos', value: '4', color: 'text-amber', border: 'border-amber/20 bg-amber/5' },
          { label: 'Sin bono', value: '7', color: 'text-rose', border: 'border-rose/20 bg-rose/5' },
          { label: 'Inactivos', value: '3', color: 'text-fog', border: 'border-line bg-surface' },
          { label: 'Cumpleaños', value: '5', color: 'text-iris', border: 'border-iris/20 bg-iris/5' },
        ].map(o => (
          <div key={o.label} className={`rounded-lg border ${o.border} p-2 flex flex-col items-center gap-0.5`}>
            <span className={`font-display text-lg font-semibold ${o.color}`}>{o.value}</span>
            <span className="text-mist text-center leading-tight" style={{ fontSize: 12 }}>{o.label}</span>
          </div>
        ))}
      </div>
      {/* mini chart bar */}
      <div className="rounded-lg border border-line bg-surface px-2.5 py-2">
        <p className="text-fog mb-1.5" style={{ fontSize: 12 }}>Visitas últimos 7 días</p>
        <div className="flex items-end gap-1 h-8">
          {[6,9,4,12,8,14,11].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm bg-lime/20 flex items-end">
              <div className="w-full rounded-sm bg-lime transition-all" style={{ height: `${(h / 14) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-mist" style={{ fontSize: 12 }}>
          {['L','M','X','J','V','S','D'].map(d => <span key={d}>{d}</span>)}
        </div>
      </div>
      {/* top member */}
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5">
        <span className="text-lime font-bold">#1</span>
        <span className="flex-1 text-snow">Noa Puig</span>
        <span className="text-fog">14 visitas</span>
        <ChevronRight size={10} className="text-mist" />
      </div>
    </div>
  )
}

function MockAlertas() {
  return (
    <div className="rounded-xl border border-line bg-carbon p-3 space-y-2 text-xs">
      {/* alert rows */}
      {[
        { name: 'Marc Torres', msg: 'Le queda 1 sesión de bono', color: 'border-amber/30 bg-amber/5', icon: AlertTriangle, iconColor: 'text-amber', status: 'sin_contactar', statusColor: 'bg-rose text-white' },
        { name: 'Sara Vidal', msg: 'Bono vence mañana', color: 'border-amber/30 bg-amber/5', icon: Clock, iconColor: 'text-amber', status: 'contactado', statusColor: 'bg-amber text-white' },
        { name: 'Pau Llop', msg: 'Sin bono · visita de pago', color: 'border-rose/30 bg-rose/5', icon: CreditCard, iconColor: 'text-rose', status: 'reservado', statusColor: 'bg-lime text-white' },
      ].map(a => (
        <div key={a.name} className={`rounded-lg border ${a.color} px-2.5 py-2`}>
          <div className="flex items-center gap-2">
            <a.icon size={10} className={`${a.iconColor} shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-snow">{a.name}</p>
              <p className="text-mist">{a.msg}</p>
            </div>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${a.statusColor} shrink-0`}>{a.status.replace('_', ' ')}</span>
          </div>
        </div>
      ))}
      {/* notes input */}
      <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-mist italic">
        Añadir nota de seguimiento…
      </div>
    </div>
  )
}

function MockOportunidades() {
  return (
    <div className="rounded-xl border border-line bg-carbon p-3 space-y-2 text-xs">
      <p className="font-semibold text-fog uppercase tracking-wide" style={{ fontSize: 12 }}>Cumpleaños este mes · 5 niños</p>
      {[
        { child: 'Aina Mas', age: 4, date: '22 jun.', client: 'Laura Mas', status: 'reservado', statusColor: 'bg-lime text-white' },
        { child: 'Leo Puig', age: 6, date: '28 jun.', client: 'Noa Puig', status: 'contactado', statusColor: 'bg-amber text-white' },
        { child: 'Martina Roca', age: 3, date: '3 jul.', client: 'Pau Roca', status: 'sin contactar', statusColor: 'bg-rose text-white' },
      ].map(b => (
        <div key={b.child} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2">
          <div className="w-5 h-5 rounded-full bg-iris/20 flex items-center justify-center shrink-0">
            <Gift size={9} className="text-iris" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-snow">{b.child} · {b.age} años</p>
            <p className="text-mist">{b.date} · {b.client}</p>
          </div>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${b.statusColor} shrink-0`}>{b.status}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Feature data ─────────────────────────────────────────────────────────────

const features = [
  {
    icon: LogIn,
    color: 'text-lime',
    bg: 'bg-lime/10',
    border: 'border-lime/20',
    title: 'Check-in instantáneo',
    desc: 'Registra entradas y salidas en segundos. Busca por nombre, teléfono o escanea el QR del miembro. El sistema detecta si tiene bono activo y calcula el coste si no lo tiene.',
    bullets: ['Bono vs. pago al contado con tarifa por hora', 'Tipo de visita: entrada normal o custodia', 'Niños presentes por visita', 'Aforo en tiempo real con indicador visual'],
    mockup: MockCheckin,
  },
  {
    icon: Users,
    color: 'text-iris',
    bg: 'bg-iris/10',
    border: 'border-iris/20',
    title: 'Miembros y familias',
    desc: 'Fichas completas para cada titular: hijos con fechas de cumpleaños, bono activo, historial de visitas y notas. Agrupa titulares en familias para una gestión conjunta.',
    bullets: ['Perfiles con hijos, edades y cumpleaños', 'Estado del bono en un vistazo', 'Historial de visitas con duración y coste', 'Agrupación por familias con vista conjunta'],
    mockup: MockMember,
  },
  {
    icon: CalendarDays,
    color: 'text-mint',
    bg: 'bg-mint/10',
    border: 'border-mint/20',
    title: 'Agenda y reservas',
    desc: 'Gestiona cumpleaños, custodias y eventos especiales desde un calendario visual. Cada reserva incluye horario, número de invitados, estado de confirmación y notas del cliente.',
    bullets: ['Reservas de cumpleaños con invitados', 'Custodias programadas', 'Estado de confirmación y pago', 'Vista diaria, semanal y mensual'],
    mockup: MockAgenda,
  },
  {
    icon: BarChart2,
    color: 'text-amber',
    bg: 'bg-amber/10',
    border: 'border-amber/20',
    title: 'Panel de gestión',
    desc: 'Gráficas de crecimiento de miembros, distribución de bonos y visitas de los últimos 7 días. Indicadores de oportunidad clicables para identificar a quién contactar hoy.',
    bullets: ['Bonos bajos, caducados o que vencen esta semana', 'Clientes inactivos más de 10 días', 'Visitan sin bono — candidatos a contratar', 'Top 5 clientes más activos del mes'],
    mockup: MockPanel,
  },
  {
    icon: Bell,
    color: 'text-rose',
    bg: 'bg-rose/10',
    border: 'border-rose/20',
    title: 'Alertas y seguimiento',
    desc: 'El sistema detecta automáticamente situaciones urgentes y las muestra como alertas. Cada indicador tiene un flujo de seguimiento para marcar si ya contactaste al cliente.',
    bullets: ['Alertas: 1 sesión restante, bono expira hoy o mañana', 'Cumpleaños en los próximos 7 días', 'Estado de contacto: sin contactar, contactado, reservado', 'Notas de seguimiento por cliente'],
    mockup: MockAlertas,
  },
  {
    icon: Gift,
    color: 'text-cyan-300',
    bg: 'bg-cyan-300/10',
    border: 'border-cyan-300/20',
    title: 'Oportunidades de negocio',
    desc: 'Detecta cada mes a los niños que cumplen años y genera oportunidades de reserva de cumpleaños. Seguimiento individual para saber quién ya ha reservado y quién está pendiente.',
    bullets: ['Listado de cumpleaños del mes con edades', 'Estado por niño: sin contactar → reservado', 'Clientes sin bono que podrían contratarlo', 'Historial de seguimiento con notas'],
    mockup: MockOportunidades,
  },
]

const stats = [
  { value: '5 seg', label: 'para registrar una entrada' },
  { value: '100%', label: 'web — sin instalar nada' },
  { value: '1 pantalla', label: 'para ver todo el estado' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-carbon text-snow">
      <TrackPageView />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-line bg-carbon/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-lime flex items-center justify-center shrink-0" style={{ boxShadow: 'var(--shadow-lime)' }}>
              <span className="text-ink font-bold text-sm">G</span>
            </div>
            <span className="font-display font-semibold text-snow text-lg">GERD</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-fog">
            <a href="#features" className="hover:text-snow transition-colors">Funciones</a>
            <a href="#how-it-works" className="hover:text-snow transition-colors">Cómo funciona</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-fog hover:text-snow transition-colors">
              Iniciar sesión
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-xl bg-lime px-4 py-2 text-sm font-semibold text-ink transition hover:bg-lime/90"
              style={{ boxShadow: 'var(--shadow-lime)' }}
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-lime px-4 py-1.5 text-xs font-semibold text-white mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
          CRM diseñado para ludotecas
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-semibold text-snow leading-tight tracking-tight mb-6">
          Tu ludoteca,<br />
          <span className="text-lime">sin caos.</span>
        </h1>
        <p className="text-lg md:text-xl text-fog max-w-2xl mx-auto mb-10 leading-relaxed">
          Check-in en segundos, bonos bajo control, agenda de cumpleaños y un panel que te dice exactamente a quién tienes que llamar hoy.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 rounded-2xl bg-lime px-8 py-4 text-base font-semibold text-ink transition hover:bg-lime/90 active:scale-[0.98]"
            style={{ boxShadow: 'var(--shadow-lime)' }}
          >
            Empezar gratis <ArrowRight size={16} />
          </Link>
          <a
            href="#features"
            className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-8 py-4 text-base font-medium text-fog hover:text-snow hover:border-line2 transition-colors"
          >
            Ver funciones
          </a>
        </div>
        <p className="text-xs text-mist mt-5">Sin tarjeta de crédito · 14 días de prueba gratis</p>
      </section>

      {/* Mock UI — hero dashboard */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-3 h-3 rounded-full bg-rose/60" />
            <div className="w-3 h-3 rounded-full bg-amber/60" />
            <div className="w-3 h-3 rounded-full bg-lime/60" />
            <span className="ml-2 text-xs text-mist">GERD · Inicio</span>
          </div>

          {/* Aforo bar */}
          <div className="rounded-2xl border border-line bg-carbon px-5 py-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
                <Timer size={11} className="text-lime" /> Aforo en tiempo real
              </p>
              <span className="text-sm font-bold text-lime">11 / 40 · 28%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-surface2 flex overflow-hidden">
              <div className="h-full bg-lime" style={{ width: '14%' }} />
              <div className="h-full bg-cyan-300" style={{ width: '14%' }} />
            </div>
            <div className="flex gap-4 mt-2">
              <span className="text-xs text-fog flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-lime" /> 5 adultos</span>
              <span className="text-xs text-fog flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-300" /> 6 niños</span>
            </div>
          </div>

          {/* Stat boxes */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3">
            {[
              { label: 'Niños en sala', value: '6', color: 'text-cyan-300' },
              { label: 'Entradas hoy', value: '14', color: 'text-lime' },
              { label: 'Con bono', value: '9', color: 'text-iris' },
              { label: 'Sin bono', value: '5', color: 'text-amber' },
              { label: 'Custodias', value: '2', color: 'text-mint' },
              { label: 'Cumpleaños', value: '1', color: 'text-rose' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-line bg-carbon p-3">
                <div className={`font-display text-2xl font-semibold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-fog mt-0.5 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Alerts strip */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 rounded-xl border border-amber/30 bg-amber/5 px-4 py-2.5 flex items-center gap-2">
              <AlertTriangle size={13} className="text-amber shrink-0" />
              <p className="text-xs text-snow">Marc Torres — le queda solo 1 sesión de bono</p>
            </div>
            <div className="flex-1 rounded-xl border border-iris/30 bg-iris/5 px-4 py-2.5 flex items-center gap-2">
              <Gift size={13} className="text-iris shrink-0" />
              <p className="text-xs text-snow">Aina cumple 4 años el día 22 — cliente: Noa Puig</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-line bg-surface py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            {stats.map(({ value, label }) => (
              <div key={label}>
                <p className="font-display text-3xl md:text-4xl font-semibold text-lime">{value}</p>
                <p className="text-sm text-fog mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — each card with inline mockup */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-snow mb-4">
            Todo lo que necesitas,<br />nada que no.
          </h2>
          <p className="text-fog text-lg max-w-xl mx-auto">
            Diseñado específicamente para el día a día de una ludoteca. Sin funciones de más, sin complejidad innecesaria.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, color, bg, border, title, desc, bullets, mockup: Mockup }) => (
            <div key={title} className={`rounded-2xl border ${border} bg-surface p-5 flex flex-col gap-4 hover:bg-surface2 transition-colors`}>
              {/* icon + title */}
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={17} className={color} />
                </div>
                <h3 className="font-semibold text-snow text-sm">{title}</h3>
              </div>
              {/* mockup */}
              <Mockup />
              {/* desc */}
              <p className="text-fog text-xs leading-relaxed">{desc}</p>
              {/* bullets */}
              <ul className="space-y-1.5 mt-auto">
                {bullets.map(b => (
                  <li key={b} className="flex items-start gap-2 text-xs text-mist">
                    <CheckCircle size={11} className={`${color} shrink-0 mt-0.5`} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-line bg-surface py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-snow mb-4">
              En marcha en minutos
            </h2>
            <p className="text-fog text-lg max-w-xl mx-auto">
              Sin instalaciones, sin técnicos. Abre el navegador y empieza.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Crea tu cuenta', desc: 'Regístrate con tu correo. Tu espacio está listo al instante con tu nombre de establecimiento y aforo.' },
              { step: '02', title: 'Añade tus miembros', desc: 'Crea fichas de familias y titulares con sus hijos. Asígnales bonos por sesiones o ilimitados.' },
              { step: '03', title: 'Controla tu ludoteca', desc: 'Registra entradas, revisa el panel de alertas y ten siempre a la vista quién está dentro y cómo va el negocio.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative rounded-2xl border border-line bg-carbon p-6">
                <span className="font-display text-6xl font-semibold text-line2 leading-none mb-4 block">{step}</span>
                <h3 className="font-semibold text-snow text-lg mb-2">{title}</h3>
                <p className="text-fog text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl bg-lime p-12 text-center" style={{ boxShadow: 'var(--shadow-lime)' }}>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-ink mb-4 leading-tight">
            ¿Lista para ordenar tu ludoteca?
          </h2>
          <p className="text-ink/70 text-lg mb-8 max-w-lg mx-auto">
            Únete a las ludotecas que ya gestionan su día a día con GERD.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-2xl bg-ink px-8 py-4 text-base font-semibold text-lime transition hover:bg-ink/80"
          >
            Empezar gratis <ArrowRight size={16} />
          </Link>
          <p className="text-ink/50 text-xs mt-4">Sin tarjeta de crédito · Cancela cuando quieras</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-lime flex items-center justify-center shrink-0">
              <span className="text-ink font-bold text-xs">G</span>
            </div>
            <span className="text-sm font-semibold text-snow">GERD CRM</span>
          </div>
          <p className="text-xs text-mist">© 2026 GERD · Hecho con cariño para ludotecas</p>
          <Link href="/login" className="text-sm text-fog hover:text-snow transition-colors">
            Iniciar sesión →
          </Link>
        </div>
      </footer>

    </div>
  )
}
