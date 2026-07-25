'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShoppingBag, Plus, Pencil, Trash2, X, Check, ScanBarcode, PackagePlus, Loader2, Search, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PanelNav } from '@/components/PanelNav'
import { Modal } from '@/components/Modal'
import { getStoredTenant } from '@/lib/tenant'
import { BarcodeScanner } from '@/components/BarcodeScanner'

type Product = {
  id: string
  name: string
  category: string
  price: number
  active: boolean
  barcode: string | null
  stock: number
  image_url: string | null
  weight: string | null
}

const CATEGORIES = [
  { value: 'bebida', label: 'Bebida' },
  { value: 'snack', label: 'Snack' },
  { value: 'otro', label: 'Otro' },
]

const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-2 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'

function categoryFromTags(tags: string[]): string {
  const s = tags.join(' ').toLowerCase()
  if (s.includes('beverage') || s.includes('drink') || s.includes('water') || s.includes('juice') || s.includes('soda')) return 'bebida'
  if (s.includes('snack') || s.includes('chip') || s.includes('crisp') || s.includes('biscuit') || s.includes('cookie')) return 'snack'
  return 'otro'
}

export default function TiendaPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [category, setCategory] = useState('bebida')
  const [price, setPrice] = useState('')
  const [barcode, setBarcode] = useState('')
  const [stockInput, setStockInput] = useState('0')

  // Lookup state
  const [showScanner, setShowScanner] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)
  const [lookupWeight, setLookupWeight] = useState<string | null>(null)

  // Stock entry modal
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [stockEntry, setStockEntry] = useState('1')
  const [savingStock, setSavingStock] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)
  const [exporting, setExporting] = useState(false)

  // Búsqueda + filtros por columna
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<'todas' | string>('todas')
  const [filterEstado, setFilterEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos')

  const load = useCallback(async () => {
    const tenant = getStoredTenant()
    if (!tenant) { setLoading(false); return }
    const { data } = await supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name')
    setProducts((data ?? []) as Product[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function resetForm() {
    setName(''); setCategory('bebida'); setPrice(''); setBarcode('')
    setStockInput('0'); setLookupMsg(null); setLookupWeight(null)
  }

  function openNew() {
    setEditing(null)
    resetForm()
    setShowModal(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setName(p.name); setCategory(p.category); setPrice(String(p.price))
    setBarcode(p.barcode ?? ''); setStockInput(String(p.stock))
    setLookupMsg(null); setLookupWeight(p.weight)
    setShowModal(true)
  }

  async function lookupBarcode(code: string) {
    if (!code.trim()) return
    setLookingUp(true)
    setLookupMsg(null)
    setLookupWeight(null)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code.trim()}.json`)
      const json = await res.json()
      if (json.status === 1 && json.product) {
        const p = json.product
        const pname = p.product_name_es || p.product_name || p.generic_name || ''
        const tags: string[] = p.categories_tags ?? []
        if (pname) setName(pname)
        setCategory(categoryFromTags(tags))
        setLookupWeight(p.quantity || p.product_quantity || null)
        setLookupMsg(pname ? `✓ ${pname}` : '✓ Producto encontrado')
      } else {
        setLookupMsg('No encontrado. Rellena los datos manualmente.')
      }
    } catch {
      setLookupMsg('Error al consultar. Rellena los datos manualmente.')
    }
    setLookingUp(false)
  }

  function handleScanDetected(code: string) {
    setShowScanner(false)
    const found = products.find(p => p.barcode === code)
    if (found) {
      if (showModal) setShowModal(false)
      setStockProduct(found)
      setStockEntry('1')
    } else {
      setBarcode(code)
      if (!showModal) {
        setEditing(null)
        resetForm()
        setShowModal(true)
      }
      lookupBarcode(code)
    }
  }

  async function handleSave() {
    if (!name.trim() || !price) return
    setSaving(true)
    const tenant = getStoredTenant()
    if (!tenant) { setSaving(false); return }
    const payload: Record<string, unknown> = {
      name: name.trim(), category, price: parseFloat(price),
      tenant_id: tenant.id, active: true,
      barcode: barcode.trim() || null,
      weight: lookupWeight || null,
    }
    if (editing) {
      payload.stock = Math.max(0, parseInt(stockInput) || 0)
      await supabase.from('products').update(payload).eq('id', editing.id)
    } else {
      payload.stock = parseInt(stockInput) || 0
      await supabase.from('products').insert(payload)
    }
    await load()
    setShowModal(false)
    setSaving(false)
  }

  async function handleToggle(p: Product) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    await load()
  }

  async function handleDelete(id: string) {
    await supabase.from('products').delete().eq('id', id)
    setConfirmDelete(null)
    await load()
  }

  async function handleStockEntry() {
    if (!stockProduct) return
    setSavingStock(true)
    const qty = parseInt(stockEntry) || 0
    if (qty !== 0) {
      await supabase.from('products').update({ stock: Math.max(0, stockProduct.stock + qty) }).eq('id', stockProduct.id)
      await load()
    }
    setStockProduct(null)
    setSavingStock(false)
  }

  const q = search.trim().toLowerCase()
  const filteredProducts = products.filter(p => {
    if (filterCategory !== 'todas' && p.category !== filterCategory) return false
    if (filterEstado === 'activo' && !p.active) return false
    if (filterEstado === 'inactivo' && p.active) return false
    if (!q) return true
    const catLabel = CATEGORIES.find(c => c.value === p.category)?.label ?? p.category
    return p.name.toLowerCase().includes(q) || catLabel.toLowerCase().includes(q)
  })

  async function handleExport() {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const rows = filteredProducts.map(p => ({
        'Producto': p.name,
        'Categoría': CATEGORIES.find(c => c.value === p.category)?.label ?? p.category,
        'Peso': p.weight ?? '',
        'Código de barras': p.barcode ?? '',
        'Stock': p.stock,
        'Precio': p.price,
        'Estado': p.active ? 'Activo' : 'Inactivo',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 10 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Productos')
      XLSX.writeFile(wb, 'tienda.xlsx')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold text-snow">Tienda</h1>
        <p className="text-sm text-fog mt-0.5">Productos de venta durante la visita</p>
      </div>

      {/* Sub-nav panel */}
      <PanelNav />

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-fog hover:text-snow transition-colors"
          title="Escanear — añade stock si el código ya existe, o crea un producto nuevo rellenando nombre/categoría/peso automáticamente"
        >
          <ScanBarcode size={15} />
        </button>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-xl border border-lime bg-lime/10 px-4 py-2.5 text-sm font-semibold text-lime hover:bg-lime/20 transition-colors"
        >
          <Plus size={15} /> Añadir producto
        </button>
      </div>

      {/* Búsqueda + filtros por columna */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o categoría..."
            className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-10 pr-4 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors"
          />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="rounded-xl border border-line bg-surface2 px-3 py-2.5 text-sm text-snow outline-none focus:border-line2">
          <option value="todas">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as typeof filterEstado)}
          className="rounded-xl border border-line bg-surface2 px-3 py-2.5 text-sm text-snow outline-none focus:border-line2">
          <option value="todos">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleExport}
          disabled={exporting || filteredProducts.length === 0}
          className="flex items-center gap-1.5 rounded-xl border border-lime bg-lime/10 px-3 py-2 text-sm font-semibold text-lime hover:bg-lime/20 transition-colors disabled:opacity-50"
        >
          <Download size={15} /> Exportar
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-mist text-center py-8">Cargando...</div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line p-10 text-center">
          <ShoppingBag size={28} className="mx-auto text-mist mb-3" />
          <p className="text-sm text-fog font-medium">Sin productos aún</p>
          <p className="text-xs text-mist mt-1">Añade agua, snacks u otros artículos para vender durante las visitas</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line p-10 text-center text-sm text-mist">
          Sin resultados para esta búsqueda o filtro.
        </div>
      ) : (
        <>
        {/* ── MÓVIL: tarjetas (< md) ── */}
        <div className="lg:hidden space-y-2.5">
          {filteredProducts.map((p, idx) => (
            <div key={p.id} className={`rounded-2xl border border-line bg-surface p-4 ${!p.active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-mist font-mono shrink-0">#{idx + 1}</span>
                    <p className="font-semibold text-snow truncate">{p.name}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-mist capitalize">{CATEGORIES.find(c => c.value === p.category)?.label ?? p.category}</span>
                    {p.weight && <><span className="text-line2 text-[10px]">·</span><span className="text-xs text-mist">{p.weight}</span></>}
                    {p.barcode && <><span className="text-line2 text-[10px]">·</span><span className="text-[10px] font-mono text-mist">{p.barcode}</span></>}
                  </div>
                </div>
                <span className="font-bold text-lime shrink-0">{p.price.toFixed(2)} €</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setStockProduct(p); setStockEntry('1') }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      p.stock === 0 ? 'bg-rose/10 border-rose/30 text-rose' :
                      p.stock <= 3 ? 'bg-amber/10 border-amber/30 text-amber' :
                      'bg-surface2 border-line text-fog'
                    }`}
                    title="Añadir unidades"
                  >
                    <PackagePlus size={12} />{p.stock} ud.
                  </button>
                  <button onClick={() => handleToggle(p)} className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${p.active ? 'bg-lime/10 border-lime/30 text-lime' : 'bg-surface2 border-line text-fog'}`}>
                    {p.active ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg border border-line bg-surface2 flex items-center justify-center text-fog hover:text-snow transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setConfirmDelete(p)} className="w-8 h-8 rounded-lg border border-line bg-surface2 flex items-center justify-center text-fog hover:text-rose transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── ESCRITORIO: tabla con scroll interno (lg+) ── */}
        <div className="hidden lg:block rounded-2xl border border-line bg-surface overflow-hidden">
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-line">
                  <th className="text-center px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide w-8">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-fog uppercase tracking-wide">Producto</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide hidden lg:table-cell">Peso</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide hidden sm:table-cell">Categoría</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide hidden md:table-cell">Código</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide">Stock</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide">Precio</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide hidden sm:table-cell">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-fog uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {filteredProducts.map((p, idx) => (
                  <tr key={p.id} className={`hover:bg-surface2/40 transition-colors ${!p.active ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs text-mist font-mono">{idx + 1}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-snow truncate max-w-[180px]">{p.name}</p>
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <span className="text-xs text-mist">{p.weight ?? '—'}</span>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <span className="text-xs text-mist capitalize">{CATEGORIES.find(c => c.value === p.category)?.label ?? p.category}</span>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {p.barcode
                        ? <span className="text-[10px] font-mono text-mist bg-surface2 px-1.5 py-0.5 rounded">{p.barcode}</span>
                        : <span className="text-xs text-line2">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => { setStockProduct(p); setStockEntry('1') }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-colors ${
                          p.stock === 0 ? 'bg-rose/10 border-rose/30 text-rose' :
                          p.stock <= 3 ? 'bg-amber/10 border-amber/30 text-amber' :
                          'bg-surface2 border-line text-fog hover:border-line2'
                        }`}
                        title="Añadir unidades"
                      >
                        <PackagePlus size={10} />{p.stock}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-bold text-lime">{p.price.toFixed(2)} €</span>
                    </td>
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <button onClick={() => handleToggle(p)}
                        className={`relative inline-block shrink-0 w-9 h-5 rounded-full transition-colors ${p.active ? 'bg-lime' : 'bg-line'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${p.active ? 'translate-x-4' : ''}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(p)} className="w-7 h-7 rounded-lg border border-line bg-surface2 flex items-center justify-center text-fog hover:text-snow transition-colors">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => setConfirmDelete(p)} className="w-7 h-7 rounded-lg border border-line bg-surface2 flex items-center justify-center text-fog hover:text-rose transition-colors">
                          <Trash2 size={12} />
                        </button>
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

      {/* Product modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-snow">{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-mist hover:text-snow"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              {/* Barcode */}
              <div>
                <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1.5">Código de barras</p>
                <div className="flex gap-2">
                  <input
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    onBlur={() => barcode && lookupBarcode(barcode)}
                    placeholder="Escanea o escribe el código"
                    className={inputCls + ' flex-1'}
                  />
                  <button
                    onClick={() => setShowScanner(true)}
                    className="px-3 rounded-xl border border-line bg-surface2 text-fog hover:text-lime hover:border-lime/40 transition-colors"
                    title="Abrir cámara"
                  >
                    <ScanBarcode size={16} />
                  </button>
                </div>
                {lookingUp && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-fog">
                    <Loader2 size={11} className="animate-spin" /> Consultando base de datos...
                  </div>
                )}
              </div>

              {/* Resultado de la búsqueda por código */}
              {lookupMsg && (
                <p className={`text-xs font-medium ${lookupMsg.startsWith('✓') ? 'text-lime' : 'text-amber'}`}>{lookupMsg}</p>
              )}

              {/* Nombre */}
              <div>
                <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1.5">Nombre *</p>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Agua mineral" className={inputCls} />
              </div>

              {/* Categoría + Precio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1.5">Categoría</p>
                  <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1.5">Precio (€) *</p>
                  <input type="number" step="0.10" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="1.50" className={inputCls} />
                </div>
              </div>

              {/* Peso / cantidad */}
              <div>
                <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1.5">Peso / cantidad</p>
                <input
                  value={lookupWeight ?? ''}
                  onChange={e => setLookupWeight(e.target.value || null)}
                  placeholder="Ej: 330 ml, 100 g"
                  className={inputCls}
                />
              </div>

              {/* Stock */}
              <div>
                <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1.5">
                  {editing ? 'Unidades (stock actual)' : 'Unidades iniciales en stock'}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStockInput(s => String(Math.max(0, (parseInt(s) || 0) - 1)))}
                    className="w-10 h-10 rounded-xl border border-line bg-surface2 text-lg font-bold text-fog hover:text-snow flex items-center justify-center transition-colors"
                  >−</button>
                  <input
                    type="number"
                    min="0"
                    value={stockInput}
                    onChange={e => setStockInput(e.target.value)}
                    className="flex-1 bg-surface2 border border-line rounded-xl px-4 py-2.5 text-center text-lg font-bold text-snow outline-none focus:border-line2"
                  />
                  <button
                    type="button"
                    onClick={() => setStockInput(s => String((parseInt(s) || 0) + 1))}
                    className="w-10 h-10 rounded-xl border border-line bg-surface2 text-lg font-bold text-fog hover:text-snow flex items-center justify-center transition-colors"
                  >+</button>
                </div>
                {!editing && (
                  <div className="flex gap-1.5 mt-2">
                    {[6, 12, 24, 48].map(n => (
                      <button key={n} type="button" onClick={() => setStockInput(String(n))}
                        className="flex-1 py-1 rounded-lg border border-line bg-surface2 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors">
                        +{n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button onClick={handleSave} disabled={saving || !name.trim() || !price} className="w-full rounded-xl border border-lime bg-lime/10 py-3 text-sm font-semibold text-lime hover:bg-lime/20 disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Añadir producto'}
            </button>
          </div>
        </div>
      )}

      {/* Quick stock entry modal */}
      {stockProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setStockProduct(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-line bg-surface p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-snow truncate">{stockProduct.name}</p>
                <p className="text-xs text-fog mt-0.5">Stock actual: <span className="font-semibold text-snow">{stockProduct.stock} ud.</span></p>
              </div>
              <button onClick={() => setStockProduct(null)} className="text-mist hover:text-snow shrink-0"><X size={16} /></button>
            </div>

            <div>
              <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-2">Unidades a añadir</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setStockEntry(s => String(Math.max(1, (parseInt(s) || 1) - 1)))}
                  className="w-12 h-12 rounded-xl border border-line bg-surface2 text-xl font-bold text-fog hover:text-snow flex items-center justify-center transition-colors">−</button>
                <input type="number" min="1" value={stockEntry} onChange={e => setStockEntry(e.target.value)}
                  className="flex-1 bg-surface2 border border-line rounded-xl px-4 py-3 text-center text-2xl font-bold text-snow outline-none focus:border-line2" />
                <button type="button" onClick={() => setStockEntry(s => String((parseInt(s) || 0) + 1))}
                  className="w-12 h-12 rounded-xl border border-line bg-surface2 text-xl font-bold text-fog hover:text-snow flex items-center justify-center transition-colors">+</button>
              </div>
              <div className="flex gap-1.5 mt-2">
                {[6, 12, 24, 48].map(n => (
                  <button key={n} type="button" onClick={() => setStockEntry(String(n))}
                    className="flex-1 py-1 rounded-lg border border-line bg-surface2 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors">
                    +{n}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleStockEntry} disabled={savingStock || !(parseInt(stockEntry) > 0)}
              className="w-full rounded-xl border border-lime bg-lime/10 py-3 text-sm font-semibold text-lime hover:bg-lime/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              <Check size={15} /> {savingStock ? 'Guardando...' : `Añadir ${stockEntry} unidades`}
            </button>
          </div>
        </div>
      )}

      {/* Confirmar borrado */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="max-w-xs" z="z-[70]" label="Eliminar producto">
        {confirmDelete && (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-snow">¿Eliminar producto?</p>
              <p className="text-xs text-fog mt-1">Se eliminará <span className="font-semibold text-snow">{confirmDelete.name}</span> de forma permanente.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-fog hover:text-snow transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete.id)}
                className="flex-1 rounded-xl bg-rose/20 border border-rose/30 py-2.5 text-xs font-semibold text-rose hover:bg-rose/30 transition-colors">
                Sí, eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Barcode scanner */}
      {showScanner && (
        <BarcodeScanner
          onDetected={handleScanDetected}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}
