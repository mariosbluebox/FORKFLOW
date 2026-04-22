# Update stale phase status in `CLAUDE.md`

**State:** `CLAUDE.md` under "Development Phases" says:

> **Phase 1** 🔄 — Core modules: dashboard, revenue, expenses, payroll, inventory, reports
>   - All API routes complete
>   - Pages: dashboard, revenue, expenses, payroll (list+log) done
>   - **Still needed: employees page, inventory pages, reports pages**

All three of those "still needed" pages exist in the repo:
- `app/(dashboard)/payroll/employees/page.tsx`
- `app/(dashboard)/inventory/page.tsx`, `inventory/movements/page.tsx`, `inventory/menu/page.tsx`
- `app/(dashboard)/reports/{pl,cashflow,vat,payroll}/page.tsx`

And Phases 2 and 3 (platform analytics + email ingestion) are also shipped, per the `196a542` commit message.

**Why it matters:** Future sessions (me, another contributor, another Claude) read `CLAUDE.md` as authoritative project state. Stale status leads to redundant work or wrong prioritisation (e.g. "let's build the employees page!" — it already exists).

**Action:**
1. Mark Phases 0–3 as ✅ done in the "Development Phases" section.
2. Move `🔄` to Phase 4.
3. Add a pointer to `PHASE4.md` so whoever picks this up reads the sub-feature sequencing there.
4. Also note the two remaining Phase 1 gaps that *do* still exist: general `/settings` page, and PDF/CSV report export (see their own flag files).

**Urgency:** Low — but cheap to fix in 5 minutes, so there's no reason to carry the confusion.
