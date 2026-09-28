import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, badRequest, notFound } from '@/lib/session'

export async function GET(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const categoryId = searchParams.get('categoryId')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '100')

  const where: {
    restaurantId: string
    date?: { gte?: Date; lte?: Date }
    categoryId?: string
  } = { restaurantId }

  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to + 'T23:59:59.999Z')
  }
  if (categoryId && categoryId !== 'ALL') where.categoryId = categoryId

  const [entries, total, agg] = await Promise.all([
    db.expenseEntry.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.expenseEntry.count({ where }),
    db.expenseEntry.aggregate({
      _sum: { grossAmount: true, vatAmount: true, netAmount: true },
      where,
    }),
  ])

  return NextResponse.json({ entries, total, summary: agg._sum })
}

export async function POST(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { date, categoryId, supplier, description, netAmount, vatAmount, grossAmount, vatReclaimable } = await req.json()

  if (!date || !categoryId || !description || netAmount == null || grossAmount == null) {
    return badRequest('Missing required fields')
  }

  const category = await db.expenseCategory.findFirst({ where: { id: categoryId, restaurantId } })
  if (!category) return notFound()

  const entry = await db.expenseEntry.create({
    data: {
      restaurantId,
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

  return NextResponse.json(entry, { status: 201 })
}
