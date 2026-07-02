'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { BarChart2, Tag, ShoppingBag, Plus, Pencil, Trash2, X, Check, Building2, ScanBarcode, PackagePlus, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant } from '@/lib/tenant'
import { BarcodeScanner } from '@/components/BarcodeScanner'

type Product = {
  id: string
  name: string
  category: string
  price: number
  emoji: string
  active: boolean
  barcode: string | null
  stock: number
}

const CATEGORIES = [
  { value: 'bebida', label: 'Bebida', emoji: '🥤' },
  { value: 'snack', label: 'Snack', emoji: '🍪' },
  { value: 'otro', label: 'Otro', emoji: '🛒' },
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
  const [emoji, setEmoji] = useState('🥤')
  const [barcode, setBarcode] = useState('')
  const [stockInput, setStockInput] = useState('0')

  // UX states
  const [showScanner, setShowScanner] = useState(false)
  const [scannerTarget, setScannerTarget] = useState<'form' | 'stock'>('form')
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)

  // Stock entry modal
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [stockEntry, setStockEntry] = useState('1')
  const [savingStock, setSavingStock] = useState(false)

  const load = useCallback(async () => {
    const tenant = getStoredTenant()
    if (!tenant) return
    const { data } = await supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name')
    setProducts((data ?? []) as Product[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null); setName(''); setCategory('bebida'); setPrice(''); setEmoji('🥤'); setBarcode(''); setStockInput('0'); setLookupMsg(null)
    setShowModal(true)
  }

  function openEdit(p: Product) {
    setEditing(p); setName(p.name); setCategory(p.category); setPrice(String(p.price)); setEmoji(p.emoji)
    setBarcode(p.barcode ?? ''); setStockInput('0'); setLookupMsg(null)
    setShowModal(true)
  }

  async function lookupBarcode(code: string) {
    if (!code.trim()) return
    setLookingUp(true)
    setLookupMsg(null)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code.trim()}.json`)
      const json = await res.json()
      if (json.status === 1 && json.product) {
        const p = json.product
        const pname = p.product_name_es || p.product_name || p.generic_name || ''
        const tags: string[] = p.categories_tags ?? []
        if (pname) setName(pname)
        setCategory(categoryFromTags(tags))
        // Emoji heuristic
        const cat = categoryFromTags(tags)
        if (cat === 'bebida') setEmoji('🥤')
        else if (cat === 'snack') setEmoji('🍪')
        setLookupMsg(pname ? `✓ Encontrado: ${pname}` : '✓ Producto encontrado (sin nombre en español)')
      } else {
        setLookupMsg('Producto no encontrado en la base de datos. Rellena los datos manualmente.')
      }
    } catch {
      setLookupMsg('Error al consultar la base de datos. Rellena los datos manualmente.')
    }
    setLookingUp(false)
  }

  function handleScanDetected(code: string) {
    setShowScanner(false)
    if (scannerTarget === 'form') {
      setBarcode(code)
      lookupBarcode(code)
    } else if (scannerTarget === 'stock') {
      // Find product by barcode and open stock entry
      const found = products.find(p => p.barcode === code)
      if (found) {
        setStockProduct(found)
        setStockEntry('1')
      } else {
        alert(`Código ${code} no encontrado en la tienda.`)
      }
    }
  }

  async function handleSave() {
    if (!name.trim() || !price) return
    setSaving(true)
    const tenant = getStoredTenant()
    if (!tenant) return
    const payload: Record<string, unknown> = {
      name: name.trim(), category, price: parseFloat(price), emoji,
      tenant_id: tenant.id, active: true,
      barcode: barcode.trim() || null,
    }
    if (editing) {
      // Stock delta: add stockInput units to existing stock
      const delta = parseInt(stockInput) || 0
      if (delta > 0) payload.stock = editing.stock + delta
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
    if (!confirm('¿Eliminar este producto?')) return
    await supabase.from('products').delete().eq('id', id)
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

  return (
    <div className="space-y-5">
      {/* Sub-nav panel */}
      <div className="flex lg:inline-flex gap-1 bg-surface rounded-xl p-1 border border-line overflow-x-auto">
        <Link href="/panel" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <BarChart2 size={13} /> Resumen
        </Link>
        <Link href="/panel/servicios" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <Tag size={13} /> Servicios
        </Link>
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-lime text-ink">
          <ShoppingBag size={13} /> Tienda
        </div>
        <Link href="/panel/perfil" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-fog hover:text-snow transition-colors">
          <Building2 size={13} /> Perfil
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-snow">Tienda</h1>
          <p className="text-sm text-fog mt-0.5">Productos de venta durante la visita</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setScannerTarget('stock'); setShowScanner(true) }}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-fog hover:text-snow transition-colors"
            title="Entrada de stock por código de barras"
          >
            <PackagePlus size={15} />
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-xl bg-lime px-4 py-2.5 text-sm font-semibold text-ink hover:bg-lime/90 transition-colors"
          >
            <Plus size={15} /> Añadir producto
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-mist text-center py-8">Cargando...</div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line p-10 text-center">
          <ShoppingBag size={28} className="mx-auto text-mist mb-3" />
          <p className="text-sm text-fog font-medium">Sin productos aún</p>
          <p className="text-xs text-mist mt-1">Añade agua, snacks u otros artículos para vender durante las visitas</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-fog uppercase tracking-wide">Producto</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide hidden sm:table-cell">Categoría</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide hidden md:table-cell">Código</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide">Stock</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide">Precio</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-fog uppercase tracking-wide hidden sm:table-cell">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-fog uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {products.map(p => (
                  <tr key={p.id} className={`hover:bg-surface2/40 transition-colors ${!p.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg shrink-0">{p.emoji}</span>
                        <span className="font-semibold text-snow truncate max-w-[140px]">{p.name}</span>
                      </div>
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
                      <button onClick={() => handleToggle(p)} className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-colors ${p.active ? 'bg-lime/10 border-lime/30 text-lime' : 'bg-surface2 border-line text-fog'}`}>
                        {p.active ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(p)} className="w-7 h-7 rounded-lg border border-line bg-surface2 flex items-center justify-center text-fog hover:text-snow transition-colors">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="w-7 h-7 rounded-lg border border-line bg-surface2 flex items-center justify-center text-fog hover:text-rose transition-colors">
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
      )}

      {/* Product modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
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
                    onClick={() => { setScannerTarget('form'); setShowScanner(true) }}
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
                {lookupMsg && (
                  <p className={`text-xs mt-1.5 ${lookupMsg.startsWith('✓') ? 'text-lime' : 'text-amber'}`}>{lookupMsg}</p>
                )}
              </div>

              {/* Emoji + nombre */}
              <div className="flex gap-2">
                <div className="shrink-0">
                  <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1.5">Emoji</p>
                  <input value={emoji} onChange={e => setEmoji(e.target.value)} className="w-14 bg-surface2 border border-line rounded-xl px-2 py-3 text-center text-xl outline-none focus:border-line2" maxLength={2} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1.5">Nombre *</p>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Agua mineral" className={inputCls} />
                </div>
              </div>

              {/* Categoría + Precio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1.5">Categoría</p>
                  <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1.5">Precio (€) *</p>
                  <input type="number" step="0.10" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="1.50" className={inputCls} />
                </div>
              </div>

              {/* Stock */}
              <div>
                <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-1.5">
                  {editing ? `Añadir unidades (stock actual: ${editing.stock})` : 'Unidades iniciales en stock'}
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
                {/* Quick presets */}
                <div className="flex gap-1.5 mt-2">
                  {[6, 12, 24, 48].map(n => (
                    <button key={n} type="button" onClick={() => setStockInput(String(n))}
                      className="flex-1 py-1 rounded-lg border border-line bg-surface2 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors">
                      +{n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving || !name.trim() || !price} className="w-full rounded-xl bg-lime py-3 text-sm font-semibold text-ink hover:bg-lime/90 disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Añadir producto'}
            </button>
          </div>
        </div>
      )}

      {/* Quick stock entry modal */}
      {stockProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setStockProduct(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-line bg-surface p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-snow">{stockProduct.emoji} {stockProduct.name}</p>
                <p className="text-xs text-fog mt-0.5">Stock actual: <span className="font-semibold text-snow">{stockProduct.stock} unidades</span></p>
              </div>
              <button onClick={() => setStockProduct(null)} className="text-mist hover:text-snow"><X size={16} /></button>
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
              className="w-full rounded-xl bg-lime py-3 text-sm font-semibold text-ink hover:bg-lime/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              <Check size={15} /> {savingStock ? 'Guardando...' : `Añadir ${stockEntry} unidades`}
            </button>
          </div>
        </div>
      )}

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
