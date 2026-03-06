'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatDate, calcVat } from '@/lib/utils'
import Link from 'next/link'

type Source = 'SUMUP' | 'TAKEPAYMENTS' | 'CASH' | 'OTHER'

interface Entry {
  id: string
  date: string
  source: Source
  grossAmount: number
  vatAmount: number
  netAmount: number
  notes: string | null
}

const SOURCE_LABEL: Record<string, string> = { ALL: 'All Sources', SUMUP: 'SumUp', TAKEPAYMENTS: 'TakePayments', CASH: 'Cash', OTHER: 'Other' }
const SOURCE_BADGE: Record<string, string> = { SUMUP: 'bg-blue-100 text-blue-700', TAKEPAYMENTS: 'bg-purple-100 text-purple-700', CASH: 'bg-green-100 text-green-700', OTHER: 'bg-gray-100 text-gray-700' }

function thisMonthDates() {
  const now = new Date()
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
}

export default function RevenuePage() {
  const defaults = thisMonthDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [source, setSource] = useState('ALL')
  const [entries, setEntries] = useState<Entry[]>([])
  const [summary, setSummary] = useState({ grossAmount: 0, vatAmount: 0, netAmount: 0 })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/revenue?from=${from}&to=${to}&source=${source}`)
    if (res.ok) {
      const d = await res.json()
      setEntries(d.entries)
      setSummary({ grossAmount: d.summary.grossAmount ?? 0, vatAmount: d.summary.vatAmount ?? 0, netAmount: d.summary.netAmount ?? 0 })
      setTotal(d.total)
    }
    setLoading(false)
  }, [from, to, source])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return
    await fetch(`/api/revenue/${id}`, { method: 'DELETE' })
    fetchData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
          <p className="text-sm text-gray-500 mt-1">Daily takings from all sources</p>
        </div>
        <div className="flex gap-2">
          <Link href="/revenue/import" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Import CSV</Link>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">+ Add Entry</button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <Field label="From"><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></Field>
        <Field label="To"><input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></Field>
        <Field label="Source">
          <select value={source} onChange={e => setSource(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Gross Takings" value={formatCurrency(summary.grossAmount)} />
        <SummaryCard label="VAT Collected" value={formatCurrency(summary.vatAmount)} colour="text-amber-600" />
        <SummaryCard label="Net Revenue" value={formatCurrency(summary.netAmount)} colour="text-green-600" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Entries <span className="text-gray-400 font-normal text-sm">({total})</span></h2>
        </div>
        {loading ? <Loader /> : entries.length === 0 ? <Empty text="No entries for this period." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">{['Date', 'Source', 'Gross', 'VAT', 'Net', 'Notes', ''].map(h => <th key={h} className={`px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide ${h && h !== 'Notes' && h !== 'Date' && h !== 'Source' ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-900">{formatDate(e.date)}</td>
                  <td className="px-6 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_BADGE[e.source]}`}>{SOURCE_LABEL[e.source]}</span></td>
                  <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(e.grossAmount)}</td>
                  <td className="px-6 py-3 text-right text-amber-600">{formatCurrency(e.vatAmount)}</td>
                  <td className="px-6 py-3 text-right text-green-600 font-medium">{formatCurrency(e.netAmount)}</td>
                  <td className="px-6 py-3 text-gray-500 max-w-[180px] truncate">{e.notes ?? '—'}</td>
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

      {showForm && <RevenueModal entry={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData() }} />}
    </div>
  )
}

function RevenueModal({ entry, onClose, onSaved }: { entry: Entry | null; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(entry?.date.split('T')[0] ?? today)
  const [source, setSource] = useState<Source>(entry?.source ?? 'SUMUP')
  const [gross, setGross] = useState(entry?.grossAmount.toString() ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const grossNum = parseFloat(gross) || 0
  const { vatAmount, netAmount } = calcVat(grossNum)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch(entry ? `/api/revenue/${entry.id}` : '/api/revenue', {
      method: entry ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, source, grossAmount: grossNum, notes }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to save'); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={entry ? 'Edit Entry' : 'Add Revenue Entry'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} required className={INPUT} /></FormRow>
        <FormRow label="Source">
          <select value={source} onChange={e => setSource(e.target.value as Source)} className={INPUT}>
            <option value="SUMUP">SumUp</option><option value="TAKEPAYMENTS">TakePayments</option><option value="CASH">Cash</option><option value="OTHER">Other</option>
          </select>
        </FormRow>
        <FormRow label="Gross Amount (inc. VAT)"><input type="number" step="0.01" min="0.01" value={gross} onChange={e => setGross(e.target.value)} required placeholder="0.00" className={INPUT} /></FormRow>
        {grossNum > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-500"><span>VAT (20%)</span><span>{formatCurrency(vatAmount)}</span></div>
            <div className="flex justify-between font-medium text-gray-900"><span>Net Revenue</span><span>{formatCurrency(netAmount)}</span></div>
          </div>
        )}
        <FormRow label="Notes (optional)"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={INPUT + ' resize-none'} /></FormRow>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ModalActions onClose={onClose} saving={saving} label={entry ? 'Update' : 'Add Entry'} />
      </form>
    </Modal>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────────

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs text-gray-500 block mb-1">{label}</label>{children}</div>
}
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm text-gray-700 mb-1">{label}</label>{children}</div>
}
function SummaryCard({ label, value, colour = 'text-gray-900' }: { label: string; value: string; colour?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colour}`}>{value}</p>
    </div>
  )
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}
function ModalActions({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
      <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Saving…' : label}</button>
    </div>
  )
}
function Loader() { return <div className="p-8 text-center text-sm text-gray-400">Loading…</div> }
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-sm text-gray-400">{text}</div> }
