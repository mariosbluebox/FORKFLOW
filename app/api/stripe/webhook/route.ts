import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { Plan } from '@prisma/client'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const getRestaurantId = (obj: { metadata?: { restaurantId?: string } }) =>
    obj.metadata?.restaurantId

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const restaurantId = getRestaurantId(sub)
      if (!restaurantId) break

      const priceId = sub.items.data[0]?.price.id
      const plan: Plan =
        priceId === process.env.STRIPE_PRO_PRICE_ID
          ? 'PRO'
          : 'BASIC'

      await db.restaurant.update({
        where: { id: restaurantId },
        data: { plan, stripeSubscriptionId: sub.id },
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const restaurantId = getRestaurantId(sub)
      if (!restaurantId) break

      await db.restaurant.update({
        where: { id: restaurantId },
        data: { plan: 'FREE_TRIAL', stripeSubscriptionId: null },
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (!customerId) break

      const restaurant = await db.restaurant.findFirst({
        where: { stripeCustomerId: customerId },
      })
      if (!restaurant) break

      await db.notification.create({
        data: {
          restaurantId: restaurant.id,
          title: 'Payment failed',
          body: 'Your subscription payment failed. Please update your billing details to keep Pro access.',
        },
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
