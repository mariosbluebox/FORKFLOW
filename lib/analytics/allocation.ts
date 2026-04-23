import type { AllocationMethod } from '@prisma/client'

export type AllocatableBucket = {
  orders: number
  grossRevenue: number
}

export type AllocationTotals = {
  orders: number
  grossRevenue: number
  platformsWithData: number
}

export function computeAllocationTotals(buckets: AllocatableBucket[]): AllocationTotals {
  return {
    orders: buckets.reduce((s, b) => s + b.orders, 0),
    grossRevenue: buckets.reduce((s, b) => s + b.grossRevenue, 0),
    platformsWithData: buckets.filter((b) => b.orders > 0 || b.grossRevenue > 0).length,
  }
}

export function allocateAmount(
  bucket: AllocatableBucket,
  totals: AllocationTotals,
  method: AllocationMethod,
  amount: number
): number {
  if (method === 'BY_ORDERS' && totals.orders > 0) {
    return amount * (bucket.orders / totals.orders)
  }
  if (method === 'BY_REVENUE' && totals.grossRevenue > 0) {
    return amount * (bucket.grossRevenue / totals.grossRevenue)
  }
  if (method === 'BY_TIME' && totals.platformsWithData > 0) {
    const hasData = bucket.orders > 0 || bucket.grossRevenue > 0
    return hasData ? amount / totals.platformsWithData : 0
  }
  return 0
}
