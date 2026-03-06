import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, badRequest } from '@/lib/session'

export async function GET() {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const categories = await db.expenseCategory.findMany({
    where: { restaurantId },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { name, colour } = await req.json()
  if (!name || !colour) return badRequest('Name and colour are required')

  const category = await db.expenseCategory.create({
    data: { restaurantId, name, colour },
  })

  return NextResponse.json(category, { status: 201 })
}
