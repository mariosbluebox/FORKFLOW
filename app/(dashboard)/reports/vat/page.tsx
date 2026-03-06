'use client'

import { useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface VATData {
  period: { from: string; to: string }
  vatOnSales: number
  vatOnExpenses: number
  reclaimableVat: number
  nonReclaimableVat: number
  netVatLiability: number
  grossRevenue: number
  netRevenue: number
}

function thisMonthDates() {
  const now = new Date()
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: now.toISOString().split('T')[0] }
}

export default function VATPage() {
  const defaults = thisMonthDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [data, setData] = useState<VATData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reports/vat?from=${from}&to=${to}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
    setFetched(true)
  }, [from, to])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">VAT Summary</h1>
          <p className="text-sm text-gray-500 mt-1">UK VAT position for any period</p>
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
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard label="VAT on Sales" value={formatCurrency(data.vatOnSales)} colour="text-indigo-600" />
            <SummaryCard label="Reclaimable Input VAT" value={formatCurrency(data.reclaimableVat)} colour="text-green-600" />
            <SummaryCard
              label="Net VAT Liability"
              value={formatCurrency(data.netVatLiability)}
              colour={data.netVatLiability >= 0 ? 'text-red-600' : 'text-green-600'}
            />
          </div>

          {/* Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">VAT Breakdown</h2>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <Section title="Output VAT (Sales)">
                <Row label="Gross Revenue" value={formatCurrency(data.grossRevenue)} />
                <Row label="Net Revenue" value={formatCurrency(data.netRevenue)} />
                <Row label="VAT Collected on Sales" value={formatCurrency(data.vatOnSales)} bold colour="text-indigo-600" />
              </Section>

              <div className="border-t border-gray-100 pt-3">
                <Section title="Input VAT (Expenses)">
                  <Row label="Total VAT on Expenses" value={formatCurrency(data.vatOnExpenses)} />
                  <Row label="Reclaimable VAT" value={formatCurrency(data.reclaimableVat)} colour="text-green-600" />
                  <Row label="Non-reclaimable VAT" value={formatCurrency(data.nonReclaimableVat)} colour="text-gray-500" />
                </Section>
              </div>

              <div className="border-t-2 border-gray-200 pt-3 mt-1">
                <Row
                  label="Net VAT Due to HMRC"
                  value={formatCurrency(data.netVatLiability)}
                  bold
                  colour={data.netVatLiability >= 0 ? 'text-red-600' : 'text-green-600'}
                />
                {data.netVatLiability < 0 && (
                  <p className="text-xs text-green-600 mt-1">You have a VAT repayment position — HMRC owes you {formatCurrency(Math.abs(data.netVatLiability))}.</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-700">
            UK standard VAT rate 20%. VAT amounts are calculated as gross ÷ 6. This report is for guidance only — always verify with your accountant before filing.
          </div>
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value, bold, colour = 'text-gray-900' }: { label: string; value: string; bold?: boolean; colour?: string }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''}`}>
      <span className="text-gray-600">{label}</span>
      <span className={colour}>{value}</span>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="text-xs text-gray-500 block mb-1">{label}</label>{children}</div> }
function SummaryCard({ label, value, colour = 'text-gray-900' }: { label: string; value: string; colour?: string }) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p><p className={`text-2xl font-bold mt-1 ${colour}`}>{value}</p></div>
}
