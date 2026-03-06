// Just Eat CSV: one row per period
// Columns: Date, Orders, Gross Sales, Commission, Net Sales

import { parseCSV, parseAmount, isSkipRow, round2, ParsedPeriod, ParseResult } from './csv'

export function parseJustEat(csvText: string, currency = 'GBP'): ParseResult {
  const rows = parseCSV(csvText)
  const periods: ParsedPeriod[] = []
  let rowsSkipped = 0

  for (const row of rows) {
    const dateStr = row['Date'] ?? row['date'] ?? ''
    if (isSkipRow(dateStr)) { rowsSkipped++; continue }

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) { rowsSkipped++; continue }

    const orders = parseInt(row['Orders'] ?? row['orders'] ?? '0', 10) || 0
    const gross = parseAmount(row['Gross Sales'] ?? row['gross sales'] ?? '')
    const commission = parseAmount(row['Commission'] ?? row['commission'] ?? '')
    const net = parseAmount(row['Net Sales'] ?? row['net sales'] ?? '')

    // Each row covers a period ending on the date — assume weekly (7 days)
    const periodEnd = new Date(date)
    periodEnd.setHours(23, 59, 59, 999)
    const periodStart = new Date(date)
    periodStart.setDate(date.getDate() - 6)
    periodStart.setHours(0, 0, 0, 0)

    periods.push({
      periodStart,
      periodEnd,
      orderCount: orders,
      grossRevenue: gross,
      commissionCharged: commission,
      netRevenue: net,
      averageOrderValue: orders > 0 ? round2(gross / orders) : 0,
      currency,
    })
  }

  if (periods.length === 0) {
    return { periods: [], rowsSkipped: rows.length, error: 'No valid rows found. Expected columns: Date, Orders, Gross Sales, Commission, Net Sales.' }
  }

  return { periods, rowsSkipped }
}
