import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import './globals.css'
import { ConditionalShell } from '@/components/ConditionalShell'
import { Toaster } from 'sonner'
import { LanguageProvider } from '@/lib/i18n'
import { ThemeProvider } from '@/lib/theme'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', axes: ['opsz'] })

export const metadata: Metadata = {
  title: 'Watermelon CRM',
  description: 'CRM para Ludotecas',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Permitir zoom (accesibilidad, WCAG 1.4.4)
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('wm_theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-carbon text-snow">
        <ThemeProvider>
          <LanguageProvider>
            <ConditionalShell>{children}</ConditionalShell>
          </LanguageProvider>
        </ThemeProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface2)',
              border: '1px solid var(--color-line)',
              color: 'var(--color-snow)',
              fontSize: '13px',
            },
          }}
        />
      </body>
    </html>
  )
}
