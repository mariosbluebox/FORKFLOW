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

  const periods = await db.platformPeriod.findMany({
    where: {
      restaurantId,
      ...(platformId && platformId !== 'ALL' && { platformId }),
      ...(from && { periodStart: { gte: new Date(from) } }),
      ...(to && { periodEnd: { lte: new Date(to + 'T23:59:59') } }),
    },
    include: { platform: true },
    orderBy: { periodStart: 'desc' },
  })

  return NextResponse.json(periods)
}

export async function POST(req: Request) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const body = await req.json()
  const { platformId, periodStart, periodEnd, orderCount, grossRevenue, commissionCharged, netRevenue } = body

  if (!platformId || !periodStart || !periodEnd || orderCount == null || grossRevenue == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify platform belongs to restaurant
  const platform = await db.platform.findFirst({ where: { id: platformId, restaurantId } })
  if (!platform) return NextResponse.json({ error: 'Platform not found' }, { status: 404 })

  const orders = parseInt(orderCount, 10)
  const gross = parseFloat(grossRevenue)
  const commission = parseFloat(commissionCharged || '0')
  const net = parseFloat(netRevenue || String(gross - commission))
  const avgOrderValue = orders > 0 ? gross / orders : 0

  const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { currency: true } })

  const period = await db.platformPeriod.upsert({
    where: {
      restaurantId_platformId_periodStart: {
        restaurantId,
        platformId,
        periodStart: new Date(periodStart),
      },
    },
    create: {
      restaurantId,
      platformId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      orderCount: orders,
      grossRevenue: gross,
      commissionCharged: commission,
      netRevenue: net,
      averageOrderValue: avgOrderValue,
      currency: restaurant?.currency ?? 'GBP',
    },
    update: {
      periodEnd: new Date(periodEnd),
      orderCount: orders,
      grossRevenue: gross,
      commissionCharged: commission,
      netRevenue: net,
      averageOrderValue: avgOrderValue,
    },
  })

  return NextResponse.json(period, { status: 201 })
}
