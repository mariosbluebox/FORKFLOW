import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionRestaurantId, unauthorized } from '@/lib/session'
import { EmployeeType } from '@prisma/client'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params
  const { name, type, hourlyRate, monthlySalary, startDate, endDate, isActive } = await req.json()

  const employee = await db.employee.update({
    where: { id, restaurantId },
    data: {
      name,
      type: type as EmployeeType,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
      monthlySalary: monthlySalary ? parseFloat(monthlySalary) : null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      isActive: isActive !== false,
    },
  })

  return NextResponse.json(employee)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const restaurantId = await getSessionRestaurantId()
  if (!restaurantId) return unauthorized()

  const { id } = await params

  // Soft delete — just deactivate
  const employee = await db.employee.update({
    where: { id, restaurantId },
    data: { isActive: false, endDate: new Date() },
  })

  return NextResponse.json(employee)
}
