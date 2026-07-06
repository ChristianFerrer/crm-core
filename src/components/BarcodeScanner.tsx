'use client'

import { useEffect, useState } from 'react'
import { X, Camera, Loader } from 'lucide-react'

const SCANNER_DIV_ID = 'wm-barcode-scanner'

export function BarcodeScanner({ onDetected, onClose }: {
  onDetected: (code: string) => void
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let scanner: any = null

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        scanner = new Html5Qrcode(SCANNER_DIV_ID)
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 110 } },
          (text: string) => { onDetected(text) },
          () => {}
        )
        setReady(true)
      } catch {
        setError('No se pudo acceder a la cámara. Comprueba los permisos del navegador.')
      }
    }

    start()

    return () => {
      if (scanner) scanner.stop().catch(() => {})
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Camera size={14} className="text-lime" />
            <span className="text-sm font-semibold text-snow">Escanear código de barras</span>
          </div>
          <button onClick={onClose} className="text-mist hover:text-snow transition-colors">
            <X size={16} />
          </button>
        </div>

        {error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-rose">{error}</p>
            <button onClick={onClose} className="mt-4 text-xs text-fog underline">Cerrar</button>
          </div>
        ) : (
          <div className="relative">
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-carbon/80 z-10" style={{ minHeight: 220 }}>
                <Loader size={20} className="text-lime animate-spin" />
              </div>
            )}
            <div id={SCANNER_DIV_ID} className="w-full" style={{ minHeight: 220 }} />
          </div>
        )}

        <div className="px-4 py-3 border-t border-line text-center">
          <p className="text-xs text-mist">Apunta la cámara al código de barras del producto</p>
        </div>
      </div>
    </div>
  )
}
