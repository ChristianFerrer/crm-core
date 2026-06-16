import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import { AppShell } from '@/components/AppShell'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', axes: ['opsz'] })

export const metadata: Metadata = {
  title: 'El Bosc Màgic · CRM',
  description: 'Gestión de familias y bonos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-carbon text-snow">
        <AppShell>
          <main className="pb-20 lg:pb-0 px-4 pt-4 lg:px-8 lg:pt-8 max-w-2xl lg:max-w-none">
            {children}
          </main>
        </AppShell>
        <BottomNav />
      </body>
    </html>
  )
}
