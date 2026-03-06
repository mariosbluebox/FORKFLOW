'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import Link from 'next/link'

interface MenuItem {
  id: string
  name: string
  category: string
  sellingPrice: number
  foodCostTarget: number
}

function foodCostPct(item: MenuItem): number {
  if (!item.sellingPrice) return 0
  return (item.foodCostTarget / item.sellingPrice) * 100
}

function foodCostColour(pct: number): string {
  if (pct < 30) return 'text-green-600 bg-green-50'
  if (pct < 40) return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

export default function MenuItemsPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('ALL')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/inventory/menu')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this menu item?')) return
    await fetch(`/api/inventory/menu/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const categories = Array.from(new Set(items.map(i => i.category))).sort()
  const filtered = categoryFilter === 'ALL' ? items : items.filter(i => i.category === categoryFilter)
  const avgFoodCost = filtered.length ? filtered.reduce((s, i) => s + foodCostPct(i), 0) / filtered.length : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Items</h1>
          <p className="text-sm text-gray-500 mt-1">Food cost % by item</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Inventory</Link>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">+ Add Item</button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-end">
        <Field label="Category">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Menu Items" value={String(filtered.length)} />
        <SummaryCard label="Avg Food Cost %" value={formatPercent(avgFoodCost)} colour={avgFoodCost < 30 ? 'text-green-600' : avgFoodCost < 40 ? 'text-amber-600' : 'text-red-600'} />
        <SummaryCard label="Items Above 30%" value={String(filtered.filter(i => foodCostPct(i) >= 30).length)} colour={filtered.filter(i => foodCostPct(i) >= 30).length > 0 ? 'text-amber-600' : 'text-gray-900'} />
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Under 30% — Good</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> 30–40% — Monitor</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Over 40% — High</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Items</h2>
        </div>
        {loading ? <Loader /> : filtered.length === 0 ? <Empty text="No menu items found." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {['Item', 'Category', 'Selling Price', 'Food Cost Target', 'Food Cost %', ''].map(h => (
                <th key={h} className={`px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide ${['Selling Price', 'Food Cost Target', 'Food Cost %'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(item => {
                const pct = foodCostPct(item)
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-3 text-gray-600">{item.category}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(item.sellingPrice)}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{formatCurrency(item.foodCostTarget)}</td>
                    <td className="px-6 py-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${foodCostColour(pct)}`}>
                        {formatPercent(pct)}
                      </span>
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

      {showForm && <MenuItemModal item={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData() }} />}
    </div>
  )
}

function MenuItemModal({ item, onClose, onSaved }: { item: MenuItem | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item?.category ?? '')
  const [sellingPrice, setSellingPrice] = useState(item?.sellingPrice.toString() ?? '')
  const [foodCostTarget, setFoodCostTarget] = useState(item?.foodCostTarget.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const previewPct = sellingPrice && foodCostTarget ? (parseFloat(foodCostTarget) / parseFloat(sellingPrice)) * 100 : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch(item ? `/api/inventory/menu/${item.id}` : '/api/inventory/menu', {
      method: item ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, sellingPrice, foodCostTarget }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={item ? 'Edit Menu Item' : 'Add Menu Item'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Name"><input type="text" value={name} onChange={e => setName(e.target.value)} required className={INPUT} /></FormRow>
        <FormRow label="Category (e.g. Burgers, Sides, Drinks)"><input type="text" value={category} onChange={e => setCategory(e.target.value)} required className={INPUT} /></FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Selling price (£)"><input type="number" step="0.01" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} required className={INPUT} /></FormRow>
          <FormRow label="Food cost target (£)"><input type="number" step="0.01" value={foodCostTarget} onChange={e => setFoodCostTarget(e.target.value)} required className={INPUT} /></FormRow>
        </div>
        {previewPct != null && (
          <p className={`text-sm font-medium ${previewPct < 30 ? 'text-green-600' : previewPct < 40 ? 'text-amber-600' : 'text-red-600'}`}>
            Food cost: {formatPercent(previewPct)} {previewPct < 30 ? '— Good' : previewPct < 40 ? '— Monitor' : '— High'}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ModalActions onClose={onClose} saving={saving} label={item ? 'Update' : 'Add Item'} />
      </form>
    </Modal>
  )
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm'
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="text-xs text-gray-500 block mb-1">{label}</label>{children}</div> }
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
