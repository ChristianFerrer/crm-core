'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Plus, X, UserPlus, Check, Loader2, UserX } from 'lucide-react'
import { use } from 'react'
import { DatePickerModal } from '@/components/DatePickerModal'

type Child = { name: string; sex: 'M' | 'F' | ''; birth_date: string }
type PartnerResult = { id: string; name: string; phone: string }

export default function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [children, setChildren] = useState<Child[]>([])

  const [existingPartners, setExistingPartners] = useState<{ id: string; name: string }[]>([])
  const [unlinkedIds, setUnlinkedIds] = useState<string[]>([])

  // Add new partner flow
  const [showPartner, setShowPartner] = useState(false)
  const [partnerPhone, setPartnerPhone] = useState('')
  const [partnerSearching, setPartnerSearching] = useState(false)
  const [partnerFound, setPartnerFound] = useState<PartnerResult | null | undefined>(undefined)
  const [partnerConfirmed, setPartnerConfirmed] = useState(false)
  const [partnerName, setPartnerName] = useState('')
  const partnerTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    supabase.from('members').select('*').eq('id', id).single()
      .then(async ({ data: member }) => {
        if (!member) return
        const parts = (member.name ?? '').split(' ')
        setFirstName(parts[0] ?? '')
        setLastName(parts.slice(1).join(' ') ?? '')
        setPhone(member.phone ?? '')
        setEmail(member.email ?? '')
        setBirthDate(member.birth_date ?? '')
        setFamilyId(member.family_id ?? null)
        setChildren((member.children as Child[]) ?? [])
        if (member.family_id) {
          const { data } = await supabase
            .from('members').select('id, name').eq('family_id', member.family_id).neq('id', id)
          setExistingPartners((data as any[]) ?? [])
        }
        setLoading(false)
      })
  }, [id])

  function addChild() { setChildren(cs => [...cs, { name: '', sex: '', birth_date: '' }]) }
  function removeChild(i: number) { setChildren(cs => cs.filter((_, idx) => idx !== i)) }
  function updateChild(i: number, field: keyof Child, value: string) {
    setChildren(cs => cs.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  function unlinkPartner(partnerId: string) {
    setExistingPartners(ps => ps.filter(p => p.id !== partnerId))
    setUnlinkedIds(ids => [...ids, partnerId])
  }

  function resetPartner() {
    setShowPartner(false); setPartnerPhone(''); setPartnerFound(undefined)
    setPartnerConfirmed(false); setPartnerName('')
  }

  function handlePartnerPhone(val: string) {
    setPartnerPhone(val); setPartnerFound(undefined); setPartnerConfirmed(false); setPartnerName('')
    clearTimeout(partnerTimer.current)
    if (val.replace(/\s/g, '').length < 8) return
    setPartnerSearching(true)
    partnerTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('members').select('id, name, phone')
        .eq('phone', val.trim())
        .limit(1).maybeSingle()
      setPartnerSearching(false)
      setPartnerFound(data ?? null)
    }, 400)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) return
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    setSaving(true); setError(null)

    try {
      const cleanChildren = children.filter(c => c.name.trim())
      const hasNewPartner = showPartner && partnerPhone.trim() && (partnerConfirmed || partnerName.trim())

      let fid = familyId
      if (hasNewPartner && !fid) {
        const { data: fam, error: fe } = await supabase
          .from('families').insert({ name: `Familia ${lastName.trim() || firstName.trim()}` }).select('id').single()
        if (fe) throw fe
        fid = fam.id
      }

      const { error: err } = await supabase.from('members').update({
        name: fullName, phone: phone.trim() || null, email: email.trim() || null,
        birth_date: birthDate || null, family_id: fid,
        children: cleanChildren, children_count: cleanChildren.length,
      }).eq('id', id)
      if (err) throw err

      // Unlink removed partners
      for (const pid of unlinkedIds) {
        await supabase.from('members').update({ family_id: null }).eq('id', pid)
      }

      // Add new partner — los hijos viven en el titular principal, no se duplican
      if (hasNewPartner && fid) {
        if (partnerFound && partnerConfirmed) {
          await supabase.from('members').update({ family_id: fid }).eq('id', partnerFound.id)
        } else if (partnerName.trim()) {
          await supabase.from('members').insert({
            name: partnerName.trim(), phone: partnerPhone.trim(), family_id: fid,
          })
        }
      }

      router.push(`/miembros/${id}`)
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
  const labelCls = 'block text-xs font-semibold text-fog uppercase tracking-wide mb-1.5'

  const activePartners = existingPartners.filter(p => !unlinkedIds.includes(p.id))
  const hasPartner = activePartners.length > 0

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
          <p className="text-xs font-semibold text-fog uppercase tracking-wide">Titular</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Apellido</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellido" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Teléfono</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="612 345 678" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fecha de nacimiento</label>
            <DatePickerModal value={birthDate} onChange={setBirthDate} />
          </div>
        </div>

        {/* Hijos */}
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-fog uppercase tracking-wide">Hijos</p>
              <p className="text-xs text-mist mt-0.5">Opcional</p>
            </div>
            <button type="button" onClick={addChild}
              className="flex items-center gap-1 text-xs font-semibold text-lime hover:text-lime-deep transition-colors">
              <Plus size={13} /> Añadir hijo/a
            </button>
          </div>
          {children.length === 0 && <p className="text-xs text-mist">Añade los niños que vienen con este miembro.</p>}
          {children.map((c, i) => (
            <div key={i} className="border-t border-line pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-fog">Hijo/a {i + 1}</p>
                <button type="button" onClick={() => removeChild(i)} className="text-mist hover:text-rose transition-colors"><X size={14} /></button>
              </div>
              <input value={c.name} onChange={e => updateChild(i, 'name', e.target.value)} placeholder="Nombre" className={inputCls} />
              <div>
                <label className={labelCls}>Sexo</label>
                <select value={c.sex} onChange={e => updateChild(i, 'sex', e.target.value)} className={inputCls}>
                  <option value="">Sin especificar</option>
                  <option value="M">Niño</option>
                  <option value="F">Niña</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha de nacimiento</label>
                <DatePickerModal value={c.birth_date} onChange={v => updateChild(i, 'birth_date', v)} />
              </div>
            </div>
          ))}
        </div>

        {/* Pareja / titular vinculado */}
        {hasPartner && (
          <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">Titular vinculado</p>
            {activePartners.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-line/60 bg-surface2 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-iris/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-iris">{p.name[0]}</span>
                </div>
                <span className="text-sm text-snow flex-1 min-w-0 truncate">{p.name}</span>
                <button
                  type="button"
                  onClick={() => unlinkPartner(p.id)}
                  className="flex items-center gap-1 text-xs text-mist hover:text-rose transition-colors shrink-0"
                  title="Desvincular"
                >
                  <UserX size={14} /> Desvincular
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Añadir titular — solo si no hay ninguno */}
        {!hasPartner && !showPartner && (
          <button type="button" onClick={() => setShowPartner(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-xs font-semibold text-fog hover:border-line2 hover:text-snow transition-colors">
            <UserPlus size={14} /> Vincular otro titular
          </button>
        )}

        {!hasPartner && showPartner && (
          <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-fog uppercase tracking-wide">Vincular titular</p>
              <button type="button" onClick={resetPartner} className="text-mist hover:text-rose transition-colors"><X size={14} /></button>
            </div>
            <p className="text-xs text-mist">Introduce el teléfono. Si ya está registrado lo vinculamos automáticamente.</p>

            <div>
              <label className={labelCls}>Teléfono</label>
              <div className="relative">
                <input type="tel" value={partnerPhone} onChange={e => handlePartnerPhone(e.target.value)}
                  placeholder="612 345 678" className={inputCls} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {partnerSearching && <Loader2 size={14} className="text-mist animate-spin" />}
                  {partnerConfirmed && <Check size={14} className="text-lime" />}
                </div>
              </div>
            </div>

            {partnerFound && !partnerConfirmed && (
              <div className="rounded-xl border border-lime/20 bg-lime/5 p-4 space-y-3">
                <p className="text-xs text-fog">Miembro encontrado</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-lime/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-lime">{partnerFound.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-snow">{partnerFound.name}</p>
                    <p className="text-xs text-mist">{partnerFound.phone}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setPartnerConfirmed(true)}
                  className="w-full rounded-xl bg-lime/10 border border-lime/30 py-2 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors">
                  Confirmar como titular
                </button>
              </div>
            )}

            {partnerConfirmed && partnerFound && (
              <div className="flex items-center gap-3 rounded-xl border border-lime/20 bg-lime/5 px-4 py-3">
                <Check size={14} className="text-lime shrink-0" />
                <p className="text-sm text-snow">{partnerFound.name} <span className="text-mist text-xs">— se vinculará al guardar</span></p>
                <button type="button" onClick={() => { setPartnerConfirmed(false); setPartnerFound(undefined); setPartnerPhone('') }}
                  className="ml-auto text-mist hover:text-rose"><X size={13} /></button>
              </div>
            )}

            {partnerFound === null && (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber/20 bg-amber/5 px-4 py-3">
                  <p className="text-xs text-amber font-medium">Número no registrado — se creará un nuevo miembro</p>
                </div>
                <div>
                  <label className={labelCls}>Nombre *</label>
                  <input value={partnerName} onChange={e => setPartnerName(e.target.value)}
                    placeholder="Nombre completo" className={inputCls} />
                </div>
              </div>
            )}

            <p className="text-[11px] text-mist">Los hijos se asignarán a ambos titulares.</p>
          </div>
        )}

        {error && <p className="text-sm text-rose text-center">{error}</p>}

        <button type="submit" disabled={saving || !firstName.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-semibold text-ink transition hover:bg-lime-deep active:scale-[0.99] disabled:opacity-60"
          style={{ boxShadow: 'var(--shadow-lime)' }}>
          <Save size={17} strokeWidth={2.2} />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
