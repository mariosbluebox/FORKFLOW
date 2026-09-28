import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, requireFeature } from '@/lib/session'
import { allocateAmount, computeAllocationTotals } from '@/lib/analytics/allocation'

export async function GET(req: Request) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()
  const denied = await requireFeature(restaurantId, 'platforms')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  const fromDate = new Date(from)
  const toDate = new Date(to + 'T23:59:59')

  const [config, platforms, expenseSum, payrollSum] = await Promise.all([
    db.overheadAllocationConfig.findUnique({ where: { restaurantId } }),
    db.platform.findMany({ where: { restaurantId, isActive: true }, orderBy: { name: 'asc' } }),
    db.expenseEntry.aggregate({
      where: { restaurantId, date: { gte: fromDate, lte: toDate } },
      _sum: { grossAmount: true },
    }),
    db.payrollEntry.aggregate({
      where: { restaurantId, periodStart: { gte: fromDate }, periodEnd: { lte: toDate } },
      _sum: { grossPay: true, employerNI: true },
    }),
  ])

  const totalOverhead =
    (expenseSum._sum.grossAmount ?? 0) +
    (payrollSum._sum.grossPay ?? 0) +
    (payrollSum._sum.employerNI ?? 0)

  const foodCostPct = config?.foodCostPct ?? 0.28
  const method = config?.method ?? 'BY_ORDERS'

  // Fetch per-platform aggregates
  const platformData = await Promise.all(
    platforms.map(async (p) => {
      const [periods, promotions] = await Promise.all([
        db.platformPeriod.aggregate({
          where: {
            restaurantId,
            platformId: p.id,
            periodStart: { gte: fromDate },
            periodEnd: { lte: toDate },
          },
          _sum: { orderCount: true, grossRevenue: true, commissionCharged: true, netRevenue: true },
        }),
        db.promotionCharge.aggregate({
          where: {
            restaurantId,
            platformId: p.id,
            periodStart: { gte: fromDate },
            periodEnd: { lte: toDate },
          },
          _sum: { chargeAmount: true },
        }),
      ])

      return {
        platform: p,
        orders: periods._sum.orderCount ?? 0,
        grossRevenue: periods._sum.grossRevenue ?? 0,
        commissionCharged: periods._sum.commissionCharged ?? 0,
        netRevenue: periods._sum.netRevenue ?? 0,
        promotionTotal: promotions._sum.chargeAmount ?? 0,
      }
    })
  )

  const allocationTotals = computeAllocationTotals(platformData)

  const results = platformData.map((pd) => {
    const allocatedOverhead = allocateAmount(pd, allocationTotals, method, totalOverhead)

    const foodCost = pd.grossRevenue * foodCostPct
    const netResult = pd.netRevenue - foodCost - allocatedOverhead - pd.promotionTotal
    const expectancyPerOrder = pd.orders > 0 ? netResult / pd.orders : null
    const netMarginPct = pd.grossRevenue > 0 ? (netResult / pd.grossRevenue) * 100 : null
    const avgOrderValue = pd.orders > 0 ? pd.grossRevenue / pd.orders : 0

    // Break-even calculation
    const commissionRate = pd.platform.commissionRate
    const netRevenuePerOrder = avgOrderValue * (1 - commissionRate)
    const avgFoodCostPerOrder = avgOrderValue * foodCostPct
    const contributionPerOrder = netRevenuePerOrder - avgFoodCostPerOrder
    const breakEvenOrders =
      contributionPerOrder > 0
        ? Math.ceil((allocatedOverhead + pd.promotionTotal) / contributionPerOrder)
        : null

    // ROI on promotion
    const totalCosts = foodCost + allocatedOverhead + pd.commissionCharged + pd.promotionTotal
    const promotionROI =
      pd.promotionTotal > 0 ? ((pd.netRevenue - totalCosts) / pd.promotionTotal) * 100 : null

    return {
      platformId: pd.platform.id,
      platformName: pd.platform.name,
      commissionRate: pd.platform.commissionRate,
      orders: pd.orders,
      grossRevenue: pd.grossRevenue,
      commissionCharged: pd.commissionCharged,
      netRevenue: pd.netRevenue,
      avgOrderValue,
      promotionTotal: pd.promotionTotal,
      foodCost,
      foodCostPct,
      allocatedOverhead,
      netResult,
      expectancyPerOrder,
      netMarginPct,
      breakEvenOrders,
      promotionROI,
      hasData: pd.orders > 0 || pd.grossRevenue > 0,
    }
  })

  return NextResponse.json({
    platforms: results,
    totals: {
      totalOrders: allocationTotals.orders,
      totalRevenue: allocationTotals.grossRevenue,
      totalOverhead,
      foodCostPct,
      method,
    },
  })
}
