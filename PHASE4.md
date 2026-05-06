# Phase 4 — Build Plan

Advanced analytics layer per SPEC2.md. Pro-only (with Free Trial access). Everything in this phase is gated by plan and scoped by `restaurantId`.

---

## Assumptions & ambiguities to resolve before starting

The spec is mostly clear, but these points need a decision from you — I've flagged them rather than pick silently.

1. **Weekly snapshot aggregation is implied but not specified.** SPEC2 §12 lists it as a Phase 4 checklist item, but no table schema, no route name, no columns. Both Expectancy and Correlations depend on it. **Assumption:** I'll compute snapshots on demand from existing tables (PlatformPeriod, RevenueEntry, ExpenseEntry, PayrollEntry) rather than introducing a dedicated snapshot table. Only persist rolling aggregates into `ExpectancySnapshot` and `CorrelationCache`. Flag if you want a separate `WeeklySnapshot` table instead — it costs a migration but simplifies debugging.

2. **Health Score — amber/red thresholds for "Platform Profitability" and "Revenue Trend" are undefined.** Spec only gives the green condition ("all channels positive expectancy" / "growing week-on-week"). **Proposed:** Platform Profitability — green = all positive, amber = mixed, red = all negative. Revenue Trend — green > +2%, amber −2% to +2%, red < −2% vs. prior week.

3. **Expectancy per ingredient £** — SPEC2 §8.1 formula is `grossProfit / COGS`. With no recipe/BOM link between MenuItem and InventoryItem, this can only be computed at the period level, not per-ingredient. **Assumption:** a single figure per restaurant per period, labelled "Gross profit per £ spent on ingredients." Not per-SKU.

4. **Scenario modelling — "projected order drop from correlation r"** is vague. Pearson r measures direction/strength, not slope. To project, you need regression. **Assumption:** store slope + intercept alongside r in `CorrelationCache` (spec doesn't forbid it) and use those for projections.

5. **Plain-English correlation insights** — spec shows examples but no rule table. **Assumption:** template by direction (POSITIVE/NEGATIVE) × strength (STRONG/MODERATE/WEAK) × variable pair label.

6. **Correlation cache refresh cadence** — spec says "recalculated weekly" but doesn't name the cron route. Assume `GET /api/cron/analytics-recalc` protected by `CRON_SECRET`.

7. **Prerequisite verification.** Phase 4 assumes Phase 2 already produces correct per-platform net profit figures (overhead allocated, commission deducted, promo charged). Before starting Task 3, sanity-check `/api/platforms/summary` against one real restaurant's week — if its numbers are wrong, Expectancy inherits the bug.

---

## Sub-feature build order

**1. Expectancy → 2. Correlations → 3. Health Score → 4. Scenarios**

### Why this order

- **Expectancy first.** It's the only sub-feature with zero dependencies on the other three. It reads raw data (PlatformPeriod, Expense, Payroll, Revenue) that already exists from Phases 1–3. It also forces us to build the weekly aggregation helper, which Correlations then reuses. Shipping Expectancy gives the owner real value on day one (per-order profitability per channel) without needing any of the heavier machinery.

- **Correlations second.** Independent of Expectancy in principle — the six tracked correlations in SPEC2 §7.1 are all raw variables (promo £, orders, food cost %, etc.), none of them are expectancy outputs. But Correlations needs the same weekly aggregation plumbing Expectancy just built, plus a new Pearson engine, plain-English generator, and `CorrelationCache` table. Doing it second lets it ride on Expectancy's infrastructure.

- **Health Score third.** Per SPEC2 §2.2, the composite score includes a "Platform Profitability" component defined as *"all channels positive expectancy = green."* That's a direct read from `ExpectancySnapshot`. The other five components (net margin, food cost %, labor cost %, overhead cost %, revenue trend) are simple ratios from existing data. Building this before Expectancy means stubbing that component; building it after means it works properly from day one.

- **Scenarios last.** Per SPEC2 §9, scenarios need (a) correlation coefficients to project order drops from promo cuts, and (b) health-score recalculation to show "what would this do to my score?" So it legitimately blocks on both Correlations and Health Score. Doing it earlier means stubbing two dependencies.

### Alternative considered & rejected

Correlations → Expectancy → Health → Scenarios. Tempting because Correlations is the most marketing-visible feature ("look, AI insights!") and the weekly snapshot infra lives naturally there. Rejected because Expectancy gives more concrete owner value per unit of engineering time, and the Pearson engine + plain-English generator in Correlations is the single longest-running task in Phase 4 — you want that *not* on the critical path for shipping the first thing.

---

## Sub-feature 1 — Expectancy: task breakdown

Ordered for a walking-skeleton approach: ship a narrow but end-to-end slice (channel expectancy only) by Task 6, then extend.

### Task 1 — `ExpectancySnapshot` table ✅ DONE (2026-04-22)
**Discovery:** The model + `ExpectancyEntityType` enum were already present in `prisma/schema.prisma` and were shipped in the `20260306013641_init_saas` migration. The Neon DB had the table from day one; only the unique constraint needed to enable Task 3's upsert pattern was missing.
**Actual work done:** Added `@@unique([restaurantId, entityType, entityId])` to the `ExpectancySnapshot` model. Created migration `20260422232120_add_expectancy_snapshot_unique` which adds the unique index. `prisma migrate dev` couldn't run non-interactively so the migration SQL file was hand-written (identical to what Prisma would have produced) and applied via `prisma migrate deploy`.
**Files touched:** `prisma/schema.prisma`, `prisma/migrations/20260422232120_add_expectancy_snapshot_unique/migration.sql`.
**Verified:** `prisma migrate deploy` applied cleanly, `prisma generate` succeeded, `tsc --noEmit` clean.

### Task 2 — Add weekly aggregation helper 🔄 IN PROGRESS (2026-04-24)
**Build:** Pure function `getWeeklySnapshot(restaurantId, weekStart)` returning per-channel aggregates: orders, grossRevenue, netRevenue, commission, promoSpend, allocatedFoodCost, allocatedOverhead, allocatedPayroll, netProfit. Reads existing tables; no writes, no caching.
**Files:** new `lib/analytics/weekly-snapshot.ts`; possibly extract shared overhead-allocation logic from `app/api/platforms/summary/route.ts` into `lib/analytics/allocation.ts` if it currently lives inline.
**Done when:** calling it with a real restaurant + week returns numbers that reconcile within £0.01 to `/api/platforms/summary` output for the same period.

**Decisions locked (2026-04-24):**
- Week boundary: ISO Monday 00:00:00.000 → Sunday 23:59:59.999, both inclusive.
- Snapshot splits `allocatedOverhead` (ExpenseEntry only) and `allocatedPayroll` (grossPay + employerNI). `/api/platforms/summary` response shape stays unchanged — it continues to return a merged `allocatedOverhead` that equals the sum of the two snapshot fields.
- Allocation logic extracted to a shared helper. Summary route refactored onto it — single source of truth, no behaviour change.
- Verification is a dev-only `scripts/verify-weekly-snapshot.ts` (no Vitest setup in this task).
- Food cost mirrors the summary route's `grossRevenue × foodCostPct` for reconciliation parity. Modelling concern (food cost applied to VAT portion) recorded in `flags/revisit-food-cost-on-gross-vs-net.md` for later.
- Payroll filter mirrors the summary route's fully-contained window (`periodStart ≥ weekStart ∧ periodEnd ≤ weekEnd`). Bi-weekly/monthly payrolls will hit zero weeks — flagged as a Task 8 (labour expectancy) investigation.

**Progress (2026-04-24):**
- ✅ Step 1 — `lib/analytics/allocation.ts`: `computeAllocationTotals` + `allocateAmount` pure functions, verbatim extraction of the BY_ORDERS / BY_REVENUE / BY_TIME logic. `tsc --noEmit` clean.
- ✅ Step 2 — `app/api/platforms/summary/route.ts` refactored onto the shared helper. 5 insertions, 15 deletions. Response shape identical, numbers mathematically equivalent (mutually exclusive method branches guarantee the `if/else if` → `if/return` transform preserves behaviour). `tsc --noEmit` clean.
- ✅ Step 3 — `lib/analytics/weekly-snapshot.ts` (`getWeeklySnapshot` helper) shipped in commit `6ba45a7`.
- ✅ Step 4 — `scripts/verify-weekly-snapshot.ts` (reconciliation dev script) shipped in commit `fe89713`. Reconciliation is structurally green but trivially zero — meaningful verification needs seeded data, tracked as Issue #13.
- ✅ Step 5 — Deferred-work issue tracked as GitHub Issue #14 (`flags/` directory was migrated to GitHub Issues in commit `29c1518`).

### Task 3 — Per-platform (channel) expectancy calculator ✅ DONE (2026-05-07)
**Build:** `recomputeChannelExpectancy(restaurantId, windowWeeks = 8)` that pulls the last N weekly snapshots, computes win rate / avg win / avg loss / expectancy per order for each platform, and upserts rows into `ExpectancySnapshot` with `entityType = PLATFORM`.
**Files:** new `lib/analytics/expectancy.ts`.
**Done when:** running it for a seeded restaurant produces one `ExpectancySnapshot` row per active platform, and hand-calculating expectancy for one platform from the raw periods matches the stored value.

**Decisions locked (2026-05-05):**
- Data point definition (A1): one week per platform = one data point. Win = week's £/order > 0; loss = ≤ 0. Zero-order weeks are filtered, not zero-imputed.
- Expectancy unit (B1): £ per order, per SPEC2 §8.2 page label. Same per-unit convention will extend to PROMOTION (£/£ promo), EMPLOYEE (£/hr), INGREDIENT (£/£ ingredient) for Tasks 7–9.
- `periodWeeks` stores the actual sample size, not the requested window (be honest about sample size for the UI).

**Progress (closed 2026-05-07):**
- ✅ `lib/analytics/expectancy.ts` shipped — pure `computeExpectancy(profitsPerUnit: number[])` + DB-orchestrating `recomputeChannelExpectancy(restaurantId, options)`. Pure / impure split chosen so Tasks 7–9 can reuse the pure function with their own series.
- ✅ `scripts/verify-channel-expectancy.ts` shipped + `npm run verify:channel-expectancy` script. Cross-checks each stored row against an independent re-derivation from `getWeeklySnapshot`. PASS for all 4 fixture platforms — `winRate`, `avgWin`, `avgLoss`, `expectancy`, `periodWeeks` agree across (independent calc, function return value, persisted DB row) within 1e-6.
- ⚠️ Integration coverage is thin: the fixture only seeds 1 week, so every series degenerates to `[positiveValue]` (winRate=1, avgLoss=0, expectancy=avgWin). The mixed-wins/losses, all-loss, and multi-week-averaging branches of `computeExpectancy` are exercised by code inspection only.
- ➡️ Closed via option 1 (2026-05-07): the multi-week fixture extension is shared infrastructure across Tasks 3, 7, 8, 9, so it's tracked as **Issue #15** and will be landed alongside Tasks 7–9 rather than reshaped four times. Fixing it now would not exercise the unbuilt promo/labour/ingredient calculators anyway.

### Task 4 — Expectancy read API
**Build:** `GET /api/analytics/expectancy` returns `{ channels: [...], promotions: [], labour: null, ingredients: null }` from the current restaurant's latest snapshots. Plan-gated to PRO or active Free Trial via `lib/feature-gate.ts`. Returns 403 otherwise.
**Files:** new `app/api/analytics/expectancy/route.ts`.
**Done when:** authed Pro user gets 200 + channels array; Basic user gets 403; unauthed gets 401.

### Task 5 — `/analytics/expectancy` page — channel section only
**Build:** Client page matching the "Channel Expectancy (per order)" block in SPEC2 §8.2. One row per platform: name, expectancy £, verdict icon (✅ positive / ❌ negative), colour band. Uses `formatCurrency(amount, restaurant.currency)`. Reuses the shared primitives pattern from other module pages (`INPUT`, `Field`, `Loader`, `Empty`).
**Files:** new `app/(dashboard)/analytics/expectancy/page.tsx`; possibly a new `app/(dashboard)/analytics/layout.tsx` if you want a shared `/analytics` layout.
**Done when:** page renders with real data for the logged-in Pro restaurant; empty state shows if no snapshots yet; trial-expired Basic user sees the upgrade gate.

### Task 6 — Sidebar link + plan gate
**Build:** Add "Expectancy" under an "Analytics" sidebar group, visible only to PRO / trial-active users via `usePlan()`. Link to `/analytics/expectancy`.
**Files:** `components/Sidebar.tsx` (or wherever nav lives — check `components/`).
**Done when:** Pro user sees the link and can navigate to it; Basic user doesn't see the link; deep-link attempt by Basic user hits the 403/gate already built in Task 4.

*(End of walking skeleton — at this point Expectancy is shippable as channel-only. Tasks 7–10 extend it.)*

### Task 7 — Promotion expectancy (per £ promo spend)
**Build:** Extend `recomputeChannelExpectancy` or add `recomputePromoExpectancy` that computes expectancy per £ spent on each promotion type per platform across the window. Upserts with `entityType = PROMOTION`. Extend the API response and page to surface the "Promotion Expectancy" block.
**Files:** `lib/analytics/expectancy.ts`, `app/api/analytics/expectancy/route.ts`, `app/(dashboard)/analytics/expectancy/page.tsx`.
**Done when:** a restaurant with ≥2 weeks of promo charges shows promotion expectancy on the page and it reconciles to a manual calc.

### Task 8 — Labour expectancy (per hour paid)
**Build:** `recomputeLabourExpectancy` — total net profit / total paid hours across the window, stored once per restaurant (`entityType = EMPLOYEE`, `entityId = 'AGGREGATE'` or similar). Surface in the page.
**Files:** `lib/analytics/expectancy.ts`, plus the API + page files.
**Done when:** labour block appears on the page with a sane £/hr value; a restaurant with no payroll entries shows "—" instead of dividing by zero.

### Task 9 — Ingredient expectancy (per £ on ingredients)
**Build:** `recomputeIngredientExpectancy` — gross profit / total ingredient-category expense across the window. Single restaurant-level figure (see assumption #3). Surface in the page.
**Files:** same three.
**Done when:** ingredient block appears with a £/£ ratio; restaurants with no ingredient-category expenses show "—".

### Task 10 — Weekly recalc cron
**Build:** `GET /api/cron/analytics-recalc` — iterates every active PRO restaurant (and trial-active restaurants), calls all four `recompute*` functions. Protected with `CRON_SECRET` header. Register in `vercel.json` to run weekly (Monday, after `/api/cron/import-check` has run so the week's imports are in).
**Files:** new `app/api/cron/analytics-recalc/route.ts`; update `vercel.json`.
**Done when:** hitting the endpoint locally with `Authorization: Bearer $CRON_SECRET` produces fresh `calculatedAt` timestamps across all snapshot rows; wrong/missing header returns 401.

---

## Sub-features 2–4 (to be broken down later)

- **Correlations** — `CorrelationCache` table, Pearson engine over 12-week rolling windows for the six tracked pairs (SPEC2 §7.1), plain-English insight generator, `/analytics` dashboard page, weekly recalc hook into the cron from Task 10.

- **Health Score** — composite 0–100 calculator combining the six weighted components (SPEC2 §2.2), `/health` page with the gauge + component breakdown, integration into the dashboard home card, sensible thresholds for the two under-specified components (see assumption #2).

- **Scenario Modelling** — `/analytics/scenarios` page with three scenarios (promotion, price increase, cost reduction) from SPEC2 §9, slope/intercept stored on `CorrelationCache` (assumption #4), projected-P&L + projected-health-score diff panel.
