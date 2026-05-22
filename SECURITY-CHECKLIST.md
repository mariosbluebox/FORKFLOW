# Security Checklist

Project-specific review checklist for FORKFLOW. Run before every push.

**How to use:** Invoke `/security-review` (the gstack skill) on the current
branch. Claude reads this file plus the diff and reports findings against the
applicable sections. The checklist is intentionally narrower than a generic
OWASP review — it focuses on the **real risk surface of this app** that
automated tools can't catch.

> Companion docs:
> - [`SECURITY.md`](./SECURITY.md) — current security posture and roadmap
> - [`CHANGELOG/security/`](./CHANGELOG/security) — history of security changes

**Scope rule:** A section only applies if the diff touches files matching its
"Applies when" filter. Skip irrelevant sections rather than padding the
report with N/A. Findings should cite file paths and line numbers.

---

## 1. Multi-tenant isolation (the #1 risk)

**Applies when:** Diff touches anything under `app/api/**` (except `app/api/auth/**`, `app/api/stripe/webhook/**`, `app/api/inbound/email/**`, `app/api/cron/**`, `app/api/admin/**`) — i.e. any tenant-scoped API route.

A single missing `restaurantId` filter is a cross-tenant data leak. Be paranoid.

- [ ] Does the route call `getSessionRestaurantId()` (from `lib/session.ts`) at the top, and `return unauthorized()` if it's null?
- [ ] Is `restaurantId` included in **every** Prisma `where:` clause on tenant-scoped models (RevenueEntry, ExpenseEntry, PayrollEntry, Employee, Platform, PlatformPeriod, ImportLog, Notification, OverheadAllocationConfig, CorrelationCache, etc.)?
- [ ] For multi-step operations (`findFirst` then `update`), is `restaurantId` re-checked on the second step — not just the lookup?
- [ ] For `prisma.$queryRaw` — does the query include `WHERE "restaurantId" = ${restaurantId}` (parameterized, not interpolated)?
- [ ] For nested creates/updates, does the route verify that referenced child records (e.g. `employeeId` on a PayrollEntry) also belong to the same `restaurantId`? (IDOR risk: user passes another tenant's `employeeId`.)
- [ ] Does the response payload only contain data that this restaurant should see? (No `include: { restaurant: true }` leaking other-tenant fields.)
- [ ] Does the route avoid calling `getServerSession(authOptions)` directly? It must use the `getSessionRestaurantId` helper.

## 2. Authentication & shared secrets

**Applies when:** Diff touches `app/api/auth/**`, `app/api/stripe/webhook/**`, `app/api/inbound/email/**`, `app/api/cron/**`, `lib/auth.ts`, `lib/session.ts`, or any new webhook/secret-protected route.

Lessons baked in from the Postmark fix:

- [ ] **Fail closed on missing env vars.** Auth checks use the shape `if (!expected) reject; if (!match) reject` — never `if (expected && !match) reject` (that's fail-open if `expected` is unset).
- [ ] **Constant-time comparison.** Shared-secret checks use `crypto.timingSafeEqual` (with a length pre-check) — never `!==` or `===` on the secret string. See `tokensMatch` in `app/api/inbound/email/route.ts` for the pattern.
- [ ] **Stripe webhook** uses `stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)` and reads the raw request body (not parsed JSON).
- [ ] **Cron routes** require `Authorization: Bearer ${CRON_SECRET}` and reject if either side is missing.
- [ ] **Password hashing**: `bcrypt.hash` cost factor ≥ 12. No plaintext passwords logged. No password ever returned in API responses (even hashed).
- [ ] **Session JWT**: any new field added to the session token is non-sensitive (no API keys, no PII beyond what's already there). The session is sent on every request — assume it's logged in transit.
- [ ] **No new auth bypass shortcuts**: search the diff for `process.env.NODE_ENV !== 'production'`, `if (isDev)`, `// TODO: re-enable auth`. Flag any auth check that's conditional on environment.

## 3. Authorization (super-admin gate)

**Applies when:** Diff touches `app/admin/**`, `app/api/admin/**`, or adds/modifies any `isAdmin` check.

- [ ] Every `/api/admin/**` handler checks `session.user.isAdmin` and returns 403 if false.
- [ ] Every `/admin/**` page redirects if `!session?.user?.isAdmin`.
- [ ] `isAdmin` is **only** set during JWT creation by matching `user.email === process.env.SUPER_ADMIN_EMAIL` (see `lib/auth.ts`). Confirm no other code path sets `isAdmin = true`.
- [ ] Admin routes that operate across tenants do NOT call `getSessionRestaurantId()` (admin is the legitimate cross-tenant case). But they DO take `restaurantId` from the URL/body and validate it exists.
- [ ] Admin actions that impersonate / suspend / delete a restaurant log an audit trail (or have a TODO marker that this is coming).

## 4. Input validation

**Applies when:** Diff touches any API route handler (`app/api/**/route.ts`).

- [ ] User input from `req.json()`, `req.url` (search params), `req.headers` is validated before use — ideally via Zod schema, otherwise via explicit `typeof`/`Number.isFinite`/string-length checks.
- [ ] Numeric inputs that go into financial calculations are checked for `Number.isFinite` and reasonable ranges (no `Infinity`, no `NaN`, no negative values where positive is required).
- [ ] String inputs that become DB queries (especially in `$queryRaw`) are NOT string-interpolated. Use Prisma's tagged-template form so values are parameterized.
- [ ] Date inputs are parsed with `new Date(...)` followed by `isNaN(d.getTime())` check.
- [ ] Array/object inputs have length caps (e.g. don't accept a 10,000-row array of payroll entries without paginating).
- [ ] File uploads have a size cap and an explicit MIME/extension allowlist.

## 5. CSV parsing safety

**Applies when:** Diff touches `lib/parsers/**`, `lib/inbound.ts`, or `app/api/inbound/email/route.ts`.

CSVs come from external email senders; treat as fully untrusted.

- [ ] Parser rejects or sanitizes cells starting with `=`, `+`, `-`, `@` — these trigger formula execution if the CSV is later opened in Excel/Sheets ("CSV injection").
- [ ] Parser has a hard size cap (suggested: 10 MB; reject larger attachments before decoding base64).
- [ ] Parser handles malformed UTF-8 gracefully (doesn't throw uncaught) and rejects unrecognized encodings rather than guessing.
- [ ] Parser handles rows where the expected columns are missing — returns a skipped/failed count, doesn't crash the route.
- [ ] Parser does NOT trust the `From` header alone to identify the platform — it cross-checks against the `inboundEmail` → restaurant lookup. (Email `From` is trivially spoofable.)
- [ ] `ImportLog` records the **outcome** (SUCCESS / FAILED / PARTIAL) AND a sanitized error message — never the full row contents (might contain PII).

## 6. Raw SQL

**Applies when:** Diff adds or modifies any `prisma.$queryRaw` or `prisma.$executeRaw` call.

- [ ] Uses the tagged-template form (`` prisma.$queryRaw`SELECT ... WHERE x = ${v}` ``) — NOT the string form (`prisma.$queryRawUnsafe`). Tagged-template form parameterizes values.
- [ ] If `Unsafe` variant is used, there is a code-level comment explaining why and confirming all interpolated values come from server-side-validated constants (never request data).
- [ ] Includes `WHERE "restaurantId" = ${restaurantId}` if the table is tenant-scoped.

## 7. Output safety (XSS / response data)

**Applies when:** Diff adds React components that render user-controlled strings, or changes API response shapes.

- [ ] No new `dangerouslySetInnerHTML` calls. If unavoidable, the input is sanitized (DOMPurify or equivalent) and the diff documents why.
- [ ] No new `<a href={userControlledUrl}>` without validation — block `javascript:` schemes.
- [ ] API responses do NOT include fields that exist on the model but shouldn't be exposed: `passwordHash`, `stripeCustomerId` (unless needed), `inboundEmail` (only to the owning tenant), `SUPER_ADMIN_EMAIL`.
- [ ] PDF / CSV export routes (`@react-pdf/renderer`) render data through React props (auto-escaped). If they build strings manually, those strings are escaped.

## 8. Secrets handling

**Applies when:** Always — but especially on diffs adding new env vars, log statements, or external API calls.

- [ ] No new secrets in code (gitleaks + secretlint should catch this, but double-check).
- [ ] No `console.log(req.headers)`, `console.log(req.body)`, `console.log(session)` left in the diff — these can spill bearer tokens, cookies, password fields.
- [ ] Error messages returned to the client don't include env var names, file paths inside `node_modules`, full SQL queries, or stack traces (in production builds Next.js already strips most of this — check that `NextResponse.json({ error: e.message })` isn't echoing internal details).
- [ ] New env vars are added to `.env.example` (if it exists) with placeholder values, AND mentioned in `CLAUDE.md`'s env vars list.

## 9. Money & financial logic

**Applies when:** Diff touches code that calculates VAT, payroll, expectancy, ROI, P&L, or any user-visible currency amount.

- [ ] VAT is computed using the constants in `lib/constants.ts` (`vatAmount = gross / 6` for the 20% UK standard rate) — never inline `* 0.20` or `/ 1.2`.
- [ ] Currency formatting uses `Intl.NumberFormat` with the restaurant's currency from `restaurant.currency` — never hardcoded `'GBP'` or `£`.
- [ ] Float arithmetic is bounded: divisions guard against zero-denominator (no `Infinity`/`NaN` reaching the UI or DB).
- [ ] Employer NI uses the formula in `CLAUDE.md` with `EMPLOYER_NI_THRESHOLD_WEEKLY` and `EMPLOYER_NI_RATE` from constants — not hardcoded.
- [ ] Atomicity: stock movements, payroll entries, and any multi-row financial write are wrapped in `db.$transaction`.

## 10. Subscription / plan gating

**Applies when:** Diff adds a new feature, or modifies anything that should be plan-restricted.

- [ ] Server-side plan check on the API route (the `usePlan()` hook is client-side — defence in depth requires the server to also reject).
- [ ] `FREE_TRIAL` → `BASIC` downgrade: features that should now be locked are actually locked (check `lib/plan.ts` or equivalent).
- [ ] Stripe webhook handlers idempotent — re-delivering the same event doesn't double-apply changes (check by event ID or use Stripe's `idempotencyKey` on outbound API calls).

## 11. Dependencies & build

**Applies when:** Diff touches `package.json`, `package-lock.json`, `next.config.ts`, `eslint.config.mjs`.

- [ ] New dependencies are necessary and minimal (CLAUDE.md says "do not introduce additional dependencies without a clear reason").
- [ ] New deps don't introduce a high/critical-severity advisory (CI's `npm audit` job will catch this — but flag it pre-push).
- [ ] No `npm audit fix --force` commits that downgrade `next` or `next-auth` to vulnerable versions to silence a different advisory.
- [ ] `next.config.ts` does not disable security headers (CSP, frame-options, HSTS) or expose source maps publicly.

## 12. Operational hygiene

**Applies when:** Diff touches CI workflows, environment config, deployment scripts.

- [ ] `.github/workflows/**` changes don't disable existing security jobs (`gitleaks`, `audit`, lint).
- [ ] No `--no-verify` git commit instructions added to scripts or docs.
- [ ] No `--allow-net` / `permissive CSP` / `cors: '*'` added without explicit justification in the diff.
- [ ] Cron schedules don't expose `CRON_SECRET` in URL query strings or commit it to `vercel.json`.

---

## Reporting format

When `/security-review` finds an issue, expect this shape:

```
[section X.Y] <file:line> — <one-line problem>
  Why it matters: <one line>
  Suggested fix: <concrete change>
  Severity: low | medium | high
```

A clean review reports "No findings in sections X, Y, Z applied to this diff"
rather than a generic "looks good" — so it's clear what was actually checked.
