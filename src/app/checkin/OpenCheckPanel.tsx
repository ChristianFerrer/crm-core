'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, X, Receipt, Euro, ScanBarcode, Minus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getStoredTenant } from '@/lib/tenant'
import { BarcodeScanner } from '@/components/BarcodeScanner'

type Product = { id: string; name: string; price: number; emoji: string; category: string; barcode: string | null }
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
  const [showScanner, setShowScanner] = useState(false)

  // Quantity picker
  const [pickProduct, setPickProduct] = useState<Product | null>(null)
  const [pickQty, setPickQty] = useState(1)

  const load = useCallback(async () => {
    const tenant = getStoredTenant()
    if (!tenant) return

    const [{ data: checkData }, { data: productsData }] = await Promise.all([
      supabase.from('open_checks').select('*').eq('visit_id', visitId).maybeSingle(),
      supabase.from('products').select('*').eq('tenant_id', tenant.id).eq('active', true).order('name'),
    ])

    if (!checkData) {
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
      const { data: freshItems } = await supabase.from('open_check_items').select('*').eq('check_id', checkData.id).order('created_at')
      setItems((freshItems ?? []) as CheckItem[])
    }

    setProducts((productsData ?? []) as Product[])
    setLoading(false)
  }, [visitId, memberName])

  useEffect(() => { load() }, [load])

  function selectProduct(product: Product) {
    setPickProduct(product)
    setPickQty(1)
    setShowProducts(false)
  }

  async function confirmAdd() {
    if (!check || !pickProduct) return
    const qty = pickQty
    const existing = items.find(i => i.name === pickProduct.name && i.unit_price === pickProduct.price)
    if (existing) {
      await supabase.from('open_check_items').update({
        quantity: existing.quantity + qty,
        total: (existing.quantity + qty) * existing.unit_price,
      }).eq('id', existing.id)
    } else {
      await supabase.from('open_check_items').insert({
        check_id: check.id,
        product_id: pickProduct.id,
        name: pickProduct.name,
        quantity: qty,
        unit_price: pickProduct.price,
        total: pickProduct.price * qty,
      })
    }
    setPickProduct(null)
    await refreshTotals()
  }

  function handleScanDetected(code: string) {
    setShowScanner(false)
    const found = products.find(p => p.barcode === code)
    if (found) {
      selectProduct(found)
    } else {
      alert(`Código ${code} no está en el catálogo de la tienda.`)
    }
  }

  async function removeItem(item: CheckItem) {
    await supabase.from('open_check_items').delete().eq('id', item.id)
    await refreshTotals()
  }

  async function changeItemQty(item: CheckItem, delta: number) {
    const newQty = item.quantity + delta
    if (newQty <= 0) {
      await removeItem(item)
      return
    }
    await supabase.from('open_check_items').update({
      quantity: newQty,
      total: newQty * item.unit_price,
    }).eq('id', item.id)
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

        {/* Items */}
        {items.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-fog uppercase tracking-wide">Productos</p>
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2">
                <span className="flex-1 text-sm text-snow truncate">{item.name}</span>
                {/* Stepper inline */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => changeItemQty(item, -1)} className="w-6 h-6 rounded-lg bg-surface border border-line text-fog hover:text-snow flex items-center justify-center transition-colors">
                    <Minus size={10} />
                  </button>
                  <span className="text-xs text-fog w-5 text-center font-semibold">{item.quantity}</span>
                  <button onClick={() => changeItemQty(item, +1)} className="w-6 h-6 rounded-lg bg-surface border border-line text-fog hover:text-snow flex items-center justify-center transition-colors">
                    <Plus size={10} />
                  </button>
                </div>
                <span className="text-sm font-semibold text-snow shrink-0 min-w-[4rem] text-right">{item.total.toFixed(2)} €</span>
                <button onClick={() => removeItem(item)} className="text-mist hover:text-rose transition-colors shrink-0"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Add products row */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 px-3 text-xs font-semibold text-fog hover:text-lime hover:border-lime/40 transition-colors"
            title="Escanear código de barras"
          >
            <ScanBarcode size={14} />
          </button>
          {!showProducts ? (
            <button onClick={() => setShowProducts(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-xs font-semibold text-fog hover:text-snow hover:border-line2 transition-colors">
              <Plus size={13} /> Añadir producto
            </button>
          ) : (
            <button onClick={() => setShowProducts(false)} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-fog hover:text-snow transition-colors">
              <X size={12} /> Cerrar catálogo
            </button>
          )}
        </div>

        {/* Product grid */}
        {showProducts && (
          <div className="space-y-2">
            {products.length === 0 ? (
              <p className="text-xs text-mist text-center py-3">Sin productos en tienda. <a href="/panel/tienda" className="text-iris underline">Añade productos</a></p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {products.map(p => (
                  <button key={p.id} onClick={() => selectProduct(p)} className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2.5 hover:border-lime/40 hover:bg-lime/5 transition-colors text-left">
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

      {/* Quantity picker overlay */}
      {pickProduct && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs rounded-2xl border border-line bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-snow">{pickProduct.emoji} {pickProduct.name}</p>
                <p className="text-xs text-lime font-bold mt-0.5">{pickProduct.price.toFixed(2)} € / ud.</p>
              </div>
              <button onClick={() => setPickProduct(null)} className="text-mist hover:text-snow"><X size={16} /></button>
            </div>

            <div>
              <p className="text-xs font-semibold text-fog uppercase tracking-wide mb-2">Cantidad</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setPickQty(q => Math.max(1, q - 1))}
                  className="w-12 h-12 rounded-xl border border-line bg-surface2 text-xl font-bold text-fog hover:text-snow flex items-center justify-center transition-colors">−</button>
                <span className="flex-1 text-center text-3xl font-display font-bold text-snow">{pickQty}</span>
                <button onClick={() => setPickQty(q => q + 1)}
                  className="w-12 h-12 rounded-xl border border-line bg-surface2 text-xl font-bold text-fog hover:text-snow flex items-center justify-center transition-colors">+</button>
              </div>
              <div className="flex gap-1.5 mt-2">
                {[2, 3, 4, 6, 8].map(n => (
                  <button key={n} onClick={() => setPickQty(n)}
                    className={`flex-1 py-1 rounded-lg border text-xs font-semibold transition-colors ${pickQty === n ? 'bg-lime/20 border-lime/40 text-lime' : 'border-line bg-surface2 text-fog hover:text-snow'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-surface2 border border-line px-4 py-2.5">
              <span className="text-xs text-fog">Subtotal</span>
              <span className="text-base font-bold text-lime">{(pickProduct.price * pickQty).toFixed(2)} €</span>
            </div>

            <button onClick={confirmAdd} className="w-full rounded-xl bg-lime py-3 text-sm font-semibold text-ink hover:bg-lime/90 transition-colors flex items-center justify-center gap-2">
              <Plus size={15} /> Añadir a la cuenta
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
