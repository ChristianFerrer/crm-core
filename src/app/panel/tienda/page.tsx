'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart2, Tag, ShoppingBag, Plus, Pencil, Trash2, X, Check, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant } from '@/lib/tenant'

type Product = { id: string; name: string; category: string; price: number; emoji: string; active: boolean }

const CATEGORIES = [
  { value: 'bebida', label: 'Bebida', emoji: '🥤' },
  { value: 'snack', label: 'Snack', emoji: '🍪' },
  { value: 'otro', label: 'Otro', emoji: '🛒' },
]

const inputCls = 'w-full bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-snow placeholder:text-mist outline-none focus:border-line2 transition-colors'

export default function TiendaPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('bebida')
  const [price, setPrice] = useState('')
  const [emoji, setEmoji] = useState('🥤')

  async function load() {
    const tenant = getStoredTenant()
    if (!tenant) return
    const { data } = await supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name')
    setProducts((data ?? []) as Product[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null); setName(''); setCategory('bebida'); setPrice(''); setEmoji('🥤')
    setShowModal(true)
  }

  function openEdit(p: Product) {
    setEditing(p); setName(p.name); setCategory(p.category); setPrice(String(p.price)); setEmoji(p.emoji)
    setShowModal(true)
  }

  async function handleSave() {
    if (!name.trim() || !price) return
    setSaving(true)
    const tenant = getStoredTenant()
    if (!tenant) return
    const payload = { name: name.trim(), category, price: parseFloat(price), emoji, tenant_id: tenant.id, active: true }
    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id)
    } else {
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

  return (
    <div className="space-y-5">
      {/* Sub-nav panel */}
      <div className="flex lg:inline-flex gap-1 bg-surface rounded-xl p-1 border border-line">
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
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-xl bg-lime px-4 py-2.5 text-sm font-semibold text-ink hover:bg-lime/90 transition-colors" style={{ boxShadow: 'var(--shadow-lime)' }}>
          <Plus size={15} /> Añadir producto
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
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <div key={p.id} className={`rounded-2xl border bg-surface p-4 flex items-center gap-4 ${p.active ? 'border-line' : 'border-line opacity-50'}`}>
              <span className="text-2xl shrink-0">{p.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-snow">{p.name}</p>
                <p className="text-xs text-mist capitalize">{CATEGORIES.find(c => c.value === p.category)?.label ?? p.category}</p>
              </div>
              <p className="text-base font-bold text-lime shrink-0">{p.price.toFixed(2)} €</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => handleToggle(p)} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${p.active ? 'bg-lime/10 border-lime/30 text-lime' : 'bg-surface2 border-line text-fog'}`}>
                  {p.active ? 'Activo' : 'Inactivo'}
                </button>
                <button onClick={() => openEdit(p)} className="w-7 h-7 rounded-lg border border-line bg-surface2 flex items-center justify-center text-fog hover:text-snow transition-colors">
                  <Pencil size={12} />
                </button>
                <button onClick={() => handleDelete(p.id)} className="w-7 h-7 rounded-lg border border-line bg-surface2 flex items-center justify-center text-fog hover:text-rose transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-snow">{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-mist hover:text-snow"><X size={16} /></button>
            </div>

            <div className="space-y-3">
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
            </div>

            <button onClick={handleSave} disabled={saving || !name.trim() || !price} className="w-full rounded-xl bg-lime py-3 text-sm font-semibold text-ink hover:bg-lime/90 disabled:opacity-50 transition-colors" style={{ boxShadow: 'var(--shadow-lime)' }}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Añadir producto'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
