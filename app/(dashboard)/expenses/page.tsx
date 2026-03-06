'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Category { id: string; name: string; colour: string }
interface Entry { id: string; date: string; category: Category; supplier: string | null; description: string; netAmount: number; vatAmount: number; grossAmount: number; vatReclaimable: boolean }

function thisMonthDates() {
  const now = new Date()
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
}

export default function ExpensesPage() {
  const defaults = thisMonthDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [categoryId, setCategoryId] = useState('ALL')
  const [entries, setEntries] = useState<Entry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [summary, setSummary] = useState({ grossAmount: 0, vatAmount: 0, netAmount: 0 })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/expenses/categories')
    if (res.ok) setCategories(await res.json())
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/expenses?from=${from}&to=${to}&categoryId=${categoryId}`)
    if (res.ok) {
      const d = await res.json()
      setEntries(d.entries)
      setSummary({ grossAmount: d.summary.grossAmount ?? 0, vatAmount: d.summary.vatAmount ?? 0, netAmount: d.summary.netAmount ?? 0 })
      setTotal(d.total)
    }
    setLoading(false)
  }, [from, to, categoryId])

  useEffect(() => { fetchCategories() }, [fetchCategories])
  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    fetchData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-1">All business expenses</p>
        </div>
        <div className="flex gap-2">
          <Link href="/expenses/categories" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Categories</Link>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">+ Add Expense</button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <Field label="From"><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></Field>
        <Field label="To"><input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></Field>
        <Field label="Category">
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Gross" value={formatCurrency(summary.grossAmount)} />
        <SummaryCard label="VAT Paid" value={formatCurrency(summary.vatAmount)} colour="text-amber-600" />
        <SummaryCard label="Net Expenses" value={formatCurrency(summary.netAmount)} colour="text-red-600" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Entries <span className="text-gray-400 font-normal text-sm">({total})</span></h2>
        </div>
        {loading ? <Loader /> : entries.length === 0 ? <Empty text="No expenses for this period." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {['Date', 'Category', 'Description', 'Supplier', 'Net', 'VAT', 'Gross', 'VAT Rec.', ''].map(h => (
                <th key={h} className={`px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide ${['Net', 'VAT', 'Gross'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-900 whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.category.colour }} />
                      {e.category.name}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-700 max-w-[160px] truncate">{e.description}</td>
                  <td className="px-6 py-3 text-gray-500">{e.supplier ?? '—'}</td>
                  <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(e.netAmount)}</td>
                  <td className="px-6 py-3 text-right text-amber-600">{formatCurrency(e.vatAmount)}</td>
                  <td className="px-6 py-3 text-right text-gray-900 font-medium">{formatCurrency(e.grossAmount)}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`text-xs font-medium ${e.vatReclaimable ? 'text-green-600' : 'text-gray-400'}`}>{e.vatReclaimable ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => { setEditing(e); setShowForm(true) }} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <ExpenseModal entry={editing} categories={categories} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData() }} />}
    </div>
  )
}

function ExpenseModal({ entry, categories, onClose, onSaved }: { entry: Entry | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(entry?.date.split('T')[0] ?? today)
  const [categoryId, setCategoryId] = useState(entry?.category.id ?? categories[0]?.id ?? '')
  const [supplier, setSupplier] = useState(entry?.supplier ?? '')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [netAmount, setNetAmount] = useState(entry?.netAmount.toString() ?? '')
  const [vatAmount, setVatAmount] = useState(entry?.vatAmount.toString() ?? '')
  const [grossAmount, setGrossAmount] = useState(entry?.grossAmount.toString() ?? '')
  const [vatReclaimable, setVatReclaimable] = useState(entry?.vatReclaimable !== false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateFromNet = (net: string) => {
    setNetAmount(net)
    const n = parseFloat(net) || 0
    const vat = parseFloat(vatAmount) || 0
    setGrossAmount((n + vat).toFixed(2))
  }
  const updateFromVat = (vat: string) => {
    setVatAmount(vat)
    const n = parseFloat(netAmount) || 0
    const v = parseFloat(vat) || 0
    setGrossAmount((n + v).toFixed(2))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch(entry ? `/api/expenses/${entry.id}` : '/api/expenses', {
      method: entry ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, categoryId, supplier, description, netAmount, vatAmount, grossAmount, vatReclaimable }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to save'); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={entry ? 'Edit Expense' : 'Add Expense'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} required className={INPUT} /></FormRow>
          <FormRow label="Category">
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={INPUT}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormRow>
        </div>
        <FormRow label="Description"><input type="text" value={description} onChange={e => setDescription(e.target.value)} required className={INPUT} /></FormRow>
        <FormRow label="Supplier (optional)"><input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} className={INPUT} /></FormRow>
        <div className="grid grid-cols-3 gap-3">
          <FormRow label="Net (£)"><input type="number" step="0.01" value={netAmount} onChange={e => updateFromNet(e.target.value)} required className={INPUT} /></FormRow>
          <FormRow label="VAT (£)"><input type="number" step="0.01" value={vatAmount} onChange={e => updateFromVat(e.target.value)} className={INPUT} /></FormRow>
          <FormRow label="Gross (£)"><input type="number" step="0.01" value={grossAmount} onChange={e => setGrossAmount(e.target.value)} required className={INPUT} /></FormRow>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={vatReclaimable} onChange={e => setVatReclaimable(e.target.checked)} className="rounded border-gray-300" />
          VAT reclaimable
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ModalActions onClose={onClose} saving={saving} label={entry ? 'Update' : 'Add Expense'} />
      </form>
    </Modal>
  )
}

// Shared primitives
const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm'
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="text-xs text-gray-500 block mb-1">{label}</label>{children}</div> }
function FormRow({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-sm text-gray-700 mb-1">{label}</label>{children}</div> }
function SummaryCard({ label, value, colour = 'text-gray-900' }: { label: string; value: string; colour?: string }) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p><p className={`text-2xl font-bold mt-1 ${colour}`}>{value}</p></div>
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}><div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}><h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>{children}</div></div>
}
function ModalActions({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) {
  return <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Saving…' : label}</button></div>
}
function Loader() { return <div className="p-8 text-center text-sm text-gray-400">Loading…</div> }
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-sm text-gray-400">{text}</div> }
