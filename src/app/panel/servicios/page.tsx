'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart2, Tag, Plus, Pencil, Trash2, X, Check, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Service = {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  price_unit: string
  duration_min: number | null
  active: boolean
  sort_order: number | null
}

type FormData = {
  name: string
  description: string
  category: string
  price: string
  price_unit: string
  duration_min: string
}

const CATEGORIES = [
  { value: 'entrada', label: 'Entrada', color: 'text-lime', bg: 'bg-lime/10', border: 'border-lime/30' },
  { value: 'bono', label: 'Bono', color: 'text-iris', bg: 'bg-iris/10', border: 'border-iris/30' },
  { value: 'sala', label: 'Sala privada', color: 'text-amber', bg: 'bg-amber/10', border: 'border-amber/30' },
  { value: 'custodia', label: 'Custodia', color: 'text-mint', bg: 'bg-mint/10', border: 'border-mint/30' },
  { value: 'general', label: 'General', color: 'text-fog', bg: 'bg-fog/10', border: 'border-fog/30' },
]

const PRICE_UNITS = ['hora', 'sesión', 'bono', 'mes', 'día']

const INPUT_CLASS = 'w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'

function getCat(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[4]
}

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  category: 'general',
  price: '',
  price_unit: 'sesión',
  duration_min: '',
}

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name')
    setServices(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditTarget(null)
    setModal('add')
  }

  function openEdit(s: Service) {
    setForm({
      name: s.name,
      description: s.description ?? '',
      category: s.category,
      price: String(s.price),
      price_unit: s.price_unit,
      duration_min: s.duration_min != null ? String(s.duration_min) : '',
    })
    setEditTarget(s)
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditTarget(null)
    setForm(EMPTY_FORM)
  }

  async function saveForm() {
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      price: parseFloat(form.price),
      price_unit: form.price_unit,
      duration_min: form.duration_min ? parseInt(form.duration_min) : null,
    }
    if (modal === 'add') {
      await supabase.from('services').insert({ ...payload, active: true })
    } else if (editTarget) {
      await supabase.from('services').update(payload).eq('id', editTarget.id)
    }
    setSaving(false)
    closeModal()
    load()
  }

  async function toggleActive(s: Service) {
    await supabase.from('services').update({ active: !s.active }).eq('id', s.id)
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, active: !x.active } : x))
  }

  async function deleteService(id: string) {
    await supabase.from('services').delete().eq('id', id)
    setDeleteId(null)
    setServices(prev => prev.filter(x => x.id !== id))
  }

  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    items: services.filter(s => s.category === cat.value),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-snow">Panel</h1>
        <p className="text-fog mt-1 text-sm">Gestión de servicios</p>
      </div>

      {/* Tab nav */}
      <div className="inline-flex gap-1 bg-surface rounded-xl p-1 border border-line">
        <Link href="/panel" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <BarChart2 size={13} /> Resumen
        </Link>
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-surface2 text-snow">
          <Tag size={13} /> Servicios
        </div>
        <Link href="/panel/perfil" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <Building2 size={13} /> Perfil
        </Link>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-fog">{services.length} servicios configurados</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-lime text-carbon text-xs font-semibold px-4 py-2 rounded-xl hover:bg-lime/90 transition-colors"
        >
          <Plus size={13} /> Nuevo servicio
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-mist text-sm">Cargando...</div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 text-mist text-sm">No hay servicios. Crea el primero.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(cat => (
            <div key={cat.value}>
              <div className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cat.color} ${cat.bg} px-3 py-1 rounded-full mb-3`}>
                {cat.label}
              </div>
              <div className="space-y-2">
                {cat.items.map(s => (
                  <div key={s.id} className={`flex items-center gap-3 rounded-2xl border ${s.active ? 'border-line bg-surface' : 'border-line/50 bg-surface/50'} px-4 py-3`}>
                    {/* Toggle */}
                    <button
                      onClick={() => toggleActive(s)}
                      className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${s.active ? 'bg-lime' : 'bg-line'}`}
                      title={s.active ? 'Desactivar' : 'Activar'}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${s.active ? 'translate-x-4' : ''}`} />
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${s.active ? 'text-snow' : 'text-fog'}`}>{s.name}</p>
                      {s.description && <p className="text-xs text-mist truncate">{s.description}</p>}
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-snow">{s.price}€</p>
                      <p className="text-xs text-mist">/ {s.price_unit}</p>
                    </div>

                    {/* Duration */}
                    {s.duration_min != null && (
                      <div className="text-xs text-fog shrink-0">{s.duration_min} min</div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded-lg text-fog hover:text-snow hover:bg-line transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteId(s.id)}
                        className="p-1.5 rounded-lg text-fog hover:text-rose hover:bg-rose/10 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-line rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-snow">
                {modal === 'add' ? 'Nuevo servicio' : 'Editar servicio'}
              </h2>
              <button onClick={closeModal} className="text-fog hover:text-snow transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Nombre *</label>
                <input
                  className={INPUT_CLASS}
                  placeholder="Ej. Entrada diaria"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Descripción (opcional)</label>
                <input
                  className={INPUT_CLASS}
                  placeholder="Breve descripción"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Categoría</label>
                <select
                  className={INPUT_CLASS}
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Precio + Unidad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5">Precio (€) *</label>
                  <input
                    className={INPUT_CLASS}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5">Unidad de precio</label>
                  <select
                    className={INPUT_CLASS}
                    value={form.price_unit}
                    onChange={e => setForm(f => ({ ...f, price_unit: e.target.value }))}
                  >
                    {PRICE_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duración */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Duración en minutos (opcional)</label>
                <input
                  className={INPUT_CLASS}
                  type="number"
                  min="0"
                  placeholder="Ej. 60"
                  value={form.duration_min}
                  onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-fog hover:text-snow transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveForm}
                disabled={saving || !form.name.trim() || !form.price}
                className="flex-1 py-2.5 rounded-xl bg-lime text-carbon text-sm font-semibold hover:bg-lime/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-snow mb-2">¿Eliminar servicio?</h2>
            <p className="text-sm text-fog mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-fog hover:text-snow transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteService(deleteId)}
                className="flex-1 py-2.5 rounded-xl bg-rose text-white text-sm font-semibold hover:bg-rose/90 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
