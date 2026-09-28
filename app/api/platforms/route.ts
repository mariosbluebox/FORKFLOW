import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, requireFeature } from '@/lib/session'

export async function GET() {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()
  const denied = await requireFeature(restaurantId, 'platforms')
  if (denied) return denied

  const platforms = await db.platform.findMany({
    where: { restaurantId },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(platforms)
}
