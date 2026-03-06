import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'

export async function GET(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const to = searchParams.get('to') ? new Date(searchParams.get('to')! + 'T23:59:59.999Z') : new Date()

  const [entries, revAgg] = await Promise.all([
    db.payrollEntry.findMany({
      where: { restaurantId, periodStart: { gte: from }, periodEnd: { lte: to } },
      include: { employee: true },
      orderBy: { periodStart: 'desc' },
    }),
    db.revenueEntry.aggregate({
      _sum: { netAmount: true },
      where: { restaurantId, date: { gte: from, lte: to } },
    }),
  ])

  // Per-employee summary
  const byEmployee: Record<string, { name: string; type: string; grossPay: number; employerNI: number; hoursWorked: number }> = {}
  for (const e of entries) {
    if (!byEmployee[e.employeeId]) {
      byEmployee[e.employeeId] = { name: e.employee.name, type: e.employee.type, grossPay: 0, employerNI: 0, hoursWorked: 0 }
    }
    byEmployee[e.employeeId].grossPay += e.grossPay
    byEmployee[e.employeeId].employerNI += e.employerNI
    byEmployee[e.employeeId].hoursWorked += e.hoursWorked ?? 0
  }

  const totalGross = entries.reduce((s, e) => s + e.grossPay, 0)
  const totalNI = entries.reduce((s, e) => s + e.employerNI, 0)
  const totalRevNet = revAgg._sum.netAmount ?? 0
  const labourPct = totalRevNet > 0 ? ((totalGross + totalNI) / totalRevNet) * 100 : 0

  return NextResponse.json({
    period: { from: from.toISOString(), to: to.toISOString() },
    entries,
    byEmployee: Object.values(byEmployee),
    totalGross,
    totalNI,
    totalCost: totalGross + totalNI,
    labourPct,
    netRevenue: totalRevNet,
  })
}
