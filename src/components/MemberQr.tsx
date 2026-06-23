'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { X, Maximize2 } from 'lucide-react'

export function MemberQr({ qrCode }: { qrCode: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="rounded-xl bg-white p-3 hover:opacity-90 transition-opacity relative group"
        title="Tocar para ampliar"
      >
        <QRCodeSVG value={qrCode} size={160} fgColor="#0e0f12" bgColor="#ffffff" />
        <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
          <Maximize2 size={22} className="text-gray-700" />
        </div>
      </button>
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
          onClick={() => setExpanded(false)}
        >
          <div className="rounded-2xl bg-white p-6 shadow-2xl max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-800 font-semibold text-sm">Código QR de acceso</p>
              <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <QRCodeSVG value={qrCode} size={260} fgColor="#0e0f12" bgColor="#ffffff" />
            <p className="text-center text-xs text-gray-400 mt-3">Toca fuera para cerrar</p>
          </div>
        </div>
      )}
    </>
  )
}
