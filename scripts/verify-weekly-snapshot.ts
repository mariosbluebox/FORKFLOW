// Dev-only reconciliation: confirms getWeeklySnapshot matches the summary
// route's math within £0.01 for a real restaurant + week.
//
// Usage:
//   npm run verify:weekly-snapshot -- <restaurantId> [YYYY-MM-DD]
//
// The optional date is any day inside the target week (defaults to today).
// Requires DATABASE_URL in the environment (loaded via lib/env.ts).

import { PrismaClient } from '@prisma/client'
import {
  allocateAmount,
  computeAllocationTotals,
} from '../lib/analytics/allocation'
import {
  getWeeklySnapshot,
  isoWeekStart,
  isoWeekEnd,
} from '../lib/analytics/weekly-snapshot'

const TOLERANCE = 0.01

const prisma = new PrismaClient()

type RouteRow = {
  platformId: string
  platformName: string
  orders: number
  grossRevenue: number
  netRevenue: number
  commissionCharged: number
  promotionTotal: number
  foodCost: number
  allocatedOverhead: number
  netResult: number
}

// Mirrors app/api/platforms/summary/route.ts at the calculation level. Kept in
// sync by hand; if the route's math changes, update this block too.
async function computeRouteSummary(
  restaurantId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<RouteRow[]> {
  const [config, platforms, expenseSum, payrollSum] = await Promise.all([
    prisma.overheadAllocationConfig.findUnique({ where: { restaurantId } }),
    prisma.platform.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.expenseEntry.aggregate({
      where: { restaurantId, date: { gte: weekStart, lte: weekEnd } },
      _sum: { grossAmount: true },
    }),
    prisma.payrollEntry.aggregate({
      where: {
        restaurantId,
        periodStart: { gte: weekStart },
        periodEnd: { lte: weekEnd },
      },
      _sum: { grossPay: true, employerNI: true },
    }),
  ])

  const totalOverhead =
    (expenseSum._sum.grossAmount ?? 0) +
    (payrollSum._sum.grossPay ?? 0) +
    (payrollSum._sum.employerNI ?? 0)

  const foodCostPct = config?.foodCostPct ?? 0.28
  const method = config?.method ?? 'BY_ORDERS'

  const platformData = await Promise.all(
    platforms.map(async (p) => {
      const [periods, promotions] = await Promise.all([
        prisma.platformPeriod.aggregate({
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
        prisma.promotionCharge.aggregate({
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

  return platformData.map((pd) => {
    const allocatedOverhead = allocateAmount(pd, totals, method, totalOverhead)
    const foodCost = pd.grossRevenue * foodCostPct
    const netResult =
      pd.netRevenue - foodCost - allocatedOverhead - pd.promotionTotal

    return {
      platformId: pd.platform.id,
      platformName: pd.platform.name,
      orders: pd.orders,
      grossRevenue: pd.grossRevenue,
      netRevenue: pd.netRevenue,
      commissionCharged: pd.commissionCharged,
      promotionTotal: pd.promotionTotal,
      foodCost,
      allocatedOverhead,
      netResult,
    }
  })
}

function fmt(n: number): string {
  return n.toFixed(4).padStart(12)
}

async function main() {
  const [restaurantId, dateArg] = process.argv.slice(2)
  if (!restaurantId) {
    console.error('Usage: verify-weekly-snapshot.ts <restaurantId> [YYYY-MM-DD]')
    process.exit(2)
  }

  const baseDate = dateArg ? new Date(dateArg + 'T12:00:00Z') : new Date()
  const weekStart = isoWeekStart(baseDate)
  const weekEnd = isoWeekEnd(weekStart)

  console.log(`Restaurant: ${restaurantId}`)
  console.log(`Week:       ${weekStart.toISOString()} → ${weekEnd.toISOString()}`)
  console.log('')

  const [snapshot, routeRows] = await Promise.all([
    getWeeklySnapshot(restaurantId, baseDate),
    computeRouteSummary(restaurantId, weekStart, weekEnd),
  ])

  const routeById = new Map(routeRows.map((r) => [r.platformId, r]))
  const failures: string[] = []

  for (const ch of snapshot.channels) {
    const route = routeById.get(ch.platformId)
    if (!route) {
      failures.push(`${ch.platformName}: no matching route row`)
      continue
    }

    const checks: Array<[string, number, number]> = [
      ['orders', ch.orders, route.orders],
      ['grossRevenue', ch.grossRevenue, route.grossRevenue],
      ['netRevenue', ch.netRevenue, route.netRevenue],
      ['commission', ch.commission, route.commissionCharged],
      ['promoSpend', ch.promoSpend, route.promotionTotal],
      ['foodCost', ch.allocatedFoodCost, route.foodCost],
      // Snapshot splits overhead and payroll; route merges them.
      [
        'overhead+payroll',
        ch.allocatedOverhead + ch.allocatedPayroll,
        route.allocatedOverhead,
      ],
      [
        'netProfit',
        ch.netProfit,
        route.netResult,
      ],
    ]

    console.log(`── ${ch.platformName} ──`)
    for (const [label, snap, rt] of checks) {
      const diff = snap - rt
      const ok = Math.abs(diff) <= TOLERANCE
      const flag = ok ? 'OK ' : 'FAIL'
      console.log(
        `  ${flag} ${label.padEnd(18)} snapshot=${fmt(snap)}  route=${fmt(rt)}  Δ=${fmt(diff)}`
      )
      if (!ok) failures.push(`${ch.platformName}.${label} Δ=${diff.toFixed(4)}`)
    }
  }

  for (const route of routeRows) {
    if (!snapshot.channels.find((c) => c.platformId === route.platformId)) {
      failures.push(`${route.platformName}: missing from snapshot`)
    }
  }

  console.log('')
  if (failures.length === 0) {
    console.log(`PASS — all values within £${TOLERANCE.toFixed(2)}`)
  } else {
    console.log(`FAIL — ${failures.length} mismatch(es):`)
    for (const f of failures) console.log(`  - ${f}`)
  }

  await prisma.$disconnect()
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
