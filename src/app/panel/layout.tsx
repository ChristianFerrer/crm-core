import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import '../globals.css'
import BottomNav from '@/components/BottomNav'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', axes: ['opsz'] })

export const metadata: Metadata = {
  title: 'Panel · El Bosc Màgic',
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${fraunces.variable}`}>
      <div className="min-h-screen bg-carbon pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-line bg-carbon/90 backdrop-blur-md">
          <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-lime flex items-center justify-center" style={{ boxShadow: 'var(--shadow-lime)' }}>
                <span className="text-ink font-bold text-sm">B</span>
              </div>
              <span className="font-display text-lg font-semibold text-snow">El Bosc Màgic</span>
              <span className="hidden sm:inline text-xs font-semibold text-fog bg-surface px-2.5 py-1 rounded-full border border-line">Panel</span>
            </div>
            <nav className="hidden lg:flex items-center gap-1 bg-surface border border-line rounded-full p-1">
              {[['/', 'Inicio'], ['/familias', 'Familias'], ['/checkin', 'Check-in'], ['/panel', 'Dashboard']].map(([href, label]) => (
                <a key={href} href={href} className="px-4 py-1.5 rounded-full text-sm font-semibold text-fog hover:text-snow hover:bg-surface2 transition-colors">{label}</a>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  )
}
