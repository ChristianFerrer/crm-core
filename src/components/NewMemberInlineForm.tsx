'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, UserPlus, Check, Loader2, AlertTriangle, ChevronLeft, Save } from 'lucide-react'

type Child = { name: string; sex: 'M' | 'F' | ''; birth_date: string }
type PartnerResult = { id: string; name: string; phone: string }

export type CreatedMember = {
  id: string
  name: string
  phone: string | null
  memberships: { id: string; sessions_remaining: number | null; expires_at: string; membership_types: { name: string } | null }[]
  children: { name: string; birth_date: string }[]
}

export function NewMemberInlineForm({
  onCreated,
  onCancel,
}: {
  onCreated: (member: CreatedMember) => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [children, setChildren] = useState<Child[]>([])
  const [consentAccepted, setConsentAccepted] = useState(false)

  const [showPartner, setShowPartner] = useState(false)
  const [partnerPhone, setPartnerPhone] = useState('')
  const [partnerSearching, setPartnerSearching] = useState(false)
  const [partnerFound, setPartnerFound] = useState<PartnerResult | null | undefined>(undefined)
  const [partnerConfirmed, setPartnerConfirmed] = useState(false)
  const [partnerName, setPartnerName] = useState('')
  const partnerTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function addChild() { setChildren(cs => [...cs, { name: '', sex: '', birth_date: '' }]) }
  function removeChild(i: number) { setChildren(cs => cs.filter((_, idx) => idx !== i)) }
  function updateChild(i: number, field: keyof Child, value: string) {
    setChildren(cs => cs.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  function resetPartner() {
    setShowPartner(false); setPartnerPhone(''); setPartnerFound(undefined)
    setPartnerConfirmed(false); setPartnerName('')
  }

  function handlePartnerPhone(val: string) {
    setPartnerPhone(val)
    setPartnerFound(undefined)
    setPartnerConfirmed(false)
    setPartnerName('')
    clearTimeout(partnerTimer.current)
    if (val.replace(/\s/g, '').length < 8) return
    setPartnerSearching(true)
    partnerTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('members')
        .select('id, name, phone')
        .or(`phone.eq.${val.trim()},phone.ilike.%${val.replace(/\s/g, '')}%`)
        .limit(1)
        .single()
      setPartnerSearching(false)
      setPartnerFound(data ?? null)
    }, 400)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !consentAccepted) return
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    setSaving(true); setError(null)

    try {
      const cleanChildren = children.filter(c => c.name.trim())
      const hasPartner = showPartner && partnerPhone.trim() && (partnerConfirmed || partnerName.trim())

      let familyId: string | null = null
      if (hasPartner) {
        const { data: fam, error: fe } = await supabase
          .from('families').insert({ name: `Familia ${lastName.trim() || firstName.trim()}` }).select('id').single()
        if (fe) throw fe
        familyId = fam.id
      }

      const { data: member, error: me } = await supabase
        .from('members')
        .insert({
          name: fullName,
          phone: phone.trim() || null,
          email: email.trim() || null,
          birth_date: birthDate || null,
          family_id: familyId,
          children: cleanChildren,
          children_count: cleanChildren.length,
          consent_accepted_at: new Date().toISOString(),
          consent_version: 'v1.0',
        })
        .select('id, name, phone, memberships(id, sessions_remaining, expires_at, membership_types(name)), children')
        .single()
      if (me) throw me

      if (hasPartner && familyId) {
        if (partnerFound && partnerConfirmed) {
          await supabase.from('members').update({
            family_id: familyId,
            ...(cleanChildren.length > 0 ? { children: cleanChildren, children_count: cleanChildren.length } : {}),
          }).eq('id', partnerFound.id)
        } else if (partnerName.trim()) {
          await supabase.from('members').insert({
            name: partnerName.trim(),
            phone: partnerPhone.trim(),
            family_id: familyId,
            children: cleanChildren,
            children_count: cleanChildren.length,
            consent_accepted_at: new Date().toISOString(),
            consent_version: 'v1.0',
          })
        }
      }

      onCreated(member as unknown as CreatedMember)
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-3 py-2 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
  const labelCls = 'block text-xs font-semibold text-fog uppercase tracking-wide mb-1'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-surface2/40">
        <button type="button" onClick={onCancel}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 bg-surface/60 text-fog hover:text-snow transition-colors shrink-0">
          <ChevronLeft size={16} />
        </button>
        <p className="font-semibold text-snow text-sm">Nuevo miembro</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
        {/* Datos personales */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-fog uppercase tracking-wide">Titular</p>

          <div className="grid grid-cols-2 gap-2">
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
            <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className={inputCls} />
          </div>
        </div>

        {/* Hijos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">Hijos</p>
            <button type="button" onClick={addChild}
              className="flex items-center gap-1 text-xs font-semibold text-lime hover:text-lime-deep transition-colors">
              <Plus size={12} /> Añadir
            </button>
          </div>
          {children.length === 0 && (
            <p className="text-xs text-mist">Opcional — añade los niños que vienen con este miembro.</p>
          )}
          {children.map((c, i) => (
            <div key={i} className="border border-line rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-fog">Hijo/a {i + 1}</p>
                <button type="button" onClick={() => removeChild(i)} className="text-mist hover:text-rose transition-colors"><X size={13} /></button>
              </div>
              <input value={c.name} onChange={e => updateChild(i, 'name', e.target.value)} placeholder="Nombre" className={inputCls} />
              <div className="grid grid-cols-2 gap-2">
                <select value={c.sex} onChange={e => updateChild(i, 'sex', e.target.value)} className={inputCls}>
                  <option value="">Sin especificar</option>
                  <option value="M">Niño</option>
                  <option value="F">Niña</option>
                </select>
                <input type="date" value={c.birth_date} onChange={e => updateChild(i, 'birth_date', e.target.value)}
                  max={new Date().toISOString().slice(0, 10)} placeholder="Nacimiento" className={inputCls} />
              </div>
            </div>
          ))}
        </div>

        {/* Pareja */}
        {!showPartner ? (
          <button type="button" onClick={() => setShowPartner(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-xs font-semibold text-fog hover:border-line2 hover:text-snow transition-colors">
            <UserPlus size={13} /> Agregar pareja / otro titular
          </button>
        ) : (
          <div className="border border-line rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-fog uppercase tracking-wide">Pareja / otro titular</p>
              <button type="button" onClick={resetPartner} className="text-mist hover:text-rose transition-colors"><X size={13} /></button>
            </div>
            <p className="text-xs text-mist">Introduce el teléfono. Si ya está registrado lo vinculamos automáticamente.</p>
            <div className="relative">
              <input type="tel" value={partnerPhone} onChange={e => handlePartnerPhone(e.target.value)}
                placeholder="612 345 678" className={inputCls} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {partnerSearching && <Loader2 size={13} className="text-mist animate-spin" />}
                {partnerConfirmed && <Check size={13} className="text-lime" />}
              </div>
            </div>
            {partnerFound && !partnerConfirmed && (
              <div className="rounded-xl border border-lime/20 bg-lime/5 p-3 space-y-2">
                <p className="text-xs text-fog">Miembro encontrado: <span className="text-snow font-medium">{partnerFound.name}</span></p>
                <button type="button" onClick={() => setPartnerConfirmed(true)}
                  className="w-full rounded-xl bg-lime/10 border border-lime/30 py-1.5 text-xs font-semibold text-lime hover:bg-lime/20 transition-colors">
                  Confirmar como pareja
                </button>
              </div>
            )}
            {partnerConfirmed && partnerFound && (
              <div className="flex items-center gap-2 rounded-xl border border-lime/20 bg-lime/5 px-3 py-2">
                <Check size={13} className="text-lime shrink-0" />
                <p className="text-sm text-snow flex-1">{partnerFound.name}</p>
                <button type="button" onClick={() => { setPartnerConfirmed(false); setPartnerFound(undefined); setPartnerPhone('') }}
                  className="text-mist hover:text-rose"><X size={12} /></button>
              </div>
            )}
            {partnerFound === null && (
              <div className="space-y-2">
                <p className="text-xs text-amber font-medium">Número no registrado — se creará nuevo miembro</p>
                <input value={partnerName} onChange={e => setPartnerName(e.target.value)}
                  placeholder="Nombre completo" className={inputCls} />
              </div>
            )}
          </div>
        )}

        {/* Consentimiento RGPD */}
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input type="checkbox" checked={consentAccepted} onChange={e => setConsentAccepted(e.target.checked)} className="sr-only" />
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${consentAccepted ? 'bg-lime border-lime' : 'bg-surface2 border-line group-hover:border-line2'}`}>
                {consentAccepted && <Check size={11} className="text-ink" strokeWidth={3} />}
              </div>
            </div>
            <p className="text-xs text-fog leading-relaxed">
              El tutor acepta el tratamiento de datos según la{' '}
              <a href="/privacidad" target="_blank" className="text-iris underline">política de privacidad</a>.
            </p>
          </label>
          {!consentAccepted && (
            <p className="text-[11px] text-amber flex items-center gap-1">
              <AlertTriangle size={11} /> Obligatorio
            </p>
          )}
        </div>

        {error && <p className="text-sm text-rose text-center">{error}</p>}

        <button type="submit" disabled={saving || !firstName.trim() || !consentAccepted}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-3.5 font-semibold text-sm text-ink transition hover:bg-lime-deep active:scale-[0.99] disabled:opacity-60"
          style={{ boxShadow: 'var(--shadow-lime)' }}>
          <Save size={15} strokeWidth={2.2} />
          {saving ? 'Guardando...' : 'Guardar y continuar'}
        </button>
      </form>
    </div>
  )
}
