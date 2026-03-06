import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'

export async function GET(req: Request) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { searchParams } = new URL(req.url)
  const platformId = searchParams.get('platformId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const promotions = await db.promotionCharge.findMany({
    where: {
      restaurantId,
      ...(platformId && platformId !== 'ALL' && { platformId }),
      ...(from && { periodStart: { gte: new Date(from) } }),
      ...(to && { periodEnd: { lte: new Date(to + 'T23:59:59') } }),
    },
    include: { platform: true },
    orderBy: { periodStart: 'desc' },
  })

  return NextResponse.json(promotions)
}

export async function POST(req: Request) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const body = await req.json()
  const { platformId, periodStart, periodEnd, chargeAmount, promotionType, notes } = body

  if (!platformId || !periodStart || !periodEnd || chargeAmount == null || !promotionType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const platform = await db.platform.findFirst({ where: { id: platformId, restaurantId } })
  if (!platform) return NextResponse.json({ error: 'Platform not found' }, { status: 404 })

  const promotion = await db.promotionCharge.create({
    data: {
      restaurantId,
      platformId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      chargeAmount: parseFloat(chargeAmount),
      promotionType,
      notes: notes || null,
    },
    include: { platform: true },
  })

  return NextResponse.json(promotion, { status: 201 })
}
