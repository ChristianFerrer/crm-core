'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, UserPlus, Check, Loader2, AlertTriangle, Save } from 'lucide-react'
import { DatePickerModal } from '@/components/DatePickerModal'
import { useLanguage } from '@/lib/i18n'

type Child = { name: string; sex: 'M' | 'F' | ''; birth_date: string }
type PartnerResult = { id: string; name: string; phone: string }

export type CreatedMember = {
  id: string
  name: string
  phone: string | null
  family_id: string | null
  memberships: { id: string; sessions_remaining: number | null; expires_at: string; membership_types: { name: string } | null }[]
  children: { name: string; birth_date: string }[]
}

const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-2 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
const labelCls = 'block text-xs font-semibold text-fog uppercase tracking-wide mb-1.5'

/**
 * Formulario de alta de miembro (titular, hijos, pareja, consentimiento RGPD).
 * Única fuente de los campos: se usa tanto en /miembros/nuevo como en el
 * popup de creación rápida desde check-in / nueva reserva, para que nunca
 * diverjan.
 */
export function MemberForm({ onCreated, submitLabel }: {
  onCreated: (member: CreatedMember) => void
  submitLabel?: string
}) {
  const { t } = useLanguage()
  const resolvedSubmitLabel = submitLabel ?? t('miembros_guardar_miembro')
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
        .eq('phone', val.trim())
        .limit(1)
        .maybeSingle()
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
        .select('id, name, phone, family_id, memberships(id, sessions_remaining, expires_at, membership_types(name)), children')
        .single()
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

      onCreated(member as unknown as CreatedMember)
    } catch (err: any) {
      setError(err.message ?? t('miembros_error_guardar'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Datos personales */}
      <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
        <p className="text-xs font-semibold text-fog uppercase tracking-wide">{t('miembros_titular')}</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('miembros_nombre')}</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t('miembros_placeholder_nombre')} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('miembros_apellido')}</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t('miembros_placeholder_apellido')} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>{t('miembros_telefono')}</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('miembros_placeholder_telefono')} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>{t('miembros_email')}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('miembros_placeholder_email')} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>{t('miembros_fecha_nacimiento')}</label>
          <DatePickerModal value={birthDate} onChange={setBirthDate} />
        </div>
      </div>

      {/* Hijos */}
      <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">{t('miembros_hijos')}</p>
            <p className="text-xs text-mist mt-0.5">{t('miembros_opcional')}</p>
          </div>
          <button type="button" onClick={addChild}
            className="flex items-center gap-1 text-xs font-semibold text-lime hover:text-lime-deep transition-colors">
            <Plus size={13} /> {t('miembros_anadir_hijo')}
          </button>
        </div>
        {children.length === 0 && <p className="text-xs text-mist">{t('miembros_anadir_hijos_desc')}</p>}
        {children.map((c, i) => (
          <div key={i} className="border-t border-line pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-fog">{t('miembros_hijo_n', { n: i + 1 })}</p>
              <button type="button" onClick={() => removeChild(i)} className="text-mist hover:text-rose transition-colors"><X size={14} /></button>
            </div>
            <input value={c.name} onChange={e => updateChild(i, 'name', e.target.value)} placeholder={t('miembros_placeholder_nombre')} className={inputCls} />
            <div>
              <label className={labelCls}>{t('miembros_sexo')}</label>
              <select value={c.sex} onChange={e => updateChild(i, 'sex', e.target.value)} className={inputCls}>
                <option value="">{t('miembros_sin_especificar')}</option>
                <option value="M">{t('miembros_nino')}</option>
                <option value="F">{t('miembros_nina')}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('miembros_fecha_nacimiento')}</label>
              <DatePickerModal value={c.birth_date} onChange={v => updateChild(i, 'birth_date', v)} />
            </div>
          </div>
        ))}
      </div>

      {/* Pareja */}
      {!showPartner ? (
        <button type="button" onClick={() => setShowPartner(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-xs font-semibold text-fog hover:border-line2 hover:text-snow transition-colors">
          <UserPlus size={14} /> {t('miembros_agregar_pareja')}
        </button>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">{t('miembros_pareja_titular')}</p>
            <button type="button" onClick={resetPartner} className="text-mist hover:text-rose transition-colors"><X size={14} /></button>
          </div>
          <p className="text-xs text-mist">{t('miembros_intro_telefono_vinculo')}</p>

          <div>
            <label className={labelCls}>{t('miembros_telefono_pareja')}</label>
            <div className="relative">
              <input type="tel" value={partnerPhone} onChange={e => handlePartnerPhone(e.target.value)}
                placeholder={t('miembros_placeholder_telefono')} className={inputCls} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {partnerSearching && <Loader2 size={14} className="text-mist animate-spin" />}
                {partnerConfirmed && <Check size={14} className="text-lime" />}
              </div>
            </div>
          </div>

          {/* Encontrado */}
          {partnerFound && !partnerConfirmed && (
            <div className="rounded-xl border border-lime/20 bg-lime/5 p-4 space-y-3">
              <p className="text-xs text-fog">{t('miembros_miembro_encontrado')}</p>
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
                {t('miembros_confirmar_pareja')}
              </button>
            </div>
          )}

          {/* Confirmado */}
          {partnerConfirmed && partnerFound && (
            <div className="flex items-center gap-3 rounded-xl border border-lime/20 bg-lime/5 px-4 py-3">
              <Check size={14} className="text-lime shrink-0" />
              <p className="text-sm text-snow">{partnerFound.name} <span className="text-mist text-xs">{t('miembros_vinculado')}</span></p>
              <button type="button" onClick={() => { setPartnerConfirmed(false); setPartnerFound(undefined); setPartnerPhone('') }}
                className="ml-auto text-mist hover:text-rose"><X size={13} /></button>
            </div>
          )}

          {/* No encontrado */}
          {partnerFound === null && (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber/20 bg-amber/5 px-4 py-3">
                <p className="text-xs text-amber font-medium">{t('miembros_numero_no_registrado')}</p>
              </div>
              <div>
                <label className={labelCls}>{t('miembros_nombre_pareja')}</label>
                <input value={partnerName} onChange={e => setPartnerName(e.target.value)}
                  placeholder={t('miembros_nombre_completo_placeholder')} className={inputCls} />
              </div>
            </div>
          )}

          <p className="text-xs text-mist">{t('miembros_familia_compartida_desc')}</p>
        </div>
      )}

      {/* Consentimiento RGPD */}
      <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
        <p className="text-xs font-semibold text-fog uppercase tracking-wide">{t('miembros_proteccion_datos')}</p>
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
            {t('miembros_consentimiento_pre')}{' '}
            <a href="/privacidad" target="_blank" className="text-iris underline hover:text-iris/80">{t('miembros_politica_privacidad')}</a>
            {t('miembros_consentimiento_post')}
          </p>
        </label>
        {!consentAccepted && (
          <p className="text-xs text-amber flex items-center gap-1">
            <AlertTriangle size={11} /> {t('miembros_consentimiento_obligatorio')}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-rose text-center">{error}</p>}

      <button type="submit" disabled={saving || !firstName.trim() || !consentAccepted}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-lime bg-lime/10 py-3.5 font-semibold text-lime transition hover:bg-lime/20 active:scale-[0.99] disabled:opacity-60"
        style={{ boxShadow: 'var(--shadow-lime)' }}>
        <Save size={17} strokeWidth={2.2} />
        {saving ? t('miembros_guardando') : resolvedSubmitLabel}
      </button>
    </form>
  )
}
