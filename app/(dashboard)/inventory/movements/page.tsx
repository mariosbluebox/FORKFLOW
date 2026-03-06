'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

interface InventoryItem { id: string; name: string; unit: string }
interface Movement {
  id: string
  type: 'IN' | 'OUT' | 'WASTE' | 'ADJUSTMENT'
  quantity: number
  costPerUnit: number | null
  totalCost: number | null
  date: string
  notes: string | null
  inventoryItem: InventoryItem
}

const TYPE_LABELS: Record<string, string> = { IN: 'Stock In', OUT: 'Used', WASTE: 'Waste', ADJUSTMENT: 'Adjustment' }
const TYPE_COLOURS: Record<string, string> = { IN: 'bg-green-50 text-green-700', OUT: 'bg-blue-50 text-blue-700', WASTE: 'bg-red-50 text-red-700', ADJUSTMENT: 'bg-gray-100 text-gray-700' }

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [itemId, setItemId] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetch('/api/inventory').then(r => r.ok ? r.json() : []).then(setItems)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const url = itemId !== 'ALL' ? `/api/inventory/movements?itemId=${itemId}` : '/api/inventory/movements'
    const res = await fetch(url)
    if (res.ok) setMovements(await res.json())
    setLoading(false)
  }, [itemId])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Movements</h1>
          <p className="text-sm text-gray-500 mt-1">Last 100 movements</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Inventory</Link>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">+ Log Movement</button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-end">
        <Field label="Item">
          <select value={itemId} onChange={e => setItemId(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="ALL">All Items</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Movements</h2>
        </div>
        {loading ? <Loader /> : movements.length === 0 ? <Empty text="No movements recorded." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {['Date', 'Item', 'Type', 'Quantity', 'Cost/Unit', 'Total Cost', 'Notes'].map(h => (
                <th key={h} className={`px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide ${['Quantity', 'Cost/Unit', 'Total Cost'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {movements.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-900 whitespace-nowrap">{formatDate(m.date)}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{m.inventoryItem.name} <span className="text-gray-400 font-normal">({m.inventoryItem.unit})</span></td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOURS[m.type] ?? 'bg-gray-100 text-gray-700'}`}>
                      {TYPE_LABELS[m.type] ?? m.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-gray-900">{m.quantity}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{m.costPerUnit != null ? formatCurrency(m.costPerUnit) : '—'}</td>
                  <td className="px-6 py-3 text-right text-gray-900">{m.totalCost != null ? formatCurrency(m.totalCost) : '—'}</td>
                  <td className="px-6 py-3 text-gray-500 max-w-[160px] truncate">{m.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <MovementModal items={items} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData() }} />}
    </div>
  )
}

function MovementModal({ items, onClose, onSaved }: { items: InventoryItem[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [inventoryItemId, setInventoryItemId] = useState(items[0]?.id ?? '')
  const [type, setType] = useState<'IN' | 'OUT' | 'WASTE' | 'ADJUSTMENT'>('IN')
  const [quantity, setQuantity] = useState('')
  const [costPerUnit, setCostPerUnit] = useState('')
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/inventory/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventoryItemId, type, quantity, costPerUnit: costPerUnit || null, date, notes }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title="Log Stock Movement" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Item">
          <select value={inventoryItemId} onChange={e => setInventoryItemId(e.target.value)} className={INPUT}>
            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Type">
            <select value={type} onChange={e => setType(e.target.value as typeof type)} className={INPUT}>
              <option value="IN">Stock In</option>
              <option value="OUT">Used</option>
              <option value="WASTE">Waste</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </FormRow>
          <FormRow label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} required className={INPUT} /></FormRow>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Quantity"><input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} required className={INPUT} /></FormRow>
          <FormRow label="Cost/unit (£) optional"><input type="number" step="0.0001" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} className={INPUT} /></FormRow>
        </div>
        <FormRow label="Notes (optional)"><input type="text" value={notes} onChange={e => setNotes(e.target.value)} className={INPUT} /></FormRow>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ModalActions onClose={onClose} saving={saving} label="Log Movement" />
      </form>
    </Modal>
  )
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm'
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="text-xs text-gray-500 block mb-1">{label}</label>{children}</div> }
function FormRow({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-sm text-gray-700 mb-1">{label}</label>{children}</div> }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}><div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}><h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>{children}</div></div>
}
function ModalActions({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) {
  return <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Saving…' : label}</button></div>
}
function Loader() { return <div className="p-8 text-center text-sm text-gray-400">Loading…</div> }
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-sm text-gray-400">{text}</div> }
