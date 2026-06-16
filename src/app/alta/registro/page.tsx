'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { Plus, Minus, Check } from 'lucide-react'

type MembershipType = { id: string; name: string; sessions: number | null; price: number; validity_days: number }

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
  const [childrenCount, setChildrenCount] = useState(0)

  // Result
  const [qrCode, setQrCode] = useState('')
  const [memberName, setMemberName] = useState('')

  useEffect(() => {
    supabase.from('membership_types').select('*').order('price')
      .then(({ data }) => setTypes((data as MembershipType[]) ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setSaving(true)
    setError(null)

    try {
      // Create family
      const { data: family, error: fe } = await supabase
        .from('families')
        .insert({ name: `Familia ${name.trim().split(' ')[0]}` })
        .select('id')
        .single()
      if (fe) throw fe

      const { data: member, error: me } = await supabase
        .from('members')
        .insert({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          family_id: family.id,
          children_count: childrenCount,
        })
        .select('id, qr_code')
        .single()
      if (me) throw me

      // Assign membership if selected
      if (selectedType) {
        const type = types.find(t => t.id === selectedType)
        if (type) {
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + type.validity_days)
          await supabase.from('memberships').insert({
            member_id: member.id,
            membership_type_id: type.id,
            sessions_remaining: type.sessions,
            expires_at: expiresAt.toISOString().split('T')[0],
          })
        }
      }

      setQrCode(member.qr_code)
      setMemberName(name.trim().split(' ')[0])
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
              Ya eres socio de El Bosc Màgic. Guarda este código — lo necesitarás cada vez que entres.
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
            <span className="text-ink font-bold text-lg">B</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-snow">Hazte socio</h1>
          <p className="text-fog text-sm">El Bosc Màgic · Alta de familia</p>
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
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-fog uppercase tracking-wide">Número de hijos</p>
                <p className="text-xs text-mist mt-0.5">Opcional</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setChildrenCount(c => Math.max(0, c - 1))}
                  className="w-8 h-8 rounded-lg border border-line bg-surface2 flex items-center justify-center hover:border-line2 transition-colors">
                  <Minus size={14} className="text-fog" />
                </button>
                <span className="font-display text-2xl font-semibold text-snow w-6 text-center">{childrenCount}</span>
                <button type="button" onClick={() => setChildrenCount(c => c + 1)}
                  className="w-8 h-8 rounded-lg border border-line bg-surface2 flex items-center justify-center hover:border-line2 transition-colors">
                  <Plus size={14} className="text-fog" />
                </button>
              </div>
            </div>
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

          {error && <p className="text-sm text-rose text-center">{error}</p>}

          <button
            type="submit"
            disabled={saving || !name.trim() || !phone.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-4 font-semibold text-ink text-sm disabled:opacity-50 hover:bg-lime-deep transition-colors active:scale-[0.99]"
            style={{ boxShadow: '0 10px 40px -12px rgba(198,242,78,0.4)' }}
          >
            {saving ? 'Registrando...' : type ? `Unirme — ${type.price}€` : 'Registrarme gratis'}
          </button>

          <p className="text-[11px] text-mist text-center">
            Demo · no se realiza ningún cobro real
          </p>
        </form>
      </div>
    </div>
  )
}
