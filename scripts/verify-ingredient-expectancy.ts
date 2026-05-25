// Dev-only: runs recomputeIngredientExpectancy against a real restaurant +
// anchor week, then cross-checks the stored ExpectancySnapshot row against
// an independent recomputation from the underlying weekly snapshots +
// StockMovement (OUT + WASTAGE).
//
// Usage:
//   npm run verify:ingredient-expectancy -- <restaurantId> [YYYY-MM-DD] [windowWeeks]
//
// The optional date is any day inside the anchor (latest) week — defaults to
// today. windowWeeks defaults to 8.

import { PrismaClient } from '@prisma/client'
import {
  computeExpectancy,
  recomputeIngredientExpectancy,
  INGREDIENT_AGGREGATE_ID,
} from '../lib/analytics/expectancy'
import {
  getWeeklySnapshot,
  isoWeekStart,
  isoWeekEnd,
} from '../lib/analytics/weekly-snapshot'

const TOLERANCE = 1e-6

const prisma = new PrismaClient()

function fmt(n: number): string {
  return n.toFixed(6).padStart(14)
}

async function main() {
  const [restaurantId, dateArg, weeksArg] = process.argv.slice(2)
  if (!restaurantId) {
    console.error(
      'Usage: verify-ingredient-expectancy.ts <restaurantId> [YYYY-MM-DD] [windowWeeks]'
    )
    process.exit(2)
  }

  const anchorDate = dateArg ? new Date(dateArg + 'T12:00:00Z') : new Date()
  const windowWeeks = weeksArg ? Number.parseInt(weeksArg, 10) : 8
  if (!Number.isFinite(windowWeeks) || windowWeeks < 1) {
    console.error(`Invalid windowWeeks: ${weeksArg}`)
    process.exit(2)
  }

  const anchor = isoWeekStart(anchorDate)
  console.log(`Restaurant:  ${restaurantId}`)
  console.log(`Anchor week: ${anchor.toISOString()} (windowWeeks=${windowWeeks})`)
  console.log('')

  const computed = await recomputeIngredientExpectancy(restaurantId, {
    anchorDate,
    windowWeeks,
  })

  const stored = await prisma.expectancySnapshot.findFirst({
    where: {
      restaurantId,
      entityType: 'INGREDIENT',
      entityId: INGREDIENT_AGGREGATE_ID,
    },
  })

  const weekStarts: Date[] = []
  for (let i = 0; i < windowWeeks; i++) {
    const d = new Date(anchor)
    d.setUTCDate(d.getUTCDate() - 7 * i)
    weekStarts.push(d)
  }

  const [snapshots, costsByWeek] = await Promise.all([
    Promise.all(weekStarts.map((ws) => getWeeklySnapshot(restaurantId, ws))),
    Promise.all(
      weekStarts.map((ws) =>
        prisma.stockMovement.aggregate({
          where: {
            restaurantId,
            type: { in: ['OUT', 'WASTAGE'] },
            date: { gte: ws, lte: isoWeekEnd(ws) },
          },
          _sum: { totalCost: true },
        })
      )
    ),
  ])

  const series: number[] = []
  for (let i = 0; i < weekStarts.length; i++) {
    const totalCost = costsByWeek[i]._sum.totalCost ?? 0
    if (totalCost === 0) continue
    const totalNetProfit = snapshots[i].channels.reduce(
      (s, c) => s + c.netProfit,
      0
    )
    series.push(totalNetProfit / totalCost)
  }

  const independent = computeExpectancy(series)

  console.log(`── Ingredient (aggregate) ──`)
  console.log(`  series (${series.length}): [${series.map((s) => s.toFixed(4)).join(', ')}]`)

  const failures: string[] = []

  if (!computed && independent.dataPoints > 0) {
    failures.push('recomputeIngredientExpectancy returned null but independent found data')
    console.log('  FAIL returned null unexpectedly')
  } else if (computed && independent.dataPoints === 0) {
    failures.push('recomputeIngredientExpectancy returned data but independent found none')
    console.log('  FAIL returned data but no independent series')
  } else if (!computed && independent.dataPoints === 0) {
    console.log('  (no data in window — nothing to verify)')
  } else if (computed && stored) {
    const checks: Array<[string, number, number, number]> = [
      ['winRate',     independent.winRate,    computed.winRate,    stored.winRate],
      ['avgWin',      independent.avgWin,     computed.avgWin,     stored.avgWin],
      ['avgLoss',     independent.avgLoss,    computed.avgLoss,    stored.avgLoss],
      ['expectancy',  independent.expectancy, computed.expectancy, stored.expectancy],
      ['periodWeeks', independent.dataPoints, computed.dataPoints, stored.periodWeeks],
    ]

    for (const [label, indep, retVal, storedVal] of checks) {
      const okRet = Math.abs(indep - retVal) <= TOLERANCE
      const okStored = Math.abs(indep - storedVal) <= TOLERANCE
      const ok = okRet && okStored
      const flag = ok ? 'OK  ' : 'FAIL'
      console.log(
        `  ${flag} ${label.padEnd(12)} indep=${fmt(indep)}  ret=${fmt(retVal)}  stored=${fmt(storedVal)}`
      )
      if (!ok) {
        failures.push(
          `${label}: indep=${indep} ret=${retVal} stored=${storedVal}`
        )
      }
    }
  } else if (computed && !stored) {
    failures.push('recomputeIngredientExpectancy returned data but no stored row found')
    console.log('  FAIL no stored row')
  }

  console.log('')
  if (failures.length === 0) {
    console.log(`PASS — all values agree within ${TOLERANCE}`)
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
