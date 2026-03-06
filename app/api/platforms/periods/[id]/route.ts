import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  const existing = await db.platformPeriod.findFirst({ where: { id, restaurantId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { periodStart, periodEnd, orderCount, grossRevenue, commissionCharged, netRevenue } = body

  const orders = parseInt(orderCount, 10)
  const gross = parseFloat(grossRevenue)
  const commission = parseFloat(commissionCharged || '0')
  const net = parseFloat(netRevenue || String(gross - commission))
  const avgOrderValue = orders > 0 ? gross / orders : 0

  try {
    const updated = await db.platformPeriod.update({
      where: { id },
      data: {
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        orderCount: orders,
        grossRevenue: gross,
        commissionCharged: commission,
        netRevenue: net,
        averageOrderValue: avgOrderValue,
      },
    })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const prismaErr = err as { code?: string }
    if (prismaErr?.code === 'P2002') {
      return NextResponse.json({ error: 'A period with this start date already exists for this platform' }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  const existing = await db.platformPeriod.findFirst({ where: { id, restaurantId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.platformPeriod.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
