'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Plus, X } from 'lucide-react'
import { use } from 'react'

type Family = { id: string; name: string }
type Child = { name: string; birth_date: string }

export default function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [families, setFamilies] = useState<Family[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [notes, setNotes] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [children, setChildren] = useState<Child[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('members').select('*').eq('id', id).single(),
      supabase.from('families').select('id, name').order('name'),
    ]).then(([{ data: member }, { data: fams }]) => {
      if (member) {
        setName(member.name ?? '')
        setPhone(member.phone ?? '')
        setEmail(member.email ?? '')
        setBirthDate(member.birth_date ?? '')
        setNotes(member.notes ?? '')
        setFamilyId(member.family_id ?? '')
        setChildren((member.children as Child[]) ?? [])
      }
      setFamilies((fams as Family[]) ?? [])
      setLoading(false)
    })
  }, [id])

  function addChild() { setChildren(prev => [...prev, { name: '', birth_date: '' }]) }
  function removeChild(i: number) { setChildren(prev => prev.filter((_, idx) => idx !== i)) }
  function updateChild(i: number, field: keyof Child, value: string) {
    setChildren(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    const validChildren = children.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), birth_date: c.birth_date || undefined }))

    const { error: err } = await supabase.from('members').update({
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      birth_date: birthDate || null,
      notes: notes.trim() || null,
      family_id: familyId || null,
      children: validChildren,
    }).eq('id', id)

    if (err) { setError(err.message); setSaving(false) }
    else router.push(`/miembros/${id}`)
  }

  const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
  const labelCls = 'block text-xs font-semibold text-fog uppercase tracking-wide mb-1.5'

  if (loading) return (
    <div className="space-y-4 lg:max-w-lg pt-2">
      <div className="h-8 w-40 bg-surface rounded-xl animate-pulse" />
      <div className="h-64 bg-surface rounded-2xl animate-pulse" />
    </div>
  )

  return (
    <div className="space-y-5 lg:max-w-lg">
      <div className="flex items-center gap-3 pt-2">
        <Link href={`/miembros/${id}`} className="w-8 h-8 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors shrink-0">
          <ArrowLeft size={15} className="text-fog" />
        </Link>
        <h1 className="font-display text-xl font-semibold text-snow truncate">Editar miembro</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Datos personales */}
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
          <p className="text-xs font-semibold text-fog uppercase tracking-wide">Padre / Madre · titular</p>

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
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alergias, preferencias, horarios habituales..." rows={3} className={`${inputCls} resize-none`} />
          </div>
        </div>

        {/* Hijos */}
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">Hijos</p>
            <button type="button" onClick={addChild} className="flex items-center gap-1 text-xs text-lime hover:text-lime-deep font-semibold">
              <Plus size={13} /> Añadir hijo/a
            </button>
          </div>
          {children.length === 0 && <p className="text-xs text-mist">Sin hijos registrados.</p>}
          {children.map((c, i) => (
            <div key={i} className="flex gap-2 items-start border-t border-line pt-3">
              <div className="flex-1 space-y-2">
                <input value={c.name} onChange={e => updateChild(i, 'name', e.target.value)} placeholder={`Nombre del hijo/a ${i + 1}`} className={inputCls} />
                <input type="date" value={c.birth_date} onChange={e => updateChild(i, 'birth_date', e.target.value)} className={`${inputCls} text-fog`} />
              </div>
              <button type="button" onClick={() => removeChild(i)} className="mt-3.5 text-mist hover:text-rose transition-colors">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Familia */}
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <p className="text-xs font-semibold text-fog uppercase tracking-wide">Familia</p>
          <select value={familyId} onChange={e => setFamilyId(e.target.value)} className={inputCls}>
            <option value="">Sin familia</option>
            {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {error && <p className="text-sm text-rose text-center">{error}</p>}

        <button type="submit" disabled={saving || !name.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-semibold text-ink transition hover:bg-lime-deep active:scale-[0.99] disabled:opacity-60"
          style={{ boxShadow: 'var(--shadow-lime)' }}>
          <Save size={17} strokeWidth={2.2} />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
