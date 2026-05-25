'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils'
import { usePlan } from '@/lib/usePlan'

interface ChannelRow {
  platformId: string
  platformName: string
  expectancy: number
  winRate: number
  avgWin: number
  avgLoss: number
  periodWeeks: number
  calculatedAt: string
}

interface PromotionRow {
  platformId: string
  platformName: string
  promotionType: string
  expectancy: number
  winRate: number
  avgWin: number
  avgLoss: number
  periodWeeks: number
  calculatedAt: string
}

interface LabourRow {
  expectancy: number
  winRate: number
  avgWin: number
  avgLoss: number
  periodWeeks: number
  calculatedAt: string
}

interface ExpectancyResponse {
  channels: ChannelRow[]
  promotions: PromotionRow[]
  labour: LabourRow | null
  ingredients: unknown
}

const PLATFORM_LABELS: Record<string, string> = {
  UBEREATS: 'Uber Eats',
  DELIVEROO: 'Deliveroo',
  JUSTEAT: 'Just Eat',
  WALKIN: 'Walk-in',
  OTHER: 'Other',
}

function Loader() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-12 text-gray-400 text-sm">{text}</div>
}

function UpgradeGate() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
      <div className="text-3xl mb-3">🔒</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Expectancy is a Pro feature</h2>
      <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">
        See net profit per order on every channel — and know which platforms are making money and which aren&apos;t.
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

function ChannelSection({ channels }: { channels: ChannelRow[] }) {
  const latestCalculated = channels.length > 0
    ? new Date(Math.max(...channels.map((c) => new Date(c.calculatedAt).getTime())))
    : null

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">
          Channel Expectancy <span className="text-gray-400 font-normal">(per order)</span>
        </h2>
        {latestCalculated && (
          <span className="text-xs text-gray-400">
            Last updated {formatDate(latestCalculated)}
          </span>
        )}
      </div>
      {channels.length === 0 ? (
        <Empty text="No expectancy data yet. Import or enter at least one week of platform orders, then wait for the weekly recalc to see numbers here." />
      ) : (
        <ul className="divide-y divide-gray-50">
          {channels.map((c) => {
            const positive = c.expectancy > 0
            return (
              <li key={c.platformId} className="px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`inline-flex w-10 h-10 items-center justify-center rounded-lg text-lg font-bold ${positive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {positive ? '✓' : '✗'}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {PLATFORM_LABELS[c.platformName] ?? c.platformName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Win rate {formatPercent(c.winRate * 100, 0)} · based on {c.periodWeeks} {c.periodWeeks === 1 ? 'week' : 'weeks'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${positive ? 'text-green-700' : 'text-red-700'}`}>
                    {positive ? '+' : ''}{formatCurrency(c.expectancy)}
                  </p>
                  <p className={`text-xs font-medium uppercase tracking-wide ${positive ? 'text-green-700' : 'text-red-700'}`}>
                    {positive ? 'Positive' : 'Negative'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function LabourSection({ labour }: { labour: LabourRow | null }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">
          Labour Expectancy <span className="text-gray-400 font-normal">(per hour)</span>
        </h2>
        {labour && (
          <span className="text-xs text-gray-400">
            Last updated {formatDate(labour.calculatedAt)}
          </span>
        )}
      </div>
      {!labour ? (
        <Empty text="No labour expectancy data yet. Log payroll entries with hours worked for at least one week, then wait for the weekly recalc." />
      ) : (
        <ul className="divide-y divide-gray-50">
          <li className="px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className={`inline-flex w-10 h-10 items-center justify-center rounded-lg text-lg font-bold ${labour.expectancy > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {labour.expectancy > 0 ? '✓' : '✗'}
              </span>
              <div>
                <p className="font-medium text-gray-900">All staff (aggregate)</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Win rate {formatPercent(labour.winRate * 100, 0)} · based on {labour.periodWeeks} {labour.periodWeeks === 1 ? 'week' : 'weeks'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${labour.expectancy > 0 ? 'text-green-700' : 'text-red-700'}`}>
                {labour.expectancy > 0 ? '+' : ''}{formatCurrency(labour.expectancy)}
              </p>
              <p className={`text-xs font-medium uppercase tracking-wide ${labour.expectancy > 0 ? 'text-green-700' : 'text-red-700'}`}>
                {labour.expectancy > 0 ? 'Positive' : 'Negative'}
              </p>
            </div>
          </li>
        </ul>
      )}
    </section>
  )
}

function PromotionSection({ promotions }: { promotions: PromotionRow[] }) {
  const latestCalculated = promotions.length > 0
    ? new Date(Math.max(...promotions.map((p) => new Date(p.calculatedAt).getTime())))
    : null

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">
          Promotion Expectancy <span className="text-gray-400 font-normal">(per £ promo spend)</span>
        </h2>
        {latestCalculated && (
          <span className="text-xs text-gray-400">
            Last updated {formatDate(latestCalculated)}
          </span>
        )}
      </div>
      {promotions.length === 0 ? (
        <Empty text="No promotion expectancy yet. Once you log a couple of weeks of promotion charges, each platform/promo combination will appear here." />
      ) : (
        <ul className="divide-y divide-gray-50">
          {promotions.map((p) => {
            const positive = p.expectancy > 0
            const key = `${p.platformId}:${p.promotionType}`
            return (
              <li key={key} className="px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`inline-flex w-10 h-10 items-center justify-center rounded-lg text-lg font-bold ${positive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {positive ? '✓' : '✗'}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {p.promotionType || '(untyped)'}{' '}
                      <span className="text-xs text-gray-400 font-normal">
                        on {PLATFORM_LABELS[p.platformName] ?? p.platformName}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Win rate {formatPercent(p.winRate * 100, 0)} · based on {p.periodWeeks} {p.periodWeeks === 1 ? 'week' : 'weeks'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${positive ? 'text-green-700' : 'text-red-700'}`}>
                    {positive ? '+' : ''}{formatCurrency(p.expectancy)}
                  </p>
                  <p className={`text-xs font-medium uppercase tracking-wide ${positive ? 'text-green-700' : 'text-red-700'}`}>
                    {positive ? 'Positive' : 'Negative'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default function ExpectancyPage() {
  const plan = usePlan()
  const [data, setData] = useState<ExpectancyResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const hasAccess = plan.can('analytics')

  useEffect(() => {
    if (plan.loading || !hasAccess) {
      if (!plan.loading) setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch('/api/analytics/expectancy')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ExpectancyResponse | null) => { if (!cancelled) setData(j) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [plan.loading, hasAccess])

  if (plan.loading) return <Loader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Expectancy</h1>
        <p className="text-sm text-gray-500 mt-1">Net profit per order, return on promo spend, and labour productivity</p>
      </div>

      {!hasAccess ? (
        <UpgradeGate />
      ) : loading ? (
        <Loader />
      ) : (
        <>
          <ChannelSection channels={data?.channels ?? []} />
          <PromotionSection promotions={data?.promotions ?? []} />
          <LabourSection labour={data?.labour ?? null} />
        </>
      )}
    </div>
  )
}
