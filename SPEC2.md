# Restaurant Finance Manager — SPEC2.md
## Advanced Analytics, Email Ingestion & Performance Intelligence

This document extends SPEC.md with:
1. Automated weekly statement ingestion via email (Postmark inbound)
2. Delivery platform analytics (ROI, overhead allocation, promotion analysis)
3. Correlation analysis
4. Expectancy calculations
5. Financial Health Score
6. Scenario modelling

All features in this document are **Pro plan only** (and available during Free Trial).
All data is scoped by `restaurantId`.

---

## 1. Philosophy

> "Don't just show me the numbers. Show me what they *mean*."

Every financial figure should have a corresponding **percentage**, **benchmark**, and **direction** (improving / declining). The owner should be able to open the app and know in under 30 seconds whether the business is healthy or not — without any mental arithmetic.

Key principles:
- **Percentages first** — every monetary value accompanied by its % of revenue
- **Colour-coded health** — green (healthy), amber (watch), red (danger)
- **Benchmarks** — industry averages for QSR shown alongside actuals
- **Expectancy framing** — every cost centre and channel expressed as expected profit/loss per £ spent or per order taken
- **Always a verdict** — every analysis ends with a plain-English recommendation
- **No jargon** — Pearson r is calculated internally but shown as plain English

---

## 2. Financial Health Score

### 2.1 Overview
A composite **Financial Health Score (0–100)** shown prominently on the dashboard. Calculated from weighted sub-scores. Gives a single, at-a-glance answer to "how is the business doing right now?"

### 2.2 Score Components

| Component | Weight | Healthy Range (QSR UK) |
|-----------|--------|----------------------|
| Net Profit Margin | 25% | > 10% green, 5–10% amber, < 5% red |
| Food Cost % | 20% | < 30% green, 30–35% amber, > 35% red |
| Labor Cost % | 20% | < 30% green, 30–35% amber, > 35% red |
| Overhead Cost % | 15% | < 20% green, 20–25% amber, > 25% red |
| Platform Profitability | 10% | All channels positive expectancy = green |
| Revenue Trend | 10% | Growing week-on-week = green |

### 2.3 Score Display
```
Financial Health: 72 / 100   [●●●●●●●●○○]  GOOD

  Net Profit Margin    14.2%   ✅  (target > 10%)
  Food Cost %          28.1%   ✅  (target < 30%)
  Labor Cost %         31.4%   ⚠️  (target < 30%)
  Overhead Cost %      18.3%   ✅  (target < 20%)
  Platform ROI         Mixed   ⚠️  (Uber Eats negative this week)
  Revenue Trend        +6.2%   ✅  (vs last week)
```

---

## 3. Percentage-Based P&L

Every P&L view shows amounts **and** their % of net revenue side by side.

```
                        This Month
                        £         % of Revenue
Revenue (net of VAT)    £18,400   100.0%
  └─ Walk-in / Till     £9,200    50.0%
  └─ Uber Eats          £5,520    30.0%
  └─ Deliveroo          £2,760    15.0%
  └─ Just Eat           £920       5.0%

Cost of Goods Sold      £5,520    30.0%   ✅
Gross Profit            £12,880   70.0%

  Payroll               £5,520    30.0%   ⚠️
  Rent & Rates          £1,840    10.0%   ✅
  Utilities             £920       5.0%   ✅
  Platform Fees         £1,104     6.0%   ⚠️
  Other Expenses        £552       3.0%   ✅

Total Expenses          £9,936    54.0%
Net Operating Profit    £2,944    16.0%   ✅
```

---

## 4. Delivery Platform Analytics Module

**Route:** `/platforms`
**Plan:** Pro only

Answers: *"Is this delivery platform actually making us money, or just generating busy work?"*

### 4.1 Supported Platforms
- Uber Eats
- Deliveroo
- Just Eat
- Walk-in / Own Till (baseline for comparison)

### 4.2 Platform Data Inputs

Data is populated via two methods:
1. **Automated email ingestion** (see Section 5) — zero effort once set up
2. **Manual entry** — for platforms not yet automated or for correction

| Input | Description |
|-------|-------------|
| Orders count | Number of orders this period |
| Gross order revenue | Total value of orders placed |
| Platform commission % | Per-order commission (e.g. 30% Uber Eats) |
| Promotion charge | Weekly promotion fee charged by platform |
| Promotion type | Boost, Sponsored listing, Free item offer, Discount |
| Average order value | Auto-calculated |

### 4.3 Platform Cost Breakdown (per period)

```
Platform Revenue Analysis — Uber Eats — Week 12

Orders:                    46
Gross Order Revenue:       £1,104.00
Platform Commission (30%): - £331.20
Net Revenue to Business:   £772.80

Food Cost (28% of gross):  - £309.12
Allocated Overhead*:       - £278.40
Promotion Charge:          - £254.00

Net Result:                - £68.72   ❌  NEGATIVE
Net Result per Order:      - £1.49    ❌  NEGATIVE EXPECTANCY

Break-even orders needed:  54 orders  (you had 46)
Break-even revenue needed: £1,306.29  (you had £1,104.00)
```

*Overhead allocated by proportion of total orders (configurable — see Section 6)*

### 4.4 Promotion ROI Analysis

```
Promotion: Uber Eats "Boost" — Week 12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Promotion Cost:            £254.00
Orders Generated:          46
Revenue from Orders:       £772.80  (after commission)

True Cost of 46 Orders:
  Food Cost:               £309.12
  Allocated Overhead:      £278.40
  Promotion Charge:        £254.00
  Total Cost:              £841.52

Gross Profit (before promo): £463.68   42.0%
Net Profit (after promo):   -£68.72   -6.2%   ❌

ROI on Promotion Spend:    -27.1%     ❌
Expectancy per Order:      -£1.49     ❌  NEGATIVE
Expectancy per £ spent:    -£0.27     ❌

VERDICT: This promotion cost more than it made.
         You needed 8 more orders to break even.
         Consider: reducing promo budget or increasing average order value.
```

### 4.5 Platform Comparison Table

| Metric | Walk-in | Uber Eats | Deliveroo | Just Eat |
|--------|---------|-----------|-----------|----------|
| Orders | 210 | 46 | 38 | 12 |
| Revenue (net) | £9,200 | £772 | £620 | £184 |
| Revenue per Order | £43.81 | £16.80 | £16.32 | £15.33 |
| Commission | — | 30% | 30% | 14% |
| Overhead Allocated | £3,920 | £858 | £709 | £224 |
| Promo Charge | — | £254 | £180 | £0 |
| Net Profit | £2,116 | -£68 | -£47 | +£38 |
| Net Margin | **23.0%** ✅ | **-8.8%** ❌ | **-7.6%** ❌ | **+20.7%** ✅ |
| Expectancy/Order | **+£10.07** | **-£1.49** | **-£1.24** | **+£3.17** |

### 4.6 Platform Health Indicator
- **Positive Expectancy** — Making money. Keep running.
- **Marginal** — Within ±5% of break-even. Monitor closely.
- **Negative Expectancy** — Losing money. Review or pause promotion.

---

## 5. Automated Email Ingestion

**Plan:** Pro only
**Route:** `POST /api/inbound/email`

### 5.1 How It Works

1. Each restaurant has a unique `inboundEmail` (e.g. `trattoria-roma-x7k2p@inbound.yourapp.com`)
2. Owner sets up a one-time auto-forward rule in Gmail/Outlook
3. Postmark receives the forwarded email and POSTs to `/api/inbound/email`
4. App parses the CSV attachment, identifies the platform, imports data automatically
5. Owner gets an in-app notification that new data arrived

### 5.2 Webhook Handler — `POST /api/inbound/email`

**Steps (synchronous):**
1. Verify Postmark webhook token (`X-Postmark-Signature` or shared secret)
2. Extract: sender address, subject, attachments (CSV files)
3. Match `To` address → find `Restaurant` by `inboundEmail`
4. If no restaurant found: log and return 200 (don't fail — Postmark retries on non-200)
5. Detect platform from sender domain:
   - `@uber.com` or `@ubereats.com` → `UBEREATS`
   - `@just-eat.co.uk` or `@justeat.com` or `@takeaway.com` → `JUSTEAT`
   - `@deliveroo.co.uk` → `DELIVEROO`
6. Find CSV attachment. If none, check HTML body for embedded data.
7. Parse CSV using platform-specific parser
8. Upsert `PlatformPeriod` (match on restaurantId + platformId + periodStart)
9. Create `ImportLog` record
10. Create `Notification` for the restaurant
11. Return `200 OK`

### 5.3 CSV Parsers (`lib/parsers/`)

**Uber Eats** (`uber-eats.ts`)
- Columns: `Order Date`, `Order ID`, `Gross Order Value`, `Uber Eats Fee`, `Net Payout`
- Group by week: sum gross, fees, net; count orders
- Skip rows where date is blank or contains "Total"

**Just Eat** (`just-eat.ts`)
- Columns: `Date`, `Orders`, `Gross Sales`, `Commission`, `Net Sales`
- One row per period — direct mapping
- Skip summary/total rows

**Deliveroo** (`deliveroo.ts`)
- Columns: `Week Ending`, `Total Orders`, `Gross Revenue`, `Fee`, `Net Revenue`
- One row per week — direct mapping
- Skip summary/total rows

**All parsers normalise to:**
```ts
interface ParsedPeriod {
  periodStart: Date
  periodEnd: Date
  orderCount: number
  grossRevenue: number
  commissionCharged: number
  netRevenue: number
  averageOrderValue: number
  currency: string  // from restaurant.currency, default 'GBP'
}
```

**Error handling:**
- Missing required columns → `ImportLog.status = 'FAILED'`, log column names found
- Partially valid rows → import valid rows, `status = 'PARTIAL'`, log count of skipped rows
- Zero valid rows → `status = 'FAILED'`

### 5.4 Upsert Logic

```ts
await db.platformPeriod.upsert({
  where: {
    restaurantId_platformId_periodStart: {
      restaurantId,
      platformId,
      periodStart,
    }
  },
  create: { ...data },
  update: { ...data },
})
```

Unique constraint: `(restaurantId, platformId, periodStart)`

### 5.5 ImportLog

Logged for every attempt:

```
status:        SUCCESS | FAILED | PARTIAL
rowsImported:  number of PlatformPeriod records created/updated
errorMessage:  null on success, error detail on failure
filename:      original CSV filename
platform:      detected platform
receivedAt:    webhook timestamp
```

### 5.6 In-App Notifications

After successful import:
```
Title: "Uber Eats statement imported"
Body:  "46 orders, £1,104 gross revenue — Week ending 02/03/2026"
```

After failed import:
```
Title: "Import failed — Uber Eats"
Body:  "Could not parse the attached CSV. Check your email forwarding is sending the correct attachment."
```

### 5.7 Settings — Integrations Page

**Route:** `/settings/integrations`

- Displays unique inbound email address with copy button
- Step-by-step Gmail forward setup instructions
- Step-by-step Outlook forward setup instructions
- Table: recent imports (platform, date, rows imported, status)
- "Test Import" — manual CSV upload with platform selector to verify parser works

### 5.8 Cron — Weekly Health Check

**Route:** `GET /api/cron/import-check`
**Schedule:** Every Monday morning (Vercel Cron)
**Auth:** `Authorization: Bearer {CRON_SECRET}` header required

For each active restaurant on Pro plan:
- Check if a `PlatformPeriod` was imported in the last 7 days per active platform
- If not, create a warning `Notification`:

```
Title: "No Uber Eats statement received this week"
Body:  "We haven't received your Uber Eats weekly statement yet.
        Check that your email forwarding is still active."
```

---

## 6. Overhead Allocation Engine

### 6.1 Allocation Methods

| Method | Description |
|--------|-------------|
| **By Order Count** | Overhead ÷ total orders × platform orders |
| **By Revenue Share** | Overhead × (platform revenue / total revenue) |
| **By Time / Hours** | Overhead × (hours channel active / total hours) |

Default: `BY_ORDERS`. Configurable per restaurant via `OverheadAllocationConfig`.

### 6.2 Allocation Comparison View

```
Overhead Allocation Comparison — Uber Eats (Week 12)
Total Overhead to Allocate: £1,710.80

Method               Allocated    Net Result   Margin
By Order Count       £278.40      -£68.72      -8.8%
By Revenue Share     £241.60      -£31.92      -4.1%
By Time              £190.00      +£19.68      +2.5%

Recommended: By Order Count (most conservative / honest)
```

---

## 7. Correlation Analysis

**Route:** `/analytics`
**Plan:** Pro only

### 7.1 Tracked Correlations

| Correlation | Variables |
|-------------|-----------|
| Promo spend → Orders | Uber Eats promo £ vs. order count |
| Promo spend → Net profit | Uber Eats promo £ vs. net profit |
| Food cost % → Net margin | Food cost % vs. net profit % |
| Labor cost % → Net margin | Payroll % vs. net profit % |
| Order volume → Overhead % | Weekly orders vs. overhead % |
| Platform orders → Walk-in | Delivery orders vs. walk-in orders |

### 7.2 Correlation Dashboard Display

```
Correlations Detected — Last 12 Weeks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEGATIVE  Uber Eats promo spend → Net Profit
  "The more you spend on Uber Eats promotions,
   the lower your weekly net profit tends to be."

POSITIVE  Total Orders → Gross Profit
  "More orders strongly correlates with higher gross profit."

WEAK      Deliveroo promo → Order Count
  "Deliveroo promotions show a weak link to order volume.
   May not be worth the cost."
```

Never show raw r values to the user.

### 7.3 Engine
- Pearson r calculated over rolling 12-week windows per restaurant
- Minimum 6 data points required
- Recalculated weekly
- Cached in `CorrelationCache` (scoped by `restaurantId`)

---

## 8. Expectancy Module

**Route:** `/analytics/expectancy`
**Plan:** Pro only

### 8.1 Calculations

| Metric | Formula |
|--------|---------|
| Expectancy per order (by platform) | Avg net profit per order over last N weeks |
| Expectancy per £ promo spend | Total net result of promos / total promo £ spent |
| Expectancy per employee hour | Net profit / total labour hours |
| Expectancy per ingredient £ | Gross profit / COGS |

### 8.2 Display

```
Expectancy Summary — Last 8 Weeks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Channel Expectancy (per order):
  Walk-in:        +£10.07  ✅  POSITIVE
  Just Eat:       + £3.17  ✅  POSITIVE
  Uber Eats:      - £1.49  ❌  NEGATIVE
  Deliveroo:      - £1.24  ❌  NEGATIVE

Promotion Expectancy (per £ spent):
  Uber Eats Boost:     -£0.27  ❌
  Deliveroo Sponsored: -£0.18  ❌

Labour Expectancy (per hour paid):
  Net profit per labour hour: +£2.14  ✅
```

---

## 9. Scenario Modelling

**Route:** `/analytics/scenarios`
**Plan:** Pro only

### 9.1 Promotion Scenario
*"What if I reduce Uber Eats promotion from £254 to £120 per week?"*

Input: new promo amount → projected order drop (from correlation r) → projected net result

### 9.2 Price Increase Scenario
*"What if I raise average order value by £2 on all platforms?"*

### 9.3 Cost Reduction Scenario
*"What if food costs drop from 28% to 25%?"*

All scenarios show: projected net profit, margin %, financial health score impact.

---

## 10. Database Tables (extending SPEC.md)

### `Platform`
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| restaurantId | String | FK → Restaurant |
| name | Enum | `UBEREATS`, `DELIVEROO`, `JUSTEAT`, `WALKIN`, `OTHER` |
| commissionRate | Float | Default commission % |
| isActive | Boolean | |

Unique constraint: `(restaurantId, name)`

---

### `PlatformPeriod`
Weekly/monthly snapshot per platform per restaurant.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| restaurantId | String | FK → Restaurant |
| platformId | String | FK → Platform |
| periodStart | DateTime | |
| periodEnd | DateTime | |
| orderCount | Int | |
| grossRevenue | Float | Before commission |
| commissionCharged | Float | |
| netRevenue | Float | |
| averageOrderValue | Float | |
| currency | String | ISO 4217, from restaurant.currency |

Unique constraint: `(restaurantId, platformId, periodStart)` — enables upsert on re-import.

---

### `PromotionCharge`
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| restaurantId | String | FK → Restaurant |
| platformId | String | FK → Platform |
| periodStart | DateTime | |
| periodEnd | DateTime | |
| chargeAmount | Float | |
| promotionType | String | Boost, Sponsored, Discount, Free item |
| notes | String? | |

---

### `OverheadAllocationConfig`
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| restaurantId | String | FK → Restaurant, unique |
| method | Enum | `BY_ORDERS`, `BY_REVENUE`, `BY_TIME` |
| updatedAt | DateTime | |

---

### `CorrelationCache`
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| restaurantId | String | FK → Restaurant |
| variableA | String | e.g. "uberEatsPromoSpend" |
| variableB | String | e.g. "weeklyNetProfit" |
| coefficient | Float | Pearson r (-1 to +1) |
| dataPoints | Int | |
| direction | Enum | `POSITIVE`, `NEGATIVE`, `NONE` |
| strength | Enum | `STRONG`, `MODERATE`, `WEAK` |
| plainEnglish | String | Auto-generated insight |
| calculatedAt | DateTime | |

---

### `ExpectancySnapshot`
| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| restaurantId | String | FK → Restaurant |
| entityType | Enum | `PLATFORM`, `PROMOTION`, `EMPLOYEE`, `INGREDIENT` |
| entityId | String | FK to relevant entity |
| periodWeeks | Int | Rolling window (e.g. 8 weeks) |
| winRate | Float | % of periods with positive result |
| avgWin | Float | Average profit when positive |
| avgLoss | Float | Average loss when negative |
| expectancy | Float | Final expectancy value |
| calculatedAt | DateTime | |

---

## 11. Key Calculations Reference

### True Cost per Order
```
trueCostPerOrder =
  (foodCost / orders)
  + (allocatedOverhead / orders)
  + commissionPerOrder
  + (promotionCharge / orders)
```

### Promotion ROI
```
ROI % = ((netRevenue − totalCosts) / promotionCharge) × 100
where totalCosts = foodCost + allocatedOverhead + commission + promotionCharge
```

### Break-Even Orders
```
breakEven =
  (fixedCosts + promotionCharge)
  / (netRevenuePerOrder − variableCostPerOrder)

netRevenuePerOrder   = avgOrderValue × (1 − commissionRate)
variableCostPerOrder = avgFoodCostPerOrder
fixedCosts           = allocatedOverhead for period
```

### Expectancy per £ Promo Spend
```
expectancy = totalNetResultAcrossPromoWeeks / totalPromoSpend
Positive = making money per £ spent
Negative = losing money per £ spent
```

### Pearson r
```
r = Σ((x − x̄)(y − ȳ)) / √(Σ(x − x̄)² × Σ(y − ȳ)²)
Calculated server-side over weekly snapshots.
Never displayed as a raw number to the owner.
```

---

## 12. Phase Plan

### Phase 2 — Platform Analytics
- [ ] Platform and PromotionCharge data entry (manual)
- [ ] True cost per order calculation
- [ ] Promotion ROI report per platform
- [ ] Break-even calculator
- [ ] Platform comparison table

### Phase 3 — Automated Email Ingestion
- [ ] Postmark inbound webhook handler
- [ ] Platform CSV parsers (Uber Eats, Just Eat, Deliveroo)
- [ ] Upsert pipeline + ImportLog
- [ ] In-app Notification system
- [ ] /settings/integrations page + test upload
- [ ] Vercel Cron: weekly missing-statement check

### Phase 4 — Correlations, Expectancy & Health Score
- [ ] Weekly snapshot aggregation (cron route)
- [ ] Pearson correlation engine
- [ ] Expectancy calculations
- [ ] Correlation dashboard with plain-English insights
- [ ] Financial Health Score composite
- [ ] Scenario modelling calculator
- [ ] Overhead allocation method selector + comparison view
