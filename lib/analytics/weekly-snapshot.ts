import type { AllocationMethod } from '@prisma/client'
import { db } from '@/lib/db'
import { allocateAmount, computeAllocationTotals } from '@/lib/analytics/allocation'

const DEFAULT_FOOD_COST_PCT = 0.28
const DEFAULT_METHOD: AllocationMethod = 'BY_ORDERS'

export type WeeklyChannelSnapshot = {
  platformId: string
  platformName: string
  orders: number
  grossRevenue: number
  netRevenue: number
  commission: number
  promoSpend: number
  allocatedFoodCost: number
  allocatedOverhead: number
  allocatedPayroll: number
  netProfit: number
}

export type WeeklySnapshot = {
  weekStart: Date
  weekEnd: Date
  foodCostPct: number
  method: AllocationMethod
  channels: WeeklyChannelSnapshot[]
}

// Snap any date to ISO-Monday 00:00:00.000 UTC of its week.
export function isoWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const daysSinceMonday = (day + 6) % 7
  d.setUTCDate(d.getUTCDate() - daysSinceMonday)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

// Sunday 23:59:59.999 UTC of the week beginning at `weekStart`.
export function isoWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setUTCDate(d.getUTCDate() + 6)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

export async function getWeeklySnapshot(
  restaurantId: string,
  weekStartInput: Date
): Promise<WeeklySnapshot> {
  const weekStart = isoWeekStart(weekStartInput)
  const weekEnd = isoWeekEnd(weekStart)

  const [config, platforms, expenseSum, payrollSum] = await Promise.all([
    db.overheadAllocationConfig.findUnique({ where: { restaurantId } }),
    db.platform.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { name: 'asc' },
    }),
    db.expenseEntry.aggregate({
      where: { restaurantId, date: { gte: weekStart, lte: weekEnd } },
      _sum: { grossAmount: true },
    }),
    db.payrollEntry.aggregate({
      where: {
        restaurantId,
        periodStart: { gte: weekStart },
        periodEnd: { lte: weekEnd },
      },
      _sum: { grossPay: true, employerNI: true },
    }),
  ])

  const foodCostPct = config?.foodCostPct ?? DEFAULT_FOOD_COST_PCT
  const method = config?.method ?? DEFAULT_METHOD

  const totalOverheadExpense = expenseSum._sum.grossAmount ?? 0
  const totalPayroll = (payrollSum._sum.grossPay ?? 0) + (payrollSum._sum.employerNI ?? 0)

  const platformData = await Promise.all(
    platforms.map(async (p) => {
      const [periods, promotions] = await Promise.all([
        db.platformPeriod.aggregate({
          where: {
            restaurantId,
            platformId: p.id,
            periodStart: { gte: weekStart },
            periodEnd: { lte: weekEnd },
          },
          _sum: {
            orderCount: true,
            grossRevenue: true,
            commissionCharged: true,
            netRevenue: true,
          },
        }),
        db.promotionCharge.aggregate({
          where: {
            restaurantId,
            platformId: p.id,
            periodStart: { gte: weekStart },
            periodEnd: { lte: weekEnd },
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

  const totals = computeAllocationTotals(platformData)

  const channels: WeeklyChannelSnapshot[] = platformData.map((pd) => {
    const allocatedOverhead = allocateAmount(pd, totals, method, totalOverheadExpense)
    const allocatedPayroll = allocateAmount(pd, totals, method, totalPayroll)
    const allocatedFoodCost = pd.grossRevenue * foodCostPct
    const netProfit =
      pd.netRevenue -
      allocatedFoodCost -
      allocatedOverhead -
      allocatedPayroll -
      pd.promotionTotal

    return {
      platformId: pd.platform.id,
      platformName: pd.platform.name,
      orders: pd.orders,
      grossRevenue: pd.grossRevenue,
      netRevenue: pd.netRevenue,
      commission: pd.commissionCharged,
      promoSpend: pd.promotionTotal,
      allocatedFoodCost,
      allocatedOverhead,
      allocatedPayroll,
      netProfit,
    }
  })

  return { weekStart, weekEnd, foodCostPct, method, channels }
}
