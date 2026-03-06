export interface ParsedPeriod {
  periodStart: Date
  periodEnd: Date
  orderCount: number
  grossRevenue: number
  commissionCharged: number
  netRevenue: number
  averageOrderValue: number
  currency: string
}

export interface ParseResult {
  periods: ParsedPeriod[]
  rowsSkipped: number
  error?: string
}

// Handles quoted fields (commas inside quotes, escaped quotes)
function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = splitCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line).map(v => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
}

export function parseAmount(val: string): number {
  return parseFloat(val.replace(/[£$€,\s]/g, '')) || 0
}

// Returns true for blank rows or summary/header rows
export function isSkipRow(val: string): boolean {
  if (!val || !val.trim()) return true
  const lower = val.toLowerCase().trim()
  return lower === 'date' || lower === 'week ending' || lower.includes('total') || lower.includes('summary')
}

// Monday of the week containing `date`
export function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  d.setHours(0, 0, 0, 0)
  return d
}

// Sunday of the week containing `date`
export function weekEnd(start: Date): Date {
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
