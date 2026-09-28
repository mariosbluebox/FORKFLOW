import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, notFound } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  const { date, categoryId, supplier, description, netAmount, vatAmount, grossAmount, vatReclaimable } = await req.json()

  if (categoryId) {
    const category = await db.expenseCategory.findFirst({ where: { id: categoryId, restaurantId } })
    if (!category) return notFound()
  }

  const entry = await db.expenseEntry.update({
    where: { id, restaurantId },
    data: {
      date: new Date(date),
      categoryId,
      supplier: supplier || null,
      description,
      netAmount: parseFloat(netAmount),
      vatAmount: parseFloat(vatAmount ?? 0),
      grossAmount: parseFloat(grossAmount),
      vatReclaimable: vatReclaimable !== false,
    },
    include: { category: true },
  })

  return NextResponse.json(entry)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  await db.expenseEntry.delete({ where: { id, restaurantId } })
  return NextResponse.json({ success: true })
}
