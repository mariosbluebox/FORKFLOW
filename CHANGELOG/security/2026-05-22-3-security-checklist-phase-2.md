# Phase 2: Project-specific security checklist

**Date:** 2026-05-22
**Author:** Marios
**Related:** Completes Phase 2 of the security hardening plan; updates `SECURITY.md §4` roadmap (Phase 2 → done)

## Summary

Drafted [`SECURITY-CHECKLIST.md`](../../SECURITY-CHECKLIST.md) at repo root —
a structured, project-specific checklist for `/security-review` to apply
against the diff before every push. Replaces "rely on Claude to remember
everything that matters about this codebase" with "rely on Claude to read a
12-section checklist tailored to our real risk surface."

## What changed

- **New:** `SECURITY-CHECKLIST.md` (12 sections, ~12 KB)
- **Updated:** `SECURITY.md` — links to the new checklist from the intro,
  Phase 2 marked done in §4 roadmap, "Last reviewed" line updated.

## What the checklist covers

Each section has an "Applies when" filter (file-glob hint) so the review
only checks sections relevant to the diff:

1. **Multi-tenant isolation** — the #1 risk. Every API route filters by `restaurantId`; multi-step ops re-check on update; nested-create IDOR; response payload scoping.
2. **Authentication & shared secrets** — fail-closed pattern (`if (!expected) reject`), constant-time compare (`timingSafeEqual`), Stripe `constructEvent`, `CRON_SECRET` bearer, bcrypt cost, no env-conditional auth bypass.
3. **Authorization (super-admin)** — `isAdmin` gate on every `/admin/*` route, single source of `isAdmin=true` in `lib/auth.ts`, admin actions still validate `restaurantId` from URL/body.
4. **Input validation** — Zod / typeof / range checks, no `Infinity`/`NaN`, array length caps, file size + MIME allowlist.
5. **CSV parsing safety** — formula injection (`=`/`+`/`-`/`@` leading), 10 MB cap, malformed UTF-8, no trust in `From` header alone, sanitized `ImportLog` errors.
6. **Raw SQL** — tagged-template form not `$queryRawUnsafe`, `restaurantId` in `WHERE` clause.
7. **Output safety (XSS)** — no new `dangerouslySetInnerHTML`, blocked `javascript:` URLs, no `passwordHash`/secret fields in API responses.
8. **Secrets handling** — no secrets in code, no logging `req.headers`/`session`/`req.body`, error messages don't leak internals.
9. **Money & financial logic** — VAT via constants, `Intl.NumberFormat` with `restaurant.currency`, zero-denominator guards, atomic multi-row writes.
10. **Subscription / plan gating** — server-side plan check (not just `usePlan()`), idempotent webhook handlers.
11. **Dependencies & build** — necessary deps only, no `audit fix --force` regressions, no disabled security headers.
12. **Operational hygiene** — no disabled CI security jobs, no `--no-verify` shortcuts, no `CRON_SECRET` in URL query strings.

## How it works

Each item is phrased as a yes/no check Claude can answer by reading the
diff. Reporting format is specified at the bottom of the file:

```
[section X.Y] <file:line> — <one-line problem>
  Why it matters: <one line>
  Suggested fix: <concrete change>
  Severity: low | medium | high
```

A clean review names the sections that were applied (not just "looks good"),
so it's clear what was actually checked.

## How to verify

```bash
# 1. The file exists and renders
cat SECURITY-CHECKLIST.md | head -30

# 2. SECURITY.md links to it
grep -n SECURITY-CHECKLIST SECURITY.md
# expected: at least two references (intro + §4)

# 3. Smoke test the workflow
#    Make a deliberately broken change (e.g. remove a getSessionRestaurantId call
#    in an API route), then run /security-review on the branch.
#    Expected: section 1.1 finding citing the file:line where the helper is missing.
```

## Why phrasing as "Applies when" rather than "always check"

The checklist has 12 sections and ~70 individual items. If `/security-review`
ran every item against every diff, the output would be dominated by N/A
noise and the reviewer (you) would stop reading. By gating each section on
a file-glob hint, a small PR that only changes a UI component gets a short
review report (sections 7, 8 only); a PR that touches an API route gets the
full tenancy + auth treatment.

## Follow-ups

- **Add a `.claude/commands/security-review.md` prompt template** that
  explicitly tells the model to use `SECURITY-CHECKLIST.md`. The gstack
  `/security-review` skill is generic — wiring it to read our checklist
  improves consistency. Defer until we see whether the default skill picks
  up the file automatically (it might, via repo conventions).
- **Iterate on the checklist as findings come in.** When `/security-review`
  catches something real that wasn't covered, add a new item. When an item
  produces only false positives, prune it. The checklist should be small
  enough that a human can read it end-to-end in 5 min — don't let it bloat.
- **Phase 3 next:** Zod schemas at API boundaries + Prisma tenant-scope
  middleware. These turn checklist items 1.* and 4.* from "Claude must
  catch" into "the code enforces it."
