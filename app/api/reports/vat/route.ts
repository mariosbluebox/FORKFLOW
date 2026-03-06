import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'

export async function GET(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const to = searchParams.get('to') ? new Date(searchParams.get('to')! + 'T23:59:59.999Z') : new Date()

  const [revenueAgg, expenseAgg, reclaimableAgg] = await Promise.all([
    db.revenueEntry.aggregate({
      _sum: { grossAmount: true, vatAmount: true, netAmount: true },
      where: { restaurantId, date: { gte: from, lte: to } },
    }),
    db.expenseEntry.aggregate({
      _sum: { vatAmount: true },
      where: { restaurantId, date: { gte: from, lte: to } },
    }),
    db.expenseEntry.aggregate({
      _sum: { vatAmount: true },
      where: { restaurantId, date: { gte: from, lte: to }, vatReclaimable: true },
    }),
  ])

  const vatOnSales = revenueAgg._sum.vatAmount ?? 0
  const vatOnExpenses = expenseAgg._sum.vatAmount ?? 0
  const reclaimableVat = reclaimableAgg._sum.vatAmount ?? 0
  const netVatLiability = vatOnSales - reclaimableVat

  return NextResponse.json({
    period: { from: from.toISOString(), to: to.toISOString() },
    vatOnSales,
    vatOnExpenses,
    reclaimableVat,
    nonReclaimableVat: vatOnExpenses - reclaimableVat,
    netVatLiability,
    grossRevenue: revenueAgg._sum.grossAmount ?? 0,
    netRevenue: revenueAgg._sum.netAmount ?? 0,
  })
}
