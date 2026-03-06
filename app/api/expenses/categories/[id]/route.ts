import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  const { name, colour } = await req.json()

  const category = await db.expenseCategory.update({
    where: { id, restaurantId },
    data: { name, colour },
  })

  return NextResponse.json(category)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params

  // Check if any expenses use this category
  const count = await db.expenseEntry.count({ where: { categoryId: id, restaurantId } })
  if (count > 0) {
    return NextResponse.json({ error: `Cannot delete — ${count} expense(s) use this category` }, { status: 409 })
  }

  await db.expenseCategory.delete({ where: { id, restaurantId } })
  return NextResponse.json({ success: true })
}
