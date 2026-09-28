import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, requireFeature } from '@/lib/session'

export async function GET() {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()
  const denied = await requireFeature(restaurantId, 'platforms')
  if (denied) return denied

  const config = await db.overheadAllocationConfig.findUnique({ where: { restaurantId } })
  return NextResponse.json(config ?? { method: 'BY_ORDERS', foodCostPct: 0.28 })
}

export async function PUT(req: Request) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()
  const denied = await requireFeature(restaurantId, 'platforms')
  if (denied) return denied

  const body = await req.json()
  const { method, foodCostPct } = body

  const config = await db.overheadAllocationConfig.upsert({
    where: { restaurantId },
    create: {
      restaurantId,
      method: method ?? 'BY_ORDERS',
      foodCostPct: foodCostPct !== undefined ? parseFloat(foodCostPct) : 0.28,
    },
    update: {
      ...(method && { method }),
      ...(foodCostPct !== undefined && { foodCostPct: parseFloat(foodCostPct) }),
    },
  })

  return NextResponse.json(config)
}
