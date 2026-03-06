import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'

export async function GET() {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const platforms = await db.platform.findMany({
    where: { restaurantId },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(platforms)
}
