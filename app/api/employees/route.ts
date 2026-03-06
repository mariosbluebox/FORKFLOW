import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized, badRequest } from '@/lib/session'
import { EmployeeType } from '@prisma/client'

export async function GET(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const activeOnly = req.nextUrl.searchParams.get('active') === 'true'

  const employees = await db.employee.findMany({
    where: { restaurantId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(employees)
}

export async function POST(req: NextRequest) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { name, type, hourlyRate, monthlySalary, startDate } = await req.json()
  if (!name || !type || !startDate) return badRequest('Missing required fields')

  const employee = await db.employee.create({
    data: {
      restaurantId,
      name,
      type: type as EmployeeType,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
      monthlySalary: monthlySalary ? parseFloat(monthlySalary) : null,
      startDate: new Date(startDate),
    },
  })

  return NextResponse.json(employee, { status: 201 })
}
