import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCurrency, formatPercent, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from '@/lib/utils'
import Link from 'next/link'

async function getDashboardData(restaurantId: string) {
  const now = new Date()

  const [todayRevenue, weekRevenue, lastWeekRevenue, monthRevenue, monthExpenses, monthPayroll, topCategories, lowStock, restaurant] =
    await Promise.all([
      db.revenueEntry.aggregate({ _sum: { netAmount: true }, where: { restaurantId, date: { gte: startOfDay(now), lte: endOfDay(now) } } }),
      db.revenueEntry.aggregate({ _sum: { netAmount: true }, where: { restaurantId, date: { gte: startOfWeek(now), lte: endOfWeek(now) } } }),
      db.revenueEntry.aggregate({ _sum: { netAmount: true }, where: { restaurantId, date: { gte: startOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), lte: endOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) } } }),
      db.revenueEntry.aggregate({ _sum: { netAmount: true }, where: { restaurantId, date: { gte: startOfMonth(now), lte: endOfMonth(now) } } }),
      db.expenseEntry.aggregate({ _sum: { netAmount: true }, where: { restaurantId, date: { gte: startOfMonth(now), lte: endOfMonth(now) } } }),
      db.payrollEntry.aggregate({ _sum: { grossPay: true, employerNI: true }, where: { restaurantId, periodStart: { gte: startOfMonth(now) } } }),
      db.expenseEntry.groupBy({ by: ['categoryId'], _sum: { netAmount: true }, where: { restaurantId, date: { gte: startOfMonth(now), lte: endOfMonth(now) } }, orderBy: { _sum: { netAmount: 'desc' } }, take: 3 }),
      db.$queryRaw<{ id: string; name: string; unit: string; currentStock: number; reorderLevel: number }[]>`
        SELECT id, name, unit, "currentStock", "reorderLevel" FROM "InventoryItem"
        WHERE "restaurantId" = ${restaurantId} AND "currentStock" <= "reorderLevel" LIMIT 5
      `,
      db.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true, currency: true } }),
    ])

  const currency = restaurant?.currency ?? 'GBP'
  const todayNet = todayRevenue._sum.netAmount ?? 0
  const weekNet = weekRevenue._sum.netAmount ?? 0
  const lastWeekNet = lastWeekRevenue._sum.netAmount ?? 0
  const monthNet = monthRevenue._sum.netAmount ?? 0
  const monthExp = monthExpenses._sum.netAmount ?? 0
  const monthPay = (monthPayroll._sum.grossPay ?? 0) + (monthPayroll._sum.employerNI ?? 0)
  const monthProfit = monthNet - monthExp - monthPay
  const weekTrend = lastWeekNet > 0 ? ((weekNet - lastWeekNet) / lastWeekNet) * 100 : 0
  const labourPct = monthNet > 0 ? (monthPay / monthNet) * 100 : 0

  const categoryIds = topCategories.map((c) => c.categoryId)
  const categories = await db.expenseCategory.findMany({ where: { id: { in: categoryIds }, restaurantId } })
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))
  const topCats = topCategories.map((c) => ({ name: catMap[c.categoryId]?.name ?? 'Unknown', colour: catMap[c.categoryId]?.colour ?? '#6b7280', amount: c._sum.netAmount ?? 0 }))

  return { todayNet, weekNet, weekTrend, monthNet, monthExp, monthPay, monthProfit, labourPct, topCats, lowStock, currency, restaurantName: restaurant?.name ?? '' }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.restaurantId) return null

  const data = await getDashboardData(session.user.restaurantId)
  const fmt = (n: number) => formatCurrency(n, data.currency)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{data.restaurantName}</h1>
        <p className="text-sm text-gray-500 mt-1">Financial overview</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's Revenue" value={fmt(data.todayNet)} />
        <StatCard label="This Week" value={fmt(data.weekNet)} trend={data.weekTrend} />
        <StatCard label="Monthly Profit" value={fmt(data.monthProfit)} highlight={data.monthProfit > 0 ? 'green' : 'red'} />
        <StatCard label="Labour Cost %" value={formatPercent(data.labourPct)} highlight={data.labourPct > 30 ? 'amber' : 'green'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly P&L */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">This Month</h2>
            <Link href="/reports/pl" className="text-xs text-indigo-600 hover:text-indigo-800">Full report →</Link>
          </div>
          <div className="space-y-3 text-sm">
            <Row label="Net Revenue" value={fmt(data.monthNet)} />
            <Row label="Expenses" value={fmt(data.monthExp)} negative />
            <Row label="Payroll" value={fmt(data.monthPay)} negative />
            <div className="border-t border-gray-100 pt-3">
              <Row label="Net Profit" value={fmt(data.monthProfit)} bold colour={data.monthProfit >= 0 ? 'text-green-600' : 'text-red-600'} />
            </div>
          </div>
        </div>

        {/* Top Expenses */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Top Expenses This Month</h2>
            <Link href="/expenses" className="text-xs text-indigo-600 hover:text-indigo-800">View all →</Link>
          </div>
          {data.topCats.length === 0 ? (
            <p className="text-sm text-gray-400">No expenses recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {data.topCats.map((cat) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.colour }} />
                  <span className="flex-1 text-sm text-gray-700">{cat.name}</span>
                  <span className="text-sm font-medium text-gray-900">{fmt(cat.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: '/revenue', label: '+ Add Revenue' },
          { href: '/expenses', label: '+ Add Expense' },
          { href: '/payroll/log', label: '+ Log Payroll' },
          { href: '/inventory', label: 'Check Stock' },
        ].map(({ href, label }) => (
          <Link key={href} href={href} className="bg-white border border-gray-100 rounded-xl p-4 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors text-center shadow-sm">
            {label}
          </Link>
        ))}
      </div>

      {/* Low Stock Alerts */}
      {data.lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-amber-800">Low Stock Alerts</h2>
            <Link href="/inventory" className="text-xs text-amber-700 hover:text-amber-900">View inventory →</Link>
          </div>
          <div className="space-y-2">
            {data.lowStock.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-amber-900">{item.name}</span>
                <span className="text-amber-700">{item.currentStock} {item.unit} (reorder at {item.reorderLevel})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, trend, highlight }: { label: string; value: string; trend?: number; highlight?: 'green' | 'amber' | 'red' }) {
  const colour = highlight === 'green' ? 'text-green-600' : highlight === 'amber' ? 'text-amber-600' : highlight === 'red' ? 'text-red-600' : 'text-gray-900'
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colour}`}>{value}</p>
      {trend !== undefined && (
        <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs last week
        </p>
      )}
    </div>
  )
}

function Row({ label, value, negative, bold, colour }: { label: string; value: string; negative?: boolean; bold?: boolean; colour?: string }) {
  return (
    <div className="flex justify-between">
      <span className={`text-gray-600 ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`${bold ? 'font-semibold' : ''} ${colour ?? (negative ? 'text-red-600' : 'text-gray-900')}`}>
        {negative ? '−' : ''}{value}
      </span>
    </div>
  )
}
