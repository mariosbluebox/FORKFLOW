import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcVat } from '@/lib/utils'
import { getSessionRestaurantId, unauthorized, badRequest } from '@/lib/session'
import { RevenueSource } from '@prisma/client'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  const { date, source, grossAmount, notes } = await req.json()
  if (!date || !source || grossAmount == null) return badRequest('Missing required fields')

  const gross = parseFloat(grossAmount)
  const { vatAmount, netAmount } = calcVat(gross)

  const entry = await db.revenueEntry.update({
    where: { id, restaurantId },
    data: { date: new Date(date), source: source as RevenueSource, grossAmount: gross, vatAmount, netAmount, notes: notes || null },
  })

  return NextResponse.json(entry)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  await db.revenueEntry.delete({ where: { id, restaurantId } })
  return NextResponse.json({ success: true })
}
