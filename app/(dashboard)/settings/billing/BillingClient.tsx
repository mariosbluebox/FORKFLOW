'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

const PLANS = [
  {
    key: 'BASIC',
    name: 'Basic',
    price: '£29/month',
    description: 'Revenue, expenses, payroll, inventory, reports, CSV import.',
  },
  {
    key: 'PRO',
    name: 'Pro',
    price: '£59/month',
    description: 'Everything in Basic + platform analytics, automated email ingestion, correlations, health score, and scenario modelling.',
    highlighted: true,
  },
]

export default function BillingClient({
  plan,
  trialEndsAt,
  daysLeft,
  trialExpired,
  hasStripeSubscription,
}: {
  plan: string
  trialEndsAt: string
  daysLeft: number
  trialExpired: boolean
  hasStripeSubscription: boolean
}) {
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const cancelled = searchParams.get('cancelled')

  const [loading, setLoading] = useState<string | null>(null)

  const handleCheckout = async (selectedPlan: string) => {
    setLoading(selectedPlan)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setLoading(null)
  }

  const handlePortal = async () => {
    setLoading('portal')
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setLoading(null)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription & Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your plan and payment details.</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          Subscription activated. Welcome to {plan}!
        </div>
      )}
      {cancelled && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">
          Checkout cancelled. No changes were made.
        </div>
      )}

      {/* Current plan */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Current plan</h2>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
            {plan.replace('_', ' ')}
          </span>
          {plan === 'FREE_TRIAL' && (
            <span className="text-sm text-gray-500">
              {trialExpired
                ? 'Expired — upgrade to continue'
                : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
            </span>
          )}
        </div>

        {hasStripeSubscription && (
          <button
            onClick={handlePortal}
            disabled={loading === 'portal'}
            className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {loading === 'portal' ? 'Opening portal…' : 'Manage billing / cancel →'}
          </button>
        )}
      </div>

      {/* Plan options */}
      {(plan === 'FREE_TRIAL' || plan === 'BASIC') && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PLANS.map((p) => (
            <div
              key={p.key}
              className={`bg-white rounded-2xl border shadow-sm p-6 flex flex-col ${p.highlighted ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-100'}`}
            >
              {p.highlighted && (
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                  Most popular
                </span>
              )}
              <h3 className="font-semibold text-gray-900 text-lg">{p.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1 mb-2">{p.price}</p>
              <p className="text-sm text-gray-500 flex-1">{p.description}</p>
              <button
                onClick={() => handleCheckout(p.key)}
                disabled={loading === p.key || plan === p.key}
                className={`mt-4 w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  plan === p.key
                    ? 'bg-gray-100 text-gray-400 cursor-default'
                    : p.highlighted
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-900 text-white hover:bg-gray-700'
                } disabled:opacity-60`}
              >
                {loading === p.key ? 'Loading…' : plan === p.key ? 'Current plan' : `Upgrade to ${p.name}`}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
