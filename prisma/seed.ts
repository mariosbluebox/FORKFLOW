import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { DEFAULT_CATEGORIES, DEFAULT_PLATFORMS } from '../lib/constants'

const prisma = new PrismaClient()

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'admin@restofinance.app'
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'owner@demo-restaurant.com'
const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? 'inbound.restofinance.app'

// Passwords come from env so no usable credentials live in the repo.
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be set to run the seed`)
  return value
}

async function main() {
  const adminPassword = requireEnv('SEED_ADMIN_PASSWORD')
  const demoPassword = requireEnv('SEED_DEMO_PASSWORD')

  // ── Super-admin user (no restaurant) ────────────────────────────────────────
  const existingAdmin = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } })
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        name: 'Super Admin',
        isAdmin: true,
        // no restaurantId — admin has no restaurant
      },
    })
    console.log(`Created super-admin: ${SUPER_ADMIN_EMAIL}`)
  }

  // ── Demo restaurant + owner ──────────────────────────────────────────────────
  const existingDemo = await prisma.restaurant.findUnique({ where: { slug: 'demo-restaurant' } })
  if (!existingDemo) {
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const restaurant = await prisma.restaurant.create({
      data: {
        name: 'Demo Restaurant',
        slug: 'demo-restaurant',
        inboundEmail: `demo-restaurant-seed01@${INBOUND_DOMAIN}`,
        trialEndsAt,
        plan: 'FREE_TRIAL',
      },
    })

    await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash: await bcrypt.hash(demoPassword, 12),
        name: 'Demo Owner',
        restaurantId: restaurant.id,
      },
    })

    // Default expense categories
    await prisma.expenseCategory.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({
        restaurantId: restaurant.id,
        name: c.name,
        colour: c.colour,
      })),
    })

    // Default platforms
    for (const p of DEFAULT_PLATFORMS) {
      await prisma.platform.create({
        data: { restaurantId: restaurant.id, name: p.name, commissionRate: p.commissionRate },
      })
    }

    // Default overhead allocation config
    await prisma.overheadAllocationConfig.create({
      data: { restaurantId: restaurant.id },
    })

    console.log(`Created demo restaurant + owner: ${DEMO_EMAIL}`)
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
