'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import Link from 'next/link'

interface EmployeeSummary { name: string; type: string; grossPay: number; employerNI: number; hoursWorked: number }
interface PayrollReportData {
  period: { from: string; to: string }
  byEmployee: EmployeeSummary[]
  totalGross: number
  totalNI: number
  totalCost: number
  labourPct: number
  netRevenue: number
}

function thisMonthDates() {
  const now = new Date()
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
}

export default function PayrollReportPage() {
  const defaults = thisMonthDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [data, setData] = useState<PayrollReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reports/payroll?from=${from}&to=${to}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
    setFetched(true)
  }, [from, to])

  const labourColour = data ? (data.labourPct < 30 ? 'text-green-600' : data.labourPct < 40 ? 'text-amber-600' : 'text-red-600') : 'text-gray-900'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Report</h1>
          <p className="text-sm text-gray-500 mt-1">Staff costs and labour percentage</p>
        </div>
        <Link href="/reports" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Reports</Link>
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <Field label="From"><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></Field>
        <Field label="To"><input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></Field>
        <button onClick={fetchData} disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
          {loading ? 'Loading…' : 'Generate'}
        </button>
      </div>

      {!fetched && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-sm text-gray-400">Select a period and click Generate.</div>
      )}

      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard label="Gross Wages" value={formatCurrency(data.totalGross)} />
            <SummaryCard label="Employer NI" value={formatCurrency(data.totalNI)} colour="text-amber-600" />
            <SummaryCard label="Total Cost" value={formatCurrency(data.totalCost)} colour="text-red-600" />
            <SummaryCard label="Labour Cost %" value={formatPercent(data.labourPct)} colour={labourColour} />
          </div>

          {data.netRevenue > 0 && (
            <div className={`rounded-2xl border p-4 text-sm font-medium ${data.labourPct < 30 ? 'bg-green-50 border-green-100 text-green-700' : data.labourPct < 40 ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
              Labour cost is {formatPercent(data.labourPct)} of net revenue.
              {data.labourPct < 30 && ' Within the target range of under 30%.'}
              {data.labourPct >= 30 && data.labourPct < 40 && ' Above the 30% target — review staffing levels.'}
              {data.labourPct >= 40 && ' Significantly above target — action required.'}
            </div>
          )}

          {/* Per-employee table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">By Employee</h2>
            </div>
            {data.byEmployee.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No payroll entries for this period.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  {['Employee', 'Type', 'Hours', 'Gross Pay', 'Employer NI', 'Total Cost', '% of Total'].map(h => (
                    <th key={h} className={`px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide ${['Hours', 'Gross Pay', 'Employer NI', 'Total Cost', '% of Total'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {data.byEmployee.map(e => {
                    const total = e.grossPay + e.employerNI
                    const sharePct = data.totalCost > 0 ? (total / data.totalCost) * 100 : 0
                    return (
                      <tr key={e.name} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium text-gray-900">{e.name}</td>
                        <td className="px-6 py-3 text-gray-600">{e.type === 'HOURLY' ? 'Hourly' : 'Salaried'}</td>
                        <td className="px-6 py-3 text-right text-gray-600">{e.hoursWorked > 0 ? e.hoursWorked : '—'}</td>
                        <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(e.grossPay)}</td>
                        <td className="px-6 py-3 text-right text-amber-600">{formatCurrency(e.employerNI)}</td>
                        <td className="px-6 py-3 text-right font-medium text-gray-900">{formatCurrency(total)}</td>
                        <td className="px-6 py-3 text-right text-gray-500">{formatPercent(sharePct)}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-6 py-3 text-gray-900" colSpan={3}>Total</td>
                    <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(data.totalGross)}</td>
                    <td className="px-6 py-3 text-right text-amber-600">{formatCurrency(data.totalNI)}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(data.totalCost)}</td>
                    <td className="px-6 py-3 text-right text-gray-500">100%</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="text-xs text-gray-500 block mb-1">{label}</label>{children}</div> }
function SummaryCard({ label, value, colour = 'text-gray-900' }: { label: string; value: string; colour?: string }) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p><p className={`text-2xl font-bold mt-1 ${colour}`}>{value}</p></div>
}
