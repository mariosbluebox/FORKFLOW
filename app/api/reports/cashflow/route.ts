import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'

export async function GET(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const to = searchParams.get('to') ? new Date(searchParams.get('to')! + 'T23:59:59.999Z') : new Date()

  // Build weekly buckets
  const weeks: { weekStart: string; moneyIn: number; moneyOut: number; net: number }[] = []

  const current = new Date(from)
  while (current <= to) {
    const weekEnd = new Date(current)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    const capEnd = weekEnd > to ? to : weekEnd

    const [revAgg, expAgg, payAgg] = await Promise.all([
      db.revenueEntry.aggregate({
        _sum: { grossAmount: true },
        where: { restaurantId, date: { gte: new Date(current), lte: capEnd } },
      }),
      db.expenseEntry.aggregate({
        _sum: { grossAmount: true },
        where: { restaurantId, date: { gte: new Date(current), lte: capEnd } },
      }),
      db.payrollEntry.aggregate({
        _sum: { grossPay: true, employerNI: true },
        where: { restaurantId, periodStart: { gte: new Date(current) }, periodEnd: { lte: capEnd } },
      }),
    ])

    const moneyIn = revAgg._sum.grossAmount ?? 0
    const moneyOut = (expAgg._sum.grossAmount ?? 0) + (payAgg._sum.grossPay ?? 0) + (payAgg._sum.employerNI ?? 0)

    weeks.push({ weekStart: current.toISOString(), moneyIn, moneyOut, net: moneyIn - moneyOut })
    current.setDate(current.getDate() + 7)
  }

  const totalIn = weeks.reduce((s, w) => s + w.moneyIn, 0)
  const totalOut = weeks.reduce((s, w) => s + w.moneyOut, 0)

  return NextResponse.json({ period: { from: from.toISOString(), to: to.toISOString() }, weeks, totalIn, totalOut, netCashFlow: totalIn - totalOut })
}
