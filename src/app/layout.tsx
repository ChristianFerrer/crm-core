import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import './globals.css'
import { ConditionalShell } from '@/components/ConditionalShell'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', axes: ['opsz'] })

export const metadata: Metadata = {
  title: 'Watermelon CRM',
  description: 'CRM para Ludotecas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-carbon text-snow">
        <ConditionalShell>{children}</ConditionalShell>
      </body>
    </html>
  )
}
