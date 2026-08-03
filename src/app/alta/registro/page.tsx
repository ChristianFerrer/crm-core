'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { Plus, Check, X } from 'lucide-react'
import { DatePickerModal } from '@/components/DatePickerModal'

type MembershipType = { id: string; name: string; sessions: number | null; price: number; validity_days: number }
type Child = { name: string; sex: 'M' | 'F' | ''; birth_date: string }

export default function RegistroPage() {
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [types, setTypes] = useState<MembershipType[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [children, setChildren] = useState<Child[]>([])
  const [consentAccepted, setConsentAccepted] = useState(false)

  // Result
  const [qrCode, setQrCode] = useState('')
  const [memberName, setMemberName] = useState('')
  const [tenantName, setTenantName] = useState('')

  useEffect(() => {
    // Alta pública vía RPC SECURITY DEFINER: el cliente anónimo no accede a las
    // tablas directamente (compatible con RLS). p_slug=null → tenant único.
    supabase.rpc('public_tenant_info', { p_slug: null }).then(({ data }) => {
      const info = data as { tenant?: { name?: string }; membershipTypes?: MembershipType[] } | null
      if (info?.tenant?.name) setTenantName(info.tenant.name)
      if (info?.membershipTypes) setTypes(info.membershipTypes)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || !consentAccepted) return
    setSaving(true)
    setError(null)

    try {
      const cleanChildren = children.filter(c => c.name.trim())
      const { data, error: rpcErr } = await supabase.rpc('public_register', {
        p_slug: null,
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_email: email.trim() || null,
        p_children: cleanChildren,
        p_membership_type_id: selectedType || null,
        p_consent: consentAccepted,
      })
      if (rpcErr) throw rpcErr
      const res = data as { qr_code?: string; memberName?: string; error?: string }
      if (res?.error) throw new Error(res.error)

      setQrCode(res.qr_code ?? '')
      setMemberName(res.memberName ?? name.trim().split(' ')[0])
      setStep('done')
    } catch (err: any) {
      setError(err.message ?? 'Error al registrarse. Inténtalo de nuevo.')
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-3.5 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-carbon flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center space-y-6">
          {/* Success icon */}
          <div className="mx-auto w-14 h-14 rounded-full bg-lime/20 flex items-center justify-center">
            <Check size={28} className="text-lime" strokeWidth={2.5} />
          </div>

          <div>
            <h1 className="font-display text-2xl font-semibold text-snow">¡Hola, {memberName}!</h1>
            <p className="text-fog text-sm mt-2 leading-relaxed">
              Ya eres miembro{tenantName ? ` de ${tenantName}` : ''}. Guarda este código — lo necesitarás cada vez que entres.
            </p>
          </div>

          {/* QR code */}
          <div className="rounded-2xl border border-line bg-surface p-6 space-y-4">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">Tu código de acceso</p>
            <div className="flex justify-center">
              <div className="rounded-2xl bg-white p-4 inline-block">
                <QRCodeSVG
                  value={qrCode}
                  size={200}
                  fgColor="#0e0f12"
                  bgColor="#ffffff"
                />
              </div>
            </div>
            <p className="text-xs text-mist leading-relaxed">
              Muéstralo al personal cuando llegues y ellos registrarán tu entrada.
            </p>
          </div>

          <div className="rounded-2xl border border-lime/20 bg-lime/5 px-4 py-3 text-xs text-fog leading-relaxed">
            💡 Haz una captura de pantalla para tenerlo siempre a mano.
          </div>
        </div>
      </div>
    )
  }

  const type = types.find(t => t.id === selectedType)

  return (
    <div className="min-h-screen bg-carbon px-5 py-10">
      <div className="max-w-sm mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-10 h-10 rounded-xl bg-lime flex items-center justify-center mx-auto mb-4" style={{ boxShadow: '0 10px 40px -12px rgba(198,242,78,0.5)' }}>
            <span className="text-ink font-bold text-lg">{(tenantName || 'G').charAt(0).toUpperCase()}</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-snow">Hazte miembro</h1>
          <p className="text-fog text-sm">{tenantName ? `${tenantName} · ` : ''}Alta de familia</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Datos del padre/madre */}
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">Padre / Madre · titular</p>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre y apellido"
              required
              className={inputCls}
            />
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Teléfono · te identificamos al entrar"
              required
              className={inputCls}
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email (opcional)"
              className={inputCls}
            />
          </div>

          {/* Niños */}
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-fog uppercase tracking-wide">Hijos</p>
                <p className="text-xs text-mist mt-0.5">Opcional</p>
              </div>
              <button type="button" onClick={() => setChildren(cs => [...cs, { name: '', sex: '', birth_date: '' }])}
                className="flex items-center gap-1 text-xs font-semibold text-lime hover:text-lime-deep transition-colors">
                <Plus size={13} /> Añadir hijo/a
              </button>
            </div>
            {children.length === 0 && <p className="text-xs text-mist">Añade los niños que vienen contigo.</p>}
            {children.map((c, i) => (
              <div key={i} className="border-t border-line pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-fog">Hijo/a {i + 1}</p>
                  <button type="button" onClick={() => setChildren(cs => cs.filter((_, idx) => idx !== i))} className="text-mist hover:text-rose transition-colors"><X size={14} /></button>
                </div>
                <input
                  value={c.name}
                  onChange={e => setChildren(cs => cs.map((ch, idx) => idx === i ? { ...ch, name: e.target.value } : ch))}
                  placeholder="Nombre"
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={c.sex}
                    onChange={e => setChildren(cs => cs.map((ch, idx) => idx === i ? { ...ch, sex: e.target.value as 'M' | 'F' | '' } : ch))}
                    className={inputCls}
                  >
                    <option value="">Sexo</option>
                    <option value="M">Niño</option>
                    <option value="F">Niña</option>
                  </select>
                  <DatePickerModal
                    value={c.birth_date}
                    onChange={v => setChildren(cs => cs.map((ch, idx) => idx === i ? { ...ch, birth_date: v } : ch))}
                    placeholder="Fecha de nacimiento"
                    className="py-2.5"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Membership type */}
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">Bono</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedType('')}
                className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${!selectedType ? 'border-lime/40 bg-lime/5 text-snow' : 'border-line text-mist hover:border-line2'}`}
              >
                Sin bono por ahora
              </button>
              {types.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedType(t.id)}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${selectedType === t.id ? 'border-lime/40 bg-lime/5' : 'border-line hover:border-line2'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${selectedType === t.id ? 'text-snow' : 'text-fog'}`}>{t.name}</span>
                    <span className="text-sm font-bold text-lime">{t.price}€</span>
                  </div>
                  <p className="text-xs text-mist mt-0.5">
                    {t.sessions != null ? `${t.sessions} sesiones` : 'Ilimitado'} · válido {t.validity_days} días
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Consentimiento RGPD (obligatorio) */}
          <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={e => setConsentAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-lime"
            />
            <span className="text-xs text-fog leading-relaxed">
              Doy mi consentimiento para el tratamiento de mis datos y los de mis hijos conforme a la{' '}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-lime underline">política de privacidad</a>. *
            </span>
          </label>

          {error && <p className="text-sm text-rose text-center">{error}</p>}

          <button
            type="submit"
            disabled={saving || !name.trim() || !phone.trim() || !consentAccepted}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-lime bg-lime/10 py-4 font-semibold text-lime text-sm disabled:opacity-50 hover:bg-lime/20 transition-colors active:scale-[0.99]"
            style={{ boxShadow: '0 10px 40px -12px rgba(198,242,78,0.4)' }}
          >
            {saving ? 'Registrando...' : 'Completar registro'}
          </button>

          {type && (
            <p className="text-[11px] text-mist text-center">
              El bono <span className="text-fog font-medium">{type.name}</span> ({type.price}€) se abona en recepción.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
