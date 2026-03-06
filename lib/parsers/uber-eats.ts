// Uber Eats CSV: individual order rows
// Columns: Order Date, Order ID, Gross Order Value, Uber Eats Fee, Net Payout
// Groups rows by ISO week (Mon–Sun)

import { parseCSV, parseAmount, isSkipRow, weekStart, weekEnd, round2, ParsedPeriod, ParseResult } from './csv'

export function parseUberEats(csvText: string, currency = 'GBP'): ParseResult {
  const rows = parseCSV(csvText)
  let rowsSkipped = 0

  const byWeek = new Map<string, { orders: number; gross: number; fee: number; net: number; start: Date }>()

  for (const row of rows) {
    const dateStr = row['Order Date'] ?? row['order date'] ?? ''
    if (isSkipRow(dateStr)) { rowsSkipped++; continue }

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) { rowsSkipped++; continue }

    const gross = parseAmount(row['Gross Order Value'] ?? row['gross order value'] ?? '')
    const fee = parseAmount(row['Uber Eats Fee'] ?? row['uber eats fee'] ?? '')
    const net = parseAmount(row['Net Payout'] ?? row['net payout'] ?? '')

    const start = weekStart(date)
    const key = start.toISOString()

    const existing = byWeek.get(key)
    if (existing) {
      existing.orders++
      existing.gross += gross
      existing.fee += fee
      existing.net += net
    } else {
      byWeek.set(key, { orders: 1, gross, fee, net, start })
    }
  }

  if (byWeek.size === 0) {
    return { periods: [], rowsSkipped: rows.length, error: 'No valid order rows found. Expected column "Order Date".' }
  }

  const periods: ParsedPeriod[] = Array.from(byWeek.values()).map(({ orders, gross, fee, net, start }) => ({
    periodStart: start,
    periodEnd: weekEnd(start),
    orderCount: orders,
    grossRevenue: round2(gross),
    commissionCharged: round2(fee),
    netRevenue: round2(net),
    averageOrderValue: orders > 0 ? round2(gross / orders) : 0,
    currency,
  }))

  return { periods, rowsSkipped }
}
