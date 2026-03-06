// Deliveroo CSV: one row per week
// Columns: Week Ending, Total Orders, Gross Revenue, Fee, Net Revenue

import { parseCSV, parseAmount, isSkipRow, round2, ParsedPeriod, ParseResult } from './csv'

export function parseDeliveroo(csvText: string, currency = 'GBP'): ParseResult {
  const rows = parseCSV(csvText)
  const periods: ParsedPeriod[] = []
  let rowsSkipped = 0

  for (const row of rows) {
    const dateStr = row['Week Ending'] ?? row['week ending'] ?? ''
    if (isSkipRow(dateStr)) { rowsSkipped++; continue }

    const weekEndDate = new Date(dateStr)
    if (isNaN(weekEndDate.getTime())) { rowsSkipped++; continue }

    const orders = parseInt(row['Total Orders'] ?? row['total orders'] ?? '0', 10) || 0
    const gross = parseAmount(row['Gross Revenue'] ?? row['gross revenue'] ?? '')
    const fee = parseAmount(row['Fee'] ?? row['fee'] ?? '')
    const net = parseAmount(row['Net Revenue'] ?? row['net revenue'] ?? '')

    // Period: Mon–Sun, ending on weekEndDate
    const periodEnd = new Date(weekEndDate)
    periodEnd.setHours(23, 59, 59, 999)
    const periodStart = new Date(weekEndDate)
    periodStart.setDate(weekEndDate.getDate() - 6)
    periodStart.setHours(0, 0, 0, 0)

    periods.push({
      periodStart,
      periodEnd,
      orderCount: orders,
      grossRevenue: gross,
      commissionCharged: fee,
      netRevenue: net,
      averageOrderValue: orders > 0 ? round2(gross / orders) : 0,
      currency,
    })
  }

  if (periods.length === 0) {
    return { periods: [], rowsSkipped: rows.length, error: 'No valid rows found. Expected columns: Week Ending, Total Orders, Gross Revenue, Fee, Net Revenue.' }
  }

  return { periods, rowsSkipped }
}
