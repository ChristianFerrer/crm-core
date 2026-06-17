'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/roles'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      const email = session.user.email ?? ''
      router.replace(isSuperAdmin(email) ? '/admin' : '/')
    })
  }, [router])

  return (
    <div className="min-h-screen bg-carbon flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-lime flex items-center justify-center animate-pulse">
          <span className="text-ink font-bold">W</span>
        </div>
        <p className="text-sm text-fog">Iniciando sesión...</p>
      </div>
    </div>
  )
}
