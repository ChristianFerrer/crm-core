'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart2, Tag, Plus, Pencil, Trash2, X, Check, Building2, ShoppingBag, FolderPlus } from 'lucide-react'
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
  deposit_pct: number | null
  price_per_guest_adult: number | null
  price_per_guest_child: number | null
  included_guests: number | null
  applies_to: string[] | null
  reservable: boolean | null
}

// Tipos de reserva a los que puede asociarse un sub-servicio
const RESERVABLE_TYPES = [
  { value: 'cumpleanos', label: 'Cumpleaños' },
  { value: 'custodia',   label: 'Custodia' },
  { value: 'otros',      label: 'Otros' },
]

type Category = {
  value: string
  label: string
  color: string
  bg: string
  border: string
}

type FormData = {
  name: string
  description: string
  category: string
  price: string
  price_unit: string
  duration_min: string
  deposit_pct: string
  price_per_guest_adult: string
  price_per_guest_child: string
  included_guests: string
  applies_to: string[]
  reservable: boolean
}

const DEFAULT_CATEGORIES: Category[] = [
  { value: 'entrada',   label: 'Entrada',      color: 'text-lime',      bg: 'bg-lime/10',      border: 'border-lime/30' },
  { value: 'bono',      label: 'Bono',         color: 'text-iris',      bg: 'bg-iris/10',      border: 'border-iris/30' },
  { value: 'cumpleanos',label: 'Cumpleaños',   color: 'text-cyan-300',  bg: 'bg-cyan-300/10',  border: 'border-cyan-300/30' },
  { value: 'sala',      label: 'Sala privada', color: 'text-amber',     bg: 'bg-amber/10',     border: 'border-amber/30' },
  { value: 'custodia',    label: 'Custodia',     color: 'text-mint',      bg: 'bg-mint/10',      border: 'border-mint/30' },
  { value: 'otros',       label: 'Otros',        color: 'text-lime',      bg: 'bg-lime/10',      border: 'border-lime/30' },
  { value: 'subservicios',label: 'Sub-servicios',color: 'text-rose',      bg: 'bg-rose/10',      border: 'border-rose/30' },
  { value: 'general',     label: 'General',      color: 'text-fog',       bg: 'bg-fog/10',       border: 'border-fog/30' },
]

const CAT_COLORS = [
  { color: 'text-lime',     bg: 'bg-lime/10',     border: 'border-lime/30' },
  { color: 'text-iris',     bg: 'bg-iris/10',     border: 'border-iris/30' },
  { color: 'text-amber',    bg: 'bg-amber/10',    border: 'border-amber/30' },
  { color: 'text-mint',     bg: 'bg-mint/10',     border: 'border-mint/30' },
  { color: 'text-cyan-300', bg: 'bg-cyan-300/10', border: 'border-cyan-300/30' },
  { color: 'text-rose',     bg: 'bg-rose/10',     border: 'border-rose/30' },
  { color: 'text-fog',      bg: 'bg-fog/10',      border: 'border-fog/30' },
]

const PRICE_UNITS = ['hora', 'sesión', 'bono', 'mes', 'día']
const INPUT_CLASS = 'w-full bg-surface2 border border-line rounded-xl px-4 py-2 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'

const EMPTY_FORM: FormData = { name: '', description: '', category: 'general', price: '', price_unit: 'sesión', duration_min: '', deposit_pct: '50', price_per_guest_adult: '', price_per_guest_child: '', included_guests: '', applies_to: [], reservable: false }

// Categorías que corresponden a paquetes reservables (muestran config de pagos)
const BOOKING_CATEGORIES = ['cumpleanos', 'sala', 'custodia']

const STORAGE_KEY = 'wm_service_categories'
const STORAGE_KEY_DELETED = 'wm_service_categories_deleted'

function loadDeletedDefaults(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveDeletedDefaults(values: string[]) {
  localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(values))
}

function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored: Category[] = JSON.parse(raw)
      const values = new Set(stored.map(c => c.value))
      const deleted = new Set(loadDeletedDefaults())
      // Fusiona categorías por defecto que falten y que no hayan sido eliminadas por el usuario
      const missing = DEFAULT_CATEGORIES.filter(c => !values.has(c.value) && !deleted.has(c.value))
      return missing.length > 0 ? [...stored, ...missing] : stored
    }
  } catch {}
  return DEFAULT_CATEGORIES
}

function saveCategories(cats: Category[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cats))
}

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Category management
  const [showCatModal, setShowCatModal] = useState(false)
  const [catForm, setCatForm] = useState({ label: '', value: '' })
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [deleteCat, setDeleteCat] = useState<string | null>(null)

  useEffect(() => {
    setCategories(loadCategories())
  }, [])

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

  function getCat(value: string): Category {
    return categories.find(c => c.value === value) ?? categories[categories.length - 1] ?? DEFAULT_CATEGORIES[4]
  }

  function openAdd() { setForm(EMPTY_FORM); setEditTarget(null); setModal('add') }
  function openEdit(s: Service) {
    setForm({
      name: s.name, description: s.description ?? '', category: s.category, price: String(s.price),
      price_unit: s.price_unit, duration_min: s.duration_min != null ? String(s.duration_min) : '',
      deposit_pct: s.deposit_pct != null ? String(s.deposit_pct) : '50',
      price_per_guest_adult: s.price_per_guest_adult ? String(s.price_per_guest_adult) : '',
      price_per_guest_child: s.price_per_guest_child ? String(s.price_per_guest_child) : '',
      included_guests: s.included_guests ? String(s.included_guests) : '',
      applies_to: s.applies_to ?? [],
      reservable: s.reservable ?? false,
    })
    setEditTarget(s); setModal('edit')
  }
  function closeModal() { setModal(null); setEditTarget(null); setForm(EMPTY_FORM) }

  async function saveForm() {
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    const payload = {
      name: form.name.trim(), description: form.description.trim() || null,
      category: form.category, price: parseFloat(form.price),
      price_unit: form.price_unit, duration_min: form.duration_min ? parseInt(form.duration_min) : null,
      deposit_pct: form.deposit_pct ? parseFloat(form.deposit_pct) : null,
      price_per_guest_adult: form.price_per_guest_adult ? parseFloat(form.price_per_guest_adult) : 0,
      price_per_guest_child: form.price_per_guest_child ? parseFloat(form.price_per_guest_child) : 0,
      included_guests: form.included_guests ? parseInt(form.included_guests) : 0,
      applies_to: form.category === 'subservicios' ? form.applies_to : [],
      reservable: form.reservable,
    }
    if (modal === 'add') await supabase.from('services').insert({ ...payload, active: true })
    else if (editTarget) await supabase.from('services').update(payload).eq('id', editTarget.id)
    setSaving(false); closeModal(); load()
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

  // Category CRUD
  function openNewCat() { setCatForm({ label: '', value: '' }); setEditCat(null); setShowCatModal(true) }
  function openEditCat(c: Category) { setCatForm({ label: c.label, value: c.value }); setEditCat(c); setShowCatModal(true) }

  async function saveCat() {
    if (!catForm.label.trim()) return
    // Al editar, si no se indica identificador, se mantiene el valor original (no se regenera desde el nombre)
    const slug = editCat
      ? (catForm.value.trim() || editCat.value)
      : (catForm.value.trim() || catForm.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))
    const colorIdx = categories.length % CAT_COLORS.length
    if (editCat) {
      const updated = categories.map(c => c.value === editCat.value
        ? { ...c, label: catForm.label.trim(), value: slug }
        : c)
      setCategories(updated); saveCategories(updated)
      // Si el identificador cambió, los servicios siguen a la categoría (no quedan huérfanos)
      if (slug !== editCat.value) {
        await supabase.from('services').update({ category: slug }).eq('category', editCat.value)
        setServices(prev => prev.map(s => s.category === editCat.value ? { ...s, category: slug } : s))
      }
    } else {
      const newCat: Category = { value: slug, label: catForm.label.trim(), ...CAT_COLORS[colorIdx] }
      const updated = [...categories, newCat]
      setCategories(updated); saveCategories(updated)
      // Si se recrea una categoría por defecto antes eliminada, quítala de la lista de eliminadas
      const deleted = loadDeletedDefaults()
      if (deleted.includes(slug)) saveDeletedDefaults(deleted.filter(v => v !== slug))
    }
    setShowCatModal(false)
  }

  async function reassignService(id: string, category: string) {
    if (!category) return
    await supabase.from('services').update({ category }).eq('id', id)
    setServices(prev => prev.map(s => s.id === id ? { ...s, category } : s))
  }

  function confirmDeleteCat(value: string) { setDeleteCat(value) }
  function doDeleteCat() {
    if (!deleteCat) return
    const updated = categories.filter(c => c.value !== deleteCat)
    setCategories(updated); saveCategories(updated)
    // Si es una categoría por defecto, recuérdalo para que no reaparezca al recargar
    if (DEFAULT_CATEGORIES.some(c => c.value === deleteCat)) {
      const deleted = Array.from(new Set([...loadDeletedDefaults(), deleteCat]))
      saveDeletedDefaults(deleted)
    }
    setDeleteCat(null)
  }

  const grouped = categories.map(cat => ({
    ...cat,
    items: services.filter(s => s.category === cat.value),
  })).filter(g => g.items.length > 0)

  // Uncategorized services (category not in list)
  const knownValues = new Set(categories.map(c => c.value))
  const uncategorized = services.filter(s => !knownValues.has(s.category))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-snow">Panel</h1>
        <p className="text-fog mt-1 text-sm">Gestión de servicios</p>
      </div>

      {/* Tab nav */}
      <div className="flex lg:inline-flex gap-1 bg-surface rounded-xl p-1 border border-line overflow-x-auto">
        <Link href="/panel" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <BarChart2 size={13} /> Resumen
        </Link>
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-lime text-ink">
          <Tag size={13} /> Servicios
        </div>
        <Link href="/panel/tienda" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <ShoppingBag size={13} /> Tienda
        </Link>
        <Link href="/panel/perfil" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <Building2 size={13} /> Perfil
        </Link>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-fog">{services.length} servicios · {categories.length} categorías</p>
        <div className="flex items-center gap-2">
          <button
            onClick={openNewCat}
            className="flex items-center gap-1.5 border border-line bg-surface text-fog text-xs font-semibold px-3 py-2 rounded-xl hover:text-snow hover:border-line2 transition-colors"
          >
            <FolderPlus size={13} /> Categoría
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-lime text-carbon text-xs font-semibold px-4 py-2 rounded-xl hover:bg-lime/90 transition-colors"
          >
            <Plus size={13} /> Nuevo servicio
          </button>
        </div>
      </div>

      {/* Categories management strip */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-fog uppercase tracking-wide">Categorías</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <div key={cat.value} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${cat.bg} ${cat.border}`}>
              <span className={`text-xs font-semibold ${cat.color}`}>{cat.label}</span>
              <span className="text-xs text-fog/60">({services.filter(s => s.category === cat.value).length})</span>
              <button onClick={() => openEditCat(cat)} className={`${cat.color} opacity-60 hover:opacity-100 transition-opacity ml-0.5`}>
                <Pencil size={10} />
              </button>
              <button onClick={() => confirmDeleteCat(cat.value)} className="text-rose/50 hover:text-rose transition-colors">
                <X size={10} />
              </button>
            </div>
          ))}
          <button
            onClick={openNewCat}
            className="flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors"
          >
            <Plus size={11} /> Nueva
          </button>
        </div>
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
                    <button
                      onClick={() => toggleActive(s)}
                      className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${s.active ? 'bg-lime' : 'bg-line'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${s.active ? 'translate-x-4' : ''}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${s.active ? 'text-snow' : 'text-fog'}`}>{s.name}</p>
                      {s.description && <p className="text-xs text-mist truncate">{s.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-snow">{s.price}€</p>
                      <p className="text-xs text-mist">/ {s.price_unit}</p>
                    </div>
                    {s.duration_min != null && (
                      <div className="text-xs text-fog shrink-0">{s.duration_min} min</div>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-fog hover:text-snow hover:bg-line transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg text-fog hover:text-rose hover:bg-rose/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-fog bg-fog/10 px-3 py-1 rounded-full mb-3">Sin categoría</div>
              <div className="space-y-2">
                {uncategorized.map(s => (
                  <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-snow truncate">{s.name}</p>
                    </div>
                    <p className="text-sm font-semibold text-snow shrink-0">{s.price}€</p>
                    {/* Reasignar a una categoría disponible */}
                    <div className="relative shrink-0">
                      <select
                        value=""
                        onChange={e => reassignService(s.id, e.target.value)}
                        className="appearance-none bg-surface2 border border-line rounded-lg pl-2.5 pr-7 py-1.5 text-xs text-fog outline-none focus:border-line2 cursor-pointer hover:text-snow transition-colors"
                      >
                        <option value="">Asignar a…</option>
                        {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <FolderPlus size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-fog pointer-events-none" />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-fog hover:text-snow hover:bg-line transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg text-fog hover:text-rose hover:bg-rose/10 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Service Modal */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-line rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-snow">{modal === 'add' ? 'Nuevo servicio' : 'Editar servicio'}</h2>
              <button onClick={closeModal} className="text-fog hover:text-snow transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Nombre *</label>
                <input className={INPUT_CLASS} placeholder="Ej. Entrada diaria" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Descripción (opcional)</label>
                <input className={INPUT_CLASS} placeholder="Breve descripción" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Categoría</label>
                <select className={INPUT_CLASS} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Reservable: aparece como tipo en el flujo de crear reserva */}
              {form.category !== 'subservicios' && (
                <button type="button" onClick={() => setForm(f => ({ ...f, reservable: !f.reservable }))}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-line bg-surface2/40 text-left">
                  <div className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${form.reservable ? 'bg-lime' : 'bg-line'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.reservable ? 'translate-x-4' : ''}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-snow">Reservable</p>
                    <p className="text-[11px] text-mist">Aparece como tipo al crear una reserva</p>
                  </div>
                </button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5">Precio (€) *</label>
                  <input className={INPUT_CLASS} type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5">Unidad de precio</label>
                  <select className={INPUT_CLASS} value={form.price_unit} onChange={e => setForm(f => ({ ...f, price_unit: e.target.value }))}>
                    {PRICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Duración en minutos (opcional)</label>
                <input className={INPUT_CLASS} type="number" min="0" placeholder="Ej. 60" value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} />
              </div>

              {/* Config de reservas — solo para paquetes reservables */}
              {BOOKING_CATEGORIES.includes(form.category) && (
                <div className="rounded-xl border border-line bg-surface2/40 p-4 space-y-3">
                  <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Configuración de reservas</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5">Adelanto sugerido (%)</label>
                      <input className={INPUT_CLASS} type="number" min="0" max="100" step="1" placeholder="50"
                        value={form.deposit_pct} onChange={e => setForm(f => ({ ...f, deposit_pct: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5">Personas incluidas</label>
                      <input className={INPUT_CLASS} type="number" min="0" step="1" placeholder="0"
                        value={form.included_guests} onChange={e => setForm(f => ({ ...f, included_guests: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5">Adulto extra (€)</label>
                      <input className={INPUT_CLASS} type="number" min="0" step="0.01" placeholder="Entrada libre"
                        value={form.price_per_guest_adult} onChange={e => setForm(f => ({ ...f, price_per_guest_adult: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5">Niño extra (€)</label>
                      <input className={INPUT_CLASS} type="number" min="0" step="0.01" placeholder="Entrada libre"
                        value={form.price_per_guest_child} onChange={e => setForm(f => ({ ...f, price_per_guest_child: e.target.value }))} />
                    </div>
                  </div>
                  <p className="text-[11px] text-mist leading-relaxed">
                    El precio cubre las <span className="text-fog font-medium">personas incluidas</span> (niños + adultos). Solo se cobran los invitados que excedan ese número. Si dejas en blanco el precio por invitado extra, se usa la tarifa de <span className="text-fog font-medium">entrada libre</span>.
                  </p>
                </div>
              )}

              {/* Sub-servicio: a qué tipos de reserva puede agregarse */}
              {form.category === 'subservicios' && (
                <div className="rounded-xl border border-line bg-surface2/40 p-4 space-y-2.5">
                  <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">Se puede agregar a</p>
                  <div className="space-y-1.5">
                    {RESERVABLE_TYPES.map(t => {
                      const sel = form.applies_to.includes(t.value)
                      return (
                        <button key={t.value} type="button"
                          onClick={() => setForm(f => ({ ...f, applies_to: sel ? f.applies_to.filter(v => v !== t.value) : [...f.applies_to, t.value] }))}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${sel ? 'border-iris/30 bg-iris/5' : 'border-line bg-surface2 hover:border-line2'}`}>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${sel ? 'bg-iris border-iris' : 'bg-surface2 border-line2'}`}>
                            {sel && <Check size={11} className="text-white" strokeWidth={3} />}
                          </div>
                          <span className={`text-sm font-medium ${sel ? 'text-snow' : 'text-fog'}`}>{t.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-mist">Si no marcas ninguno, el sub-servicio estará disponible en todas las reservas.</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-fog hover:text-snow transition-colors">Cancelar</button>
              <button onClick={saveForm} disabled={saving || !form.name.trim() || !form.price} className="flex-1 py-2.5 rounded-xl bg-lime text-carbon text-sm font-semibold hover:bg-lime/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                <Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Add/Edit Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-snow">{editCat ? 'Editar categoría' : 'Nueva categoría'}</h2>
              <button onClick={() => setShowCatModal(false)} className="text-fog hover:text-snow transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Nombre de la categoría *</label>
                <input
                  className={INPUT_CLASS}
                  placeholder="Ej. Taller, Evento especial..."
                  value={catForm.label}
                  onChange={e => setCatForm(f => ({ ...f, label: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">Identificador (opcional)</label>
                <input
                  className={INPUT_CLASS}
                  placeholder="Se genera automáticamente"
                  value={catForm.value}
                  onChange={e => setCatForm(f => ({ ...f, value: e.target.value }))}
                />
                <p className="text-xs text-mist mt-1">Solo letras minúsculas y guión bajo. Déjalo vacío para generarlo automáticamente.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowCatModal(false)} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-fog hover:text-snow transition-colors">Cancelar</button>
              <button onClick={saveCat} disabled={!catForm.label.trim()} className="flex-1 py-2.5 rounded-xl bg-lime text-carbon text-sm font-semibold hover:bg-lime/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Check size={14} /> {editCat ? 'Guardar' : 'Crear categoría'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete category confirmation */}
      {deleteCat && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-snow mb-2">¿Eliminar categoría?</h2>
            <p className="text-sm text-fog mb-1">Los servicios con esta categoría quedarán sin categorizar.</p>
            <p className="text-sm text-fog mb-6">Esta acción no elimina los servicios.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteCat(null)} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-fog hover:text-snow transition-colors">Cancelar</button>
              <button onClick={doDeleteCat} className="flex-1 py-2.5 rounded-xl bg-rose text-white text-sm font-semibold hover:bg-rose/90 transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete service confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-snow mb-2">¿Eliminar servicio?</h2>
            <p className="text-sm text-fog mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-fog hover:text-snow transition-colors">Cancelar</button>
              <button onClick={() => deleteService(deleteId)} className="flex-1 py-2.5 rounded-xl bg-rose text-white text-sm font-semibold hover:bg-rose/90 transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
