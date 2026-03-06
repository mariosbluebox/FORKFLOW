'use client'

import { useState, useCallback } from 'react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import Link from 'next/link'

interface RevenueSource { source: string; _sum: { grossAmount: number | null; vatAmount: number | null; netAmount: number | null } }
interface ExpenseCategory { name: string; colour: string; net: number; vat: number; gross: number; reclaimable: number }
interface PLData {
  period: { from: string; to: string }
  revenue: { bySource: RevenueSource[]; totalGross: number; totalVat: number; totalNet: number }
  expenses: { byCategory: ExpenseCategory[]; totalNet: number }
  payroll: { grossPay: number; employerNI: number; total: number }
  netProfit: number
  labourPct: number
}

function thisMonthDates() {
  const now = new Date()
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
}

export default function PLPage() {
  const defaults = thisMonthDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [data, setData] = useState<PLData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reports/pl?from=${from}&to=${to}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
    setFetched(true)
  }, [from, to])

  const profitColour = data ? (data.netProfit >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-900'
  const marginPct = data && data.revenue.totalNet > 0 ? (data.netProfit / data.revenue.totalNet) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profit & Loss</h1>
          <p className="text-sm text-gray-500 mt-1">Revenue minus all costs</p>
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
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard label="Net Revenue" value={formatCurrency(data.revenue.totalNet)} />
            <SummaryCard label="Total Expenses" value={formatCurrency(data.expenses.totalNet)} colour="text-red-600" />
            <SummaryCard label="Payroll Cost" value={formatCurrency(data.payroll.total)} colour="text-amber-600" />
            <SummaryCard label="Net Profit" value={formatCurrency(data.netProfit)} colour={profitColour} />
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Revenue breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Revenue by Source</h2>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide text-left">Source</th>
                  <th className="px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide text-right">Gross</th>
                  <th className="px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide text-right">VAT</th>
                  <th className="px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide text-right">Net</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {data.revenue.bySource.map(r => (
                    <tr key={r.source} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-700">{r.source}</td>
                      <td className="px-6 py-3 text-right text-gray-700">{formatCurrency(r._sum.grossAmount ?? 0)}</td>
                      <td className="px-6 py-3 text-right text-amber-600">{formatCurrency(r._sum.vatAmount ?? 0)}</td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900">{formatCurrency(r._sum.netAmount ?? 0)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-6 py-3 text-gray-900">Total</td>
                    <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(data.revenue.totalGross)}</td>
                    <td className="px-6 py-3 text-right text-amber-600">{formatCurrency(data.revenue.totalVat)}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(data.revenue.totalNet)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Expenses breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Expenses by Category</h2>
              </div>
              {data.expenses.byCategory.length === 0 ? (
                <div className="p-6 text-sm text-gray-400 text-center">No expenses for this period.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className="px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide text-left">Category</th>
                    <th className="px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide text-right">Net</th>
                    <th className="px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide text-right">VAT</th>
                    <th className="px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide text-right">Gross</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.expenses.byCategory.map(c => (
                      <tr key={c.name} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-700">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.colour }} />
                            {c.name}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right text-gray-700">{formatCurrency(c.net)}</td>
                        <td className="px-6 py-3 text-right text-amber-600">{formatCurrency(c.vat)}</td>
                        <td className="px-6 py-3 text-right font-medium text-gray-900">{formatCurrency(c.gross)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-6 py-3 text-gray-900">Total</td>
                      <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(data.expenses.totalNet)}</td>
                      <td className="px-6 py-3 text-right" />
                      <td className="px-6 py-3 text-right" />
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* P&L Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">P&L Summary</h2>
            </div>
            <div className="p-6 space-y-2 text-sm">
              <Row label="Net Revenue" value={formatCurrency(data.revenue.totalNet)} bold />
              <Row label="Total Expenses (net)" value={`− ${formatCurrency(data.expenses.totalNet)}`} colour="text-red-600" />
              <Row label="Payroll (gross + NI)" value={`− ${formatCurrency(data.payroll.total)}`} colour="text-red-600" />
              <div className="border-t border-gray-100 pt-2 mt-2">
                <Row label="Net Profit" value={formatCurrency(data.netProfit)} bold colour={profitColour} />
                <Row label="Profit Margin" value={formatPercent(marginPct)} colour={marginPct >= 0 ? 'text-green-600' : 'text-red-600'} />
                <Row label="Labour Cost %" value={formatPercent(data.labourPct)} colour={data.labourPct < 30 ? 'text-green-600' : 'text-amber-600'} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, value, bold, colour = 'text-gray-900' }: { label: string; value: string; bold?: boolean; colour?: string }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-gray-600">{label}</span>
      <span className={colour}>{value}</span>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="text-xs text-gray-500 block mb-1">{label}</label>{children}</div> }
function SummaryCard({ label, value, colour = 'text-gray-900' }: { label: string; value: string; colour?: string }) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p><p className={`text-2xl font-bold mt-1 ${colour}`}>{value}</p></div>
}
