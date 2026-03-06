// Manual CSV test upload — session-authenticated, same processing pipeline as email webhook
// Used from /settings/integrations to verify parsers work before going live

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, badRequest } from '@/lib/session'
import { processInboundCSV } from '@/lib/inbound'
import { PlatformName } from '@prisma/client'

const VALID_PLATFORMS: PlatformName[] = ['UBEREATS', 'JUSTEAT', 'DELIVEROO']

export async function POST(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const platformName = formData.get('platform') as string | null

  if (!file) return badRequest('No file provided')
  if (!platformName || !VALID_PLATFORMS.includes(platformName as PlatformName)) {
    return badRequest('Invalid platform. Must be UBEREATS, JUSTEAT, or DELIVEROO')
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { currency: true },
  })

  const platform = await db.platform.findFirst({
    where: { restaurantId, name: platformName as PlatformName, isActive: true },
  })
  if (!platform) {
    return NextResponse.json({ error: 'Platform not configured for your restaurant' }, { status: 404 })
  }

  const csvText = await file.text()
  const filename = file.name

  const result = await processInboundCSV(
    restaurantId,
    restaurant?.currency ?? 'GBP',
    platformName as PlatformName,
    platform.id,
    csvText,
    filename
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error, rowsSkipped: result.rowsSkipped }, { status: 422 })
  }

  return NextResponse.json({
    rowsImported: result.rowsImported,
    rowsSkipped: result.rowsSkipped,
  }, { status: 201 })
}
