'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import BottomNav from '@/components/BottomNav'
import { ArrowLeft, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type ViewingAs = { id: string; name: string } | null

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [viewingAs, setViewingAs] = useState<ViewingAs>(null)
  // null = still checking, true = authenticated, false = not authenticated
  const [authed, setAuthed] = useState<boolean | null>(null)

  const isPublic = pathname.startsWith('/alta') || pathname === '/login' || pathname.startsWith('/auth') || pathname === '/landing' || pathname === '/privacidad'
  const isAdmin = pathname.startsWith('/admin')

  // Single auth listener on mount — never re-runs on navigation
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
    })

    // Keep in sync with auth state changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Redirect unauthenticated users away from protected routes
  useEffect(() => {
    if (authed === false && !isPublic && !isAdmin) {
      router.replace('/login')
    }
  }, [authed, isPublic, isAdmin, router])

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

  // Still checking auth on cold start — show nothing briefly
  if (authed === null && !isPublic) return null

  if (isAdmin) return <main className="min-h-screen bg-carbon">{children}</main>

  return (
    <>
      {viewingAs && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-amber/10 border-b border-amber/30 px-4 py-2 lg:pl-56">
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
        <main className={`pb-safe-nav px-4 md:px-6 lg:px-8 lg:pt-8 ${viewingAs ? 'pt-12 lg:pt-4' : 'pt-6 lg:pt-4'}`}>
          {children}
        </main>
      </AppShell>
      <BottomNav />
    </>
  )
}
