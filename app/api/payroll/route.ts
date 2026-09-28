import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, badRequest, notFound } from '@/lib/session'
import { EMPLOYER_NI_RATE, EMPLOYER_NI_THRESHOLD_WEEKLY } from '@/lib/constants'

function calcEmployerNI(grossPay: number, periodStart: Date, periodEnd: Date): number {
  const weeks = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (7 * 24 * 60 * 60 * 1000)))
  const threshold = EMPLOYER_NI_THRESHOLD_WEEKLY * weeks
  return Math.max(0, (grossPay - threshold) * EMPLOYER_NI_RATE)
}

export async function GET(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const employeeId = searchParams.get('employeeId')

  const where: {
    restaurantId: string
    periodStart?: { gte?: Date }
    periodEnd?: { lte?: Date }
    employeeId?: string
  } = { restaurantId }

  if (from) where.periodStart = { gte: new Date(from) }
  if (to) where.periodEnd = { lte: new Date(to + 'T23:59:59.999Z') }
  if (employeeId && employeeId !== 'ALL') where.employeeId = employeeId

  const [entries, agg] = await Promise.all([
    db.payrollEntry.findMany({
      where,
      include: { employee: true },
      orderBy: { periodStart: 'desc' },
    }),
    db.payrollEntry.aggregate({
      _sum: { grossPay: true, employerNI: true },
      where,
    }),
  ])

  return NextResponse.json({ entries, summary: agg._sum })
}

export async function POST(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { employeeId, periodStart, periodEnd, hoursWorked, grossPay, notes } = await req.json()
  if (!employeeId || !periodStart || !periodEnd || grossPay == null) return badRequest('Missing required fields')

  const employee = await db.employee.findFirst({ where: { id: employeeId, restaurantId } })
  if (!employee) return notFound()

  const start = new Date(periodStart)
  const end = new Date(periodEnd)
  const gross = parseFloat(grossPay)
  const employerNI = calcEmployerNI(gross, start, end)

  const entry = await db.payrollEntry.create({
    data: {
      restaurantId,
      employeeId,
      periodStart: start,
      periodEnd: end,
      hoursWorked: hoursWorked ? parseFloat(hoursWorked) : null,
      grossPay: gross,
      employerNI,
      notes: notes || null,
    },
    include: { employee: true },
  })

  return NextResponse.json(entry, { status: 201 })
}
