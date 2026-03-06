import { isTrialExpired } from './utils'

export type Feature =
  | 'revenue'
  | 'expenses'
  | 'payroll'
  | 'inventory'
  | 'reports'
  | 'platforms'
  | 'analytics'
  | 'health'
  | 'email-ingestion'
  | 'scenarios'

const PLAN_FEATURES: Record<string, Feature[]> = {
  FREE_TRIAL: [
    'revenue', 'expenses', 'payroll', 'inventory', 'reports',
    'platforms', 'analytics', 'health', 'email-ingestion', 'scenarios',
  ],
  BASIC: ['revenue', 'expenses', 'payroll', 'inventory', 'reports'],
  PRO: [
    'revenue', 'expenses', 'payroll', 'inventory', 'reports',
    'platforms', 'analytics', 'health', 'email-ingestion', 'scenarios',
  ],
}

export function hasFeature(plan: string, feature: Feature, trialEndsAt?: string): boolean {
  const expired = trialEndsAt ? isTrialExpired(plan, trialEndsAt) : false
  const effectivePlan = expired ? 'BASIC' : plan
  return (PLAN_FEATURES[effectivePlan] ?? PLAN_FEATURES.BASIC).includes(feature)
}

export function requiresPro(feature: Feature): boolean {
  return !PLAN_FEATURES.BASIC.includes(feature)
}
