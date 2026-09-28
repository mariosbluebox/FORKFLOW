// Shared logic for both Postmark webhook and manual test upload

import { db } from './db'
import { PlatformName } from '@prisma/client'
import { ParsedPeriod, ParseResult } from './parsers/csv'
import { parseUberEats } from './parsers/uber-eats'
import { parseJustEat } from './parsers/just-eat'
import { parseDeliveroo } from './parsers/deliveroo'

const PLATFORM_LABELS: Record<string, string> = {
  UBEREATS: 'Uber Eats',
  JUSTEAT: 'Just Eat',
  DELIVEROO: 'Deliveroo',
}

export function parsePlatformCSV(
  csvText: string,
  platform: PlatformName,
  currency: string
): ParseResult | null {
  switch (platform) {
    case 'UBEREATS':  return parseUberEats(csvText, currency)
    case 'JUSTEAT':   return parseJustEat(csvText, currency)
    case 'DELIVEROO': return parseDeliveroo(csvText, currency)
    default:          return null
  }
}

async function upsertPeriods(
  restaurantId: string,
  platformId: string,
  periods: ParsedPeriod[]
): Promise<number> {
  let count = 0
  for (const p of periods) {
    await db.platformPeriod.upsert({
      where: {
        restaurantId_platformId_periodStart: {
          restaurantId,
          platformId,
          periodStart: p.periodStart,
        },
      },
      create: {
        restaurantId,
        platformId,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        orderCount: p.orderCount,
        grossRevenue: p.grossRevenue,
        commissionCharged: p.commissionCharged,
        netRevenue: p.netRevenue,
        averageOrderValue: p.averageOrderValue,
        currency: p.currency,
      },
      update: {
        periodEnd: p.periodEnd,
        orderCount: p.orderCount,
        grossRevenue: p.grossRevenue,
        commissionCharged: p.commissionCharged,
        netRevenue: p.netRevenue,
        averageOrderValue: p.averageOrderValue,
      },
    })
    count++
  }
  return count
}

export interface ProcessResult {
  success: boolean
  rowsImported: number
  rowsSkipped: number
  error?: string
}

export async function processInboundCSV(
  restaurantId: string,
  currency: string,
  platformName: PlatformName,
  platformId: string,
  csvText: string,
  filename: string
): Promise<ProcessResult> {
  const parseResult = parsePlatformCSV(csvText, platformName, currency)

  if (!parseResult) {
    await db.importLog.create({
      data: { restaurantId, platform: platformName, filename, status: 'FAILED', rowsImported: 0, errorMessage: 'Unsupported platform' },
    })
    return { success: false, rowsImported: 0, rowsSkipped: 0, error: 'Unsupported platform' }
  }

  if (parseResult.periods.length === 0) {
    const msg = parseResult.error ?? 'No valid rows found in CSV'
    await db.importLog.create({
      data: { restaurantId, platform: platformName, filename, status: 'FAILED', rowsImported: 0, errorMessage: msg },
    })
    await db.notification.create({
      data: {
        restaurantId,
        title: `Import failed — ${PLATFORM_LABELS[platformName] ?? platformName}`,
        body: `Could not parse the attached CSV. ${msg}`.trim(),
      },
    })
    return { success: false, rowsImported: 0, rowsSkipped: parseResult.rowsSkipped, error: msg }
  }

  const rowsImported = await upsertPeriods(restaurantId, platformId, parseResult.periods)
  const status = parseResult.rowsSkipped > 0 ? 'PARTIAL' : 'SUCCESS'

  await db.importLog.create({
    data: { restaurantId, platform: platformName, filename, status, rowsImported, errorMessage: null },
  })

  const totalOrders = parseResult.periods.reduce((s, p) => s + p.orderCount, 0)
  const totalGross = parseResult.periods.reduce((s, p) => s + p.grossRevenue, 0)
  const periodLabel =
    parseResult.periods.length === 1
      ? `Week ending ${parseResult.periods[0].periodEnd.toLocaleDateString('en-GB')}`
      : `${parseResult.periods.length} week${parseResult.periods.length > 1 ? 's' : ''}`

  await db.notification.create({
    data: {
      restaurantId,
      title: `${PLATFORM_LABELS[platformName] ?? platformName} statement imported`,
      body: `${totalOrders} orders, £${totalGross.toFixed(2)} gross revenue — ${periodLabel}`,
    },
  })

  return { success: true, rowsImported, rowsSkipped: parseResult.rowsSkipped }
}

// Detect platform from sender email domain
export function detectPlatformFromEmail(fromAddress: string): PlatformName | null {
  const domain = fromAddress.split('@')[1]?.toLowerCase() ?? ''
  if (domain.includes('uber') || domain.includes('ubereats')) return 'UBEREATS'
  if (domain.includes('just-eat') || domain.includes('justeat') || domain.includes('takeaway')) return 'JUSTEAT'
  if (domain.includes('deliveroo')) return 'DELIVEROO'
  return null
}

// Extract bare email from "Name <email>" format
export function extractEmail(address: string): string {
  // indexOf instead of a regex: headers are untrusted, and /<([^>]+)>/ is
  // quadratic on input like "<<<<…" with no closing bracket (CodeQL).
  const start = address.indexOf('<')
  const end = start === -1 ? -1 : address.indexOf('>', start + 1)
  return end > start + 1 ? address.slice(start + 1, end).trim() : address.split(',')[0].trim()
}
