'use client'

import { useEffect, useRef, type ReactNode } from 'react'

type ModalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Ancho máximo del panel (clase Tailwind). Por defecto max-w-sm. */
  maxWidth?: string
  /** Etiqueta accesible del diálogo. */
  label?: string
  /** z-index del overlay (por defecto z-[60]). */
  z?: string
  /** Si false, el clic en el backdrop no cierra. Por defecto true. */
  closeOnBackdrop?: boolean
}

/**
 * Modal compartido: backdrop, cierre por Esc y por clic fuera, y semántica
 * de accesibilidad (role="dialog", aria-modal). Unifica el "chrome" de los
 * distintos modales de la app.
 */
export function Modal({ open, onClose, children, maxWidth = 'max-w-sm', label, z = 'z-[60]', closeOnBackdrop = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Enfoca el panel al abrir para navegación por teclado
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 ${z} flex items-center justify-center p-4`}
      onClick={() => { if (closeOnBackdrop) onClose() }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className={`relative w-full ${maxWidth} rounded-2xl border border-line bg-surface shadow-2xl outline-none`}
      >
        {children}
      </div>
    </div>
  )
}
