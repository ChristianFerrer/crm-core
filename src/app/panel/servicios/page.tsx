'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart2, Tag, Plus, Pencil, Trash2, X, Check, Building2, ShoppingBag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PanelNav } from '@/components/PanelNav'
import { TableFilterBar } from '@/components/TableFilterBar'
import { useLanguage } from '@/lib/i18n'

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
  tipo: string | null
  flujo: string | null
}

type MembershipType = { id: string; name: string; sessions: number | null; price: number | null; validity_days: number | null; active: boolean | null }

// Tipo de servicio — define el comportamiento y los campos que se muestran.
// El BONO se crea en el mismo asistente pero se guarda en membership_types (fuente única para venta y check-in).
const TIPOS = [
  { value: 'entrada',     labelKey: 'panelcfg_tipo_entrada',     descKey: 'panelcfg_tipo_entrada_desc' },
  { value: 'bono',        labelKey: 'panelcfg_tipo_bono',        descKey: 'panelcfg_tipo_bono_desc' },
  { value: 'reservable',  labelKey: 'panelcfg_tipo_reservable',  descKey: 'panelcfg_tipo_reservable_desc' },
  { value: 'subservicio', labelKey: 'panelcfg_tipo_subservicio', descKey: 'panelcfg_tipo_subservicio_desc' },
] as const

// Flujo de reserva (solo para paquetes reservables) — define la UX de la reserva
const FLUJOS = [
  { value: 'cumpleanos', labelKey: 'panelcfg_flujo_cumpleanos' },
  { value: 'custodia',   labelKey: 'panelcfg_flujo_custodia' },
  { value: 'generico',   labelKey: 'panelcfg_flujo_generico' },
] as const

// Flujos a los que puede asociarse un sub-servicio
const RESERVABLE_TYPES = [
  { value: 'cumpleanos', labelKey: 'panelcfg_appliesto_cumpleanos' },
  { value: 'custodia',   labelKey: 'panelcfg_appliesto_custodia' },
  { value: 'generico',   labelKey: 'panelcfg_appliesto_generico' },
] as const

function tipoLabel(t: (key: any, vars?: Record<string, string | number>) => string, value: string | null): string {
  const found = TIPOS.find(x => x.value === value)
  return found ? t(found.labelKey) : (value ?? '')
}

function flujoLabel(t: (key: any, vars?: Record<string, string | number>) => string, value: string | null): string {
  const found = FLUJOS.find(x => x.value === value)
  return found ? t(found.labelKey) : (value ?? '')
}

function appliesToLabel(t: (key: any, vars?: Record<string, string | number>) => string, value: string): string {
  const found = RESERVABLE_TYPES.find(x => x.value === value)
  return found ? t(found.labelKey) : value
}

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
  tipo: string
  flujo: string
  // bono
  sessions: string
  validity_days: string
  ilimitado: boolean
}

// Categorías por defecto que no ha creado el tenant: su label se traduce vía panelcfg_cat_<value>.
const DEFAULT_CATEGORY_KEYS: Record<string, string> = {
  entrada: 'panelcfg_cat_entrada',
  bono: 'panelcfg_cat_bono',
  cumpleanos: 'panelcfg_cat_cumpleanos',
  sala: 'panelcfg_cat_sala',
  custodia: 'panelcfg_cat_custodia',
  otros: 'panelcfg_cat_otros',
  subservicios: 'panelcfg_cat_subservicios',
  general: 'panelcfg_cat_general',
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

// Traduce el label de una categoría si es una de las categorías por defecto; las creadas por el tenant se muestran tal cual.
function catLabel(t: (key: any) => string, cat: { value: string; label: string }): string {
  const key = DEFAULT_CATEGORY_KEYS[cat.value]
  return key ? t(key) : cat.label
}

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

const EMPTY_FORM: FormData = { name: '', description: '', category: 'general', price: '', price_unit: 'sesión', duration_min: '', deposit_pct: '50', price_per_guest_adult: '', price_per_guest_child: '', included_guests: '', applies_to: [], reservable: false, tipo: 'entrada', flujo: 'cumpleanos', sessions: '', validity_days: '', ilimitado: false }

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
  const { t } = useLanguage()
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState<'todos' | 'entrada' | 'bono' | 'reservable' | 'subservicio'>('todos')
  const [exporting, setExporting] = useState(false)

  // Bonos (membership_types) — fuente única para venta y check-in; se crean en el mismo asistente
  const [bonos, setBonos] = useState<MembershipType[]>([])
  const [editBonoId, setEditBonoId] = useState<string | null>(null)
  const [bonoDeleteId, setBonoDeleteId] = useState<string | null>(null)

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
    const [{ data }, { data: mt }] = await Promise.all([
      supabase.from('services').select('*').order('sort_order', { ascending: true, nullsFirst: false }).order('name'),
      supabase.from('membership_types').select('id, name, sessions, price, validity_days, active').order('price'),
    ])
    setServices(data ?? [])
    setBonos((mt ?? []) as MembershipType[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Bonos (membership_types) ──
  function openEditBono(b: MembershipType) {
    setForm({
      ...EMPTY_FORM,
      tipo: 'bono',
      name: b.name,
      ilimitado: b.sessions == null,
      sessions: b.sessions != null ? String(b.sessions) : '',
      price: b.price != null ? String(b.price) : '',
      validity_days: b.validity_days != null ? String(b.validity_days) : '',
    })
    setEditBonoId(b.id); setEditTarget(null); setModal('edit')
  }
  async function toggleBonoActive(b: MembershipType) {
    await supabase.from('membership_types').update({ active: !b.active }).eq('id', b.id)
    setBonos(prev => prev.map(x => x.id === b.id ? { ...x, active: !x.active } : x))
  }
  async function deleteBono(id: string) {
    await supabase.from('membership_types').delete().eq('id', id)
    setBonoDeleteId(null)
    setBonos(prev => prev.filter(x => x.id !== id))
  }

  function getCat(value: string): Category {
    return categories.find(c => c.value === value) ?? categories[categories.length - 1] ?? DEFAULT_CATEGORIES[4]
  }

  function openAdd() { setForm(EMPTY_FORM); setEditTarget(null); setEditBonoId(null); setModal('add') }
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
      tipo: s.tipo ?? 'entrada',
      flujo: s.flujo ?? 'cumpleanos',
      sessions: '', validity_days: '', ilimitado: false,
    })
    setEditTarget(s); setEditBonoId(null); setModal('edit')
  }
  function closeModal() { setModal(null); setEditTarget(null); setEditBonoId(null); setForm(EMPTY_FORM) }

  async function saveForm() {
    if (!form.name.trim()) return
    setSaving(true)

    // BONO → membership_types (fuente única para venta y check-in)
    if (form.tipo === 'bono') {
      if (!form.price) { setSaving(false); return }
      const bonoPayload = {
        name: form.name.trim(),
        sessions: form.ilimitado ? null : (form.sessions ? parseInt(form.sessions) : null),
        price: parseFloat(form.price),
        validity_days: form.validity_days ? parseInt(form.validity_days) : null,
      }
      if (editBonoId) await supabase.from('membership_types').update(bonoPayload).eq('id', editBonoId)
      else await supabase.from('membership_types').insert({ ...bonoPayload, active: true })
      setSaving(false); closeModal(); load()
      return
    }

    if (!form.price) { setSaving(false); return }
    const isReservable = form.tipo === 'reservable'
    const isSub = form.tipo === 'subservicio'
    // La categoría se retiró: se guarda un valor derivado (flujo para reservables, tipo para el resto) solo por compatibilidad.
    const derivedCategory = isReservable ? form.flujo : form.tipo
    const payload = {
      name: form.name.trim(), description: form.description.trim() || null,
      category: derivedCategory, price: parseFloat(form.price),
      price_unit: form.price_unit, duration_min: form.duration_min ? parseInt(form.duration_min) : null,
      tipo: form.tipo,
      flujo: isReservable ? form.flujo : null,
      deposit_pct: isReservable ? (form.deposit_pct ? parseFloat(form.deposit_pct) : null) : null,
      price_per_guest_adult: isReservable && form.price_per_guest_adult ? parseFloat(form.price_per_guest_adult) : 0,
      price_per_guest_child: isReservable && form.price_per_guest_child ? parseFloat(form.price_per_guest_child) : 0,
      included_guests: isReservable && form.included_guests ? parseInt(form.included_guests) : 0,
      applies_to: isSub ? form.applies_to : [],
      reservable: isReservable,
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

  const q = search.trim().toLowerCase()
  function matchesSearch(name: string, tipoLabel: string) {
    if (!q) return true
    return name.toLowerCase().includes(q) || tipoLabel.toLowerCase().includes(q)
  }
  const filteredServices = services.filter(s => {
    if (filterTipo === 'bono') return false
    if (filterTipo !== 'todos' && s.tipo !== filterTipo) return false
    const tLabel = tipoLabel(t, s.tipo)
    return matchesSearch(s.name, tLabel)
  })
  const filteredBonos = bonos.filter(b => {
    if (filterTipo !== 'todos' && filterTipo !== 'bono') return false
    return matchesSearch(b.name, t('panelcfg_bono_label'))
  })
  const totalFiltered = filteredServices.length + filteredBonos.length

  async function handleExport() {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const dash = ''
      const rows = [
        ...filteredServices.map(s => ({
          [t('panelcfg_th_servicio')]: s.name,
          [t('panelcfg_tipo_label')]: tipoLabel(t, s.tipo) || dash,
          [t('panelcfg_th_flujo')]: s.flujo ? flujoLabel(t, s.flujo) : dash,
          [t('panelcfg_th_reservable')]: s.reservable ? 'Sí' : 'No',
          [t('panelcfg_th_precio')]: s.price ?? dash,
          [t('panelcfg_th_unidad')]: s.price_unit ?? dash,
          'Duración (min)': s.duration_min ?? dash,
          [t('panelcfg_th_capacidad')]: s.included_guests ?? dash,
          'Adelanto (%)': s.deposit_pct ?? dash,
          [t('panelcfg_th_adulto_precio')]: s.price_per_guest_adult ?? dash,
          [t('panelcfg_th_nino_precio')]: s.price_per_guest_child ?? dash,
          [t('panelcfg_th_aplica_a')]: (s.applies_to ?? []).map(v => appliesToLabel(t, v)).join(', '),
          [t('panelcfg_th_activo')]: s.active ? 'Sí' : 'No',
        })),
        ...filteredBonos.map(b => ({
          [t('panelcfg_th_servicio')]: b.name,
          [t('panelcfg_tipo_label')]: t('panelcfg_bono_label'),
          [t('panelcfg_th_flujo')]: dash,
          [t('panelcfg_th_reservable')]: dash,
          [t('panelcfg_th_precio')]: b.price ?? dash,
          [t('panelcfg_th_unidad')]: dash,
          'Duración (min)': dash,
          [t('panelcfg_th_capacidad')]: b.sessions == null ? t('panelcfg_ilimitado') : `${b.sessions} ${t('panelcfg_sesiones_abrev')}`,
          'Adelanto (%)': dash,
          [t('panelcfg_th_adulto_precio')]: dash,
          [t('panelcfg_th_nino_precio')]: dash,
          [t('panelcfg_th_aplica_a')]: dash,
          [t('panelcfg_th_activo')]: b.active ? 'Sí' : 'No',
        })),
      ]
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 9 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 9 }, { wch: 9 }, { wch: 20 }, { wch: 8 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Servicios')
      XLSX.writeFile(wb, 'servicios.xlsx')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">{t('panelcfg_servicios_titulo')}</h1>
        <p className="text-sm text-fog mt-0.5">{t('panelcfg_servicios_subtitulo')}</p>
      </div>

      {/* Tab nav */}
      <PanelNav />

      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-fog">{t('panelcfg_servicios_count', { n: services.length, s: services.length !== 1 ? 's' : '', a: services.filter(s => s.active).length, as: services.filter(s => s.active).length !== 1 ? 's' : '' })}</p>
        <button
          onClick={openAdd}
          title={t('panelcfg_nuevo_servicio_titulo_btn')}
          className="flex items-center gap-1.5 border border-lime bg-lime/10 text-lime text-xs font-semibold px-4 py-2 rounded-xl hover:bg-lime/20 transition-colors"
        >
          <Plus size={13} /> {t('panelcfg_nuevo_servicio')}
        </button>
      </div>

      {/* Búsqueda + filtros + exportar */}
      <TableFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('panelcfg_buscar_nombre_tipo')}
        activeFilterCount={filterTipo !== 'todos' ? 1 : 0}
        onExport={handleExport}
        exporting={exporting}
        exportDisabled={totalFiltered === 0}
        filters={
          <div>
            <p className="text-[10px] font-semibold text-fog uppercase tracking-wide mb-2">{t('panelcfg_tipo_label')}</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: 'todos', label: t('panelcfg_todos') },
                ...TIPOS.map(x => ({ key: x.value, label: t(x.labelKey) })),
              ] as { key: typeof filterTipo; label: string }[]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterTipo(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
                    filterTipo === f.key ? 'border-lime bg-lime/10 text-lime' : 'border-line bg-surface text-fog hover:text-snow'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {loading ? (
        <div className="text-center py-16 text-mist text-sm">{t('panelcfg_cargando')}</div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 text-mist text-sm">{t('panelcfg_sin_servicios')}</div>
      ) : totalFiltered === 0 ? (
        <div className="text-center py-16 text-mist text-sm">{t('panelcfg_sin_resultados_busqueda')}</div>
      ) : (
        <>
          {/* ── MÓVIL/TABLET: tarjetas (< lg) ── */}
          <div className="lg:hidden space-y-2">
            {filteredServices.map(s => (
              <div key={s.id} className={`rounded-2xl border border-line bg-surface px-4 py-3 ${s.active ? '' : 'opacity-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-snow truncate">{s.name}</p>
                    <p className="text-xs text-mist mt-0.5">
                      {tipoLabel(t, s.tipo) || '—'}
                      {s.flujo ? ` · ${flujoLabel(t, s.flujo)}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-snow">{s.price}€</p>
                    <p className="text-[10px] text-mist">/ {s.price_unit}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <button onClick={() => toggleActive(s)}
                    className={`relative inline-block shrink-0 w-9 h-5 rounded-full transition-colors ${s.active ? 'bg-lime' : 'bg-line'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${s.active ? 'translate-x-4' : ''}`} />
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg text-fog hover:text-rose hover:bg-rose/10 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
            {filteredBonos.map(b => (
              <div key={`bono-${b.id}`} className={`rounded-2xl border border-line bg-surface px-4 py-3 ${b.active ? '' : 'opacity-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-snow truncate">{b.name}</p>
                    <p className="text-xs text-mist mt-0.5">{t('panelcfg_bono_label')} · {b.sessions == null ? t('panelcfg_ilimitado') : `${b.sessions} ${t('panelcfg_sesiones_abrev')}`}</p>
                  </div>
                  <p className="text-sm font-semibold text-snow shrink-0">{b.price != null ? `${b.price}€` : '—'}</p>
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <button onClick={() => toggleBonoActive(b)}
                    className={`relative inline-block shrink-0 w-9 h-5 rounded-full transition-colors ${b.active ? 'bg-lime' : 'bg-line'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${b.active ? 'translate-x-4' : ''}`} />
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditBono(b)} className="p-1.5 rounded-lg text-fog hover:text-snow hover:bg-surface2 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => setBonoDeleteId(b.id)} className="p-1.5 rounded-lg text-fog hover:text-rose hover:bg-rose/10 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── ESCRITORIO: tabla con scroll interno (lg+) ── */}
          <div className="hidden lg:block rounded-2xl border border-line bg-surface overflow-hidden">
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="text-left text-[10px] font-semibold text-mist uppercase tracking-wide border-b border-line">
                  <th className="px-4 py-3">{t('panelcfg_th_servicio')}</th>
                  <th className="px-3 py-3">{t('panelcfg_tipo_label')}</th>
                  <th className="px-3 py-3">{t('panelcfg_th_flujo')}</th>
                  <th className="px-3 py-3 text-center">{t('panelcfg_th_reservable')}</th>
                  <th className="px-3 py-3 text-right">{t('panelcfg_th_precio')}</th>
                  <th className="px-3 py-3">{t('panelcfg_th_unidad')}</th>
                  <th className="px-3 py-3 text-right">{t('panelcfg_th_duracion')}</th>
                  <th className="px-3 py-3 text-right">{t('panelcfg_th_capacidad')}</th>
                  <th className="px-3 py-3 text-right">{t('panelcfg_th_adelanto')}</th>
                  <th className="px-3 py-3 text-right">{t('panelcfg_th_adulto_precio')}</th>
                  <th className="px-3 py-3 text-right">{t('panelcfg_th_nino_precio')}</th>
                  <th className="px-3 py-3">{t('panelcfg_th_aplica_a')}</th>
                  <th className="px-3 py-3 text-center">{t('panelcfg_th_activo')}</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredServices.map(s => {
                  const cat = categories.find(c => c.value === s.category)
                  const applies = (s.applies_to ?? []).map(v => appliesToLabel(t, v)).join(', ')
                  const dash = <span className="text-mist">—</span>
                  return (
                    <tr key={s.id} className={`${s.active ? '' : 'opacity-50'} hover:bg-surface2/40 transition-colors`}>
                      <td className="px-4 py-2.5 max-w-[220px]">
                        <p className="font-semibold text-snow truncate">{s.name}</p>
                        {s.description && <p className="text-xs text-mist truncate">{s.description}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-medium text-snow">{tipoLabel(t, s.tipo) || dash}</span>
                      </td>
                      <td className="px-3 py-2.5 text-fog">{s.flujo ? flujoLabel(t, s.flujo) : dash}</td>
                      <td className="px-3 py-2.5 text-center">{s.reservable ? <Check size={14} className="inline text-lime" /> : dash}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-snow">{s.price != null ? `${s.price}€` : dash}</td>
                      <td className="px-3 py-2.5 text-fog">{s.price_unit || dash}</td>
                      <td className="px-3 py-2.5 text-right text-fog">{s.duration_min != null ? `${s.duration_min} min` : dash}</td>
                      <td className="px-3 py-2.5 text-right text-fog">{s.included_guests ? s.included_guests : dash}</td>
                      <td className="px-3 py-2.5 text-right text-fog">{s.deposit_pct != null ? `${s.deposit_pct}%` : dash}</td>
                      <td className="px-3 py-2.5 text-right text-fog">{s.price_per_guest_adult ? `${s.price_per_guest_adult}€` : dash}</td>
                      <td className="px-3 py-2.5 text-right text-fog">{s.price_per_guest_child ? `${s.price_per_guest_child}€` : dash}</td>
                      <td className="px-3 py-2.5 text-fog">{applies || dash}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => toggleActive(s)}
                          className={`relative inline-block shrink-0 w-9 h-5 rounded-full transition-colors ${s.active ? 'bg-lime' : 'bg-line'}`}>
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${s.active ? 'translate-x-4' : ''}`} />
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-fog hover:text-snow hover:bg-line transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg text-fog hover:text-rose hover:bg-rose/20 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {/* Bonos (membership_types) en la misma tabla */}
                {filteredBonos.map(b => (
                  <tr key={`bono-${b.id}`} className={`${b.active ? '' : 'opacity-50'} hover:bg-surface2/40 transition-colors`}>
                    <td className="px-4 py-2.5 font-semibold text-snow">{b.name}</td>
                    <td className="px-3 py-2.5"><span className="text-xs font-medium text-snow">{t('panelcfg_bono_label')}</span></td>
                    <td className="px-3 py-2.5"><span className="text-mist">—</span></td>
                    <td className="px-3 py-2.5 text-center"><span className="text-mist">—</span></td>
                    <td className="px-3 py-2.5 text-right font-semibold text-snow">{b.price != null ? `${b.price}€` : '—'}</td>
                    <td className="px-3 py-2.5 text-fog"><span className="text-mist">—</span></td>
                    <td className="px-3 py-2.5 text-right text-fog">{b.validity_days != null ? `${b.validity_days} ${t('panelcfg_dias')}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-fog">{b.sessions == null ? <span className="text-iris">{t('panelcfg_ilimitado')}</span> : `${b.sessions} ${t('panelcfg_sesiones_abrev')}`}</td>
                    <td className="px-3 py-2.5 text-right"><span className="text-mist">—</span></td>
                    <td className="px-3 py-2.5 text-right"><span className="text-mist">—</span></td>
                    <td className="px-3 py-2.5 text-right"><span className="text-mist">—</span></td>
                    <td className="px-3 py-2.5"><span className="text-mist">—</span></td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => toggleBonoActive(b)}
                        className={`relative inline-block shrink-0 w-9 h-5 rounded-full transition-colors ${b.active ? 'bg-lime' : 'bg-line'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${b.active ? 'translate-x-4' : ''}`} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditBono(b)} className="p-1.5 rounded-lg text-fog hover:text-snow hover:bg-line transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setBonoDeleteId(b.id)} className="p-1.5 rounded-lg text-fog hover:text-rose hover:bg-rose/20 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </>
      )}

      {/* Add / Edit Service Modal */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-line rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-snow">{modal === 'add' ? t('panelcfg_nuevo_servicio_modal') : t('panelcfg_editar_servicio')}</h2>
              <button onClick={closeModal} className="text-fog hover:text-snow transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              {/* Paso 1 — Tipo de servicio (define el comportamiento y los campos) */}
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_tipo_servicio_req')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.map(opt => {
                    const sel = form.tipo === opt.value
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => setForm(f => ({ ...f, tipo: opt.value, flujo: f.flujo || 'cumpleanos' }))}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${sel ? 'border-lime/40 bg-lime/10' : 'border-line bg-surface2 hover:border-line2'}`}>
                        <p className={`text-sm font-semibold ${sel ? 'text-snow' : 'text-fog'}`}>{t(opt.labelKey)}</p>
                        <p className="text-[10px] text-mist leading-tight">{t(opt.descKey)}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_nombre_req')}</label>
                <input className={INPUT_CLASS} placeholder={t('panelcfg_placeholder_nombre_servicio')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_descripcion_opcional')}</label>
                <input className={INPUT_CLASS} placeholder={t('panelcfg_placeholder_descripcion_breve')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {/* BONO — campos propios (se guardan en membership_types) */}
              {form.tipo === 'bono' && (
                <>
                  <button type="button" onClick={() => setForm(f => ({ ...f, ilimitado: !f.ilimitado }))}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-line bg-surface2/40 text-left">
                    <div className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${form.ilimitado ? 'bg-lime' : 'bg-line'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.ilimitado ? 'translate-x-4' : ''}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-snow">{t('panelcfg_ilimitado_label')}</p>
                      <p className="text-[11px] text-mist">{t('panelcfg_ilimitado_desc')}</p>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    {!form.ilimitado && (
                      <div>
                        <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_num_sesiones_req')}</label>
                        <input className={INPUT_CLASS} type="number" min="1" placeholder={t('panelcfg_placeholder_ej10')} value={form.sessions} onChange={e => setForm(f => ({ ...f, sessions: e.target.value }))} />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_precio_eur_req')}</label>
                      <input className={INPUT_CLASS} type="number" min="0" step="0.01" placeholder="60.00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_vigencia_dias_opcional')}</label>
                    <input className={INPUT_CLASS} type="number" min="0" placeholder={t('panelcfg_placeholder_ej90')} value={form.validity_days} onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))} />
                  </div>
                </>
              )}

              {/* Flujo de reserva — solo para paquetes reservables (define la UX de la reserva) */}
              {form.tipo === 'reservable' && (
                <div>
                  <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_flujo_reserva_req')}</label>
                  <select className={INPUT_CLASS} value={form.flujo} onChange={e => setForm(f => ({ ...f, flujo: e.target.value }))}>
                    {FLUJOS.map(fl => <option key={fl.value} value={fl.value}>{t(fl.labelKey)}</option>)}
                  </select>
                  <p className="text-[11px] text-mist mt-1">{t('panelcfg_flujo_reserva_hint')}</p>
                </div>
              )}
              {form.tipo !== 'bono' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_precio_eur_req')}</label>
                      <input className={INPUT_CLASS} type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_unidad_precio')}</label>
                      <select className={INPUT_CLASS} value={form.price_unit} onChange={e => setForm(f => ({ ...f, price_unit: e.target.value }))}>
                        {PRICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_duracion_min_opcional')}</label>
                    <input className={INPUT_CLASS} type="number" min="0" placeholder={t('panelcfg_placeholder_ej60')} value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} />
                  </div>
                </>
              )}

              {/* Config de reservas — solo para paquetes reservables */}
              {form.tipo === 'reservable' && (
                <div className="rounded-xl border border-line bg-surface2/40 p-4 space-y-3">
                  <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">{t('panelcfg_config_reservas')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_adelanto_sugerido')}</label>
                      <input className={INPUT_CLASS} type="number" min="0" max="100" step="1" placeholder="50"
                        value={form.deposit_pct} onChange={e => setForm(f => ({ ...f, deposit_pct: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_personas_incluidas')}</label>
                      <input className={INPUT_CLASS} type="number" min="0" step="1" placeholder="0"
                        value={form.included_guests} onChange={e => setForm(f => ({ ...f, included_guests: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_adulto_extra')}</label>
                      <input className={INPUT_CLASS} type="number" min="0" step="0.01" placeholder={t('panelcfg_placeholder_entrada_libre')}
                        value={form.price_per_guest_adult} onChange={e => setForm(f => ({ ...f, price_per_guest_adult: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_nino_extra')}</label>
                      <input className={INPUT_CLASS} type="number" min="0" step="0.01" placeholder={t('panelcfg_placeholder_entrada_libre')}
                        value={form.price_per_guest_child} onChange={e => setForm(f => ({ ...f, price_per_guest_child: e.target.value }))} />
                    </div>
                  </div>
                  <p className="text-[11px] text-mist leading-relaxed">
                    {t('panelcfg_config_reservas_hint', { personas: t('panelcfg_personas_incluidas_inline'), entrada: t('panelcfg_entrada_libre_inline') })}
                  </p>
                </div>
              )}

              {/* Sub-servicio: a qué tipos de reserva puede agregarse */}
              {form.tipo === 'subservicio' && (
                <div className="rounded-xl border border-line bg-surface2/40 p-4 space-y-2.5">
                  <p className="text-[10px] font-semibold text-fog uppercase tracking-wide">{t('panelcfg_se_puede_agregar_a')}</p>
                  <div className="space-y-1.5">
                    {RESERVABLE_TYPES.map(opt => {
                      const sel = form.applies_to.includes(opt.value)
                      return (
                        <button key={opt.value} type="button"
                          onClick={() => setForm(f => ({ ...f, applies_to: sel ? f.applies_to.filter(v => v !== opt.value) : [...f.applies_to, opt.value] }))}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${sel ? 'border-iris/30 bg-iris/5' : 'border-line bg-surface2 hover:border-line2'}`}>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${sel ? 'bg-iris border-iris' : 'bg-surface2 border-line2'}`}>
                            {sel && <Check size={11} className="text-white" strokeWidth={3} />}
                          </div>
                          <span className={`text-sm font-medium ${sel ? 'text-snow' : 'text-fog'}`}>{t(opt.labelKey)}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-mist">{t('panelcfg_agregar_a_hint')}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-fog hover:text-snow transition-colors">{t('panelcfg_cancelar')}</button>
              <button onClick={saveForm} disabled={saving || !form.name.trim() || !form.price} className="flex-1 py-2.5 rounded-xl border border-lime bg-lime/10 text-lime text-sm font-semibold hover:bg-lime/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                <Check size={14} /> {saving ? t('panelcfg_guardando') : t('panelcfg_guardar')}
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
              <h2 className="text-base font-semibold text-snow">{editCat ? t('panelcfg_editar_categoria') : t('panelcfg_nueva_categoria')}</h2>
              <button onClick={() => setShowCatModal(false)} className="text-fog hover:text-snow transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_nombre_categoria_req')}</label>
                <input
                  className={INPUT_CLASS}
                  placeholder={t('panelcfg_placeholder_categoria')}
                  value={catForm.label}
                  onChange={e => setCatForm(f => ({ ...f, label: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fog mb-1.5">{t('panelcfg_identificador_opcional')}</label>
                <input
                  className={INPUT_CLASS}
                  placeholder={t('panelcfg_placeholder_autogenerado')}
                  value={catForm.value}
                  onChange={e => setCatForm(f => ({ ...f, value: e.target.value }))}
                />
                <p className="text-xs text-mist mt-1">{t('panelcfg_identificador_hint')}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowCatModal(false)} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-fog hover:text-snow transition-colors">{t('panelcfg_cancelar')}</button>
              <button onClick={saveCat} disabled={!catForm.label.trim()} className="flex-1 py-2.5 rounded-xl border border-lime bg-lime/10 text-lime text-sm font-semibold hover:bg-lime/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Check size={14} /> {editCat ? t('panelcfg_guardar') : t('panelcfg_crear_categoria')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete category confirmation */}
      {deleteCat && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-snow mb-2">{t('panelcfg_eliminar_categoria_titulo')}</h2>
            <p className="text-sm text-fog mb-1">{t('panelcfg_eliminar_categoria_msg1')}</p>
            <p className="text-sm text-fog mb-6">{t('panelcfg_eliminar_categoria_msg2')}</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteCat(null)} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-fog hover:text-snow transition-colors">{t('panelcfg_cancelar')}</button>
              <button onClick={doDeleteCat} className="flex-1 py-2.5 rounded-xl border border-rose bg-rose/10 text-rose text-sm font-semibold hover:bg-rose/20 transition-colors">{t('panelcfg_eliminar')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete service confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-snow mb-2">{t('panelcfg_eliminar_servicio_titulo')}</h2>
            <p className="text-sm text-fog mb-6">{t('panelcfg_eliminar_servicio_msg')}</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-fog hover:text-snow transition-colors">{t('panelcfg_cancelar')}</button>
              <button onClick={() => deleteService(deleteId)} className="flex-1 py-2.5 rounded-xl border border-rose bg-rose/10 text-rose text-sm font-semibold hover:bg-rose/20 transition-colors">{t('panelcfg_eliminar')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete bono confirmation */}
      {bonoDeleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-carbon/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-line rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-snow mb-2">{t('panelcfg_eliminar_bono_titulo')}</h2>
            <p className="text-sm text-fog mb-6">{t('panelcfg_eliminar_bono_msg')}</p>
            <div className="flex gap-2">
              <button onClick={() => setBonoDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-fog hover:text-snow transition-colors">{t('panelcfg_cancelar')}</button>
              <button onClick={() => deleteBono(bonoDeleteId)} className="flex-1 py-2.5 rounded-xl border border-rose bg-rose/10 text-rose text-sm font-semibold hover:bg-rose/20 transition-colors">{t('panelcfg_eliminar')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
