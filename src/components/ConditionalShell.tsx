'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import BottomNav from '@/components/BottomNav'
import { ArrowLeft, Eye } from 'lucide-react'

type ViewingAs = { id: string; name: string } | null

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [viewingAs, setViewingAs] = useState<ViewingAs>(null)

  const isPublic = pathname.startsWith('/alta') || pathname === '/login' || pathname.startsWith('/auth')
  const isAdmin = pathname.startsWith('/admin')

  useEffect(() => {
    if (!isAdmin) {
      const stored = localStorage.getItem('viewingAsTenant')
      setViewingAs(stored ? JSON.parse(stored) : null)
    }
  }, [pathname, isAdmin])

  function exitImpersonation() {
    localStorage.removeItem('viewingAsTenant')
    setViewingAs(null)
    router.push('/admin')
  }

  if (isPublic) return <>{children}</>

  if (isAdmin) return <main className="min-h-screen bg-carbon">{children}</main>

  return (
    <>
      {viewingAs && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-amber/10 border-b border-amber/30 px-4 py-2 lg:pl-60">
          <div className="flex items-center gap-2">
            <Eye size={13} className="text-amber shrink-0" />
            <span className="text-xs font-semibold text-amber">
              Vista de: <span className="text-snow">{viewingAs.name}</span>
            </span>
          </div>
          <button
            onClick={exitImpersonation}
            className="flex items-center gap-1 text-xs font-semibold text-amber hover:text-snow transition-colors shrink-0"
          >
            <ArrowLeft size={12} /> Volver al admin
          </button>
        </div>
      )}
      <AppShell>
        <main className={`pb-20 lg:pb-0 px-4 lg:px-8 lg:pt-8 max-w-2xl lg:max-w-none ${viewingAs ? 'pt-12' : 'pt-4'}`}>
          {children}
        </main>
      </AppShell>
      <BottomNav />
    </>
  )
}
