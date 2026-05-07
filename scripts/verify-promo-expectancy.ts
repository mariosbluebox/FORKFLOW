// Dev-only: runs recomputePromoExpectancy against a real restaurant +
// anchor week, then cross-checks each stored ExpectancySnapshot row
// (entityType=PROMOTION) against an independent recomputation built from
// the underlying weekly snapshots and PromotionCharge rows.
//
// Usage:
//   npm run verify:promo-expectancy -- <restaurantId> [YYYY-MM-DD] [windowWeeks]
//
// The optional date is any day inside the anchor (latest) week — defaults to
// today. windowWeeks defaults to 8.

import { PrismaClient } from '@prisma/client'
import {
  computeExpectancy,
  decodePromoEntityId,
  encodePromoEntityId,
  recomputePromoExpectancy,
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
      'Usage: verify-promo-expectancy.ts <restaurantId> [YYYY-MM-DD] [windowWeeks]'
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
  const computed = await recomputePromoExpectancy(restaurantId, {
    anchorDate,
    windowWeeks,
  })

  // Read back what the function persisted.
  const stored = await prisma.expectancySnapshot.findMany({
    where: { restaurantId, entityType: 'PROMOTION' },
  })
  const storedById = new Map(stored.map((s) => [s.entityId, s]))

  // Independent recomputation: rebuild per-(platform, promoType) series from
  // the same weekly snapshots and per-week PromotionCharge rows. Same logic
  // shape as recomputePromoExpectancy but written separately so a regression
  // in one surface doesn't mask the other.
  const weekStarts: Date[] = []
  for (let i = 0; i < windowWeeks; i++) {
    const d = new Date(anchor)
    d.setUTCDate(d.getUTCDate() - 7 * i)
    weekStarts.push(d)
  }

  const weekEndOf = (ws: Date): Date => {
    const e = new Date(ws)
    e.setUTCDate(e.getUTCDate() + 6)
    e.setUTCHours(23, 59, 59, 999)
    return e
  }

  const snapshots = await Promise.all(
    weekStarts.map((ws) => getWeeklySnapshot(restaurantId, ws))
  )
  const promoChargesByWeek = await Promise.all(
    weekStarts.map((ws) =>
      prisma.promotionCharge.findMany({
        where: {
          restaurantId,
          periodStart: { gte: ws },
          periodEnd: { lte: weekEndOf(ws) },
        },
        select: {
          platformId: true,
          promotionType: true,
          chargeAmount: true,
        },
      })
    )
  )

  const buckets = new Map<
    string,
    { platformName: string; promotionType: string; series: number[] }
  >()
  for (let i = 0; i < weekStarts.length; i++) {
    const snap = snapshots[i]
    const promos = promoChargesByWeek[i]
    if (promos.length === 0) continue

    const weekChargesByKey = new Map<
      string,
      { platformId: string; promotionType: string; chargeSum: number }
    >()
    for (const p of promos) {
      const k = encodePromoEntityId(p.platformId, p.promotionType)
      const existing = weekChargesByKey.get(k)
      if (existing) existing.chargeSum += p.chargeAmount
      else
        weekChargesByKey.set(k, {
          platformId: p.platformId,
          promotionType: p.promotionType,
          chargeSum: p.chargeAmount,
        })
    }

    const channelByPlatform = new Map(snap.channels.map((c) => [c.platformId, c]))

    for (const [k, w] of weekChargesByKey) {
      if (w.chargeSum === 0) continue
      const channel = channelByPlatform.get(w.platformId)
      if (!channel || channel.promoSpend === 0) continue

      const profitPerPromoPound = channel.netProfit / channel.promoSpend
      let bucket = buckets.get(k)
      if (!bucket) {
        bucket = {
          platformName: channel.platformName,
          promotionType: w.promotionType,
          series: [],
        }
        buckets.set(k, bucket)
      }
      bucket.series.push(profitPerPromoPound)
    }
  }

  const failures: string[] = []

  for (const [entityId, { platformName, promotionType, series }] of buckets) {
    const independent = computeExpectancy(series)
    const { platformId } = decodePromoEntityId(entityId)
    const ret = computed.find(
      (c) => c.platformId === platformId && c.promotionType === promotionType
    )
    const row = storedById.get(entityId)

    console.log(`── ${platformName} / ${promotionType || '(untyped)'} ──`)
    console.log(`  series (${series.length}): [${series.map((s) => s.toFixed(4)).join(', ')}]`)

    if (!ret) {
      failures.push(`${platformName}/${promotionType}: missing from recompute return value`)
      console.log(`  FAIL no row in returned array`)
      continue
    }
    if (!row) {
      failures.push(`${platformName}/${promotionType}: missing from ExpectancySnapshot rows`)
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

    for (const [label, indep, retVal, persisted] of checks) {
      const okRet = Math.abs(indep - retVal) <= TOLERANCE
      const okStored = Math.abs(indep - persisted) <= TOLERANCE
      const ok = okRet && okStored
      const flag = ok ? 'OK  ' : 'FAIL'
      console.log(
        `  ${flag} ${label.padEnd(12)} indep=${fmt(indep)}  ret=${fmt(retVal)}  stored=${fmt(persisted)}`
      )
      if (!ok) {
        failures.push(
          `${platformName}/${promotionType}.${label}: indep=${indep} ret=${retVal} stored=${persisted}`
        )
      }
    }
  }

  // Reverse: any stored PROMOTION row not in our buckets is stale.
  for (const row of stored) {
    if (!buckets.has(row.entityId)) {
      console.log(
        `── (stored PROMOTION row entityId=${row.entityId}, but no series in current window — likely stale from a prior run)`
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
