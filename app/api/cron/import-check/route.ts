// Vercel Cron: runs every Monday morning
// Checks each active Pro/Trial restaurant for missing weekly platform statements

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const DELIVERY_PLATFORMS = ['UBEREATS', 'JUSTEAT', 'DELIVEROO'] as const

const PLATFORM_LABELS: Record<string, string> = {
  UBEREATS: 'Uber Eats',
  JUSTEAT: 'Just Eat',
  DELIVEROO: 'Deliveroo',
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const now = new Date()

  // Active restaurants on Pro plan or unexpired Free Trial
  const restaurants = await db.restaurant.findMany({
    where: {
      isActive: true,
      OR: [
        { plan: 'PRO' },
        { plan: 'FREE_TRIAL', trialEndsAt: { gte: now } },
      ],
    },
    include: {
      platforms: {
        where: {
          isActive: true,
          name: { in: [...DELIVERY_PLATFORMS] },
        },
      },
    },
  })

  let notificationsCreated = 0

  for (const restaurant of restaurants) {
    for (const platform of restaurant.platforms) {
      const recentImport = await db.importLog.findFirst({
        where: {
          restaurantId: restaurant.id,
          platform: platform.name,
          status: { in: ['SUCCESS', 'PARTIAL'] },
          receivedAt: { gte: sevenDaysAgo },
        },
      })

      if (!recentImport) {
        const label = PLATFORM_LABELS[platform.name] ?? platform.name
        await db.notification.create({
          data: {
            restaurantId: restaurant.id,
            title: `No ${label} statement received this week`,
            body: `We haven't received your ${label} weekly statement yet. Check that your email forwarding is still active.`,
          },
        })
        notificationsCreated++
      }
    }
  }

  return NextResponse.json({
    checked: restaurants.length,
    notificationsCreated,
  })
}
