import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { daysLeftInTrial, isTrialExpired } from '@/lib/utils'
import BillingClient from './BillingClient'

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const restaurant = await db.restaurant.findUnique({
    where: { id: session.user.restaurantId },
    select: { plan: true, trialEndsAt: true, stripeCustomerId: true, stripeSubscriptionId: true },
  })

  if (!restaurant) return null

  const trialEndsAt = restaurant.trialEndsAt.toISOString()
  const daysLeft = daysLeftInTrial(trialEndsAt)
  const expired = isTrialExpired(restaurant.plan, trialEndsAt)

  return (
    <BillingClient
      plan={restaurant.plan}
      trialEndsAt={trialEndsAt}
      daysLeft={daysLeft}
      trialExpired={expired}
      hasStripeSubscription={!!restaurant.stripeSubscriptionId}
    />
  )
}
