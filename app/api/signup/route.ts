import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { DEFAULT_CATEGORIES, DEFAULT_PLATFORMS } from '@/lib/constants'
import { generateUniqueSlug, randomString } from '@/lib/utils'
import { rateLimit, clientIp, RATE_LIMITS } from '@/lib/rate-limit'

const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? 'inbound.restofinance.app'

export async function POST(req: NextRequest) {
  const { allowed, retryAfterSec } = await rateLimit(`signup:ip:${clientIp(req.headers)}`, RATE_LIMITS.signupPerIp)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    )
  }

  const body = await req.json()
  const { restaurantName, name, email, password } = body

  if (!restaurantName || !name || !email || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const existingUser = await db.user.findUnique({ where: { email } })
  if (existingUser) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const slug = await generateUniqueSlug(restaurantName, async (s) => {
    const existing = await db.restaurant.findUnique({ where: { slug: s } })
    return !!existing
  })

  const inboundEmail = `${slug}-${randomString(6)}@${INBOUND_DOMAIN}`
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const passwordHash = await bcrypt.hash(password, 12)

  await db.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.create({
      data: { name: restaurantName, slug, inboundEmail, trialEndsAt },
    })

    await tx.user.create({
      data: { email, name, passwordHash, restaurantId: restaurant.id },
    })

    await tx.expenseCategory.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({
        restaurantId: restaurant.id,
        name: c.name,
        colour: c.colour,
      })),
    })

    for (const p of DEFAULT_PLATFORMS) {
      await tx.platform.create({
        data: { restaurantId: restaurant.id, name: p.name, commissionRate: p.commissionRate },
      })
    }

    await tx.overheadAllocationConfig.create({
      data: { restaurantId: restaurant.id },
    })
  })

  return NextResponse.json({ success: true }, { status: 201 })
}
