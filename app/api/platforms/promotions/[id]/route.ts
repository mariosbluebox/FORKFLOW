import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, requireFeature } from '@/lib/session'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()
  const denied = await requireFeature(restaurantId, 'platforms')
  if (denied) return denied

  const { id } = await params
  const existing = await db.promotionCharge.findFirst({ where: { id, restaurantId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.promotionCharge.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
