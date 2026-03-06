import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  const { name, unit, currentStock, reorderLevel, costPerUnit } = await req.json()

  const item = await db.inventoryItem.update({
    where: { id, restaurantId },
    data: {
      name,
      unit,
      currentStock: parseFloat(currentStock),
      reorderLevel: parseFloat(reorderLevel),
      costPerUnit: parseFloat(costPerUnit),
    },
  })

  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  await db.inventoryItem.delete({ where: { id, restaurantId } })
  return NextResponse.json({ success: true })
}
