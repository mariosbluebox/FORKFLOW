'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { usePlan } from '@/lib/usePlan'
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Platform {
  id: string
  name: 'UBEREATS' | 'DELIVEROO' | 'JUSTEAT' | 'WALKIN' | 'OTHER'
  commissionRate: number
  isActive: boolean
}

interface Period {
  id: string
  platformId: string
  platform: Platform
  periodStart: string
  periodEnd: string
  orderCount: number
  grossRevenue: number
  commissionCharged: number
  netRevenue: number
  averageOrderValue: number
  currency: string
}

interface Promotion {
  id: string
  platformId: string
  platform: Platform
  periodStart: string
  periodEnd: string
  chargeAmount: number
  promotionType: string
  notes: string | null
}

interface PlatformSummary {
  platformId: string
  platformName: string
  commissionRate: number
  orders: number
  grossRevenue: number
  commissionCharged: number
  netRevenue: number
  avgOrderValue: number
  promotionTotal: number
  foodCost: number
  foodCostPct: number
  allocatedOverhead: number
  netResult: number
  expectancyPerOrder: number | null
  netMarginPct: number | null
  breakEvenOrders: number | null
  promotionROI: number | null
  hasData: boolean
}

interface SummaryData {
  platforms: PlatformSummary[]
  totals: {
    totalOrders: number
    totalRevenue: number
    totalOverhead: number
    foodCostPct: number
    method: string
  }
}

interface OverheadConfig {
  method: 'BY_ORDERS' | 'BY_REVENUE' | 'BY_TIME'
  foodCostPct: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  UBEREATS: 'Uber Eats',
  DELIVEROO: 'Deliveroo',
  JUSTEAT: 'Just Eat',
  WALKIN: 'Walk-in',
  OTHER: 'Other',
}

const PLATFORM_COLOURS: Record<string, string> = {
  UBEREATS: 'bg-black text-white',
  DELIVEROO: 'bg-teal-600 text-white',
  JUSTEAT: 'bg-orange-500 text-white',
  WALKIN: 'bg-indigo-600 text-white',
  OTHER: 'bg-gray-500 text-white',
}

function thisMonthDates() {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  }
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const LABEL = 'block text-xs font-medium text-gray-600 mb-1'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  )
}

function Loader() {
  return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-12 text-gray-400 text-sm">{text}</div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ onClose, saving, label = 'Save' }: { onClose: () => void; saving: boolean; label?: string }) {
  return (
    <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
      <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
      <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
        {saving ? 'Saving…' : label}
      </button>
    </div>
  )
}

// ─── Expectancy badge ─────────────────────────────────────────────────────────

function ExpBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400 text-xs">—</span>
  const pos = value >= 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${pos ? 'text-green-700' : 'text-red-700'}`}>
      {pos ? '✓' : '✗'} {pos ? '+' : ''}{formatCurrency(value)}
    </span>
  )
}

function MarginBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400 text-xs">—</span>
  const pos = value >= 0
  return (
    <span className={`text-xs font-medium ${pos ? 'text-green-700' : 'text-red-700'}`}>
      {pos ? '+' : ''}{formatPercent(value)}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function UpgradeGate() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
      <div className="text-3xl mb-3">🔒</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Platform analytics is a Pro feature</h2>
      <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">
        Track commission, promotions and true profit per order across Uber Eats, Deliveroo and Just Eat.
      </p>
      <Link
        href="/settings/billing"
        className="inline-flex px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
      >
        Upgrade to Pro
      </Link>
    </div>
  )
}

// Gate before mounting the page so Basic users never fire the (403) API calls.
export default function PlatformsPage() {
  const plan = usePlan()
  if (plan.loading) return <Loader />
  if (!plan.can('platforms')) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Delivery platform performance &amp; ROI</p>
        </div>
        <UpgradeGate />
      </div>
    )
  }
  return <PlatformsContent />
}

function PlatformsContent() {
  const defaults = thisMonthDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [activeTab, setActiveTab] = useState<string>('overview')

  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [config, setConfig] = useState<OverheadConfig>({ method: 'BY_ORDERS', foodCostPct: 0.28 })

  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)

  // Modals
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null)
  const [showPromoForm, setShowPromoForm] = useState(false)
  const [showConfigForm, setShowConfigForm] = useState(false)
  const [showCommissionForm, setShowCommissionForm] = useState<Platform | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state — period
  const [pf, setPf] = useState({ platformId: '', periodStart: '', periodEnd: '', orderCount: '', grossRevenue: '', commissionCharged: '', netRevenue: '' })
  // Form state — promo
  const [prom, setProm] = useState({ platformId: '', periodStart: '', periodEnd: '', chargeAmount: '', promotionType: 'Boost', notes: '' })
  // Form state — config
  const [cfg, setCfg] = useState({ method: 'BY_ORDERS', foodCostPct: '28' })
  // Form state — commission edit
  const [commRate, setCommRate] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [plRes, cfgRes] = await Promise.all([
      fetch('/api/platforms'),
      fetch('/api/platforms/overhead-config'),
    ])
    if (plRes.ok) setPlatforms(await plRes.json())
    if (cfgRes.ok) {
      const c = await cfgRes.json()
      setConfig(c)
      setCfg({ method: c.method, foodCostPct: (c.foodCostPct * 100).toFixed(0) })
    }
    setLoading(false)
  }, [])

  const fetchPeriodData = useCallback(async () => {
    const [perRes, proRes] = await Promise.all([
      fetch(`/api/platforms/periods?from=${from}&to=${to}`),
      fetch(`/api/platforms/promotions?from=${from}&to=${to}`),
    ])
    if (perRes.ok) setPeriods(await perRes.json())
    if (proRes.ok) setPromotions(await proRes.json())
  }, [from, to])

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    const res = await fetch(`/api/platforms/summary?from=${from}&to=${to}`)
    if (res.ok) setSummary(await res.json())
    setSummaryLoading(false)
  }, [from, to])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    fetchPeriodData()
    fetchSummary()
  }, [fetchPeriodData, fetchSummary])

  const activePlatformId = platforms.find(p => p.name === activeTab)?.id

  // ─── Period form ──────────────────────────────────────────────────────────

  function openAddPeriod(platformId?: string) {
    setEditingPeriod(null)
    setPf({ platformId: platformId ?? platforms[0]?.id ?? '', periodStart: from, periodEnd: to, orderCount: '', grossRevenue: '', commissionCharged: '', netRevenue: '' })
    setShowPeriodForm(true)
  }

  function openEditPeriod(p: Period) {
    setEditingPeriod(p)
    setPf({
      platformId: p.platformId,
      periodStart: p.periodStart.split('T')[0],
      periodEnd: p.periodEnd.split('T')[0],
      orderCount: p.orderCount.toString(),
      grossRevenue: p.grossRevenue.toFixed(2),
      commissionCharged: p.commissionCharged.toFixed(2),
      netRevenue: p.netRevenue.toFixed(2),
    })
    setShowPeriodForm(true)
  }

  // Auto-calculate net revenue when gross/commission changes
  function handleGrossOrCommissionChange(field: 'grossRevenue' | 'commissionCharged', val: string) {
    const next = { ...pf, [field]: val }
    const gross = parseFloat(next.grossRevenue) || 0
    const comm = parseFloat(next.commissionCharged) || 0
    next.netRevenue = (gross - comm).toFixed(2)
    setPf(next)
  }

  async function savePeriod(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = editingPeriod
        ? await fetch(`/api/platforms/periods/${editingPeriod.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pf),
          })
        : await fetch('/api/platforms/periods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pf),
          })
      if (res.ok) {
        setShowPeriodForm(false)
        fetchPeriodData()
        fetchSummary()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Failed to save period. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function deletePeriod(id: string) {
    if (!confirm('Delete this period?')) return
    await fetch(`/api/platforms/periods/${id}`, { method: 'DELETE' })
    fetchPeriodData()
    fetchSummary()
  }

  // ─── Promo form ───────────────────────────────────────────────────────────

  function openAddPromo(platformId?: string) {
    setProm({ platformId: platformId ?? platforms[0]?.id ?? '', periodStart: from, periodEnd: to, chargeAmount: '', promotionType: 'Boost', notes: '' })
    setShowPromoForm(true)
  }

  async function savePromo(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/platforms/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prom),
      })
      if (res.ok) {
        setShowPromoForm(false)
        fetchPeriodData()
        fetchSummary()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Failed to save promotion. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function deletePromo(id: string) {
    if (!confirm('Delete this promotion?')) return
    await fetch(`/api/platforms/promotions/${id}`, { method: 'DELETE' })
    fetchPeriodData()
    fetchSummary()
  }

  // ─── Config form ──────────────────────────────────────────────────────────

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/platforms/overhead-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: cfg.method, foodCostPct: parseFloat(cfg.foodCostPct) / 100 }),
      })
      if (res.ok) {
        const c = await res.json()
        setConfig(c)
        setCfg({ method: c.method, foodCostPct: (c.foodCostPct * 100).toFixed(0) })
        setShowConfigForm(false)
        fetchSummary()
      }
    } finally {
      setSaving(false)
    }
  }

  // ─── Commission form ──────────────────────────────────────────────────────

  async function saveCommission(e: React.FormEvent) {
    e.preventDefault()
    if (!showCommissionForm) return
    setSaving(true)
    try {
      const res = await fetch(`/api/platforms/${showCommissionForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionRate: parseFloat(commRate) / 100 }),
      })
      if (res.ok) {
        setShowCommissionForm(null)
        fetchAll()
        fetchSummary()
      }
    } finally {
      setSaving(false)
    }
  }

  // ─── Derived data ─────────────────────────────────────────────────────────

  const tabPlatforms = platforms.filter(p => p.name !== 'OTHER')
  const currentPlatformPeriods = activePlatformId
    ? periods.filter(p => p.platformId === activePlatformId)
    : periods
  const currentPlatformPromos = activePlatformId
    ? promotions.filter(p => p.platformId === activePlatformId)
    : promotions
  const currentSummary = summary?.platforms.find(p => p.platformId === activePlatformId)

  if (loading) return <Loader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Delivery platform performance & ROI</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfigForm(true)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ⚙ Settings
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <Field label="From">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </Field>
        <div className="text-xs text-gray-500 self-end pb-2">
          Overhead: <span className="font-medium text-gray-700">{config.method === 'BY_ORDERS' ? 'By orders' : config.method === 'BY_REVENUE' ? 'By revenue' : 'Equal split'}</span>
          &nbsp;·&nbsp; Food cost: <span className="font-medium text-gray-700">{formatPercent(config.foodCostPct * 100, 0)} of gross</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Overview
        </button>
        {tabPlatforms.map(p => (
          <button
            key={p.id}
            onClick={() => setActiveTab(p.name)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === p.name ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {PLATFORM_LABELS[p.name] ?? p.name}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {summaryLoading ? <Loader /> : !summary ? null : (
            <>
              {/* Totals row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totals.totalOrders.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Platform Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totals.totalRevenue)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Overhead Allocated</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totals.totalOverhead)}</p>
                </div>
              </div>

              {/* Comparison table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Platform Comparison</h2>
                  <span className="text-xs text-gray-400">All figures for selected period</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">Platform</th>
                        <th className="px-4 py-3 text-right">Orders</th>
                        <th className="px-4 py-3 text-right">Gross Revenue</th>
                        <th className="px-4 py-3 text-right">Commission</th>
                        <th className="px-4 py-3 text-right">Net Revenue</th>
                        <th className="px-4 py-3 text-right">Promo Spend</th>
                        <th className="px-4 py-3 text-right">Food Cost</th>
                        <th className="px-4 py-3 text-right">Overhead</th>
                        <th className="px-4 py-3 text-right">Net Result</th>
                        <th className="px-4 py-3 text-right">Expectancy/Order</th>
                        <th className="px-4 py-3 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {summary.platforms.filter(p => p.hasData).map(p => (
                        <tr key={p.platformId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_COLOURS[p.platformName] ?? 'bg-gray-100 text-gray-800'}`}>
                              {PLATFORM_LABELS[p.platformName] ?? p.platformName}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{p.orders.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(p.grossRevenue)}</td>
                          <td className="px-4 py-3 text-right text-red-600">-{formatCurrency(p.commissionCharged)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(p.netRevenue)}</td>
                          <td className="px-4 py-3 text-right text-orange-600">{p.promotionTotal > 0 ? `-${formatCurrency(p.promotionTotal)}` : '—'}</td>
                          <td className="px-4 py-3 text-right text-orange-600">-{formatCurrency(p.foodCost)}</td>
                          <td className="px-4 py-3 text-right text-orange-600">-{formatCurrency(p.allocatedOverhead)}</td>
                          <td className="px-4 py-3 text-right font-semibold">
                            <span className={p.netResult >= 0 ? 'text-green-700' : 'text-red-700'}>
                              {p.netResult >= 0 ? '' : '-'}{formatCurrency(Math.abs(p.netResult))}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right"><ExpBadge value={p.expectancyPerOrder} /></td>
                          <td className="px-4 py-3 text-right"><MarginBadge value={p.netMarginPct} /></td>
                        </tr>
                      ))}
                      {summary.platforms.filter(p => p.hasData).length === 0 && (
                        <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400 text-sm">No platform data for this period. Add data on each platform tab.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PLATFORM TABS ── */}
      {activeTab !== 'overview' && activePlatformId && (
        <div className="space-y-6">
          {/* Platform header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-semibold ${PLATFORM_COLOURS[activeTab] ?? 'bg-gray-100 text-gray-800'}`}>
                {PLATFORM_LABELS[activeTab] ?? activeTab}
              </span>
              <span className="text-sm text-gray-500">
                Commission: {formatPercent(platforms.find(p => p.name === activeTab)?.commissionRate ? (platforms.find(p => p.name === activeTab)!.commissionRate * 100) : 0, 0)}
              </span>
              <button
                onClick={() => {
                  const pl = platforms.find(p => p.name === activeTab)
                  if (pl) { setCommRate((pl.commissionRate * 100).toFixed(0)); setShowCommissionForm(pl) }
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Edit rate
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openAddPromo(activePlatformId)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">+ Add Promotion</button>
              <button onClick={() => openAddPeriod(activePlatformId)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">+ Add Period</button>
            </div>
          </div>

          {/* Cost breakdown card (if we have summary data) */}
          {currentSummary && currentSummary.hasData && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Cost Breakdown — {formatDate(from)} to {formatDate(to)}</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-600">Orders</span>
                    <span className="font-medium text-gray-900">{currentSummary.orders.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-600">Gross Order Revenue</span>
                    <span className="font-medium text-gray-900">{formatCurrency(currentSummary.grossRevenue)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-600">Commission ({formatPercent(currentSummary.commissionRate * 100, 0)})</span>
                    <span className="font-medium text-red-600">-{formatCurrency(currentSummary.commissionCharged)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100 font-medium">
                    <span className="text-gray-700">Net Revenue to Business</span>
                    <span className="text-gray-900">{formatCurrency(currentSummary.netRevenue)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-600">Food Cost ({formatPercent(currentSummary.foodCostPct * 100, 0)} of gross)</span>
                    <span className="font-medium text-orange-600">-{formatCurrency(currentSummary.foodCost)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-600">Allocated Overhead</span>
                    <span className="font-medium text-orange-600">-{formatCurrency(currentSummary.allocatedOverhead)}</span>
                  </div>
                  {currentSummary.promotionTotal > 0 && (
                    <div className="flex justify-between py-1.5 border-b border-gray-50">
                      <span className="text-gray-600">Promotion Spend</span>
                      <span className="font-medium text-orange-600">-{formatCurrency(currentSummary.promotionTotal)}</span>
                    </div>
                  )}
                  <div className={`flex justify-between py-2 rounded-lg px-2 font-semibold ${currentSummary.netResult >= 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    <span>Net Result</span>
                    <span>{currentSummary.netResult >= 0 ? '' : '-'}{formatCurrency(Math.abs(currentSummary.netResult))}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className={`rounded-xl p-4 ${currentSummary.expectancyPerOrder !== null && currentSummary.expectancyPerOrder >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expectancy per Order</p>
                    <p className={`text-2xl font-bold mt-1 ${currentSummary.expectancyPerOrder !== null && currentSummary.expectancyPerOrder >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {currentSummary.expectancyPerOrder !== null
                        ? `${currentSummary.expectancyPerOrder >= 0 ? '+' : ''}${formatCurrency(currentSummary.expectancyPerOrder)}`
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {currentSummary.expectancyPerOrder !== null && currentSummary.expectancyPerOrder >= 0
                        ? 'Making money on this channel. Keep running.'
                        : 'Losing money per order. Review costs or pause promotion.'}
                    </p>
                  </div>

                  {currentSummary.breakEvenOrders !== null && (
                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Break-Even Orders</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{currentSummary.breakEvenOrders.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {currentSummary.orders >= currentSummary.breakEvenOrders
                          ? `You achieved this (${currentSummary.orders} orders).`
                          : `You needed ${currentSummary.breakEvenOrders - currentSummary.orders} more orders.`}
                      </p>
                    </div>
                  )}

                  {currentSummary.promotionTotal > 0 && currentSummary.promotionROI !== null && (
                    <div className={`rounded-xl p-4 ${currentSummary.promotionROI >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Promotion ROI</p>
                      <p className={`text-2xl font-bold mt-1 ${currentSummary.promotionROI >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {currentSummary.promotionROI >= 0 ? '+' : ''}{formatPercent(currentSummary.promotionROI)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {currentSummary.promotionROI >= 0
                          ? 'Promotion is generating positive returns.'
                          : 'Promotion cost more than it generated.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Periods table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Period Data</h3>
              <button onClick={() => openAddPeriod(activePlatformId)} className="text-sm text-indigo-600 hover:text-indigo-800">+ Add</button>
            </div>
            {currentPlatformPeriods.length === 0 ? (
              <Empty text="No period data yet. Add your first period." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Period</th>
                    <th className="px-4 py-3 text-right">Orders</th>
                    <th className="px-4 py-3 text-right">Gross Revenue</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                    <th className="px-4 py-3 text-right">Net Revenue</th>
                    <th className="px-4 py-3 text-right">Avg Order</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {currentPlatformPeriods.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{p.orderCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(p.grossRevenue)}</td>
                      <td className="px-4 py-3 text-right text-red-600">-{formatCurrency(p.commissionCharged)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(p.netRevenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(p.averageOrderValue)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEditPeriod(p)} className="text-gray-400 hover:text-indigo-600 mr-2 text-xs">Edit</button>
                        <button onClick={() => deletePeriod(p.id)} className="text-gray-400 hover:text-red-600 text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Promotions table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Promotion Charges</h3>
              <button onClick={() => openAddPromo(activePlatformId)} className="text-sm text-indigo-600 hover:text-indigo-800">+ Add</button>
            </div>
            {currentPlatformPromos.length === 0 ? (
              <Empty text="No promotions logged for this period." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Period</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-right">Charge</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {currentPlatformPromos.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</td>
                      <td className="px-4 py-3 text-gray-700">{p.promotionType}</td>
                      <td className="px-4 py-3 text-right text-orange-600 font-medium">-{formatCurrency(p.chargeAmount)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{p.notes ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deletePromo(p.id)} className="text-gray-400 hover:text-red-600 text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Add/Edit Period */}
      {showPeriodForm && (
        <Modal title={editingPeriod ? 'Edit Period' : 'Add Period Data'} onClose={() => setShowPeriodForm(false)}>
          <form onSubmit={savePeriod} className="space-y-3">
            <Field label="Platform">
              <select value={pf.platformId} onChange={e => setPf(v => ({ ...v, platformId: e.target.value }))} className={INPUT} required>
                {platforms.map(p => <option key={p.id} value={p.id}>{PLATFORM_LABELS[p.name] ?? p.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Period Start">
                <input type="date" value={pf.periodStart} onChange={e => setPf(v => ({ ...v, periodStart: e.target.value }))} className={INPUT} required />
              </Field>
              <Field label="Period End">
                <input type="date" value={pf.periodEnd} onChange={e => setPf(v => ({ ...v, periodEnd: e.target.value }))} className={INPUT} required />
              </Field>
            </div>
            <Field label="Orders">
              <input type="number" min="0" value={pf.orderCount} onChange={e => setPf(v => ({ ...v, orderCount: e.target.value }))} className={INPUT} required placeholder="0" />
            </Field>
            <Field label="Gross Revenue (£)">
              <input type="number" step="0.01" min="0" value={pf.grossRevenue} onChange={e => handleGrossOrCommissionChange('grossRevenue', e.target.value)} className={INPUT} required placeholder="0.00" />
            </Field>
            <Field label="Commission Charged (£)">
              <input type="number" step="0.01" min="0" value={pf.commissionCharged} onChange={e => handleGrossOrCommissionChange('commissionCharged', e.target.value)} className={INPUT} placeholder="0.00" />
            </Field>
            <Field label="Net Revenue (£)">
              <input type="number" step="0.01" value={pf.netRevenue} onChange={e => setPf(v => ({ ...v, netRevenue: e.target.value }))} className={INPUT} placeholder="Auto-calculated" />
            </Field>
            <ModalActions onClose={() => setShowPeriodForm(false)} saving={saving} />
          </form>
        </Modal>
      )}

      {/* Add Promotion */}
      {showPromoForm && (
        <Modal title="Add Promotion Charge" onClose={() => setShowPromoForm(false)}>
          <form onSubmit={savePromo} className="space-y-3">
            <Field label="Platform">
              <select value={prom.platformId} onChange={e => setProm(v => ({ ...v, platformId: e.target.value }))} className={INPUT} required>
                {platforms.filter(p => p.name !== 'WALKIN').map(p => <option key={p.id} value={p.id}>{PLATFORM_LABELS[p.name] ?? p.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Period Start">
                <input type="date" value={prom.periodStart} onChange={e => setProm(v => ({ ...v, periodStart: e.target.value }))} className={INPUT} required />
              </Field>
              <Field label="Period End">
                <input type="date" value={prom.periodEnd} onChange={e => setProm(v => ({ ...v, periodEnd: e.target.value }))} className={INPUT} required />
              </Field>
            </div>
            <Field label="Charge Amount (£)">
              <input type="number" step="0.01" min="0" value={prom.chargeAmount} onChange={e => setProm(v => ({ ...v, chargeAmount: e.target.value }))} className={INPUT} required placeholder="0.00" />
            </Field>
            <Field label="Promotion Type">
              <select value={prom.promotionType} onChange={e => setProm(v => ({ ...v, promotionType: e.target.value }))} className={INPUT}>
                <option>Boost</option>
                <option>Sponsored Listing</option>
                <option>Discount</option>
                <option>Free Item Offer</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Notes (optional)">
              <input type="text" value={prom.notes} onChange={e => setProm(v => ({ ...v, notes: e.target.value }))} className={INPUT} placeholder="Optional notes" />
            </Field>
            <ModalActions onClose={() => setShowPromoForm(false)} saving={saving} />
          </form>
        </Modal>
      )}

      {/* Overhead / Food Cost Config */}
      {showConfigForm && (
        <Modal title="Analytics Settings" onClose={() => setShowConfigForm(false)}>
          <form onSubmit={saveConfig} className="space-y-4">
            <Field label="Overhead Allocation Method">
              <select value={cfg.method} onChange={e => setCfg(v => ({ ...v, method: e.target.value }))} className={INPUT}>
                <option value="BY_ORDERS">By Order Count (recommended)</option>
                <option value="BY_REVENUE">By Revenue Share</option>
                <option value="BY_TIME">Equal Split</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {cfg.method === 'BY_ORDERS' && 'Overhead allocated in proportion to number of orders per platform.'}
                {cfg.method === 'BY_REVENUE' && 'Overhead allocated in proportion to revenue generated per platform.'}
                {cfg.method === 'BY_TIME' && 'Overhead split equally across all platforms with data.'}
              </p>
            </Field>
            <Field label="Food Cost % of Gross Revenue">
              <div className="flex items-center gap-2">
                <input type="number" min="1" max="99" step="1" value={cfg.foodCostPct} onChange={e => setCfg(v => ({ ...v, foodCostPct: e.target.value }))} className={INPUT} />
                <span className="text-sm text-gray-500 shrink-0">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Used to estimate food cost per platform. Industry benchmark: 25–35%.</p>
            </Field>
            <ModalActions onClose={() => setShowConfigForm(false)} saving={saving} label="Save Settings" />
          </form>
        </Modal>
      )}

      {/* Edit Commission Rate */}
      {showCommissionForm && (
        <Modal title={`Edit Commission — ${PLATFORM_LABELS[showCommissionForm.name] ?? showCommissionForm.name}`} onClose={() => setShowCommissionForm(null)}>
          <form onSubmit={saveCommission} className="space-y-4">
            <Field label="Commission Rate (%)">
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="100" step="0.5" value={commRate} onChange={e => setCommRate(e.target.value)} className={INPUT} />
                <span className="text-sm text-gray-500 shrink-0">%</span>
              </div>
            </Field>
            <ModalActions onClose={() => setShowCommissionForm(null)} saving={saving} />
          </form>
        </Modal>
      )}
    </div>
  )
}
