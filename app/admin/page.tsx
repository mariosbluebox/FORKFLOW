import { db } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

async function getRestaurants() {
  return db.restaurant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { revenueEntries: true, importLogs: true },
      },
    },
  })
}

const PLAN_BADGE: Record<string, string> = {
  FREE_TRIAL: 'bg-blue-100 text-blue-700',
  BASIC: 'bg-gray-100 text-gray-700',
  PRO: 'bg-indigo-100 text-indigo-700',
}

export default async function AdminPage() {
  const restaurants = await getRestaurants()

  const active = restaurants.filter((r) => r.isActive).length
  const pro = restaurants.filter((r) => r.plan === 'PRO').length
  const trials = restaurants.filter((r) => r.plan === 'FREE_TRIAL').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restaurants</h1>
        <p className="text-sm text-gray-500 mt-1">All tenants on the platform</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: restaurants.length },
          { label: 'Active', value: active },
          { label: 'Free Trial', value: trials },
          { label: 'Pro', value: pro },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Restaurant</th>
              <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Plan</th>
              <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Trial ends</th>
              <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Status</th>
              <th className="text-right px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Revenue entries</th>
              <th className="text-right px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Imports</th>
              <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Joined</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {restaurants.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3">
                  <p className="font-medium text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.slug}</p>
                </td>
                <td className="px-6 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[r.plan]}`}>
                    {r.plan.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-3 text-gray-500">{formatDate(r.trialEndsAt)}</td>
                <td className="px-6 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {r.isActive ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-6 py-3 text-right text-gray-700">{r._count.revenueEntries}</td>
                <td className="px-6 py-3 text-right text-gray-700">{r._count.importLogs}</td>
                <td className="px-6 py-3 text-gray-500">{formatDate(r.createdAt)}</td>
                <td className="px-6 py-3">
                  <Link
                    href={`/admin/restaurants/${r.id}`}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
