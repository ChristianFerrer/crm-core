'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AltaPage() {
  const [registroUrl, setRegistroUrl] = useState('')
  const [tenantName, setTenantName] = useState('')

  useEffect(() => {
    setRegistroUrl(`${window.location.origin}/alta/registro`)
    supabase.from('tenants').select('name').limit(1).maybeSingle()
      .then(({ data }) => { if (data?.name) setTenantName(data.name) })
  }, [])

  return (
    <div className="min-h-screen bg-carbon flex flex-col items-center justify-center px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10 w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-lime flex items-center justify-center" style={{ boxShadow: '0 10px 40px -12px rgba(198,242,78,0.5)' }}>
            <span className="text-ink font-bold text-lg">{(tenantName || 'W').charAt(0).toUpperCase()}</span>
          </div>
          <span className="font-display text-xl font-semibold text-snow">{tenantName || 'Watermelon CRM'}</span>
        </div>

        <h1 className="font-display text-3xl font-semibold text-snow mb-2">Alta de miembro</h1>
        <p className="text-fog text-sm leading-relaxed">
          El miembro se registra en menos de un minuto, sin instalar nada.
        </p>
      </div>

      {/* QR card */}
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-line bg-surface p-6 text-center space-y-5">
          <div className="inline-flex items-center gap-2 bg-lime/10 border border-lime/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
            <span className="text-xs font-semibold text-lime uppercase tracking-wide">En la recepción</span>
          </div>

          <div>
            <p className="text-lg font-semibold text-snow mb-1">Escanea para registrarte</p>
            <p className="text-xs text-mist">Apunta con la cámara del móvil</p>
          </div>

          <div className="flex justify-center">
            {registroUrl ? (
              <div className="rounded-2xl bg-white p-4 inline-block">
                <QRCodeSVG
                  value={registroUrl}
                  size={220}
                  fgColor="#0e0f12"
                  bgColor="#ffffff"
                />
              </div>
            ) : (
              <div className="w-[252px] h-[252px] rounded-2xl bg-surface2 animate-pulse" />
            )}
          </div>

          <p className="text-xs text-mist leading-relaxed">
            Rellena tus datos y obten tu código personal de acceso.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="flex items-center justify-center gap-2 w-full mt-4 py-3 rounded-xl border border-line text-sm text-mist hover:text-fog hover:border-line2 transition-colors"
        >
          <RotateCcw size={14} /> Reiniciar
        </button>
      </div>
    </div>
  )
}
