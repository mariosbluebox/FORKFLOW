import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'

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
