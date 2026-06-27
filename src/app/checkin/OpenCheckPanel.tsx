'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShoppingBag, Plus, Trash2, X, Receipt, Euro } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant } from '@/lib/tenant'

type Product = { id: string; name: string; price: number; emoji: string; category: string }
type CheckItem = { id: string; name: string; quantity: number; unit_price: number; total: number }
type OpenCheck = { id: string; products_cost: number; time_cost: number; total: number; status: string }

export function OpenCheckPanel({
  visitId,
  memberName,
  durationMin,
  timeCost,
  onClose,
}: {
  visitId: string
  memberName: string
  durationMin: number
  timeCost: number | null
  onClose: () => void
}) {
  const [check, setCheck] = useState<OpenCheck | null>(null)
  const [items, setItems] = useState<CheckItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showProducts, setShowProducts] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const tenant = getStoredTenant()
    if (!tenant) return

    const [{ data: checkData }, { data: itemsData }, { data: productsData }] = await Promise.all([
      supabase.from('open_checks').select('*').eq('visit_id', visitId).maybeSingle(),
      supabase.from('open_check_items').select('*').eq('check_id', (await supabase.from('open_checks').select('id').eq('visit_id', visitId).maybeSingle()).data?.id ?? '').order('created_at'),
      supabase.from('products').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name'),
    ])

    if (!checkData) {
      // Create the open check
      const { data: newCheck } = await supabase.from('open_checks').insert({
        tenant_id: tenant.id,
        visit_id: visitId,
        member_name: memberName,
        status: 'open',
        time_cost: 0,
        products_cost: 0,
        total: 0,
      }).select().single()
      setCheck(newCheck as OpenCheck)
      setItems([])
    } else {
      setCheck(checkData as OpenCheck)
      // reload items with correct check id
      const { data: freshItems } = await supabase.from('open_check_items').select('*').eq('check_id', checkData.id).order('created_at')
      setItems((freshItems ?? []) as CheckItem[])
    }

    setProducts((productsData ?? []) as Product[])
    setLoading(false)
  }, [visitId, memberName])

  useEffect(() => { load() }, [load])

  async function addProduct(product: Product) {
    if (!check) return
    const existing = items.find(i => i.name === product.name && i.unit_price === product.price)
    if (existing) {
      await supabase.from('open_check_items').update({
        quantity: existing.quantity + 1,
        total: (existing.quantity + 1) * existing.unit_price,
      }).eq('id', existing.id)
    } else {
      await supabase.from('open_check_items').insert({
        check_id: check.id,
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: product.price,
        total: product.price,
      })
    }
    await refreshTotals()
    setShowProducts(false)
  }

  async function removeItem(item: CheckItem) {
    await supabase.from('open_check_items').delete().eq('id', item.id)
    await refreshTotals()
  }

  async function refreshTotals() {
    if (!check) return
    const { data: freshItems } = await supabase.from('open_check_items').select('*').eq('check_id', check.id).order('created_at')
    const freshList = (freshItems ?? []) as CheckItem[]
    const productsCost = freshList.reduce((s, i) => s + i.total, 0)
    const effectiveTimeCost = timeCost ?? 0
    const total = effectiveTimeCost + productsCost
    await supabase.from('open_checks').update({ products_cost: productsCost, time_cost: effectiveTimeCost, total }).eq('id', check.id)
    setItems(freshList)
    setCheck(prev => prev ? { ...prev, products_cost: productsCost, time_cost: effectiveTimeCost, total } : prev)
  }

  const productsCost = items.reduce((s, i) => s + i.total, 0)
  const effectiveTimeCost = timeCost ?? 0
  const grandTotal = effectiveTimeCost + productsCost

  if (loading) return <div className="p-4 text-xs text-mist text-center">Cargando cuenta...</div>

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <Receipt size={14} className="text-lime" />
          <span className="text-sm font-semibold text-snow">Cuenta · {memberName}</span>
        </div>
        <button onClick={onClose} className="text-mist hover:text-snow transition-colors"><X size={14} /></button>
      </div>

      <div className="p-4 space-y-4">
        {/* Tiempo */}
        <div className="flex items-center justify-between py-2 border-b border-line">
          <div>
            <p className="text-xs font-semibold text-fog">Tiempo en sala</p>
            <p className="text-xs text-mist">{durationMin} min · {Math.ceil(durationMin / 60)}h facturadas</p>
          </div>
          <p className="text-sm font-semibold text-snow">
            {effectiveTimeCost > 0 ? `${effectiveTimeCost.toFixed(2)} €` : <span className="text-lime text-xs">Con bono</span>}
          </p>
        </div>

        {/* Productos añadidos */}
        {items.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">Productos</p>
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-surface2 px-3 py-2">
                <span className="flex-1 text-sm text-snow">{item.name}</span>
                <span className="text-xs text-fog">×{item.quantity}</span>
                <span className="text-sm font-semibold text-snow">{item.total.toFixed(2)} €</span>
                <button onClick={() => removeItem(item)} className="text-mist hover:text-rose transition-colors"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Añadir producto */}
        {!showProducts ? (
          <button onClick={() => setShowProducts(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors">
            <Plus size={13} /> Añadir producto
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-fog uppercase tracking-wide">Seleccionar producto</p>
              <button onClick={() => setShowProducts(false)} className="text-mist hover:text-snow"><X size={13} /></button>
            </div>
            {products.length === 0 ? (
              <p className="text-xs text-mist text-center py-3">Sin productos en tienda. <a href="/panel/tienda" className="text-iris underline">Añade productos</a></p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {products.map(p => (
                  <button key={p.id} onClick={() => addProduct(p)} className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2.5 hover:border-lime/40 hover:bg-lime/5 transition-colors text-left">
                    <span className="text-lg shrink-0">{p.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-snow truncate">{p.name}</p>
                      <p className="text-xs text-lime font-bold">{p.price.toFixed(2)} €</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Total */}
        <div className="rounded-xl bg-surface2 border border-line px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Euro size={14} className="text-lime" />
            <span className="text-sm font-semibold text-snow">Total a cobrar</span>
          </div>
          <span className="font-display text-xl font-bold text-lime">{grandTotal.toFixed(2)} €</span>
        </div>
      </div>
    </div>
  )
}
