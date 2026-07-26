'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Trash2, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useLanguage } from '@/lib/i18n'

export function DeleteMemberButton({ memberId }: { memberId: string }) {
  const { t } = useLanguage()
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
      alert(t('miembros_error_eliminar'))
      return
    }

    router.push('/miembros')
  }

  return (
    <>
      <button
        onClick={() => setStep('confirm')}
        title={t('miembros_eliminar')}
        aria-label={t('miembros_eliminar_aria')}
        className="w-9 h-9 flex items-center justify-center rounded-xl border border-rose/30 text-rose hover:bg-rose/20 transition-colors shrink-0"
      >
        <Trash2 size={14} />
      </button>

      <Modal open={step !== 'idle'} onClose={() => step === 'confirm' && setStep('idle')} z="z-[70]" label={t('miembros_eliminar_aria')}>
        <div className="p-5 space-y-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-rose shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-snow">{t('miembros_confirmar_eliminar_titulo')}</p>
                <p className="text-xs text-fog mt-1 leading-relaxed">
                  {t('miembros_confirmar_eliminar_desc')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('idle')}
                disabled={step === 'deleting'}
                className="flex-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-fog hover:text-snow transition-colors disabled:opacity-50"
              >
                {t('miembros_cancelar')}
              </button>
              <button
                onClick={handleDelete}
                disabled={step === 'deleting'}
                className="flex-1 rounded-xl bg-rose/20 border border-rose/30 py-2.5 text-xs font-semibold text-rose hover:bg-rose/30 transition-colors disabled:opacity-50"
              >
                {step === 'deleting' ? t('miembros_eliminando') : t('miembros_si_eliminar')}
              </button>
            </div>
        </div>
      </Modal>
    </>
  )
}
