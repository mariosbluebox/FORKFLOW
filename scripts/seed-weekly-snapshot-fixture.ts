// Dev-only: seeds a deterministic restaurant + one ISO week of platform,
// expense, payroll and promotion data so scripts/verify-weekly-snapshot.ts
// has non-zero numbers to reconcile.
//
// Idempotent — re-running upserts the restaurant, platforms, periods and
// allocation config, and deletes-then-inserts the rows that have no unique
// constraint (expenses, payroll, promotions, expense categories, employees).
// Only ever touches the fixture restaurant; never reads or modifies any
// other tenant.
//
// Usage:
//   npm run seed:weekly-snapshot

import { PrismaClient, PlatformName } from '@prisma/client'

const FIXTURE_SLUG = '_fixture_weekly_snapshot'
const FIXTURE_NAME = '_FIXTURE Weekly Snapshot'
const FIXTURE_INBOUND = '_fixture_weekly_snapshot@inbound.fixture.local'

// Fixed week so the seed is time-stable. Verify with:
//   npm run verify:weekly-snapshot -- <restaurantId> 2026-04-13
const WEEK_START = new Date('2026-04-13T00:00:00.000Z') // ISO Monday
const WEEK_END = new Date('2026-04-19T23:59:59.999Z')   // ISO Sunday

const FOOD_COST_PCT = 0.28

const PLATFORM_DATA: Array<{
  name: PlatformName
  commissionRate: number
  orders: number
  gross: number
  commission: number
  net: number
}> = [
  // Numbers chosen so all four allocation buckets produce distinct values
  // and BY_ORDERS allocation differs cleanly from any uniform split.
  { name: 'UBEREATS',  commissionRate: 0.30, orders: 120, gross: 1800, commission: 540,  net: 1260 },
  { name: 'DELIVEROO', commissionRate: 0.30, orders: 80,  gross: 1280, commission: 384,  net: 896 },
  { name: 'JUSTEAT',   commissionRate: 0.25, orders: 60,  gross: 840,  commission: 210,  net: 630 },
  { name: 'WALKIN',    commissionRate: 0.0,  orders: 40,  gross: 520,  commission: 0,    net: 520 },
]

const PROMOTIONS: Array<{ platform: PlatformName; chargeAmount: number; promotionType: string }> = [
  { platform: 'UBEREATS',  chargeAmount: 50, promotionType: 'BOGO' },
  { platform: 'DELIVEROO', chargeAmount: 30, promotionType: 'Discount 20%' },
]

const EXPENSES: Array<{ description: string; gross: number }> = [
  { description: 'Weekly rent contribution',  gross: 400 },
  { description: 'Weekly utilities estimate', gross: 200 },
]

const prisma = new PrismaClient()

async function main() {
  console.log(`Seeding fixture restaurant: ${FIXTURE_SLUG}`)
  console.log(`Week: ${WEEK_START.toISOString()} → ${WEEK_END.toISOString()}`)

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: FIXTURE_SLUG },
    create: {
      name: FIXTURE_NAME,
      slug: FIXTURE_SLUG,
      inboundEmail: FIXTURE_INBOUND,
      currency: 'GBP',
      // Trial end well in the future so plan gating doesn't trip if the
      // fixture is ever loaded through real app code paths.
      trialEndsAt: new Date('2099-12-31T00:00:00.000Z'),
    },
    update: {
      name: FIXTURE_NAME,
      inboundEmail: FIXTURE_INBOUND,
    },
  })
  console.log(`Restaurant id: ${restaurant.id}`)

  await prisma.overheadAllocationConfig.upsert({
    where: { restaurantId: restaurant.id },
    create: {
      restaurantId: restaurant.id,
      method: 'BY_ORDERS',
      foodCostPct: FOOD_COST_PCT,
    },
    update: {
      method: 'BY_ORDERS',
      foodCostPct: FOOD_COST_PCT,
    },
  })

  const platforms = await Promise.all(
    PLATFORM_DATA.map((p) =>
      prisma.platform.upsert({
        where: { restaurantId_name: { restaurantId: restaurant.id, name: p.name } },
        create: {
          restaurantId: restaurant.id,
          name: p.name,
          commissionRate: p.commissionRate,
          isActive: true,
        },
        update: {
          commissionRate: p.commissionRate,
          isActive: true,
        },
      })
    )
  )
  const platformByName = new Map(platforms.map((p) => [p.name, p]))

  for (const p of PLATFORM_DATA) {
    const platform = platformByName.get(p.name)!
    await prisma.platformPeriod.upsert({
      where: {
        restaurantId_platformId_periodStart: {
          restaurantId: restaurant.id,
          platformId: platform.id,
          periodStart: WEEK_START,
        },
      },
      create: {
        restaurantId: restaurant.id,
        platformId: platform.id,
        periodStart: WEEK_START,
        periodEnd: WEEK_END,
        orderCount: p.orders,
        grossRevenue: p.gross,
        commissionCharged: p.commission,
        netRevenue: p.net,
        averageOrderValue: p.gross / p.orders,
        currency: 'GBP',
      },
      update: {
        periodEnd: WEEK_END,
        orderCount: p.orders,
        grossRevenue: p.gross,
        commissionCharged: p.commission,
        netRevenue: p.net,
        averageOrderValue: p.gross / p.orders,
      },
    })
  }

  // Tables without unique constraints: wipe scoped to the fixture restaurant
  // and re-insert. Safe because nothing else writes to this restaurant.
  await prisma.promotionCharge.deleteMany({ where: { restaurantId: restaurant.id } })
  for (const promo of PROMOTIONS) {
    const platform = platformByName.get(promo.platform)!
    await prisma.promotionCharge.create({
      data: {
        restaurantId: restaurant.id,
        platformId: platform.id,
        periodStart: WEEK_START,
        periodEnd: WEEK_END,
        chargeAmount: promo.chargeAmount,
        promotionType: promo.promotionType,
      },
    })
  }

  await prisma.expenseEntry.deleteMany({ where: { restaurantId: restaurant.id } })
  await prisma.expenseCategory.deleteMany({ where: { restaurantId: restaurant.id } })
  const overheadCategory = await prisma.expenseCategory.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Overhead',
      colour: '#888888',
    },
  })
  for (const exp of EXPENSES) {
    const vat = exp.gross / 6
    const net = exp.gross - vat
    await prisma.expenseEntry.create({
      data: {
        restaurantId: restaurant.id,
        date: new Date('2026-04-15T12:00:00.000Z'), // mid-week, inside [WEEK_START, WEEK_END]
        categoryId: overheadCategory.id,
        description: exp.description,
        netAmount: net,
        vatAmount: vat,
        grossAmount: exp.gross,
        vatReclaimable: true,
      },
    })
  }

  await prisma.payrollEntry.deleteMany({ where: { restaurantId: restaurant.id } })
  await prisma.employee.deleteMany({ where: { restaurantId: restaurant.id } })
  const employee = await prisma.employee.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Fixture Worker',
      type: 'HOURLY',
      hourlyRate: 12,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      isActive: true,
    },
  })
  await prisma.payrollEntry.create({
    data: {
      restaurantId: restaurant.id,
      employeeId: employee.id,
      // Fully contained in the week — matches the summary route's
      // periodStart ≥ weekStart ∧ periodEnd ≤ weekEnd filter.
      periodStart: WEEK_START,
      periodEnd: WEEK_END,
      hoursWorked: 40,
      grossPay: 480,
      // Hand-figured employer NI so the fixture has a realistic-ish value
      // without depending on whatever rate constants live in lib/. The
      // verify script doesn't recompute NI; it just reads what's stored.
      employerNI: 32.84,
    },
  })

  console.log('')
  console.log('Done. Verify with:')
  console.log(`  npm run verify:weekly-snapshot -- ${restaurant.id} 2026-04-13`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
