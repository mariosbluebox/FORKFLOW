// Postmark inbound webhook — receives forwarded platform emails
// Always returns 200 so Postmark doesn't retry on auth/not-found failures

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { detectPlatformFromEmail, extractEmail, processInboundCSV } from '@/lib/inbound'

// Constant-time token comparison. Prevents byte-by-byte timing-oracle attacks
// on the shared secret. Length check is a pre-filter — timingSafeEqual throws
// on differing buffer lengths.
function tokensMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const providedBuf = Buffer.from(provided)
  const expectedBuf = Buffer.from(expected)
  if (providedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(providedBuf, expectedBuf)
}

interface PostmarkAttachment {
  Name: string
  Content: string       // base64-encoded
  ContentType: string
  ContentLength: number
}

interface PostmarkPayload {
  From: string
  To: string
  Subject?: string
  Attachments?: PostmarkAttachment[]
}

export async function POST(req: NextRequest) {
  // Verify shared secret (fail-closed: reject if env var missing OR token mismatch).
  // Response stays 200 so Postmark doesn't trigger retry storms on bad senders.
  const expectedToken = process.env.POSTMARK_INBOUND_WEBHOOK_TOKEN
  if (!expectedToken) {
    console.error(
      '[postmark-inbound] POSTMARK_INBOUND_WEBHOOK_TOKEN is not set — rejecting request',
    )
    return NextResponse.json({ ok: false, reason: 'server misconfigured' })
  }

  const token =
    req.headers.get('x-postmark-token') ??
    new URL(req.url).searchParams.get('token')

  if (!tokensMatch(token, expectedToken)) {
    return NextResponse.json({ ok: false, reason: 'invalid token' })
  }

  let payload: PostmarkPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid JSON' })
  }

  const toAddress = extractEmail(payload.To ?? '')
  const fromAddress = payload.From ?? ''

  // Match To address → Restaurant
  const restaurant = await db.restaurant.findFirst({
    where: { inboundEmail: toAddress, isActive: true },
    select: { id: true, currency: true },
  })

  if (!restaurant) {
    return NextResponse.json({ ok: true, reason: 'no restaurant for this address' })
  }

  // Detect platform from sender domain
  const platformName = detectPlatformFromEmail(fromAddress)
  if (!platformName) {
    return NextResponse.json({ ok: true, reason: 'unknown platform domain' })
  }

  // Find the platform record for this restaurant
  const platform = await db.platform.findFirst({
    where: { restaurantId: restaurant.id, name: platformName, isActive: true },
  })
  if (!platform) {
    return NextResponse.json({ ok: true, reason: 'platform not active for restaurant' })
  }

  // Find CSV attachment
  const csvAttachment = payload.Attachments?.find(
    a => a.ContentType?.toLowerCase().includes('csv') || a.Name?.toLowerCase().endsWith('.csv')
  )
  const filename = csvAttachment?.Name ?? 'unknown.csv'

  if (!csvAttachment) {
    await db.importLog.create({
      data: {
        restaurantId: restaurant.id,
        platform: platformName,
        filename,
        status: 'FAILED',
        rowsImported: 0,
        errorMessage: 'No CSV attachment found in email',
      },
    })
    await db.notification.create({
      data: {
        restaurantId: restaurant.id,
        title: `Import failed — ${platformName}`,
        body: 'Could not find a CSV attachment in the forwarded email. Check your email forwarding is sending the correct file.',
      },
    })
    return NextResponse.json({ ok: true })
  }

  // Decode base64 CSV
  let csvText: string
  try {
    csvText = Buffer.from(csvAttachment.Content, 'base64').toString('utf-8')
  } catch {
    await db.importLog.create({
      data: {
        restaurantId: restaurant.id,
        platform: platformName,
        filename,
        status: 'FAILED',
        rowsImported: 0,
        errorMessage: 'Failed to decode attachment',
      },
    })
    return NextResponse.json({ ok: true })
  }

  const result = await processInboundCSV(
    restaurant.id,
    restaurant.currency ?? 'GBP',
    platformName,
    platform.id,
    csvText,
    filename
  )

  return NextResponse.json({ ok: true, rowsImported: result.rowsImported })
}
