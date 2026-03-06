export const VAT_RATE = 0.2 // UK standard rate 20%
export const VAT_DIVISOR = 6 // grossAmount / 6 = vatAmount

export const LOCALE = 'en-GB'
export const CURRENCY = 'GBP'

export const FOOD_COST_TARGET = 0.3 // 30%
export const LABOUR_COST_TARGET = 0.3 // 30%
export const OVERHEAD_COST_TARGET = 0.2 // 20%
export const NET_PROFIT_TARGET = 0.1 // 10%

export const PLATFORMS = ['UBEREATS', 'DELIVEROO', 'JUSTEAT', 'WALKIN', 'OTHER'] as const

export const DEFAULT_CATEGORIES = [
  { name: 'Ingredients & Food Supplies', colour: '#ef4444' },
  { name: 'Packaging & Disposables', colour: '#f97316' },
  { name: 'Utilities', colour: '#eab308' },
  { name: 'Rent & Rates', colour: '#8b5cf6' },
  { name: 'Equipment & Maintenance', colour: '#06b6d4' },
  { name: 'Staff Uniforms', colour: '#84cc16' },
  { name: 'Insurance', colour: '#ec4899' },
  { name: 'Marketing & Advertising', colour: '#14b8a6' },
  { name: 'Miscellaneous', colour: '#6b7280' },
]

export const DEFAULT_PLATFORMS = [
  { name: 'UBEREATS' as const, commissionRate: 0.3 },
  { name: 'DELIVEROO' as const, commissionRate: 0.3 },
  { name: 'JUSTEAT' as const, commissionRate: 0.14 },
  { name: 'WALKIN' as const, commissionRate: 0 },
]

// Employer NI rate (2024/25): 13.8% above secondary threshold
export const EMPLOYER_NI_RATE = 0.138
export const EMPLOYER_NI_THRESHOLD_WEEKLY = 175 // £175/week secondary threshold
