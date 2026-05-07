// Dev-only: seeds a deterministic restaurant + three consecutive ISO weeks
// of platform, expense, payroll and promotion data so verify-weekly-snapshot
// has non-zero numbers to reconcile and verify-channel-expectancy exercises
// the mixed-wins/losses, all-loss, and multi-week-averaging branches of
// computeExpectancy (Issue #15).
//
// Idempotent — re-running upserts the restaurant, platforms, platform periods
// (keyed by week start) and allocation config, and deletes-then-inserts the
// rows that have no unique constraint (expenses, payroll, promotions, expense
// categories, employees). Only ever touches the fixture restaurant; never
// reads or modifies any other tenant.
//
// Usage:
//   npm run seed:weekly-snapshot

import { PrismaClient, PlatformName } from '@prisma/client'

const FIXTURE_SLUG = '_fixture_weekly_snapshot'
const FIXTURE_NAME = '_FIXTURE Weekly Snapshot'
const FIXTURE_INBOUND = '_fixture_weekly_snapshot@inbound.fixture.local'

// Three consecutive ISO weeks. Week C (idx 2) is the original anchor; A and
// B were added for Issue #15 so the channel-expectancy verifier exercises
// the multi-week / mixed / all-loss branches the single-week fixture could
// not. midweek is used for ExpenseEntry.date and is always inside [start, end].
type WeekDef = { idx: number; start: Date; end: Date; midweek: Date }

const WEEKS: WeekDef[] = [
  {
    idx: 0,
    start: new Date('2026-03-30T00:00:00.000Z'),
    end: new Date('2026-04-05T23:59:59.999Z'),
    midweek: new Date('2026-04-01T12:00:00.000Z'),
  },
  {
    idx: 1,
    start: new Date('2026-04-06T00:00:00.000Z'),
    end: new Date('2026-04-12T23:59:59.999Z'),
    midweek: new Date('2026-04-08T12:00:00.000Z'),
  },
  {
    idx: 2,
    start: new Date('2026-04-13T00:00:00.000Z'),
    end: new Date('2026-04-19T23:59:59.999Z'),
    midweek: new Date('2026-04-15T12:00:00.000Z'),
  },
]

const FOOD_COST_PCT = 0.28

// Per-platform per-week numbers. Hand-verified against the BY_ORDERS allocator
// + £600 expenses/week + £512.84 payroll/week (= £1112.84 overhead) so that
// across the 3-week window:
//   - WALKIN   = WIN, WIN, WIN              (all-win branch)
//   - DELIVEROO = LOSS, LOSS, LOSS          (all-loss branch — heavy promo)
//   - UBEREATS = WIN, LOSS, WIN             (mixed — Week B's £600 promo crushes it)
//   - JUSTEAT  = LOSS, WIN, WIN             (mixed — Week A's £200 promo on low orders)
type PlatformWeekRow = {
  orders: number
  gross: number
  commission: number
  net: number
}

type PlatformConfig = {
  name: PlatformName
  commissionRate: number
  weeks: PlatformWeekRow[]
}

const PLATFORM_DATA: PlatformConfig[] = [
  {
    name: 'UBEREATS',
    commissionRate: 0.30,
    weeks: [
      { orders: 100, gross: 1500, commission: 450, net: 1050 },
      { orders: 110, gross: 1650, commission: 495, net: 1155 },
      { orders: 120, gross: 1800, commission: 540, net: 1260 },
    ],
  },
  {
    name: 'DELIVEROO',
    commissionRate: 0.30,
    weeks: [
      { orders: 90, gross: 1440, commission: 432, net: 1008 },
      { orders: 95, gross: 1520, commission: 456, net: 1064 },
      { orders: 80, gross: 1280, commission: 384, net: 896 },
    ],
  },
  {
    name: 'JUSTEAT',
    commissionRate: 0.25,
    weeks: [
      { orders: 50, gross: 700,   commission: 175,   net: 525 },
      { orders: 55, gross: 770,   commission: 192.5, net: 577.5 },
      { orders: 60, gross: 840,   commission: 210,   net: 630 },
    ],
  },
  {
    name: 'WALKIN',
    commissionRate: 0.0,
    weeks: [
      { orders: 40, gross: 520, commission: 0, net: 520 },
      { orders: 40, gross: 520, commission: 0, net: 520 },
      { orders: 40, gross: 520, commission: 0, net: 520 },
    ],
  },
]

type PromoRow = {
  platform: PlatformName
  weekIdx: number
  chargeAmount: number
  promotionType: string
}

const PROMOTIONS: PromoRow[] = [
  { platform: 'UBEREATS',  weekIdx: 0, chargeAmount: 50,  promotionType: 'BOGO' },
  { platform: 'UBEREATS',  weekIdx: 1, chargeAmount: 600, promotionType: 'BOGO Aggressive' },
  { platform: 'UBEREATS',  weekIdx: 2, chargeAmount: 50,  promotionType: 'BOGO' },
  { platform: 'DELIVEROO', weekIdx: 0, chargeAmount: 400, promotionType: 'Discount 30%' },
  { platform: 'DELIVEROO', weekIdx: 1, chargeAmount: 400, promotionType: 'Discount 30%' },
  { platform: 'DELIVEROO', weekIdx: 2, chargeAmount: 350, promotionType: 'Discount 30%' },
  { platform: 'JUSTEAT',   weekIdx: 0, chargeAmount: 200, promotionType: 'Discount 25%' },
  { platform: 'JUSTEAT',   weekIdx: 1, chargeAmount: 100, promotionType: 'Discount 10%' },
  { platform: 'JUSTEAT',   weekIdx: 2, chargeAmount: 30,  promotionType: 'Discount 5%' },
]

const EXPENSES_PER_WEEK: Array<{ description: string; gross: number }> = [
  { description: 'Weekly rent contribution',  gross: 400 },
  { description: 'Weekly utilities estimate', gross: 200 },
]

// One payroll period per week, fully contained in [weekStart, weekEnd] so it
// matches the summary route's filter. Hand-figured employerNI — verifier reads
// what's stored, doesn't recompute it.
const PAYROLL_PER_WEEK = {
  hoursWorked: 40,
  grossPay: 480,
  employerNI: 32.84,
}

const prisma = new PrismaClient()

async function main() {
  console.log(`Seeding fixture restaurant: ${FIXTURE_SLUG}`)
  console.log(`Weeks (${WEEKS.length}):`)
  for (const w of WEEKS) {
    console.log(`  ${w.idx}: ${w.start.toISOString()} → ${w.end.toISOString()}`)
  }

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

  // PlatformPeriod is keyed by (restaurantId, platformId, periodStart) so
  // upsert is safe across re-runs and across the new multi-week window.
  for (const p of PLATFORM_DATA) {
    const platform = platformByName.get(p.name)!
    for (const w of WEEKS) {
      const row = p.weeks[w.idx]
      await prisma.platformPeriod.upsert({
        where: {
          restaurantId_platformId_periodStart: {
            restaurantId: restaurant.id,
            platformId: platform.id,
            periodStart: w.start,
          },
        },
        create: {
          restaurantId: restaurant.id,
          platformId: platform.id,
          periodStart: w.start,
          periodEnd: w.end,
          orderCount: row.orders,
          grossRevenue: row.gross,
          commissionCharged: row.commission,
          netRevenue: row.net,
          averageOrderValue: row.gross / row.orders,
          currency: 'GBP',
        },
        update: {
          periodEnd: w.end,
          orderCount: row.orders,
          grossRevenue: row.gross,
          commissionCharged: row.commission,
          netRevenue: row.net,
          averageOrderValue: row.gross / row.orders,
        },
      })
    }
  }

  // Tables without unique constraints: wipe scoped to the fixture restaurant
  // and re-insert. Safe because nothing else writes to this restaurant.
  await prisma.promotionCharge.deleteMany({ where: { restaurantId: restaurant.id } })
  for (const promo of PROMOTIONS) {
    const platform = platformByName.get(promo.platform)!
    const week = WEEKS[promo.weekIdx]
    await prisma.promotionCharge.create({
      data: {
        restaurantId: restaurant.id,
        platformId: platform.id,
        periodStart: week.start,
        periodEnd: week.end,
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
  for (const w of WEEKS) {
    for (const exp of EXPENSES_PER_WEEK) {
      const vat = exp.gross / 6
      const net = exp.gross - vat
      await prisma.expenseEntry.create({
        data: {
          restaurantId: restaurant.id,
          date: w.midweek,
          categoryId: overheadCategory.id,
          description: exp.description,
          netAmount: net,
          vatAmount: vat,
          grossAmount: exp.gross,
          vatReclaimable: true,
        },
      })
    }
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
  for (const w of WEEKS) {
    await prisma.payrollEntry.create({
      data: {
        restaurantId: restaurant.id,
        employeeId: employee.id,
        // Fully contained in the week — matches the summary route's
        // periodStart ≥ weekStart ∧ periodEnd ≤ weekEnd filter.
        periodStart: w.start,
        periodEnd: w.end,
        hoursWorked: PAYROLL_PER_WEEK.hoursWorked,
        grossPay: PAYROLL_PER_WEEK.grossPay,
        employerNI: PAYROLL_PER_WEEK.employerNI,
      },
    })
  }

  console.log('')
  console.log('Done. Verify with:')
  console.log(`  npm run verify:weekly-snapshot -- ${restaurant.id} 2026-04-13`)
  console.log(`  npm run verify:weekly-snapshot -- ${restaurant.id} 2026-04-06`)
  console.log(`  npm run verify:weekly-snapshot -- ${restaurant.id} 2026-03-30`)
  console.log(`  npm run verify:channel-expectancy -- ${restaurant.id} 2026-04-13 3`)
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
