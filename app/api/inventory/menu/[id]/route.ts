import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  const { name, category, sellingPrice, foodCostTarget, isActive } = await req.json()

  const item = await db.menuItem.update({
    where: { id, restaurantId },
    data: { name, category, sellingPrice: parseFloat(sellingPrice), foodCostTarget: parseFloat(foodCostTarget), isActive: isActive !== false },
  })

  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  await db.menuItem.delete({ where: { id, restaurantId } })
  return NextResponse.json({ success: true })
}
