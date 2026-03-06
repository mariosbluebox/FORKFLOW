# Restaurant Finance Manager — SPEC.md

## 1. Project Overview

A **multi-tenant SaaS** financial management platform for restaurants. Any restaurant can self-sign up, manage their finances, and get actionable insights from their data. Initially targeting UK fast food / quick service restaurants, but built to support any currency and locale.

**Multi-tenant:** Each restaurant is an isolated tenant. Data is never shared between restaurants.
**Single role (Phase 1):** Owner only — no staff/accountant roles yet.
**Platform:** Desktop web browser (responsive for mobile in future phases).
**Currency:** Multi-currency (default GBP, stored per restaurant).

---

## 2. Goals

| # | Goal |
|---|------|
| 1 | Replace manual spreadsheet tracking with a structured, reliable system |
| 2 | Provide daily/weekly/monthly P&L at a glance |
| 3 | Track all expense categories with VAT handling |
| 4 | Manage staff payroll (hourly and salaried employees) |
| 5 | Monitor inventory and food cost per menu item |
| 6 | Automate platform statement ingestion via email (Uber Eats, Deliveroo, Just Eat) |
| 7 | Export reports to CSV / PDF for accountant use |
| 8 | Offer tiered subscription plans (Free Trial, Basic, Pro) via Stripe |
| 9 | Super-admin panel to manage all restaurants and subscriptions |

---

## 3. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **Next.js 15** (App Router) | Full-stack, single codebase, minimal infra |
| Language | **TypeScript** | Catches bugs early, good DX |
| Styling | **Tailwind CSS** | Fast to build, no extra CSS files |
| Database | **PostgreSQL** via **Prisma ORM** (hosted on **Neon**) | Serverless-compatible, works on Vercel |
| Auth | **NextAuth.js** (credentials, self-signup) | Simple credentials auth with custom signup |
| Charts | **Recharts** | Lightweight, React-native charts |
| PDF export | **@react-pdf/renderer** | Generate reports as PDF |
| Payments | **Stripe** | Subscription billing + webhooks |
| Email inbound | **Postmark Inbound** | Receive forwarded platform emails |
| Deployment | **Vercel** | Zero-config deployment for Next.js |

---

## 4. Architecture

```
app/
├── (auth)/
│   ├── login/              # Login page
│   └── signup/             # Self-signup (creates Restaurant + User)
├── (dashboard)/
│   ├── layout.tsx          # Protected layout — session required
│   ├── page.tsx            # Dashboard home
│   ├── revenue/            # Revenue module
│   ├── expenses/           # Expenses module
│   ├── payroll/            # Payroll module
│   ├── inventory/          # Inventory & food cost module
│   ├── reports/            # Reports module
│   ├── platforms/          # Platform analytics (SPEC2)
│   ├── analytics/          # Correlations + expectancy (SPEC2)
│   ├── health/             # Financial health score (SPEC2)
│   └── settings/
│       ├── page.tsx        # General settings
│       └── integrations/   # Postmark inbound email setup
├── admin/                  # Super-admin panel (SUPER_ADMIN_EMAIL only)
│   ├── page.tsx            # All restaurants list
│   ├── restaurants/[id]/   # Restaurant detail + actions
│   └── layout.tsx          # Admin layout with guard
└── api/
    ├── auth/               # NextAuth
    ├── signup/             # POST — create restaurant + user
    ├── revenue/            # CRUD + CSV import
    ├── expenses/           # CRUD + categories
    ├── payroll/            # Employees + pay periods
    ├── inventory/          # Stock + movements + menu items
    ├── reports/            # P&L, cash flow, VAT, payroll
    ├── platforms/          # Platform periods + promotions
    ├── notifications/      # List + mark read
    ├── inbound/
    │   └── email/          # Postmark inbound webhook
    ├── stripe/
    │   └── webhook/        # Stripe subscription events
    ├── billing/
    │   └── portal/         # Create Stripe customer portal session
    └── cron/
        └── import-check/   # Weekly missing-statement check

lib/
├── db.ts                   # Prisma singleton
├── auth.ts                 # NextAuth config
├── utils.ts                # Currency formatting, date helpers
├── constants.ts            # VAT_RATE, plan limits, etc.
├── stripe.ts               # Stripe client singleton
├── postmark.ts             # Postmark client
├── feature-gate.ts         # Plan feature check helpers
└── parsers/
    ├── uber-eats.ts        # Uber Eats CSV parser
    ├── just-eat.ts         # Just Eat CSV parser
    └── deliveroo.ts        # Deliveroo CSV parser

components/
├── ui/                     # Button, Card, Table, Modal, Badge, Alert, Tabs
├── charts/                 # Recharts wrappers
├── forms/                  # All form components
└── Sidebar.tsx / Topbar.tsx / Notifications.tsx
```

---

## 5. Database Schema

### `Restaurant`
The top-level tenant. Every data record is scoped to a restaurant.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| name | String | Restaurant display name |
| slug | String | Unique, URL-safe identifier |
| inboundEmail | String | Unique inbound address (e.g. slug-abc@inbound.app.com) |
| currency | String | ISO 4217 code, default `GBP` |
| plan | Enum | `FREE_TRIAL`, `BASIC`, `PRO` |
| trialEndsAt | DateTime | 30 days from signup |
| stripeCustomerId | String? | Stripe Customer ID |
| stripeSubscriptionId | String? | Stripe Subscription ID |
| isActive | Boolean | False = suspended |
| createdAt | DateTime | |

---

### `User`
One user per restaurant (owner). Belongs to exactly one restaurant.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| email | String | Unique |
| passwordHash | String | Bcrypt |
| name | String | Display name |
| restaurantId | String | FK → Restaurant |
| isAdmin | Boolean | True only for super-admin |
| createdAt | DateTime | |

---

### `RevenueEntry`
Daily revenue log, scoped to a restaurant.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| restaurantId | String | FK → Restaurant |
| date | DateTime | Day of the entry |
| source | Enum | `SUMUP`, `TAKEPAYMENTS`, `CASH`, `OTHER` |
| grossAmount | Float | Total takings inc. VAT |
| vatAmount | Float | VAT collected (gross / 6 for UK) |
| netAmount | Float | Gross minus VAT |
| notes | String? | |
| createdAt | DateTime | |

---

### `ExpenseCategory`
Scoped per restaurant. Owner can customise.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| restaurantId | String | FK → Restaurant |
| name | String | e.g. "Ingredients", "Utilities" |
| colour | String | Hex colour for charts |
| entries | ExpenseEntry[] | |

---

### `ExpenseEntry`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| restaurantId | String | FK → Restaurant |
| date | DateTime | |
| categoryId | String | FK → ExpenseCategory |
| supplier | String? | |
| description | String | |
| netAmount | Float | |
| vatAmount | Float | |
| grossAmount | Float | |
| vatReclaimable | Boolean | Default true |
| receiptUrl | String? | |
| createdAt | DateTime | |

---

### `Employee`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| restaurantId | String | FK → Restaurant |
| name | String | |
| type | Enum | `HOURLY`, `SALARIED` |
| hourlyRate | Float? | |
| monthlySalary | Float? | |
| startDate | DateTime | |
| endDate | DateTime? | |
| isActive | Boolean | |
| payrollEntries | PayrollEntry[] | |

---

### `PayrollEntry`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| restaurantId | String | FK → Restaurant |
| employeeId | String | FK → Employee |
| periodStart | DateTime | |
| periodEnd | DateTime | |
| hoursWorked | Float? | |
| grossPay | Float | |
| employerNI | Float | |
| notes | String? | |
| createdAt | DateTime | |

---

### `InventoryItem`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| restaurantId | String | FK → Restaurant |
| name | String | |
| unit | String | kg, litre, pack, etc. |
| currentStock | Float | |
| reorderLevel | Float | |
| costPerUnit | Float | |
| supplierId | String? | |
| updatedAt | DateTime | |
| movements | StockMovement[] | |

---

### `StockMovement`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| restaurantId | String | FK → Restaurant |
| inventoryItemId | String | FK → InventoryItem |
| type | Enum | `IN`, `OUT`, `WASTAGE` |
| quantity | Float | |
| costPerUnit | Float? | |
| totalCost | Float? | |
| date | DateTime | |
| notes | String? | |

---

### `MenuItem`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| restaurantId | String | FK → Restaurant |
| name | String | |
| category | String | |
| sellingPrice | Float | Inc. VAT |
| foodCostTarget | Float | Target ingredient cost |
| isActive | Boolean | |

---

### `Notification`
In-app notifications for a restaurant. Created by system after imports, alerts, etc.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| restaurantId | String | FK → Restaurant |
| title | String | Short heading |
| body | String | Detail message |
| read | Boolean | Default false |
| createdAt | DateTime | |

---

### `ImportLog`
Records every automated email ingestion attempt.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| restaurantId | String | FK → Restaurant |
| platform | Enum | `UBEREATS`, `DELIVEROO`, `JUSTEAT` |
| filename | String | CSV filename from attachment |
| status | Enum | `SUCCESS`, `FAILED`, `PARTIAL` |
| rowsImported | Int | Number of rows successfully parsed |
| errorMessage | String? | Reason for failure if applicable |
| receivedAt | DateTime | When the webhook was received |

---

## 6. Subscription Plans

| Feature | Free Trial (30 days) | Basic | Pro |
|---------|---------------------|-------|-----|
| Revenue & Expenses | ✓ | ✓ | ✓ |
| Payroll | ✓ | ✓ | ✓ |
| Inventory & Food Cost | ✓ | ✓ | ✓ |
| Reports + CSV/PDF export | ✓ | ✓ | ✓ |
| CSV manual import | ✓ | ✓ | ✓ |
| Platform Analytics (SPEC2) | ✓ | ✗ | ✓ |
| Automated email ingestion | ✓ | ✗ | ✓ |
| Correlations & Expectancy | ✓ | ✗ | ✓ |
| Financial Health Score | ✓ | ✗ | ✓ |
| Scenario Modelling | ✓ | ✗ | ✓ |

After Free Trial expires: locked to Basic feature set until they subscribe.
No card required to start Free Trial.

---

## 7. Self-Signup Flow

**Route:** `/signup`

1. Restaurant name + owner email + password
2. On submit: create `Restaurant` + `User` in one DB transaction
   - Generate unique `slug` from restaurant name
   - Generate unique `inboundEmail`: `{slug}-{random6}@inbound.yourapp.com`
   - Set `plan = FREE_TRIAL`, `trialEndsAt = now + 30 days`
   - Seed default expense categories for the restaurant
   - Seed default platforms (Uber Eats, Deliveroo, Just Eat, Walk-in)
   - Seed default `OverheadAllocationConfig`
3. Auto-login after signup (create session)
4. Redirect to `/` (dashboard)

---

## 8. Stripe Integration

### Checkout
- `POST /api/billing/checkout` — creates a Stripe Checkout session for Basic or Pro
- On success → Stripe redirects to `/settings/billing?success=true`

### Customer Portal
- `POST /api/billing/portal` — creates a Stripe Customer Portal session for plan management/cancellation

### Webhooks
`POST /api/stripe/webhook` handles:
- `customer.subscription.created` → set plan, store `stripeSubscriptionId`
- `customer.subscription.updated` → update plan
- `customer.subscription.deleted` → revert to `FREE_TRIAL` (or lock)
- `invoice.payment_failed` → create warning Notification

### Plan stored on Restaurant
After any subscription event, update `restaurant.plan` and `restaurant.stripeCustomerId`.

---

## 9. Super-Admin Panel

**Route:** `/admin` — restricted to user with `isAdmin = true` (matched by `SUPER_ADMIN_EMAIL` env var at seed/signup).

### Pages

| Route | Description |
|-------|-------------|
| `/admin` | All restaurants: name, plan, trial end date, joined date, status |
| `/admin/restaurants/[id]` | Restaurant detail: usage, subscription, actions |

### Actions available per restaurant:
- View all data (read-only impersonation via `?impersonate=restaurantId` query param in admin routes)
- Manually change plan (`FREE_TRIAL` / `BASIC` / `PRO`)
- Extend trial (update `trialEndsAt`)
- Suspend account (`isActive = false`)
- Delete account (hard delete, cascades all data)

---

## 10. Automated Email Ingestion

See SPEC2.md Section 5 for full detail. Summary:

- Each restaurant has a unique `inboundEmail`
- Owner sets up a one-time Gmail/Outlook auto-forward to that address
- Postmark receives emails and POSTs to `POST /api/inbound/email`
- Handler: verify token → match restaurant → detect platform → parse CSV → upsert `PlatformPeriod` → log to `ImportLog` → create `Notification`
- Processing is synchronous (fast enough for serverless)

---

## 11. Modules & Features

### 11.1 Dashboard
**Route:** `/`
- Today's revenue, week vs. last week trend, monthly P&L
- Financial Health Score (if Pro)
- Top 3 expense categories
- Labour cost % gauge
- Low stock alerts
- Unread notifications count
- Trial expiry banner (if on Free Trial with < 7 days remaining)

### 11.2 Revenue Module
**Route:** `/revenue`
- Log daily revenue (SumUp / TakePayments / Cash / Other)
- VAT auto-calculated (20% UK standard)
- CSV import from SumUp and TakePayments
- Filter by date range, source
- Summary: gross / VAT / net for period
- Week-over-week comparison

### 11.3 Expense Module
**Route:** `/expenses`
- Log expenses with category, supplier, net/VAT/gross
- Mark VAT as reclaimable
- Filter by category, date, supplier
- Monthly breakdown by category (pie chart)
- VAT summary for quarterly return

### 11.4 Payroll Module
**Route:** `/payroll`
- Employee directory (hourly / salaried)
- Log pay periods, auto-calculate gross pay
- Employer NI awareness (13.8% above secondary threshold)
- Labour cost % of revenue

### 11.5 Inventory & Food Cost Module
**Route:** `/inventory`
- Stock levels, IN/OUT/WASTAGE movements
- Low stock alerts (below reorder level)
- Menu items with food cost % per item
- Colour-coded: green (<30%), amber (30–40%), red (>40%)

### 11.6 Reports Module
**Route:** `/reports`
- P&L Statement (daily/weekly/monthly/custom range)
- Cash Flow Summary
- Expense Breakdown with VAT summary
- Payroll Report with labour cost %
- VAT Summary (VAT on sales − reclaimable VAT = net liability)
- Export to CSV and PDF

### 11.7 Settings
**Route:** `/settings`
- Restaurant profile (name, currency)
- Change password
- Subscription & billing (`/settings/billing`) — upgrade/downgrade via Stripe portal
- Integrations (`/settings/integrations`) — inbound email address, setup instructions, import history, test upload

---

## 12. Pages & Routes

| Route | Page |
|-------|------|
| `/login` | Login |
| `/signup` | Self-signup |
| `/` | Dashboard |
| `/revenue` | Revenue list + add |
| `/revenue/import` | CSV import |
| `/expenses` | Expense list + add |
| `/expenses/categories` | Manage categories |
| `/payroll` | Payroll overview |
| `/payroll/employees` | Employee directory |
| `/payroll/log` | Log pay period |
| `/inventory` | Stock list |
| `/inventory/movements` | Stock movements |
| `/inventory/menu` | Menu items + food cost |
| `/reports` | Reports hub |
| `/reports/pl` | P&L report |
| `/reports/cashflow` | Cash flow report |
| `/reports/vat` | VAT summary |
| `/reports/payroll` | Payroll report |
| `/platforms` | Platform analytics (Pro) |
| `/analytics` | Correlations (Pro) |
| `/analytics/expectancy` | Expectancy (Pro) |
| `/analytics/scenarios` | Scenario modelling (Pro) |
| `/health` | Financial health score (Pro) |
| `/settings` | General settings |
| `/settings/billing` | Subscription + billing |
| `/settings/integrations` | Email ingestion setup |
| `/admin` | Super-admin: all restaurants |
| `/admin/restaurants/[id]` | Super-admin: restaurant detail |

---

## 13. API Endpoints

### Auth & Signup
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/signup` | Create restaurant + user, auto-login |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handlers |

### Revenue
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/revenue` | List (filter by date, source) |
| POST | `/api/revenue` | Create entry |
| PUT | `/api/revenue/[id]` | Update |
| DELETE | `/api/revenue/[id]` | Delete |
| POST | `/api/revenue/import` | CSV import |

### Expenses
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/expenses` | List |
| POST | `/api/expenses` | Create |
| PUT | `/api/expenses/[id]` | Update |
| DELETE | `/api/expenses/[id]` | Delete |
| GET | `/api/expenses/categories` | List categories |
| POST | `/api/expenses/categories` | Create category |

### Payroll
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employees` | List employees |
| POST | `/api/employees` | Add employee |
| PUT | `/api/employees/[id]` | Update |
| GET | `/api/payroll` | List payroll entries |
| POST | `/api/payroll` | Log pay period |

### Inventory
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inventory` | List items |
| POST | `/api/inventory` | Add item |
| PUT | `/api/inventory/[id]` | Update |
| GET | `/api/inventory/movements` | List movements |
| POST | `/api/inventory/movements` | Log movement |
| GET | `/api/inventory/menu` | List menu items |
| POST | `/api/inventory/menu` | Add menu item |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/pl` | P&L data |
| GET | `/api/reports/cashflow` | Cash flow data |
| GET | `/api/reports/vat` | VAT summary |
| GET | `/api/reports/payroll` | Payroll report |
| GET | `/api/reports/[type]/export` | CSV or PDF |

### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List unread notifications |
| POST | `/api/notifications/[id]/read` | Mark as read |
| POST | `/api/notifications/read-all` | Mark all as read |

### Email Ingestion
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/inbound/email` | Postmark inbound webhook |
| POST | `/api/inbound/test` | Manual CSV upload for testing |

### Billing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/billing/checkout` | Create Stripe Checkout session |
| POST | `/api/billing/portal` | Create Stripe Customer Portal session |
| POST | `/api/stripe/webhook` | Stripe webhook handler |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/restaurants` | List all restaurants |
| GET | `/api/admin/restaurants/[id]` | Restaurant detail |
| PATCH | `/api/admin/restaurants/[id]` | Update plan/status/trial |
| DELETE | `/api/admin/restaurants/[id]` | Delete restaurant + all data |

### Cron
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cron/import-check` | Check for missing weekly statements |

---

## 14. Key Business Logic

### VAT Handling (UK)
- Standard rate: 20% (stored in `lib/constants.ts`)
- `vatAmount = grossAmount / 6`
- `netAmount = grossAmount − vatAmount`
- VAT Report: `VAT on Sales − Reclaimable VAT on Expenses = Net VAT Liability`

### P&L Calculation
```
Net Revenue (excl. VAT)
− Cost of Goods Sold (food & packaging expenses)
= Gross Profit

Gross Profit
− Operating Expenses (utilities, rent, insurance, etc.)
− Payroll (total wages + employer NI)
= Net Operating Profit
```

### Multi-tenancy Rule
Every Prisma query in API routes must include `where: { restaurantId }` (from session).
Failing to scope by restaurantId is a data breach — treat it as a critical bug.

### Trial Expiry
```
isTrialExpired = restaurant.plan === 'FREE_TRIAL' && restaurant.trialEndsAt < new Date()
```
When expired, gate Pro features and show upgrade banner. Basic features remain accessible.

---

## 15. Development Phases

### Phase 0 — SaaS Foundation
- [ ] Rebuild Prisma schema (add Restaurant, Notification, ImportLog, restaurantId on all models)
- [ ] Self-signup flow (Restaurant + User creation)
- [ ] Updated auth (JWT carries restaurantId, plan)
- [ ] Stripe integration (checkout, portal, webhooks)
- [ ] Super-admin panel
- [ ] Feature gating middleware / hooks
- [ ] Trial expiry banner

### Phase 1 — Core Modules
- [ ] Dashboard (live data, scoped to restaurant)
- [ ] Revenue module (CRUD + CSV import)
- [ ] Expense module (CRUD + categories)
- [ ] Payroll module
- [ ] Inventory & food cost module
- [ ] Reports module (P&L, VAT, payroll, cash flow)
- [ ] PDF + CSV export

### Phase 2 — Platform Analytics
- [ ] Platform data entry (manual)
- [ ] Platform cost breakdown + ROI
- [ ] Overhead allocation engine
- [ ] Platform comparison table

### Phase 3 — Automated Email Ingestion
- [ ] Postmark inbound webhook endpoint
- [ ] CSV parsers (Uber Eats, Just Eat, Deliveroo)
- [ ] ImportLog table + logging
- [ ] In-app Notification system (bell icon in topbar)
- [ ] /settings/integrations page (inbound email + test upload)
- [ ] Cron job: weekly missing-statement health check

### Phase 4 — Advanced Analytics
- [ ] Correlations engine (Pearson r, 12-week rolling)
- [ ] Expectancy calculations per platform + promotion
- [ ] Financial Health Score composite
- [ ] Scenario modelling calculator
- [ ] Correlation dashboard with plain-English insights

### Phase 5 — Polish & Future
- [ ] Mobile-responsive layout
- [ ] SumUp / TakePayments direct API integration
- [ ] Budget targets per category
- [ ] Annual profit goal tracking
