import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  const body = await req.json()
  const { commissionRate, isActive } = body

  const existing = await db.platform.findFirst({ where: { id, restaurantId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.platform.update({
    where: { id },
    data: {
      ...(commissionRate !== undefined && { commissionRate: parseFloat(commissionRate) }),
      ...(isActive !== undefined && { isActive }),
    },
  })

  return NextResponse.json(updated)
}
