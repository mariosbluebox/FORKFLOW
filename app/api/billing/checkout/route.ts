import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await req.json()

  const priceId =
    plan === 'PRO'
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_BASIC_PRICE_ID

  if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const restaurant = await db.restaurant.findUnique({
    where: { id: session.user.restaurantId },
  })
  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  // Create or reuse Stripe customer
  let customerId = restaurant.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: restaurant.name,
      metadata: { restaurantId: restaurant.id },
    })
    customerId = customer.id
    await db.restaurant.update({
      where: { id: restaurant.id },
      data: { stripeCustomerId: customerId },
    })
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/settings/billing?success=true`,
    cancel_url: `${baseUrl}/settings/billing?cancelled=true`,
    metadata: { restaurantId: restaurant.id, plan },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
