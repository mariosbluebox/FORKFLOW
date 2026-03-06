# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A **multi-tenant SaaS** financial management platform for restaurants (initially targeting UK fast food / QSR). Each restaurant is a separate tenant. The full design is documented in:
- `SPEC.md` — core app: onboarding, auth, revenue, expenses, payroll, inventory, reports, subscriptions, super-admin
- `SPEC2.md` — analytics layer: platform ROI, automated email ingestion, correlations, expectancy, financial health score

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Prisma ORM (hosted on Neon) |
| Auth | NextAuth.js (credentials, self-signup) |
| Charts | Recharts |
| PDF export | @react-pdf/renderer |
| Payments | Stripe (subscriptions + webhooks) |
| Email inbound | Postmark Inbound Webhooks |
| Deployment | Vercel |

Keep the stack simple and low-maintenance. Do not introduce additional dependencies without a clear reason.

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Database migrations
npx prisma migrate dev --name <migration-name>

# Regenerate Prisma client after schema changes
npx prisma generate

# Seed database
npx prisma db seed

# Open Prisma Studio (DB browser)
npx prisma studio

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Environment Variables

```
DATABASE_URL=                  # Neon PostgreSQL connection string
NEXTAUTH_SECRET=               # Random secret for NextAuth
NEXTAUTH_URL=                  # App URL (e.g. https://yourapp.com)
STRIPE_SECRET_KEY=             # Stripe secret key
STRIPE_WEBHOOK_SECRET=         # Stripe webhook signing secret
STRIPE_BASIC_PRICE_ID=        # Stripe Price ID for Basic plan
STRIPE_PRO_PRICE_ID=           # Stripe Price ID for Pro plan
POSTMARK_INBOUND_WEBHOOK_TOKEN= # Postmark webhook auth token
POSTMARK_SERVER_TOKEN=         # Postmark server token (for outbound)
CRON_SECRET=                   # Secret header for cron routes
SUPER_ADMIN_EMAIL=             # Email of the super-admin user
```

## Architecture

**Next.js App Router** — all routes live under `app/`. API logic uses Route Handlers (`app/api/`). No separate backend server.

**Multi-tenancy** — Row-level tenancy. Every data model (RevenueEntry, ExpenseEntry, PayrollEntry, etc.) has a `restaurantId` field. All DB queries MUST filter by `restaurantId` from the session. Never query without a restaurant scope unless you are in a super-admin route.

**Restaurant context** — `restaurantId` is embedded in the JWT session at login and at signup. Middleware ensures all dashboard routes have a valid session. Routes are NOT slug-based — the restaurant is always resolved from the session, not the URL.

**Super-admin** — Routes under `/admin` are restricted to the user whose email matches `SUPER_ADMIN_EMAIL`. Super-admin can view all restaurants, manage subscriptions, impersonate restaurants, and suspend/delete accounts.

**Database** — PostgreSQL hosted on Neon, managed by Prisma. The schema is the source of truth. Always run `prisma generate` after schema changes.

**Auth** — NextAuth.js with credentials provider. Self-signup creates a Restaurant + User in one transaction. Session JWT carries `userId`, `restaurantId`, `plan`, `isAdmin`.

**Subscriptions** — Three plans: `FREE_TRIAL` (30 days), `BASIC`, `PRO`. Plan is stored on the Restaurant record. Stripe webhooks update the plan on subscription events. Feature gating is enforced server-side in API routes and client-side via a `usePlan()` hook.

**Feature gating by plan:**
- `FREE_TRIAL` — full access to everything for 30 days, then locked to Free
- `BASIC` — Revenue, Expenses, Payroll, Inventory, Reports, CSV import
- `PRO` — Everything in Basic + Platform Analytics, Automated email ingestion, Correlations, Expectancy, Health Score, Scenario Modelling

**Automated email ingestion** — Each restaurant has a unique `inboundEmail` (e.g. `slug-abc123@inbound.yourapp.com`). Postmark receives forwarded platform emails and POSTs to `POST /api/inbound/email`. The handler identifies the restaurant by matching the `To` address, identifies the platform by sender domain, parses the CSV attachment, and upserts a `PlatformPeriod` record. Processing is synchronous. All attempts logged in `ImportLog`.

**Inbound email processing (synchronous):**
1. Verify Postmark webhook token
2. Match `To` address → Restaurant
3. Match sender domain → Platform
4. Parse CSV attachment using platform-specific parser
5. Upsert `PlatformPeriod`
6. Create `ImportLog` record (SUCCESS / FAILED / PARTIAL)
7. Create in-app `Notification`

**Platform parsers** — one parser per platform in `lib/parsers/`:
- `uber-eats.ts` — columns: Order Date, Gross Order Value, Uber Eats Fee, Net Payout
- `just-eat.ts` — columns: Date, Orders, Gross Sales, Commission, Net Sales
- `deliveroo.ts` — columns: Week Ending, Total Orders, Gross Revenue, Fee, Net Revenue
All parsers normalise to: `{ date, orderCount, grossRevenue, commissionCharged, netRevenue, platformName }`
Skip rows where date is blank or contains "Total".

**Financial calculations** — monetary values stored as `Float`. Currency stored per restaurant (`restaurant.currency`, default `GBP`). VAT is always 20% UK standard rate (for UK restaurants). Revenue entries store `grossAmount`, `vatAmount` (gross / 6), and `netAmount` (gross − VAT) separately.

**Overhead allocation** — fixed costs allocated to delivery platforms using one of three methods: by order count (default), by revenue share, or by time. Configurable per restaurant via `OverheadAllocationConfig`.

**Correlations** — Pearson r calculated over rolling 12-week windows. Results cached in `CorrelationCache` table (scoped by `restaurantId`). Never show raw r values to the user — always render as plain-English insight.

**Expectancy** — expressed as net profit per order or per £ spent. Positive = making money, negative = losing money. Always accompanied by a plain-English verdict and actionable recommendation.

**Cron jobs** — Protected with `CRON_SECRET` header. Called by Vercel Cron:
- `GET /api/cron/import-check` — every Monday, checks each restaurant for missing weekly statements and creates warning notifications

## Key Business Logic

```
# UK VAT (20% standard rate)
vatAmount  = grossAmount / 6
netAmount  = grossAmount - vatAmount

# P&L
Net Profit = Net Revenue - COGS - Operating Expenses - Payroll

# Food Cost %  (target < 30%)
foodCostPct = (ingredientCost / sellingPriceExVAT) * 100

# Labour Cost %  (target < 30% for QSR)
labourCostPct = (totalPayroll / totalRevenue) * 100

# True cost per delivery order
trueCostPerOrder = (foodCost / orders)
                 + (allocatedOverhead / orders)
                 + commissionPerOrder
                 + (promotionCharge / orders)

# Promotion ROI
roiPct = ((netRevenue - totalCosts) / promotionCharge) * 100

# Break-even orders
breakEven = (fixedCosts + promotionCharge)
          / (netRevenuePerOrder - variableCostPerOrder)

# Free trial expiry
isTrialExpired = restaurant.plan === 'FREE_TRIAL' && restaurant.trialEndsAt < now
```

## Currency & Locale

- Default currency: GBP (£), but each restaurant stores its own `currency` code
- Default locale: `en-GB`
- Use `Intl.NumberFormat` with the restaurant's currency for all formatting
- Date format: `dd/MM/yyyy` (UK default)
- VAT rate constant: define once in `lib/constants.ts`, never hardcode `0.20` inline

## Session Helper — use in every API route

```ts
import { getSessionRestaurantId, unauthorized } from '@/lib/session'
const restaurantId = await getSessionRestaurantId()
if (!restaurantId) return unauthorized()
```

Never call `getServerSession(authOptions)` directly in API routes — use the helper.

## Stripe

- Lazy-initialize via `lib/stripe.ts` Proxy pattern — **never** `new Stripe()` at module level (breaks Next.js build)
- API version: `'2026-02-25.clover'`

## Employer NI Calculation

```ts
const weeks = Math.max(1, Math.round((periodEnd - periodStart) / (7 * 24 * 60 * 60 * 1000)))
const employerNI = Math.max(0, (grossPay - EMPLOYER_NI_THRESHOLD_WEEKLY * weeks) * EMPLOYER_NI_RATE)
```

## UI Patterns (consistent across all module pages)

- All list/CRUD pages are `'use client'` components
- Filter bar + summary cards (3-col) + table + modal — same structure every module
- Modals: fixed overlay, `max-w-md` or `max-w-lg`, click-outside closes
- Shared primitives inlined per file: `INPUT` const, `Field`, `FormRow`, `Modal`, `ModalActions`, `Loader`, `Empty`
- `formatCurrency(amount, currency)` — always pass restaurant currency; never hardcode GBP
- Employees are **soft-deleted** (isActive=false, endDate=now) — never hard-deleted
- Stock movements update `currentStock` atomically via `db.$transaction`
- `$queryRaw` required for `currentStock <= reorderLevel` comparisons (Prisma field comparison limitation)
- Cash flow report uses **weekly buckets** — iterate week by week between from/to dates

## Development Phases

1. **Phase 0** ✅ — SaaS schema, multi-tenant auth, self-signup, Stripe, super-admin panel
2. **Phase 1** 🔄 — Core modules: dashboard, revenue, expenses, payroll, inventory, reports
   - All API routes complete
   - Pages: dashboard, revenue, expenses, payroll (list+log) done
   - Still needed: employees page, inventory pages, reports pages
3. **Phase 2** — Platform analytics: manual entry + CSV import per platform
4. **Phase 3** — Automated email ingestion: Postmark inbound, CSV parsers, ImportLog, Notifications
5. **Phase 4** — Advanced analytics: correlations, expectancy, financial health score, scenario modelling
6. **Phase 5** — Polish: PDF export, cron jobs, mobile layout, direct POS API integration (future)
