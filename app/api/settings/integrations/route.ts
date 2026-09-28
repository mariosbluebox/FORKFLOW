import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, requireFeature } from '@/lib/session'

export async function GET() {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()
  const denied = await requireFeature(restaurantId, 'email-ingestion')
  if (denied) return denied

  const [restaurant, importLogs] = await Promise.all([
    db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { inboundEmail: true },
    }),
    db.importLog.findMany({
      where: { restaurantId },
      orderBy: { receivedAt: 'desc' },
      take: 20,
    }),
  ])

  return NextResponse.json({
    inboundEmail: restaurant?.inboundEmail ?? '',
    importLogs,
  })
}
