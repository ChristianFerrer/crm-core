'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PasswordInput } from '@/components/PasswordInput'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const inputClass =
    'w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
  const limeBtn =
    'w-full flex items-center justify-center gap-2 rounded-xl border border-lime bg-lime/10 py-3.5 font-semibold text-lime text-sm transition hover:bg-lime/20 active:scale-[0.99] disabled:opacity-60'

  useEffect(() => {
    // El enlace del correo abre una sesión de recuperación temporal; el cliente
    // la detecta automáticamente desde la URL al cargar.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setStatus('ready')
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStatus('ready')
    })
    const timeout = setTimeout(() => setStatus(s => (s === 'checking' ? 'invalid' : s)), 3000)
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setMessage('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { setError(error.message); return }
    setMessage('Contraseña actualizada. Redirigiendo...')
    setTimeout(() => router.push('/login'), 1500)
  }

  return (
    <div className="min-h-screen bg-carbon flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-lime flex items-center justify-center" style={{ boxShadow: 'var(--shadow-lime)' }}>
            <span className="text-ink font-bold text-2xl">W</span>
          </div>
          <div>
            <p className="font-display font-bold text-snow text-2xl leading-tight">Nueva contraseña</p>
            <p className="text-sm text-mist mt-0.5">Watermelon CRM</p>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
          {status === 'checking' && (
            <p className="text-center text-sm text-fog py-6">Comprobando enlace...</p>
          )}

          {status === 'invalid' && (
            <div className="text-center space-y-3 py-4">
              <p className="text-sm text-rose">Este enlace no es válido o ha caducado.</p>
              <a href="/login" className="text-xs text-snow underline hover:text-lime transition-colors">Volver a iniciar sesión</a>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <PasswordInput value={password} onChange={setPassword} placeholder="Nueva contraseña" required minLength={6}
                className={inputClass.replace('px-4', 'pl-4 pr-11')} />
              <PasswordInput value={confirm} onChange={setConfirm} placeholder="Confirma la contraseña" required minLength={6}
                className={inputClass.replace('px-4', 'pl-4 pr-11')} />

              {error && <p className="text-xs text-rose">{error}</p>}
              {message && <p className="text-xs text-lime">{message}</p>}

              <button type="submit" disabled={saving} className={limeBtn}>
                {saving ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
