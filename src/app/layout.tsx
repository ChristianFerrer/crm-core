import type { Metadata } from 'next'
import './globals.css'
import { BottomNav } from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'El Bosc Màgic · CRM',
  description: 'Gestión de familias y bonos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-full">
        <main className="px-4 pt-4 pb-6">{children}</main>
        <BottomNav />
      </body>
    </html>
  )
}
