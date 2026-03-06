import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Plan } from '@prisma/client'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, createdAt: true } },
      _count: {
        select: {
          revenueEntries: true,
          expenseEntries: true,
          payrollEntries: true,
          importLogs: true,
        },
      },
    },
  })

  if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(restaurant)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { plan, isActive, trialEndsAt } = body

  const data: { plan?: Plan; isActive?: boolean; trialEndsAt?: Date } = {}
  if (plan) data.plan = plan as Plan
  if (typeof isActive === 'boolean') data.isActive = isActive
  if (trialEndsAt) data.trialEndsAt = new Date(trialEndsAt)

  const restaurant = await db.restaurant.update({ where: { id }, data })
  return NextResponse.json(restaurant)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Cascade is handled by Prisma schema (onDelete: Cascade)
  await db.restaurant.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
