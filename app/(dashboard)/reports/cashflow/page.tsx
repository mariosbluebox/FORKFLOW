'use client'

import { useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts'

interface Week { weekStart: string; moneyIn: number; moneyOut: number; net: number }
interface CashflowData {
  period: { from: string; to: string }
  weeks: Week[]
  totalIn: number
  totalOut: number
  netCashFlow: number
}

function thisMonthDates() {
  const now = new Date()
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
}

function fmtWeek(iso: string) {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
}

export default function CashflowPage() {
  const defaults = thisMonthDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [data, setData] = useState<CashflowData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reports/cashflow?from=${from}&to=${to}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
    setFetched(true)
  }, [from, to])

  const chartData = data?.weeks.map(w => ({
    week: fmtWeek(w.weekStart),
    'Money In': parseFloat(w.moneyIn.toFixed(2)),
    'Money Out': parseFloat(w.moneyOut.toFixed(2)),
    'Net': parseFloat(w.net.toFixed(2)),
  })) ?? []

  const netColour = data ? (data.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-900'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cash Flow</h1>
          <p className="text-sm text-gray-500 mt-1">Weekly money in vs. out</p>
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
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard label="Total In" value={formatCurrency(data.totalIn)} colour="text-green-600" />
            <SummaryCard label="Total Out" value={formatCurrency(data.totalOut)} colour="text-red-600" />
            <SummaryCard label="Net Cash Flow" value={formatCurrency(data.netCashFlow)} colour={netColour} />
          </div>

          {/* Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Weekly Cash Flow</h2>
            {chartData.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8">No data for this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
                  <Tooltip
                    formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name ?? '')] as [string, string]}
                    contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: '12px' }} />
                  <ReferenceLine y={0} stroke="#e5e7eb" />
                  <Bar dataKey="Money In" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Money Out" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Weekly Detail</h2>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {['Week Starting', 'Money In', 'Money Out', 'Net'].map(h => (
                  <th key={h} className={`px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide ${h !== 'Week Starting' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {data.weeks.map(w => (
                  <tr key={w.weekStart} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-700">{fmtWeek(w.weekStart)}</td>
                    <td className="px-6 py-3 text-right text-green-600">{formatCurrency(w.moneyIn)}</td>
                    <td className="px-6 py-3 text-right text-red-500">{formatCurrency(w.moneyOut)}</td>
                    <td className={`px-6 py-3 text-right font-medium ${w.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(w.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
