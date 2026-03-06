'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface InventoryItem {
  id: string
  name: string
  unit: string
  currentStock: number
  reorderLevel: number
  costPerUnit: number
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/inventory${lowStockOnly ? '?lowStock=true' : ''}`)
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [lowStockOnly])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this inventory item?')) return
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const lowCount = items.filter(i => i.currentStock <= i.reorderLevel).length
  const totalValue = items.reduce((s, i) => s + i.currentStock * i.costPerUnit, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Stock levels and costs</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/movements" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Movements</Link>
          <Link href="/inventory/menu" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Menu Items</Link>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">+ Add Item</button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} className="rounded border-gray-300" />
          Low stock only
        </label>
        {lowCount > 0 && (
          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">{lowCount} item{lowCount !== 1 ? 's' : ''} below reorder level</span>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Items" value={String(items.length)} />
        <SummaryCard label="Low Stock" value={String(lowCount)} colour={lowCount > 0 ? 'text-amber-600' : 'text-gray-900'} />
        <SummaryCard label="Stock Value" value={formatCurrency(totalValue)} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Items</h2>
        </div>
        {loading ? <Loader /> : items.length === 0 ? <Empty text="No inventory items found." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {['Item', 'Unit', 'Current Stock', 'Reorder Level', 'Cost / Unit', 'Stock Value', 'Status', ''].map(h => (
                <th key={h} className={`px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide ${['Current Stock', 'Reorder Level', 'Cost / Unit', 'Stock Value'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => {
                const isLow = item.currentStock <= item.reorderLevel
                return (
                  <tr key={item.id} className={`hover:bg-gray-50 ${isLow ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-6 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-3 text-gray-600">{item.unit}</td>
                    <td className={`px-6 py-3 text-right font-medium ${isLow ? 'text-amber-600' : 'text-gray-900'}`}>{item.currentStock}</td>
                    <td className="px-6 py-3 text-right text-gray-500">{item.reorderLevel}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{formatCurrency(item.costPerUnit)}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(item.currentStock * item.costPerUnit)}</td>
                    <td className="px-6 py-3">
                      {isLow
                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Low</span>
                        : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">OK</span>
                      }
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => { setEditing(item); setShowForm(true) }} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                        <button onClick={() => handleDelete(item.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <InventoryModal item={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData() }} />}
    </div>
  )
}

function InventoryModal({ item, onClose, onSaved }: { item: InventoryItem | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [unit, setUnit] = useState(item?.unit ?? '')
  const [currentStock, setCurrentStock] = useState(item?.currentStock.toString() ?? '0')
  const [reorderLevel, setReorderLevel] = useState(item?.reorderLevel.toString() ?? '')
  const [costPerUnit, setCostPerUnit] = useState(item?.costPerUnit.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch(item ? `/api/inventory/${item.id}` : '/api/inventory', {
      method: item ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, unit, currentStock, reorderLevel, costPerUnit }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={item ? 'Edit Item' : 'Add Inventory Item'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Name"><input type="text" value={name} onChange={e => setName(e.target.value)} required className={INPUT} /></FormRow>
        <FormRow label="Unit (e.g. kg, litres, pcs)"><input type="text" value={unit} onChange={e => setUnit(e.target.value)} required className={INPUT} /></FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Current stock"><input type="number" step="0.01" value={currentStock} onChange={e => setCurrentStock(e.target.value)} required className={INPUT} /></FormRow>
          <FormRow label="Reorder level"><input type="number" step="0.01" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} required className={INPUT} /></FormRow>
        </div>
        <FormRow label="Cost per unit (£)"><input type="number" step="0.0001" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} required className={INPUT} /></FormRow>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ModalActions onClose={onClose} saving={saving} label={item ? 'Update' : 'Add Item'} />
      </form>
    </Modal>
  )
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm'
function FormRow({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-sm text-gray-700 mb-1">{label}</label>{children}</div> }
function SummaryCard({ label, value, colour = 'text-gray-900' }: { label: string; value: string; colour?: string }) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p><p className={`text-2xl font-bold mt-1 ${colour}`}>{value}</p></div>
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}><div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}><h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>{children}</div></div>
}
function ModalActions({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) {
  return <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Saving…' : label}</button></div>
}
function Loader() { return <div className="p-8 text-center text-sm text-gray-400">Loading…</div> }
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-sm text-gray-400">{text}</div> }
