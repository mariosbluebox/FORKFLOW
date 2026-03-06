import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, badRequest } from '@/lib/session'

export async function GET() {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const items = await db.menuItem.findMany({
    where: { restaurantId },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { name, category, sellingPrice, foodCostTarget } = await req.json()
  if (!name || !category || sellingPrice == null || foodCostTarget == null) return badRequest('Missing required fields')

  const item = await db.menuItem.create({
    data: {
      restaurantId,
      name,
      category,
      sellingPrice: parseFloat(sellingPrice),
      foodCostTarget: parseFloat(foodCostTarget),
    },
  })

  return NextResponse.json(item, { status: 201 })
}
