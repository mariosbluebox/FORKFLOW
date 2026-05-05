import type { ExpectancyEntityType } from '@prisma/client'
import { db } from '@/lib/db'
import { getWeeklySnapshot, isoWeekStart } from '@/lib/analytics/weekly-snapshot'

const DEFAULT_WINDOW_WEEKS = 8

export type ExpectancyResult = {
  winRate: number
  avgWin: number
  avgLoss: number
  expectancy: number
  dataPoints: number
}

// Pure: trading-style expectancy over a series of "£ profit per unit" data
// points. One data point = one week. Caller filters out zero-activity weeks
// before calling — this function trusts every value it receives.
export function computeExpectancy(profitsPerUnit: number[]): ExpectancyResult {
  const n = profitsPerUnit.length
  if (n === 0) {
    return { winRate: 0, avgWin: 0, avgLoss: 0, expectancy: 0, dataPoints: 0 }
  }

  const wins: number[] = []
  const losses: number[] = []
  for (const p of profitsPerUnit) {
    if (p > 0) wins.push(p)
    else losses.push(p)
  }

  const winRate = wins.length / n
  const lossRate = losses.length / n
  const avgWin =
    wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0
  const avgLoss =
    losses.length > 0
      ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length)
      : 0
  const expectancy = winRate * avgWin - lossRate * avgLoss

  return { winRate, avgWin, avgLoss, expectancy, dataPoints: n }
}

export type ChannelExpectancyRow = ExpectancyResult & {
  platformId: string
  platformName: string
}

export type RecomputeChannelExpectancyOptions = {
  windowWeeks?: number
  // Snapped to ISO Monday. The anchor week is included; we look back
  // (windowWeeks - 1) further weeks. Defaults to "now".
  anchorDate?: Date
}

// Pulls the last N weekly snapshots, builds a per-platform series of
// £/order, computes expectancy, and upserts ExpectancySnapshot rows with
// entityType=PLATFORM. Returns one row per platform that had any orders
// in the window. Platforms with zero orders across the whole window are
// skipped (no row written, no row deleted).
export async function recomputeChannelExpectancy(
  restaurantId: string,
  options: RecomputeChannelExpectancyOptions = {}
): Promise<ChannelExpectancyRow[]> {
  const windowWeeks = options.windowWeeks ?? DEFAULT_WINDOW_WEEKS
  const anchor = isoWeekStart(options.anchorDate ?? new Date())

  const weekStarts: Date[] = []
  for (let i = 0; i < windowWeeks; i++) {
    const d = new Date(anchor)
    d.setUTCDate(d.getUTCDate() - 7 * i)
    weekStarts.push(d)
  }

  const snapshots = await Promise.all(
    weekStarts.map((ws) => getWeeklySnapshot(restaurantId, ws))
  )

  // Group £/order series by platform. Zero-order weeks are silently
  // skipped — a week with no orders carries no signal either direction.
  const byPlatform = new Map<
    string,
    { name: string; series: number[] }
  >()
  for (const snap of snapshots) {
    for (const ch of snap.channels) {
      if (ch.orders === 0) continue
      const profitPerOrder = ch.netProfit / ch.orders
      let bucket = byPlatform.get(ch.platformId)
      if (!bucket) {
        bucket = { name: ch.platformName, series: [] }
        byPlatform.set(ch.platformId, bucket)
      }
      bucket.series.push(profitPerOrder)
    }
  }

  const PLATFORM: ExpectancyEntityType = 'PLATFORM'
  const results: ChannelExpectancyRow[] = []

  for (const [platformId, { name, series }] of byPlatform) {
    const r = computeExpectancy(series)
    if (r.dataPoints === 0) continue

    await db.expectancySnapshot.upsert({
      where: {
        restaurantId_entityType_entityId: {
          restaurantId,
          entityType: PLATFORM,
          entityId: platformId,
        },
      },
      create: {
        restaurantId,
        entityType: PLATFORM,
        entityId: platformId,
        periodWeeks: r.dataPoints,
        winRate: r.winRate,
        avgWin: r.avgWin,
        avgLoss: r.avgLoss,
        expectancy: r.expectancy,
      },
      update: {
        periodWeeks: r.dataPoints,
        winRate: r.winRate,
        avgWin: r.avgWin,
        avgLoss: r.avgLoss,
        expectancy: r.expectancy,
        calculatedAt: new Date(),
      },
    })

    results.push({ platformId, platformName: name, ...r })
  }

  return results
}
