'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Employee {
  id: string
  name: string
  type: 'HOURLY' | 'SALARIED'
  hourlyRate: number | null
  monthlySalary: number | null
  startDate: string
  endDate: string | null
  isActive: boolean
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/employees')
    if (res.ok) setEmployees(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this employee? They will be soft-deleted.')) return
    await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const filtered = showInactive ? employees : employees.filter(e => e.isActive)
  const active = employees.filter(e => e.isActive).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-1">Staff directory</p>
        </div>
        <div className="flex gap-2">
          <Link href="/payroll" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Payroll</Link>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">+ Add Employee</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Active Staff" value={String(active)} />
        <SummaryCard label="Hourly Workers" value={String(employees.filter(e => e.isActive && e.type === 'HOURLY').length)} />
        <SummaryCard label="Salaried Staff" value={String(employees.filter(e => e.isActive && e.type === 'SALARIED').length)} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Staff</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded border-gray-300" />
            Show inactive
          </label>
        </div>
        {loading ? <Loader /> : filtered.length === 0 ? <Empty text="No employees found." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {['Name', 'Type', 'Rate', 'Start Date', 'Status', ''].map(h => (
                <th key={h} className="px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{e.name}</td>
                  <td className="px-6 py-3 text-gray-600">{e.type === 'HOURLY' ? 'Hourly' : 'Salaried'}</td>
                  <td className="px-6 py-3 text-gray-600">
                    {e.type === 'HOURLY' && e.hourlyRate != null ? `£${e.hourlyRate}/hr` : e.monthlySalary != null ? `£${e.monthlySalary}/mo` : '—'}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{formatDate(e.startDate)}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${e.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {e.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => { setEditing(e); setShowForm(true) }} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                      {e.isActive && <button onClick={() => handleDeactivate(e.id)} className="text-xs text-red-500 hover:text-red-700">Deactivate</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <EmployeeModal employee={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData() }} />}
    </div>
  )
}

function EmployeeModal({ employee, onClose, onSaved }: { employee: Employee | null; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [name, setName] = useState(employee?.name ?? '')
  const [type, setType] = useState<'HOURLY' | 'SALARIED'>(employee?.type ?? 'HOURLY')
  const [hourlyRate, setHourlyRate] = useState(employee?.hourlyRate?.toString() ?? '')
  const [monthlySalary, setMonthlySalary] = useState(employee?.monthlySalary?.toString() ?? '')
  const [startDate, setStartDate] = useState(employee?.startDate?.split('T')[0] ?? today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body: Record<string, unknown> = { name, type, startDate }
    if (type === 'HOURLY') body.hourlyRate = hourlyRate || null
    else body.monthlySalary = monthlySalary || null
    if (employee) { body.isActive = employee.isActive; body.endDate = employee.endDate }
    const res = await fetch(employee ? `/api/employees/${employee.id}` : '/api/employees', {
      method: employee ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={employee ? 'Edit Employee' : 'Add Employee'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Full name"><input type="text" value={name} onChange={e => setName(e.target.value)} required className={INPUT} /></FormRow>
        <FormRow label="Type">
          <select value={type} onChange={e => setType(e.target.value as 'HOURLY' | 'SALARIED')} className={INPUT}>
            <option value="HOURLY">Hourly</option>
            <option value="SALARIED">Salaried</option>
          </select>
        </FormRow>
        {type === 'HOURLY'
          ? <FormRow label="Hourly rate (£)"><input type="number" step="0.01" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} className={INPUT} placeholder="e.g. 12.00" /></FormRow>
          : <FormRow label="Monthly salary (£)"><input type="number" step="0.01" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} className={INPUT} placeholder="e.g. 2500.00" /></FormRow>
        }
        <FormRow label="Start date"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className={INPUT} /></FormRow>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ModalActions onClose={onClose} saving={saving} label={employee ? 'Update' : 'Add Employee'} />
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
