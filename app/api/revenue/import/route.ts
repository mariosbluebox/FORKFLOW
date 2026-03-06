import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcVat } from '@/lib/utils'
import { getSessionRestaurantId, unauthorized, badRequest } from '@/lib/session'
import { RevenueSource } from '@prisma/client'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
}

function findCol(row: Record<string, string>, candidates: string[]): string | undefined {
  const key = Object.keys(row).find((k) =>
    candidates.some((c) => k.toLowerCase().includes(c.toLowerCase()))
  )
  return key ? row[key] : undefined
}

export async function POST(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const source = formData.get('source') as string | null

  if (!file || !source) return badRequest('Missing file or source')

  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length === 0) return badRequest('No data found in CSV')

  const entries = []
  for (const row of rows) {
    const dateStr = findCol(row, ['date', 'transaction date', 'payment date'])
    const grossStr = findCol(row, ['gross', 'total amount', 'amount', 'net sales', 'gross sales'])
    if (!dateStr || !grossStr) continue

    const gross = parseFloat(grossStr.replace(/[£,\s]/g, ''))
    if (isNaN(gross) || gross <= 0) continue

    const parsedDate = new Date(dateStr)
    if (isNaN(parsedDate.getTime())) continue

    const { vatAmount, netAmount } = calcVat(gross)
    entries.push({ restaurantId, date: parsedDate, source: source as RevenueSource, grossAmount: gross, vatAmount, netAmount, notes: `Imported from ${source} CSV` })
  }

  if (entries.length === 0) return badRequest('No valid rows found in CSV')

  await db.revenueEntry.createMany({ data: entries })
  return NextResponse.json({ imported: entries.length }, { status: 201 })
}
