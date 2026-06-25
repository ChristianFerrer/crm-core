'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/roles'
import { loadAndStoreTenant } from '@/lib/tenant'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const inputClass =
    'w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
  const limeBtn =
    'w-full flex items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-semibold text-ink text-sm transition hover:bg-lime/90 active:scale-[0.99] disabled:opacity-60'

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        const userEmail = data.user?.email ?? ''
        if (!isSuperAdmin(userEmail)) await loadAndStoreTenant(userEmail)
        router.push(isSuperAdmin(userEmail) ? '/admin' : '/')
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Revisa tu correo para confirmar tu cuenta.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-carbon flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-lime flex items-center justify-center" style={{ boxShadow: 'var(--shadow-lime)' }}>
            <span className="text-ink font-bold text-2xl">W</span>
          </div>
          <div>
            <p className="font-display font-bold text-snow text-2xl leading-tight">Watermelon</p>
            <p className="text-sm text-mist mt-0.5">CRM para Ludotecas</p>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
          {/* Google */}
          <button
            disabled
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-line bg-surface2 py-3 text-sm font-semibold text-mist cursor-not-allowed opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

          {/* Divider */}
          <div className="relative flex items-center">
            <div className="flex-1 border-t border-line" />
            <span className="absolute left-1/2 -translate-x-1/2 bg-surface text-xs text-mist px-2">o</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="email" placeholder="Correo electrónico" value={email}
              onChange={e => setEmail(e.target.value)} required className={inputClass} />
            <input type="password" placeholder="Contraseña" value={password}
              onChange={e => setPassword(e.target.value)} required className={inputClass} />

            {error && <p className="text-xs text-rose">{error}</p>}
            {message && <p className="text-xs text-lime">{message}</p>}

            <button type="submit" disabled={loading} className={limeBtn}>
              {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-xs text-mist">
            {mode === 'login' ? (
              <>¿Primera vez?{' '}
                <button onClick={() => { setMode('register'); setError(''); setMessage('') }}
                  className="text-snow underline hover:text-lime transition-colors">Crear cuenta</button></>
            ) : (
              <>¿Ya tienes cuenta?{' '}
                <button onClick={() => { setMode('login'); setError(''); setMessage('') }}
                  className="text-snow underline hover:text-lime transition-colors">Iniciar sesión</button></>
            )}
          </p>
        </div>

        <p className="text-center text-[10px] text-mist">
          Watermelon CRM · v0.1 ·{' '}
          <a href="/privacidad" className="underline hover:text-snow transition-colors">Política de privacidad</a>
        </p>
      </div>
    </div>
  )
}
