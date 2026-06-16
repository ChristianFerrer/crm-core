'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'

type Family = { id: string; name: string }

export default function NuevoMiembroPage() {
  const router = useRouter()
  const [families, setFamilies] = useState<Family[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [notes, setNotes] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [newFamilyName, setNewFamilyName] = useState('')
  const [familyMode, setFamilyMode] = useState<'existing' | 'new' | 'none'>('existing')

  useEffect(() => {
    supabase.from('families').select('id, name').order('name')
      .then(({ data }) => setFamilies((data as Family[]) ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    try {
      let fid: string | null = null

      if (familyMode === 'existing' && familyId) {
        fid = familyId
      } else if (familyMode === 'new' && newFamilyName.trim()) {
        const { data, error: fe } = await supabase.from('families').insert({ name: newFamilyName.trim() }).select('id').single()
        if (fe) throw fe
        fid = data.id
      }

      const { data, error: me } = await supabase
        .from('members')
        .insert({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          birth_date: birthDate || null,
          notes: notes.trim() || null,
          family_id: fid,
        })
        .select('id')
        .single()
      if (me) throw me

      router.push(`/miembros/${data.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
  const labelCls = 'block text-xs font-semibold text-fog uppercase tracking-wide mb-1.5'

  return (
    <div className="space-y-5 lg:max-w-lg">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/miembros" className="w-8 h-8 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors">
          <ArrowLeft size={15} className="text-fog" />
        </Link>
        <h1 className="font-display text-xl font-semibold text-snow">Nuevo cliente</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
          <p className="text-xs font-semibold text-fog uppercase tracking-wide">Datos personales</p>

          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo" required className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Teléfono</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="612 345 678" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha nacimiento</label>
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Notas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Alergias, preferencias, horarios habituales..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
          <p className="text-xs font-semibold text-fog uppercase tracking-wide">Familia</p>

          <div className="flex rounded-xl border border-line overflow-hidden">
            {(['existing', 'new', 'none'] as const).map((mode, i) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFamilyMode(mode)}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${familyMode === mode ? 'bg-lime/15 text-lime' : 'text-mist hover:text-fog'} ${i > 0 ? 'border-l border-line' : ''}`}
              >
                {mode === 'existing' ? 'Familia existente' : mode === 'new' ? 'Crear nueva' : 'Sin familia'}
              </button>
            ))}
          </div>

          {familyMode === 'existing' && (
            <select value={familyId} onChange={e => setFamilyId(e.target.value)} className={inputCls}>
              <option value="">Selecciona una familia</option>
              {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}

          {familyMode === 'new' && (
            <input value={newFamilyName} onChange={e => setNewFamilyName(e.target.value)} placeholder="Nombre de la familia (ej. Família García)" className={inputCls} />
          )}
        </div>

        {error && <p className="text-sm text-rose text-center">{error}</p>}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-semibold text-ink transition hover:bg-lime-deep active:scale-[0.99] disabled:opacity-60"
          style={{ boxShadow: 'var(--shadow-lime)' }}
        >
          <Save size={17} strokeWidth={2.2} />
          {saving ? 'Guardando...' : 'Guardar cliente'}
        </button>
      </form>
    </div>
  )
}
