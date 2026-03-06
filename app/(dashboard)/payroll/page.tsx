'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils'
import Link from 'next/link'

interface Employee { id: string; name: string; type: string; hourlyRate: number | null; monthlySalary: number | null; isActive: boolean }
interface Entry { id: string; employee: Employee; periodStart: string; periodEnd: string; hoursWorked: number | null; grossPay: number; employerNI: number; notes: string | null }

function thisMonthDates() {
  const now = new Date()
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
}

export default function PayrollPage() {
  const defaults = thisMonthDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [entries, setEntries] = useState<Entry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [summary, setSummary] = useState({ grossPay: 0, employerNI: 0 })
  const [labourPct, setLabourPct] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [payRes, empRes] = await Promise.all([
      fetch(`/api/payroll?from=${from}&to=${to}`),
      fetch('/api/employees?active=true'),
    ])
    if (payRes.ok) {
      const d = await payRes.json()
      setEntries(d.entries)
      setSummary({ grossPay: d.summary.grossPay ?? 0, employerNI: d.summary.employerNI ?? 0 })
    }
    if (empRes.ok) setEmployees(await empRes.json())
    setLoading(false)
  }, [from, to])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payroll entry?')) return
    await fetch(`/api/payroll/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const total = summary.grossPay + summary.employerNI

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">Staff wages and employer costs</p>
        </div>
        <div className="flex gap-2">
          <Link href="/payroll/employees" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Employees</Link>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">+ Log Pay Period</button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <Field label="From"><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></Field>
        <Field label="To"><input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></Field>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Gross Wages" value={formatCurrency(summary.grossPay)} />
        <SummaryCard label="Employer NI" value={formatCurrency(summary.employerNI)} colour="text-amber-600" />
        <SummaryCard label="Total Cost" value={formatCurrency(total)} colour="text-red-600" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Pay periods</h2>
        </div>
        {loading ? <Loader /> : entries.length === 0 ? <Empty text="No payroll entries for this period." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {['Employee', 'Period', 'Hours', 'Gross Pay', 'Employer NI', 'Total', 'Notes', ''].map(h => (
                <th key={h} className={`px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide ${['Gross Pay', 'Employer NI', 'Total'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-900">{e.employee.name}</p>
                    <p className="text-xs text-gray-400">{e.employee.type}</p>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{formatDate(e.periodStart)} – {formatDate(e.periodEnd)}</td>
                  <td className="px-6 py-3 text-gray-600">{e.hoursWorked ?? '—'}</td>
                  <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(e.grossPay)}</td>
                  <td className="px-6 py-3 text-right text-amber-600">{formatCurrency(e.employerNI)}</td>
                  <td className="px-6 py-3 text-right font-medium text-gray-900">{formatCurrency(e.grossPay + e.employerNI)}</td>
                  <td className="px-6 py-3 text-gray-500 max-w-[120px] truncate">{e.notes ?? '—'}</td>
                  <td className="px-6 py-3"><button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <PayrollModal employees={employees} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData() }} />}
    </div>
  )
}

function PayrollModal({ employees, onClose, onSaved }: { employees: Employee[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '')
  const [periodStart, setPeriodStart] = useState(weekAgo)
  const [periodEnd, setPeriodEnd] = useState(today)
  const [hoursWorked, setHoursWorked] = useState('')
  const [grossPay, setGrossPay] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedEmp = employees.find(e => e.id === employeeId)

  // Auto-fill gross pay for hourly employees
  const autoFill = () => {
    if (selectedEmp?.type === 'HOURLY' && selectedEmp.hourlyRate && hoursWorked) {
      setGrossPay((selectedEmp.hourlyRate * parseFloat(hoursWorked)).toFixed(2))
    } else if (selectedEmp?.type === 'SALARIED' && selectedEmp.monthlySalary) {
      setGrossPay(selectedEmp.monthlySalary.toFixed(2))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, periodStart, periodEnd, hoursWorked: hoursWorked || null, grossPay, notes }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Log Pay Period</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm text-gray-700 mb-1">Employee</label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className={INPUT}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.type})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm text-gray-700 mb-1">Period start</label><input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} required className={INPUT} /></div>
            <div><label className="block text-sm text-gray-700 mb-1">Period end</label><input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} required className={INPUT} /></div>
          </div>
          {selectedEmp?.type === 'HOURLY' && (
            <div><label className="block text-sm text-gray-700 mb-1">Hours worked</label>
              <input type="number" step="0.5" value={hoursWorked} onChange={e => setHoursWorked(e.target.value)} onBlur={autoFill} className={INPUT} placeholder="e.g. 40" />
            </div>
          )}
          <div><label className="block text-sm text-gray-700 mb-1">Gross pay (£)</label>
            <div className="flex gap-2">
              <input type="number" step="0.01" value={grossPay} onChange={e => setGrossPay(e.target.value)} required className={INPUT} placeholder="0.00" />
              <button type="button" onClick={autoFill} className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 whitespace-nowrap">Auto-fill</button>
            </div>
            {selectedEmp?.type === 'HOURLY' && selectedEmp.hourlyRate && <p className="text-xs text-gray-400 mt-1">Rate: £{selectedEmp.hourlyRate}/hr</p>}
          </div>
          <div><label className="block text-sm text-gray-700 mb-1">Notes (optional)</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} className={INPUT} /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700">Cancel</button>
            <button type="submit" disabled={saving || employees.length === 0} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Log Pay Period'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm'
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="text-xs text-gray-500 block mb-1">{label}</label>{children}</div> }
function SummaryCard({ label, value, colour = 'text-gray-900' }: { label: string; value: string; colour?: string }) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p><p className={`text-2xl font-bold mt-1 ${colour}`}>{value}</p></div>
}
function Loader() { return <div className="p-8 text-center text-sm text-gray-400">Loading…</div> }
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-sm text-gray-400">{text}</div> }
