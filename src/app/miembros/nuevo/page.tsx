'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Plus, X, UserPlus, Check, Loader2, AlertTriangle } from 'lucide-react'
import { DatePickerModal } from '@/components/DatePickerModal'

type Child = { name: string; sex: 'M' | 'F' | ''; birth_date: string }
type PartnerResult = { id: string; name: string; phone: string }

export default function NuevoMiembroPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [children, setChildren] = useState<Child[]>([])
  const [consentAccepted, setConsentAccepted] = useState(false)

  // Partner
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
        .eq('phone', val.trim())
        .limit(1)
        .maybeSingle()
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
        .select('id').single()
      if (me) throw me

      if (hasPartner && familyId) {
        // Los hijos viven en el titular principal (no se duplican en la pareja,
        // así se evita que diverjan al editar).
        if (partnerFound && partnerConfirmed) {
          await supabase.from('members').update({ family_id: familyId }).eq('id', partnerFound.id)
        } else if (partnerName.trim()) {
          await supabase.from('members').insert({
            name: partnerName.trim(),
            phone: partnerPhone.trim(),
            family_id: familyId,
            consent_accepted_at: new Date().toISOString(),
            consent_version: 'v1.0',
          })
        }
      }

      router.push(`/miembros/${member.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-2 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
  const labelCls = 'block text-xs font-semibold text-fog uppercase tracking-wide mb-1.5'

  return (
    <div className="space-y-5 lg:max-w-lg">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/miembros" className="w-8 h-8 rounded-xl border border-line bg-surface flex items-center justify-center hover:border-line2 transition-colors">
          <ArrowLeft size={15} className="text-fog" />
        </Link>
        <h1 className="font-display text-xl font-semibold text-snow">Nuevo miembro</h1>
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

        {/* Pareja */}
        {!showPartner ? (
          <button type="button" onClick={() => setShowPartner(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-xs font-semibold text-fog hover:border-line2 hover:text-snow transition-colors">
            <UserPlus size={14} /> Agregar pareja / otro titular
          </button>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-fog uppercase tracking-wide">Pareja / otro titular</p>
              <button type="button" onClick={resetPartner} className="text-mist hover:text-rose transition-colors"><X size={14} /></button>
            </div>
            <p className="text-xs text-mist">Introduce el teléfono. Si ya está registrado lo vinculamos automáticamente.</p>

            <div>
              <label className={labelCls}>Teléfono de la pareja</label>
              <div className="relative">
                <input type="tel" value={partnerPhone} onChange={e => handlePartnerPhone(e.target.value)}
                  placeholder="612 345 678" className={inputCls} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {partnerSearching && <Loader2 size={14} className="text-mist animate-spin" />}
                  {partnerConfirmed && <Check size={14} className="text-lime" />}
                </div>
              </div>
            </div>

            {/* Encontrado */}
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
                  Confirmar como pareja
                </button>
              </div>
            )}

            {/* Confirmado */}
            {partnerConfirmed && partnerFound && (
              <div className="flex items-center gap-3 rounded-xl border border-lime/20 bg-lime/5 px-4 py-3">
                <Check size={14} className="text-lime shrink-0" />
                <p className="text-sm text-snow">{partnerFound.name} <span className="text-mist text-xs">— vinculado</span></p>
                <button type="button" onClick={() => { setPartnerConfirmed(false); setPartnerFound(undefined); setPartnerPhone('') }}
                  className="ml-auto text-mist hover:text-rose"><X size={13} /></button>
              </div>
            )}

            {/* No encontrado */}
            {partnerFound === null && (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber/20 bg-amber/5 px-4 py-3">
                  <p className="text-xs text-amber font-medium">Número no registrado — se creará un nuevo miembro</p>
                </div>
                <div>
                  <label className={labelCls}>Nombre de la pareja *</label>
                  <input value={partnerName} onChange={e => setPartnerName(e.target.value)}
                    placeholder="Nombre completo" className={inputCls} />
                </div>
              </div>
            )}

            <p className="text-[11px] text-mist">Se creará una familia compartida y los hijos se asignarán a ambos titulares.</p>
          </div>
        )}

        {/* Consentimiento RGPD */}
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <p className="text-xs font-semibold text-fog uppercase tracking-wide">Protección de datos</p>
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={e => setConsentAccepted(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${consentAccepted ? 'bg-lime border-lime' : 'bg-surface2 border-line group-hover:border-line2'}`}>
                {consentAccepted && <Check size={12} className="text-ink" strokeWidth={3} />}
              </div>
            </div>
            <p className="text-xs text-fog leading-relaxed">
              El tutor legal ha sido informado y acepta el tratamiento de sus datos y los de su hijo/a según la{' '}
              <a href="/privacidad" target="_blank" className="text-iris underline hover:text-iris/80">política de privacidad</a>.
              Consentimiento registrado con fecha y hora.
            </p>
          </label>
          {!consentAccepted && (
            <p className="text-[11px] text-amber flex items-center gap-1">
              <AlertTriangle size={11} /> Obligatorio para registrar al miembro
            </p>
          )}
        </div>

        {error && <p className="text-sm text-rose text-center">{error}</p>}

        <button type="submit" disabled={saving || !firstName.trim() || !consentAccepted}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-lime bg-transparent py-3.5 font-semibold text-lime transition hover:bg-lime/10 active:scale-[0.99] disabled:opacity-60"
          style={{ boxShadow: 'var(--shadow-lime)' }}>
          <Save size={17} strokeWidth={2.2} />
          {saving ? 'Guardando...' : 'Guardar miembro'}
        </button>
      </form>
    </div>
  )
}
