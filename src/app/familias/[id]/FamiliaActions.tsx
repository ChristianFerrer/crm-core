'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function FamiliaActions({ id }: { id: string }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await supabase.from('members').update({ family_id: null }).eq('family_id', id)
    await supabase.from('families').delete().eq('id', id)
    router.push('/miembros?view=familias')
  }

  return (
    <>
      <Link
        href={`/familias/${id}/editar`}
        className="w-8 h-8 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors shrink-0"
      >
        <Pencil size={14} className="text-fog" />
      </Link>

      <button
        onClick={() => setShowModal(true)}
        className="w-8 h-8 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors shrink-0"
      >
        <Trash2 size={14} className="text-rose" />
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-carbon/80 backdrop-blur-sm px-4">
          <div className="rounded-2xl border border-line bg-surface p-6 w-full max-w-sm space-y-4">
            <h2 className="text-base font-semibold text-snow">¿Eliminar familia?</h2>
            <p className="text-sm text-fog">
              Se desvinculará a los titulares. Los hijos permanecerán con cada titular.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-line bg-surface2 text-sm text-fog hover:text-snow transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-rose/15 text-rose text-sm font-medium hover:bg-rose/25 transition-colors disabled:opacity-50"
              >
                {loading ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
