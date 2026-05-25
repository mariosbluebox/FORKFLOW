import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'
import { hasFeature } from '@/lib/feature-gate'
import {
  decodePromoEntityId,
  LABOUR_AGGREGATE_ID,
  INGREDIENT_AGGREGATE_ID,
} from '@/lib/analytics/expectancy'

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

  const [platformSnapshots, promoSnapshots, labourSnapshot, ingredientSnapshot, platforms] =
    await Promise.all([
      db.expectancySnapshot.findMany({
        where: { restaurantId, entityType: 'PLATFORM' },
      }),
      db.expectancySnapshot.findMany({
        where: { restaurantId, entityType: 'PROMOTION' },
      }),
      db.expectancySnapshot.findFirst({
        where: { restaurantId, entityType: 'EMPLOYEE', entityId: LABOUR_AGGREGATE_ID },
      }),
      db.expectancySnapshot.findFirst({
        where: {
          restaurantId,
          entityType: 'INGREDIENT',
          entityId: INGREDIENT_AGGREGATE_ID,
        },
      }),
      db.platform.findMany({
        where: { restaurantId },
        select: { id: true, name: true },
      }),
    ])

  const platformNameById = new Map(platforms.map((p) => [p.id, p.name]))

  const channels = platformSnapshots
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

  const promotions = promoSnapshots
    .map((s) => {
      const { platformId, promotionType } = decodePromoEntityId(s.entityId)
      return {
        platformId,
        platformName: platformNameById.get(platformId) ?? '(unknown)',
        promotionType,
        expectancy: s.expectancy,
        winRate: s.winRate,
        avgWin: s.avgWin,
        avgLoss: s.avgLoss,
        periodWeeks: s.periodWeeks,
        calculatedAt: s.calculatedAt,
      }
    })
    .sort(
      (a, b) =>
        a.platformName.localeCompare(b.platformName) ||
        a.promotionType.localeCompare(b.promotionType)
    )

  return NextResponse.json({
    channels,
    promotions,
    labour: labourSnapshot
      ? {
          expectancy: labourSnapshot.expectancy,
          winRate: labourSnapshot.winRate,
          avgWin: labourSnapshot.avgWin,
          avgLoss: labourSnapshot.avgLoss,
          periodWeeks: labourSnapshot.periodWeeks,
          calculatedAt: labourSnapshot.calculatedAt,
        }
      : null,
    ingredients: ingredientSnapshot
      ? {
          expectancy: ingredientSnapshot.expectancy,
          winRate: ingredientSnapshot.winRate,
          avgWin: ingredientSnapshot.avgWin,
          avgLoss: ingredientSnapshot.avgLoss,
          periodWeeks: ingredientSnapshot.periodWeeks,
          calculatedAt: ingredientSnapshot.calculatedAt,
        }
      : null,
  })
}
