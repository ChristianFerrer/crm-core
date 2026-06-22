import Link from 'next/link'
import {
  LogIn, Users, CalendarDays, BarChart2, CheckCircle,
  Zap, Shield, Clock, ArrowRight, Star, Gift, Bell,
  Timer, WalletCards, UserMinus, Baby, Crown, AlertTriangle,
} from 'lucide-react'

const features = [
  {
    icon: LogIn,
    color: 'text-lime',
    bg: 'bg-lime/10',
    border: 'border-lime/20',
    title: 'Check-in instantáneo',
    desc: 'Registra entradas y salidas en segundos. Busca por nombre, teléfono o escanea el QR del miembro. El sistema detecta si tiene bono activo y calcula el coste automáticamente si no lo tiene.',
    bullets: ['Bono vs. pago al contado con tarifa por hora', 'Tipo de visita: entrada normal o custodia', 'Niños presentes por visita', 'Aforo en tiempo real con indicador visual'],
  },
  {
    icon: Users,
    color: 'text-iris',
    bg: 'bg-iris/10',
    border: 'border-iris/20',
    title: 'Miembros y familias',
    desc: 'Fichas completas para cada titular: hijos con fechas de cumpleaños, bono activo, historial de visitas y notas. Agrupa titulares en familias para una gestión conjunta.',
    bullets: ['Perfiles con hijos, edades y cumpleaños', 'Estado del bono en un vistazo', 'Historial de visitas con duración y coste', 'Agrupación por familias con vista conjunta'],
  },
  {
    icon: CalendarDays,
    color: 'text-mint',
    bg: 'bg-mint/10',
    border: 'border-mint/20',
    title: 'Agenda y reservas',
    desc: 'Gestiona cumpleaños, custodias y eventos especiales desde un calendario visual. Cada reserva incluye horario, número de invitados, estado de pago y notas del cliente.',
    bullets: ['Reservas de cumpleaños con invitados', 'Custodias programadas', 'Estado de confirmación y pago', 'Vista diaria, semanal y mensual'],
  },
  {
    icon: BarChart2,
    color: 'text-amber',
    bg: 'bg-amber/10',
    border: 'border-amber/20',
    title: 'Panel de gestión',
    desc: 'Gráficas de crecimiento de miembros, distribución de bonos y visitas de los últimos 7 días. Indicadores de oportunidad clicables para identificar a quién contactar hoy.',
    bullets: ['Bonos bajos, caducados o que vencen esta semana', 'Clientes inactivos más de 10 días', 'Visitan sin bono — candidatos a contratar', 'Top 5 clientes más activos del mes'],
  },
  {
    icon: Bell,
    color: 'text-rose',
    bg: 'bg-rose/10',
    border: 'border-rose/20',
    title: 'Alertas y seguimiento',
    desc: 'El sistema detecta automáticamente situaciones urgentes y las muestra como alertas. Cada indicador tiene un flujo de seguimiento para marcar si ya contactaste al cliente.',
    bullets: ['Alertas: 1 sesión restante, bono expira hoy/mañana', 'Cumpleaños en los próximos 7 días', 'Estado de contacto: sin contactar, contactado, reservado', 'Notas de seguimiento por cliente'],
  },
  {
    icon: Gift,
    color: 'text-cyan-300',
    bg: 'bg-cyan-300/10',
    border: 'border-cyan-300/20',
    title: 'Oportunidades de negocio',
    desc: 'Detecta cada mes a los niños que cumplen años y genera oportunidades de reserva de cumpleaños. Seguimiento individual para saber quién ya ha reservado y quién está pendiente.',
    bullets: ['Listado de cumpleaños del mes con edades', 'Estado por niño: sin contactar → reservado', 'Clientes sin bono que podrían contratarlo', 'Historial de seguimiento con notas'],
  },
]

const stats = [
  { value: '5 seg', label: 'para registrar una entrada' },
  { value: '100%', label: 'web — sin instalar nada' },
  { value: '1 pantalla', label: 'para ver todo el estado' },
]

const planFeatures = [
  'Check-in con bono, QR y detección de aforo',
  'Miembros, hijos, familias y cumpleaños',
  'Bonos por sesiones o ilimitados con tarifas propias',
  'Agenda: cumpleaños, custodias y eventos',
  'Panel con gráficas y oportunidades de negocio',
  'Alertas automáticas de bonos y cumpleaños',
  'Seguimiento de clientes con estado de contacto',
  'Acceso desde móvil, tablet y ordenador',
  'Soporte en español',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-carbon text-snow">

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-line bg-carbon/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-lime flex items-center justify-center shrink-0" style={{ boxShadow: 'var(--shadow-lime)' }}>
              <span className="text-ink font-bold text-sm">W</span>
            </div>
            <span className="font-display font-semibold text-snow text-lg">Watermelon</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-fog">
            <a href="#features" className="hover:text-snow transition-colors">Funciones</a>
            <a href="#pricing" className="hover:text-snow transition-colors">Precios</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-fog hover:text-snow transition-colors">
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
        <div className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5 text-xs font-semibold text-lime mb-8">
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
            className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-8 py-4 text-base font-semibold text-fog hover:text-snow hover:border-line2 transition-colors"
          >
            Ver funciones
          </a>
        </div>
        <p className="text-xs text-mist mt-5">Sin tarjeta de crédito · 14 días de prueba gratis</p>
      </section>

      {/* Mock UI */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-3 h-3 rounded-full bg-rose/60" />
            <div className="w-3 h-3 rounded-full bg-amber/60" />
            <div className="w-3 h-3 rounded-full bg-lime/60" />
          </div>

          {/* Aforo bar */}
          <div className="rounded-2xl border border-line bg-carbon px-5 py-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-fog uppercase tracking-wide flex items-center gap-1.5">
                <Timer size={11} className="text-lime" /> Aforo
              </p>
              <span className="text-sm font-bold text-lime">11 / 40 · 28%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-surface2 flex overflow-hidden">
              <div className="h-full bg-lime" style={{ width: '14%' }} />
              <div className="h-full bg-cyan-300" style={{ width: '14%' }} />
            </div>
            <div className="flex gap-4 mt-2">
              <span className="text-[10px] text-fog flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-lime" /> 5 adultos</span>
              <span className="text-[10px] text-fog flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-300" /> 6 niños</span>
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
                <div className="text-[10px] text-fog mt-0.5 leading-tight">{s.label}</div>
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

      {/* Features */}
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
          {features.map(({ icon: Icon, color, bg, border, title, desc, bullets }) => (
            <div key={title} className={`rounded-2xl border ${border} bg-surface p-6 flex flex-col gap-4 hover:bg-surface2 transition-colors`}>
              <div className={`w-11 h-11 rounded-2xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon size={20} className={color} />
              </div>
              <div>
                <h3 className="font-semibold text-snow text-base mb-2">{title}</h3>
                <p className="text-fog text-sm leading-relaxed">{desc}</p>
              </div>
              <ul className="space-y-1.5 mt-auto">
                {bullets.map(b => (
                  <li key={b} className="flex items-start gap-2 text-xs text-mist">
                    <CheckCircle size={12} className={`${color} shrink-0 mt-0.5`} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface py-24">
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

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-snow mb-4">
            Precio claro, sin sorpresas
          </h2>
          <p className="text-fog text-lg">14 días de prueba gratis. Todo incluido desde el primer día.</p>
        </div>
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl border border-lime/50 bg-surface p-8 flex flex-col items-center text-center">
            <div className="mb-1">
              <span className="font-display text-6xl font-semibold text-snow">99,9€</span>
              <span className="text-fog text-base ml-1">/mes</span>
            </div>
            <p className="text-mist text-sm mb-8">Todo incluido · Sin permanencia</p>
            <ul className="space-y-3 w-full mb-8 text-left">
              {planFeatures.map(f => (
                <li key={f} className="flex items-start gap-3 text-sm text-fog">
                  <CheckCircle size={15} className="text-lime shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-lime py-3.5 text-sm font-semibold text-ink hover:bg-lime/90 transition-colors"
              style={{ boxShadow: 'var(--shadow-lime)' }}
            >
              Empezar 14 días gratis
            </Link>
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
            Únete a las ludotecas que ya gestionan su día a día con Watermelon.
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
              <span className="text-ink font-bold text-xs">W</span>
            </div>
            <span className="text-sm font-semibold text-snow">Watermelon CRM</span>
          </div>
          <p className="text-xs text-mist">© 2026 Watermelon · Hecho con cariño para ludotecas</p>
          <Link href="/login" className="text-sm text-fog hover:text-snow transition-colors">
            Iniciar sesión →
          </Link>
        </div>
      </footer>

    </div>
  )
}
