import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, badRequest } from '@/lib/session'
import { StockMovementType } from '@prisma/client'

export async function GET(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const itemId = req.nextUrl.searchParams.get('itemId')
  const where: { restaurantId: string; inventoryItemId?: string } = { restaurantId }
  if (itemId) where.inventoryItemId = itemId

  const movements = await db.stockMovement.findMany({
    where,
    include: { inventoryItem: true },
    orderBy: { date: 'desc' },
    take: 100,
  })

  return NextResponse.json(movements)
}

export async function POST(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { inventoryItemId, type, quantity, costPerUnit, date, notes } = await req.json()
  if (!inventoryItemId || !type || quantity == null) return badRequest('Missing required fields')

  const qty = parseFloat(quantity)
  const cpu = costPerUnit ? parseFloat(costPerUnit) : null
  const totalCost = cpu ? qty * cpu : null

  // Update stock level
  const delta = type === 'IN' ? qty : -qty
  const [movement] = await db.$transaction([
    db.stockMovement.create({
      data: {
        restaurantId,
        inventoryItemId,
        type: type as StockMovementType,
        quantity: qty,
        costPerUnit: cpu,
        totalCost,
        date: date ? new Date(date) : new Date(),
        notes: notes || null,
      },
    }),
    db.inventoryItem.update({
      where: { id: inventoryItemId, restaurantId },
      data: { currentStock: { increment: delta } },
    }),
  ])

  return NextResponse.json(movement, { status: 201 })
}
