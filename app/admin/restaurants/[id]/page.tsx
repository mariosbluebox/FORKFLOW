'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface Restaurant {
  id: string
  name: string
  slug: string
  inboundEmail: string
  currency: string
  plan: string
  trialEndsAt: string
  isActive: boolean
  createdAt: string
  stripeCustomerId: string | null
  users: { id: string; name: string; email: string; createdAt: string }[]
  _count: { revenueEntries: number; expenseEntries: number; payrollEntries: number; importLogs: number }
}

export default function AdminRestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [trialEndsAt, setTrialEndsAt] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/restaurants/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setRestaurant(data)
        setPlan(data.plan)
        setIsActive(data.isActive)
        setTrialEndsAt(data.trialEndsAt?.split('T')[0] ?? '')
      })
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/admin/restaurants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, isActive, trialEndsAt }),
    })
    setSaving(false)
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${restaurant?.name}" and ALL their data? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/admin/restaurants/${id}`, { method: 'DELETE' })
    router.push('/admin')
  }

  if (!restaurant) return <div className="text-sm text-gray-400">Loading…</div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/admin" className="text-sm text-indigo-600 hover:text-indigo-800">← All restaurants</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{restaurant.name}</h1>
        <p className="text-sm text-gray-500">{restaurant.slug} · joined {formatDate(restaurant.createdAt)}</p>
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Revenue entries', value: restaurant._count.revenueEntries },
          { label: 'Expenses', value: restaurant._count.expenseEntries },
          { label: 'Payroll entries', value: restaurant._count.payrollEntries },
          { label: 'Email imports', value: restaurant._count.importLogs },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Account settings</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="FREE_TRIAL">Free Trial</option>
              <option value="BASIC">Basic</option>
              <option value="PRO">Pro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Trial ends</label>
            <input
              type="date"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="active" className="text-sm text-gray-700">Account active</label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete restaurant'}
          </button>
        </div>
      </div>

      {/* Users */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Users</h2>
        <div className="space-y-2">
          {restaurant.users.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-gray-900">{u.name}</p>
                <p className="text-gray-500">{u.email}</p>
              </div>
              <p className="text-gray-400">{formatDate(u.createdAt)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-2 text-sm">
        <h2 className="font-semibold text-gray-900 mb-2">Details</h2>
        <Row label="Inbound email" value={restaurant.inboundEmail} />
        <Row label="Currency" value={restaurant.currency} />
        <Row label="Stripe customer" value={restaurant.stripeCustomerId ?? '—'} />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-mono text-xs">{value}</span>
    </div>
  )
}
