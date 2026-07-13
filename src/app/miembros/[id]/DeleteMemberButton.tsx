'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Trash2, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/Modal'

export function DeleteMemberButton({ memberId }: { memberId: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')

  async function handleDelete() {
    setStep('deleting')
    // Anonimiza datos personales — conserva el registro por obligación fiscal (5 años).
    // Invalida el QR (para que no sirva para check-in) y desvincula de la familia.
    const { error } = await supabase
      .from('members')
      .update({
        name: 'Miembro eliminado',
        phone: null,
        email: null,
        birth_date: null,
        children: [],
        children_count: 0,
        notes: null,
        qr_code: null,
        family_id: null,
      })
      .eq('id', memberId)

    if (error) {
      setStep('confirm')
      alert('Error al eliminar el miembro. Inténtalo de nuevo.')
      return
    }

    router.push('/miembros')
  }

  return (
    <>
      <button
        onClick={() => setStep('confirm')}
        className="flex items-center gap-1.5 rounded-xl border border-rose/30 px-3 py-2 text-xs font-semibold text-rose hover:bg-rose/20 transition-colors shrink-0"
      >
        <Trash2 size={13} /> Eliminar
      </button>

      <Modal open={step !== 'idle'} onClose={() => step === 'confirm' && setStep('idle')} z="z-[70]" label="Eliminar miembro">
        <div className="p-5 space-y-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-rose shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-snow">¿Eliminar este miembro?</p>
                <p className="text-xs text-fog mt-1 leading-relaxed">
                  Sus datos personales serán anonimizados de forma permanente (nombre, teléfono, email, hijos) y su QR quedará invalidado. El historial de visitas se conserva por obligación fiscal durante 5 años.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('idle')}
                disabled={step === 'deleting'}
                className="flex-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-fog hover:text-snow transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={step === 'deleting'}
                className="flex-1 rounded-xl bg-rose/20 border border-rose/30 py-2.5 text-xs font-semibold text-rose hover:bg-rose/30 transition-colors disabled:opacity-50"
              >
                {step === 'deleting' ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
        </div>
      </Modal>
    </>
  )
}
