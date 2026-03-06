import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcVat } from '@/lib/utils'
import { getSessionRestaurantId, unauthorized, badRequest } from '@/lib/session'
import { RevenueSource } from '@prisma/client'

export async function GET(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const source = searchParams.get('source')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '100')

  const where: { restaurantId: string; date?: { gte?: Date; lte?: Date }; source?: RevenueSource } = { restaurantId }

  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to + 'T23:59:59.999Z')
  }
  if (source && source !== 'ALL') where.source = source as RevenueSource

  const [entries, total, agg] = await Promise.all([
    db.revenueEntry.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
    db.revenueEntry.count({ where }),
    db.revenueEntry.aggregate({ _sum: { grossAmount: true, vatAmount: true, netAmount: true }, where }),
  ])

  return NextResponse.json({ entries, total, summary: agg._sum })
}

export async function POST(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { date, source, grossAmount, notes } = await req.json()
  if (!date || !source || grossAmount == null) return badRequest('Missing required fields')

  const gross = parseFloat(grossAmount)
  if (isNaN(gross) || gross <= 0) return badRequest('Invalid gross amount')

  const { vatAmount, netAmount } = calcVat(gross)

  const entry = await db.revenueEntry.create({
    data: { restaurantId, date: new Date(date), source: source as RevenueSource, grossAmount: gross, vatAmount, netAmount, notes: notes || null },
  })

  return NextResponse.json(entry, { status: 201 })
}
