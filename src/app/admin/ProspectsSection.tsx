'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Plus, X, Phone, Mail, MapPin, Calendar, Trash2, Check } from 'lucide-react'

type Stage = 'nuevo' | 'demo_agendada' | 'demo_realizada' | 'propuesta' | 'cliente' | 'descartado'

type Prospect = {
  id: string
  created_at: string
  business_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  source: string | null
  stage: Stage
  next_action: string | null
  next_action_at: string | null
  notes: string | null
  converted_tenant_id: string | null
  discard_reason: string | null
}

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: 'nuevo', label: 'Nuevo contacto', color: 'text-fog' },
  { id: 'demo_agendada', label: 'Demo agendada', color: 'text-amber' },
  { id: 'demo_realizada', label: 'Demo realizada', color: 'text-iris' },
  { id: 'propuesta', label: 'Propuesta enviada', color: 'text-mint' },
  { id: 'cliente', label: 'Cliente', color: 'text-lime' },
  { id: 'descartado', label: 'Descartado', color: 'text-rose' },
]

const SOURCES = ['Referido', 'Redes sociales', 'Google', 'Evento', 'Otro']

const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-2.5 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'
const labelCls = 'block text-xs font-semibold text-fog uppercase tracking-wide mb-1.5'

const EMPTY_FORM = {
  business_name: '', contact_name: '', email: '', phone: '', city: '',
  source: 'Referido', next_action: '', next_action_at: '', notes: '',
}

export function ProspectsSection() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Prospect | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [convertModal, setConvertModal] = useState<Prospect | null>(null)
  const [discardModal, setDiscardModal] = useState<Prospect | null>(null)
  const [discardReason, setDiscardReason] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('prospects').select('*').order('created_at', { ascending: false })
    setProspects((data as Prospect[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(p: Prospect) {
    setEditing(p)
    setForm({
      business_name: p.business_name, contact_name: p.contact_name ?? '', email: p.email ?? '',
      phone: p.phone ?? '', city: p.city ?? '', source: p.source ?? 'Referido',
      next_action: p.next_action ?? '', next_action_at: p.next_action_at ?? '', notes: p.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.business_name.trim()) { toast.error('El nombre del negocio es obligatorio'); return }
    setSaving(true)
    const payload = {
      business_name: form.business_name.trim(),
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      city: form.city || null,
      source: form.source || null,
      next_action: form.next_action || null,
      next_action_at: form.next_action_at || null,
      notes: form.notes || null,
    }
    if (editing) {
      await supabase.from('prospects').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
    } else {
      await supabase.from('prospects').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    toast.success(editing ? 'Prospecto actualizado' : 'Prospecto añadido')
    load()
  }

  async function moveStage(p: Prospect, stage: Stage) {
    if (stage === 'cliente') { setConvertModal(p); return }
    if (stage === 'descartado') { setDiscardModal(p); setDiscardReason(''); return }
    await supabase.from('prospects').update({ stage, updated_at: new Date().toISOString() }).eq('id', p.id)
    load()
  }

  async function handleConvert() {
    if (!convertModal) return
    const slug = convertModal.business_name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const { data: tenant, error } = await supabase.from('tenants').insert({
      name: convertModal.business_name,
      slug,
      owner_email: convertModal.email,
      phone: convertModal.phone,
      city: convertModal.city,
      plan: 'trial',
      status: 'trial',
      trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    }).select('id').single()

    if (error) { toast.error('Error al crear el establecimiento: ' + error.message); return }

    await supabase.from('prospects').update({
      stage: 'cliente',
      converted_tenant_id: tenant?.id,
      updated_at: new Date().toISOString(),
    }).eq('id', convertModal.id)

    toast.success('Prospecto convertido en establecimiento')
    setConvertModal(null)
    load()
  }

  async function handleDiscard() {
    if (!discardModal) return
    await supabase.from('prospects').update({
      stage: 'descartado', discard_reason: discardReason || null, updated_at: new Date().toISOString(),
    }).eq('id', discardModal.id)
    setDiscardModal(null)
    load()
  }

  async function handleDelete(p: Prospect) {
    if (!confirm(`¿Eliminar el prospecto "${p.business_name}"?`)) return
    await supabase.from('prospects').delete().eq('id', p.id)
    load()
  }

  const byStage = (stage: Stage) => prospects.filter(p => p.stage === stage)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-semibold text-snow">Prospectos</h2>
          <p className="text-sm text-fog mt-0.5">Seguimiento comercial de nuevos clientes potenciales</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 text-xs font-semibold text-lime border border-lime bg-lime/10 rounded-lg px-3 py-2 hover:bg-lime/20 transition-colors shrink-0"
        >
          <Plus size={14} /> Nuevo prospecto
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">{[1, 2, 3].map(i => <div key={i} className="h-64 rounded-2xl bg-surface border border-line animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-x-auto">
          {STAGES.map(stage => (
            <div key={stage.id} className="rounded-2xl border border-line bg-surface flex flex-col min-h-[120px]">
              <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wide ${stage.color}`}>{stage.label}</span>
                <span className="text-[10px] font-bold text-mist bg-surface2 rounded-full px-2 py-0.5">{byStage(stage.id).length}</span>
              </div>
              <div className="p-2.5 space-y-2 flex-1">
                {byStage(stage.id).length === 0 && (
                  <p className="text-[11px] text-mist text-center py-4">Sin prospectos</p>
                )}
                {byStage(stage.id).map(p => (
                  <div key={p.id} className="rounded-xl border border-line bg-surface2 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => openEdit(p)} className="text-left flex-1 min-w-0">
                        <p className="text-sm font-semibold text-snow truncate">{p.business_name}</p>
                        {p.contact_name && <p className="text-[11px] text-mist truncate">{p.contact_name}</p>}
                      </button>
                      <button onClick={() => handleDelete(p)} className="text-mist hover:text-rose transition-colors shrink-0"><Trash2 size={12} /></button>
                    </div>
                    <div className="space-y-1">
                      {p.phone && <p className="text-[11px] text-fog flex items-center gap-1.5"><Phone size={10} className="shrink-0" />{p.phone}</p>}
                      {p.email && <p className="text-[11px] text-fog flex items-center gap-1.5 truncate"><Mail size={10} className="shrink-0" />{p.email}</p>}
                      {p.city && <p className="text-[11px] text-fog flex items-center gap-1.5"><MapPin size={10} className="shrink-0" />{p.city}</p>}
                      {p.next_action && (
                        <p className="text-[11px] text-amber flex items-center gap-1.5">
                          <Calendar size={10} className="shrink-0" />
                          {p.next_action}{p.next_action_at ? ` · ${new Date(p.next_action_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
                        </p>
                      )}
                    </div>
                    {stage.id !== 'cliente' && stage.id !== 'descartado' && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <select
                          value={stage.id}
                          onChange={e => moveStage(p, e.target.value as Stage)}
                          className="flex-1 bg-surface border border-line rounded-lg px-2 py-1.5 text-[11px] text-fog outline-none"
                        >
                          {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal alta/edición */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-line rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-snow">{editing ? 'Editar prospecto' : 'Nuevo prospecto'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-fog hover:text-snow"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Negocio *</label>
                <input className={inputCls} value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} placeholder="Ej. Ludoteca El Trencet" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Contacto</label>
                  <input className={inputCls} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Ciudad</label>
                  <input className={inputCls} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Teléfono</label>
                  <input className={inputCls} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Origen</label>
                <select className={inputCls} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Próxima acción</label>
                  <input className={inputCls} value={form.next_action} onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))} placeholder="Ej. Llamar" />
                </div>
                <div>
                  <label className={labelCls}>Fecha</label>
                  <input type="date" className={inputCls} value={form.next_action_at} onChange={e => setForm(f => ({ ...f, next_action_at: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notas</label>
                <textarea className={inputCls} rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-line text-fog text-sm font-semibold hover:text-snow transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-lime bg-lime/10 text-lime text-sm font-semibold hover:bg-lime/20 transition-colors disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convertir a cliente */}
      {convertModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-snow">¿Convertir en establecimiento?</h3>
            <p className="text-sm text-fog">Se creará un establecimiento en prueba (14 días) para <strong className="text-snow">{convertModal.business_name}</strong> con los datos de contacto ya cargados.</p>
            <div className="flex gap-3">
              <button onClick={() => setConvertModal(null)} className="flex-1 py-2.5 rounded-xl border border-line text-fog text-sm font-semibold hover:text-snow transition-colors">Cancelar</button>
              <button onClick={handleConvert} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-lime bg-lime/10 text-lime text-sm font-semibold hover:bg-lime/20 transition-colors">
                <Check size={14} /> Convertir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Descartar */}
      {discardModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-snow">Descartar prospecto</h3>
            <div>
              <label className={labelCls}>Motivo (opcional)</label>
              <textarea className={inputCls} rows={3} value={discardReason} onChange={e => setDiscardReason(e.target.value)} placeholder="Ej. No respondió, precio, etc." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDiscardModal(null)} className="flex-1 py-2.5 rounded-xl border border-line text-fog text-sm font-semibold hover:text-snow transition-colors">Cancelar</button>
              <button onClick={handleDiscard} className="flex-1 py-2.5 rounded-xl border border-rose bg-rose/10 text-rose text-sm font-semibold hover:bg-rose/20 transition-colors">Descartar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
