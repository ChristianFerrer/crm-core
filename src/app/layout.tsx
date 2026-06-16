import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'

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
        <main className="max-w-md mx-auto min-h-screen pb-20 px-4 pt-4">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
