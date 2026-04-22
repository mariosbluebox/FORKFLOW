# Build PDF + CSV report export

**State:** SPEC.md §13 defines `GET /api/reports/[type]/export` (returns CSV or PDF). The route **doesn't exist** in `app/api/reports/` — only the four data-fetching routes (`pl`, `cashflow`, `vat`, `payroll`) are there. `@react-pdf/renderer` is already pinned in `package.json` but currently unused.

**Why it matters:** Report export is listed in SPEC.md §6 as available on **every plan** (including Basic) — it's part of the baseline promise, not a Pro feature. Owners sending monthly P&L to their accountant is the canonical use case for a financial tool like this.

**Action:**
1. Create `app/api/reports/[type]/export/route.ts` — single handler, switches on `[type]` (pl / cashflow / vat / payroll) and on a `?format=csv|pdf` query.
2. Extract each report's data-gathering into a shared `lib/reports/` function so the export route and the view route don't duplicate it.
3. CSV: roll your own with `Content-Type: text/csv` + `Content-Disposition: attachment`.
4. PDF: one `@react-pdf/renderer` template per report type under `components/pdf/`. Keep them simple — header with restaurant name + period, table of line items, totals.
5. Add download buttons on each report page.

**Urgency:** Phase 5 polish per the roadmap — not blocking current work, but a notable gap in the stated plan baseline.
