import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'
import { db } from './db'
import { hasFeature, type Feature } from './feature-gate'

export async function getSessionRestaurantId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.restaurantId ?? null
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

// Server-side plan gate. Reads the plan from the DB rather than the JWT so
// Stripe upgrades/downgrades take effect immediately. Returns a response to
// send back when access is denied, or null when the feature is allowed.
export async function requireFeature(restaurantId: string, feature: Feature): Promise<NextResponse | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { plan: true, trialEndsAt: true },
  })
  if (!restaurant) return unauthorized()
  if (!hasFeature(restaurant.plan, feature, restaurant.trialEndsAt.toISOString())) {
    return NextResponse.json({ error: 'Upgrade required' }, { status: 403 })
  }
  return null
}
