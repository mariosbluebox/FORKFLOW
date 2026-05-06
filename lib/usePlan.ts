'use client'

import { useSession } from 'next-auth/react'
import { hasFeature, type Feature } from './feature-gate'

export function usePlan() {
  const { data: session, status } = useSession()
  const user = session?.user

  return {
    plan: user?.plan ?? null,
    trialEndsAt: user?.trialEndsAt ?? null,
    isAdmin: user?.isAdmin ?? false,
    can: (feature: Feature): boolean =>
      user ? hasFeature(user.plan, feature, user.trialEndsAt) : false,
    loading: status === 'loading',
  }
}
