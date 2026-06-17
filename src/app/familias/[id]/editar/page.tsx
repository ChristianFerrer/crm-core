'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function EditarFamiliaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('families')
      .select('name')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setName(data.name)
        setLoading(false)
      })
  }, [id])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('families').update({ name: name.trim() }).eq('id', id)
    router.push(`/familias/${id}`)
  }

  return (
    <div className="space-y-4 lg:max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link
          href={`/familias/${id}`}
          className="w-8 h-8 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors shrink-0"
        >
          <ArrowLeft size={15} className="text-fog" />
        </Link>
        <h1 className="font-display text-xl font-semibold text-snow">Editar familia</h1>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-line bg-surface p-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-fog uppercase tracking-wide">Nombre</label>
          {loading ? (
            <div className="h-10 rounded-xl bg-surface2 animate-pulse" />
          ) : (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-full rounded-xl border border-line bg-carbon px-3 py-2.5 text-sm text-snow placeholder:text-mist focus:outline-none focus:border-iris transition-colors"
              placeholder="Nombre de la familia"
              autoFocus
            />
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || loading || !name.trim()}
            className="px-5 py-2 rounded-xl bg-iris/20 text-iris text-sm font-medium hover:bg-iris/30 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
