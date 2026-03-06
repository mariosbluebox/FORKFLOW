import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.notification.updateMany({
    where: { restaurantId: session.user.restaurantId, read: false },
    data: { read: true },
  })

  return NextResponse.json({ success: true })
}
