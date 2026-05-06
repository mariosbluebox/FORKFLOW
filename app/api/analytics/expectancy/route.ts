import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'
import { hasFeature } from '@/lib/feature-gate'

export async function GET() {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { plan: true, trialEndsAt: true },
  })
  if (!restaurant) return unauthorized()

  if (!hasFeature(restaurant.plan, 'analytics', restaurant.trialEndsAt.toISOString())) {
    return NextResponse.json({ error: 'Upgrade required' }, { status: 403 })
  }

  const [snapshots, platforms] = await Promise.all([
    db.expectancySnapshot.findMany({
      where: { restaurantId, entityType: 'PLATFORM' },
    }),
    db.platform.findMany({
      where: { restaurantId },
      select: { id: true, name: true },
    }),
  ])

  const platformNameById = new Map(platforms.map((p) => [p.id, p.name]))

  const channels = snapshots
    .map((s) => ({
      platformId: s.entityId,
      platformName: platformNameById.get(s.entityId) ?? '(unknown)',
      expectancy: s.expectancy,
      winRate: s.winRate,
      avgWin: s.avgWin,
      avgLoss: s.avgLoss,
      periodWeeks: s.periodWeeks,
      calculatedAt: s.calculatedAt,
    }))
    .sort((a, b) => a.platformName.localeCompare(b.platformName))

  return NextResponse.json({
    channels,
    promotions: [],
    labour: null,
    ingredients: null,
  })
}
