import Link from 'next/link'
import {
  LogIn, Users, CalendarDays, BarChart2, CheckCircle,
  Zap, Shield, Clock, ArrowRight, Star
} from 'lucide-react'

const features = [
  {
    icon: LogIn,
    color: 'text-lime',
    bg: 'bg-lime/10',
    title: 'Control de acceso',
    desc: 'Registra entradas y salidas en segundos. Escaneo por nombre, bono o familia.',
  },
  {
    icon: Users,
    color: 'text-iris',
    bg: 'bg-iris/10',
    title: 'Gestión de miembros',
    desc: 'Fichas completas por niño y familia. Historial de visitas, bonos y notas.',
  },
  {
    icon: CalendarDays,
    color: 'text-mint',
    bg: 'bg-mint/10',
    title: 'Agenda y reservas',
    desc: 'Gestiona cumpleaños, custodias y eventos especiales desde un solo calendario.',
  },
  {
    icon: BarChart2,
    color: 'text-amber',
    bg: 'bg-amber/10',
    title: 'Panel de análisis',
    desc: 'Visitas diarias, bonos agotándose, miembros inactivos. Todo a la vista.',
  },
]

const benefits = [
  { icon: Zap, label: 'Configuración en minutos', color: 'text-lime' },
  { icon: Shield, label: 'Datos seguros en la nube', color: 'text-iris' },
  { icon: Clock, label: 'Acceso desde cualquier dispositivo', color: 'text-mint' },
  { icon: Star, label: 'Soporte en español', color: 'text-amber' },
]

const plans = [
  {
    name: 'Starter',
    price: '29',
    desc: 'Para ludotecas que empiezan',
    features: ['Hasta 100 miembros', 'Control de acceso', 'Bonos y membresías', 'Soporte por email'],
    accent: 'border-line',
    badge: null,
  },
  {
    name: 'Pro',
    price: '59',
    desc: 'El más popular',
    features: ['Miembros ilimitados', 'Todo de Starter', 'Agenda y reservas', 'Panel de análisis', 'Soporte prioritario'],
    accent: 'border-lime/50',
    badge: 'Popular',
  },
  {
    name: 'Enterprise',
    price: '—',
    desc: 'Para grupos o franquicias',
    features: ['Múltiples establecimientos', 'Todo de Pro', 'Onboarding personalizado', 'SLA dedicado'],
    accent: 'border-line',
    badge: null,
  },
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
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5 text-xs font-semibold text-lime mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
          CRM diseñado para ludotecas
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-semibold text-snow leading-tight tracking-tight mb-6">
          Tu ludoteca,<br />
          <span className="text-lime">sin caos.</span>
        </h1>
        <p className="text-lg md:text-xl text-fog max-w-2xl mx-auto mb-10 leading-relaxed">
          Watermelon es el CRM especializado para ludotecas. Controla accesos, gestiona bonos,
          agenda reservas y conoce tu negocio en tiempo real — desde el móvil o el ordenador.
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'En sala', value: '8', color: 'text-iris' },
              { label: 'Entradas hoy', value: '24', color: 'text-lime' },
              { label: 'Con bono', value: '19', color: 'text-mint' },
              { label: 'Sin bono', value: '5', color: 'text-amber' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-line bg-carbon p-4">
                <div className={`font-display text-3xl font-semibold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-fog mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-line bg-carbon p-4">
            <p className="text-xs text-fog mb-3">Afluencia · últimas horas</p>
            <div className="flex items-end gap-2 h-16">
              {[2, 5, 8, 12, 9, 14, 11, 7, 4, 3, 6, 10].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md bg-lime/60" style={{ height: `${(h / 14) * 100}%` }} />
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {['08h', '10h', '12h', '14h', '16h', '18h'].map(h => (
                <span key={h} className="text-[10px] text-mist">{h}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-snow mb-4">
            Todo lo que necesitas,<br />nada que no.
          </h2>
          <p className="text-fog text-lg max-w-xl mx-auto">
            Diseñado específicamente para el día a día de una ludoteca. Sin funciones de más, sin complejidad innecesaria.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-6 hover:border-line2 transition-colors">
              <div className={`w-11 h-11 rounded-2xl ${bg} flex items-center justify-center mb-4`}>
                <Icon size={20} className={color} />
              </div>
              <h3 className="font-semibold text-snow text-lg mb-2">{title}</h3>
              <p className="text-fog text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits strip */}
      <section className="border-y border-line bg-surface py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {benefits.map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon size={18} className={`${color} shrink-0`} />
                <span className="text-sm font-semibold text-snow">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-24">
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
            { step: '01', title: 'Crea tu cuenta', desc: 'Regístrate con tu correo. Tu espacio está listo al instante.' },
            { step: '02', title: 'Añade tus miembros', desc: 'Importa o añade niños y familias. Asígnales bonos en segundos.' },
            { step: '03', title: 'Controla tu ludoteca', desc: 'Registra entradas, consulta el panel y toma decisiones con datos reales.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="relative rounded-2xl border border-line bg-surface p-6">
              <span className="font-display text-6xl font-semibold text-line2 leading-none mb-4 block">{step}</span>
              <h3 className="font-semibold text-snow text-lg mb-2">{title}</h3>
              <p className="text-fog text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-snow mb-4">
            Precio claro, sin sorpresas
          </h2>
          <p className="text-fog text-lg">14 días de prueba gratis en cualquier plan.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map(({ name, price, desc, features: fs, accent, badge }) => (
            <div key={name} className={`relative rounded-2xl border ${accent} bg-surface p-6 flex flex-col`}>
              {badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-lime px-3 py-0.5 text-xs font-bold text-ink">
                  {badge}
                </span>
              )}
              <div className="mb-6">
                <p className="text-sm font-semibold text-fog mb-1">{name}</p>
                <div className="flex items-end gap-1 mb-1">
                  {price === '—' ? (
                    <span className="font-display text-4xl font-semibold text-snow">Contacta</span>
                  ) : (
                    <>
                      <span className="font-display text-5xl font-semibold text-snow">{price}€</span>
                      <span className="text-fog text-sm mb-1.5">/mes</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-mist">{desc}</p>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {fs.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-fog">
                    <CheckCircle size={14} className="text-lime shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
                  badge
                    ? 'bg-lime text-ink hover:bg-lime/90'
                    : 'border border-line text-fog hover:text-snow hover:border-line2'
                }`}
                style={badge ? { boxShadow: 'var(--shadow-lime)' } : undefined}
              >
                {price === '—' ? 'Hablar con ventas' : 'Empezar gratis'}
              </Link>
            </div>
          ))}
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
