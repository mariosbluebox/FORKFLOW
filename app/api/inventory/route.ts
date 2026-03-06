import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, badRequest } from '@/lib/session'

export async function GET(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const lowStockOnly = req.nextUrl.searchParams.get('lowStock') === 'true'

  let items
  if (lowStockOnly) {
    items = await db.$queryRaw<{ id: string; name: string; unit: string; currentStock: number; reorderLevel: number; costPerUnit: number }[]>`
      SELECT id, name, unit, "currentStock", "reorderLevel", "costPerUnit"
      FROM "InventoryItem"
      WHERE "restaurantId" = ${restaurantId} AND "currentStock" <= "reorderLevel"
      ORDER BY name
    `
  } else {
    items = await db.inventoryItem.findMany({
      where: { restaurantId },
      orderBy: { name: 'asc' },
    })
  }

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { name, unit, currentStock, reorderLevel, costPerUnit } = await req.json()
  if (!name || !unit || reorderLevel == null || costPerUnit == null) return badRequest('Missing required fields')

  const item = await db.inventoryItem.create({
    data: {
      restaurantId,
      name,
      unit,
      currentStock: parseFloat(currentStock ?? 0),
      reorderLevel: parseFloat(reorderLevel),
      costPerUnit: parseFloat(costPerUnit),
    },
  })

  return NextResponse.json(item, { status: 201 })
}
