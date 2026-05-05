// Dev-only: runs recomputeChannelExpectancy against a real restaurant +
// anchor week, then cross-checks each stored ExpectancySnapshot row against
// an independent recomputation from the underlying weekly snapshots.
//
// Usage:
//   npm run verify:channel-expectancy -- <restaurantId> [YYYY-MM-DD] [windowWeeks]
//
// The optional date is any day inside the anchor (latest) week — defaults to
// today. windowWeeks defaults to 8.

import { PrismaClient } from '@prisma/client'
import {
  computeExpectancy,
  recomputeChannelExpectancy,
} from '../lib/analytics/expectancy'
import {
  getWeeklySnapshot,
  isoWeekStart,
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
      'Usage: verify-channel-expectancy.ts <restaurantId> [YYYY-MM-DD] [windowWeeks]'
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

  // Run the function under test.
  const computed = await recomputeChannelExpectancy(restaurantId, {
    anchorDate,
    windowWeeks,
  })

  // Read back what the function persisted.
  const stored = await prisma.expectancySnapshot.findMany({
    where: { restaurantId, entityType: 'PLATFORM' },
  })
  const storedById = new Map(stored.map((s) => [s.entityId, s]))

  // Independent recomputation — re-fetch the weekly snapshots and hand-build
  // each platform's £/order series, then call computeExpectancy. If the
  // function under test deviates from the pure helper or skips a week, this
  // surfaces it.
  const weekStarts: Date[] = []
  for (let i = 0; i < windowWeeks; i++) {
    const d = new Date(anchor)
    d.setUTCDate(d.getUTCDate() - 7 * i)
    weekStarts.push(d)
  }
  const snapshots = await Promise.all(
    weekStarts.map((ws) => getWeeklySnapshot(restaurantId, ws))
  )
  const seriesByPlatform = new Map<string, { name: string; series: number[] }>()
  for (const snap of snapshots) {
    for (const ch of snap.channels) {
      if (ch.orders === 0) continue
      let bucket = seriesByPlatform.get(ch.platformId)
      if (!bucket) {
        bucket = { name: ch.platformName, series: [] }
        seriesByPlatform.set(ch.platformId, bucket)
      }
      bucket.series.push(ch.netProfit / ch.orders)
    }
  }

  const failures: string[] = []

  // Every platform with data should have a stored row, a returned row, and
  // an independently-computed result that all agree.
  for (const [platformId, { name, series }] of seriesByPlatform) {
    const independent = computeExpectancy(series)
    const ret = computed.find((c) => c.platformId === platformId)
    const row = storedById.get(platformId)

    console.log(`── ${name} ──`)
    console.log(`  series (${series.length}): [${series.map((s) => s.toFixed(4)).join(', ')}]`)

    if (!ret) {
      failures.push(`${name}: missing from recompute return value`)
      console.log(`  FAIL no row in returned array`)
      continue
    }
    if (!row) {
      failures.push(`${name}: missing from ExpectancySnapshot rows`)
      console.log(`  FAIL no row persisted`)
      continue
    }

    const checks: Array<[string, number, number, number]> = [
      ['winRate',     independent.winRate,    ret.winRate,    row.winRate],
      ['avgWin',      independent.avgWin,     ret.avgWin,     row.avgWin],
      ['avgLoss',     independent.avgLoss,    ret.avgLoss,    row.avgLoss],
      ['expectancy',  independent.expectancy, ret.expectancy, row.expectancy],
      ['periodWeeks', independent.dataPoints, ret.dataPoints, row.periodWeeks],
    ]

    for (const [label, indep, retVal, stored] of checks) {
      const okRet = Math.abs(indep - retVal) <= TOLERANCE
      const okStored = Math.abs(indep - stored) <= TOLERANCE
      const ok = okRet && okStored
      const flag = ok ? 'OK  ' : 'FAIL'
      console.log(
        `  ${flag} ${label.padEnd(12)} indep=${fmt(indep)}  ret=${fmt(retVal)}  stored=${fmt(stored)}`
      )
      if (!ok) {
        failures.push(
          `${name}.${label}: indep=${indep} ret=${retVal} stored=${stored}`
        )
      }
    }
  }

  // Reverse: check no stored row exists for a platform not in our series.
  for (const row of stored) {
    if (!seriesByPlatform.has(row.entityId)) {
      console.log(
        `── (stored row for platformId=${row.entityId}, but no series in current window — likely stale from a prior run)`
      )
    }
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
