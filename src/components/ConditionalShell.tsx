'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import BottomNav from '@/components/BottomNav'

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isPublic = pathname.startsWith('/alta') || pathname === '/login' || pathname.startsWith('/auth')
  const isAdmin = pathname.startsWith('/admin')

  if (isPublic) return <>{children}</>

  if (isAdmin) return <main className="min-h-screen bg-carbon">{children}</main>

  return (
    <>
      <AppShell>
        <main className="pb-20 lg:pb-0 px-4 lg:px-8 lg:pt-8 pt-4 max-w-2xl lg:max-w-none">
          {children}
        </main>
      </AppShell>
      <BottomNav />
    </>
  )
}
