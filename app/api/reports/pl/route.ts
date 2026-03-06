import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'

export async function GET(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const to = searchParams.get('to') ? new Date(searchParams.get('to')! + 'T23:59:59.999Z') : new Date()

  const [revenueAgg, expensesByCategory, payrollAgg] = await Promise.all([
    // Revenue by source
    db.revenueEntry.groupBy({
      by: ['source'],
      _sum: { grossAmount: true, vatAmount: true, netAmount: true },
      where: { restaurantId, date: { gte: from, lte: to } },
    }),
    // Expenses by category
    db.expenseEntry.findMany({
      where: { restaurantId, date: { gte: from, lte: to } },
      include: { category: true },
      orderBy: { date: 'desc' },
    }),
    // Payroll totals
    db.payrollEntry.aggregate({
      _sum: { grossPay: true, employerNI: true },
      where: { restaurantId, periodStart: { gte: from }, periodEnd: { lte: to } },
    }),
  ])

  // Aggregate expenses by category
  const expCatMap: Record<string, { name: string; colour: string; net: number; vat: number; gross: number; reclaimable: number }> = {}
  for (const e of expensesByCategory) {
    const key = e.categoryId
    if (!expCatMap[key]) {
      expCatMap[key] = { name: e.category.name, colour: e.category.colour, net: 0, vat: 0, gross: 0, reclaimable: 0 }
    }
    expCatMap[key].net += e.netAmount
    expCatMap[key].vat += e.vatAmount
    expCatMap[key].gross += e.grossAmount
    if (e.vatReclaimable) expCatMap[key].reclaimable += e.vatAmount
  }

  const totalRevNet = revenueAgg.reduce((s, r) => s + (r._sum.netAmount ?? 0), 0)
  const totalExpNet = expensesByCategory.reduce((s, e) => s + e.netAmount, 0)
  const totalPayroll = (payrollAgg._sum.grossPay ?? 0) + (payrollAgg._sum.employerNI ?? 0)
  const netProfit = totalRevNet - totalExpNet - totalPayroll

  return NextResponse.json({
    period: { from: from.toISOString(), to: to.toISOString() },
    revenue: {
      bySource: revenueAgg,
      totalGross: revenueAgg.reduce((s, r) => s + (r._sum.grossAmount ?? 0), 0),
      totalVat: revenueAgg.reduce((s, r) => s + (r._sum.vatAmount ?? 0), 0),
      totalNet: totalRevNet,
    },
    expenses: {
      byCategory: Object.values(expCatMap),
      totalNet: totalExpNet,
    },
    payroll: {
      grossPay: payrollAgg._sum.grossPay ?? 0,
      employerNI: payrollAgg._sum.employerNI ?? 0,
      total: totalPayroll,
    },
    netProfit,
    labourPct: totalRevNet > 0 ? (totalPayroll / totalRevNet) * 100 : 0,
  })
}
