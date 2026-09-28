# Security

Living source of truth for how the FORKFLOW app is secured. Read this first
to understand the current posture; consult `CHANGELOG/security/` for the
history of how we got here; consult [`SECURITY-CHECKLIST.md`](./SECURITY-CHECKLIST.md)
for what `/security-review` checks before every push.

> **Update this document in place** when you change anything in the lists
> below. Each change should also get a dated entry in `CHANGELOG/security/`
> that links back to the section it modifies. The CHANGELOG is the history;
> this file is the current state.

**Last reviewed:** 2026-05-22 — after Phase 1 (pre-commit + CI gates), Postmark fail-closed/timing-safe fix, Phase 2 (`SECURITY-CHECKLIST.md` drafted), CI workflow fix for Dependabot/fork PRs, `.gitleaks.toml` allowlist, and the dependency-bump cleanup that closed 25 of 27 Dependabot advisories.

---

## 1. What this app is, from a security perspective

A multi-tenant SaaS that handles **money, PII, and payment data**:

- Each tenant is a restaurant; rows are scoped by `restaurantId`.
- Stores: customer emails, password hashes, employee records (incl. NI numbers, pay rates), revenue/expense data, Stripe subscription state.
- Talks to: Stripe (subscriptions + webhooks), Postmark (inbound CSV email), Neon (Postgres), Vercel (hosting).
- Public surface: signup, login, Stripe webhook, Postmark inbound webhook, cron endpoints.

The blast radius of a single missing `restaurantId` filter is "Restaurant A
sees Restaurant B's financials." That's the #1 risk we design against.

---

## 2. Threat model

What we're actively defending against:

| Threat | Where it lands |
|---|---|
| Cross-tenant data leakage (missing `restaurantId` filter) | Every API route and DB query |
| Credential stuffing / weak passwords | `/api/signup`, `/api/auth/*` |
| Stripe webhook spoofing (fake subscription events) | `/api/stripe/webhook` |
| Postmark webhook spoofing (fake CSV imports) | `/api/inbound/email` |
| Cron endpoint abuse | `/api/cron/*` |
| Privilege escalation (regular user → super-admin) | `/admin/*` and `/api/admin/*` |
| Malicious CSV uploads (formula injection, OOM, malformed encoding) | `lib/parsers/*` |
| Secrets leaked in git history | Repo |
| Vulnerable transitive deps (RCE, prototype pollution) | `package-lock.json` |
| Stored XSS via user-controlled strings (restaurant name, employee name, etc.) | All dashboard pages |
| SQL injection | `prisma.$queryRaw` callsites |

What we're **not** defending against yet (see §5 *Out of scope*):
volumetric DoS, sophisticated insider attacks, physical security of dev
machines, supply-chain attacks on npm itself.

---

## 3. Current controls

Each row marks whether the control is **verified in code today**, **per spec
but not audited**, or **planned**. Verified means I read the line of code
that enforces it.

### 3.1 Identity & access

| Control | Status | Where |
|---|---|---|
| Passwords hashed with bcrypt, cost factor 12 | Verified | `app/api/signup/route.ts:33`, `lib/auth.ts:30` |
| NextAuth JWT session carries `userId`, `restaurantId`, `plan`, `isAdmin` | Verified | `lib/auth.ts` |
| Session helper `getSessionRestaurantId()` for every API route | Verified | `lib/session.ts:5` |
| Middleware gates dashboard routes on valid session | Per spec | `middleware.ts` |
| Super-admin gate: `session.user.isAdmin` checked on `/admin/*` routes | Verified | `app/admin/layout.tsx:8`, `app/api/admin/restaurants/**` |
| `isAdmin` set only when user email matches `SUPER_ADMIN_EMAIL` | Per spec | `lib/auth.ts` |
| Self-signup creates Restaurant + User atomically | Per spec | `app/api/signup/route.ts` |

### 3.2 Multi-tenant isolation

| Control | Status |
|---|---|
| Every tenant-scoped model has a `restaurantId` column | Verified (schema) |
| Every API route is required to filter by `restaurantId` from the session | Manual discipline — not enforced by code yet |
| Admin routes are the only legitimate cross-tenant queries | Convention |

**Gap:** Tenant filtering is by-convention, not enforced. A single forgotten
`restaurantId` filter is a data leak. **Mitigation:** Phase 3 will add a
Prisma middleware that throws on tenant-scoped queries lacking
`restaurantId`. Until then, this is the #1 thing `/security-review` must
catch (Phase 2).

### 3.3 Webhooks & cron

| Control | Status | Where |
|---|---|---|
| Stripe webhook signature verification via `stripe.webhooks.constructEvent` | Verified | `app/api/stripe/webhook/route.ts:17` |
| Postmark inbound token check: fail-closed (rejects on missing env var) + constant-time compare via `crypto.timingSafeEqual` | Verified | `app/api/inbound/email/route.ts` |
| Cron endpoints require `Authorization: Bearer ${CRON_SECRET}` header (fail-closed) | Verified | `app/api/cron/import-check/route.ts:17` |

### 3.4 Data handling

| Control | Status |
|---|---|
| Prisma ORM (parameterized queries everywhere by default) | Verified |
| `$queryRaw` used only for `currentStock <= reorderLevel` comparisons | Per spec |
| Monetary values stored as `Float`, formatted via `Intl.NumberFormat` with per-restaurant currency | Per spec |
| Employees soft-deleted (`isActive=false`), never hard-deleted | Per spec |
| Stock movements wrapped in `db.$transaction` for atomicity | Per spec |

### 3.5 Secrets & supply chain

| Control | Status |
|---|---|
| Secrets only in `.env` (gitignored) + Vercel env vars | Verified |
| Pre-commit: `secretlint` (recommended preset) on every staged file | Verified — Phase 1 |
| CI: `gitleaks` full-history scan on every push/PR, run via pinned docker image `zricethezav/gitleaks:v8.30.1` | Verified — Phase 1 (workflow fixed for Dependabot/fork PRs) |
| `.gitleaks.toml` allowlist for known placeholder strings (`sk_test_placeholder`, `whsec_placeholder`, `price_placeholder`) — neutralizes false positives without weakening real-secret detection | Verified |
| CI: `npm audit --audit-level=high --omit=dev` blocks high+ prod vulns | Verified — Phase 1 |
| Dependabot watches for security updates | Verified — pre-existing |
| `eslint-plugin-security` blocks `eval`, `child_process`, weak randomness, bidi chars, etc. | Verified — Phase 1 |

**Why multiple scanners:** `npm audit` (npm's advisory DB) and Dependabot (GitHub's GHSA DB) overlap but are not equivalent. We observed on 2026-05-22 that GHSA had 12 high `next` advisories while `npm audit` reported 0 — the same advisories landed in `npm audit` later the same day. Treat `npm audit` as a fast CI gate, Dependabot as the broader source of truth, and check the Dependabot dashboard before declaring a clean bill of health.

### 3.6 Transport & platform

| Control | Status |
|---|---|
| HTTPS everywhere (Vercel default, HSTS on `*.vercel.app`) | Verified — platform |
| Neon Postgres connection over TLS | Verified — provider default |
| No custom CORS config (Next.js defaults; same-origin) | Verified |

---

## 4. Roadmap

### Phase 2 — Project-specific security checklist (done 2026-05-22)
Drafted [`SECURITY-CHECKLIST.md`](./SECURITY-CHECKLIST.md) — 12 sections
covering tenant isolation, auth/secrets, super-admin gating, input
validation, CSV parser safety, raw SQL, output safety, secrets handling,
financial logic, plan gating, dependencies, and ops hygiene. Use via
`/security-review` before every push. Update in place as new patterns
emerge from real findings.

### Phase 3 — Code-level guardrails (incremental as routes are touched)
- **Zod schemas** at every API boundary for input validation
- **Prisma tenant-scope middleware** that throws when a query on a tenant-scoped model lacks `restaurantId` — eliminates the #1 by-convention gap
- **Rate limiting** on `/api/signup`, `/api/auth/*`, `/api/inbound/email` (target: pre-launch, not post-launch)

### Beyond Phase 3 (no timeline)
- 2FA / TOTP for users (especially super-admin)
- Audit log table (who did what, when) — required for SOC 2 if we ever go there
- Session timeout / idle expiry config
- CSP header tightening (currently default)
- Sentry or similar for anomaly alerting

---

## 5. Out of scope (explicitly deferred)

| Item | Why deferred |
|---|---|
| Volumetric DoS protection / WAF | Vercel provides baseline DDoS; revisit when we have real traffic or get hit |
| Rate limiting beyond the three endpoints in Phase 3 | Cost/complexity not justified pre-launch |
| Formal compliance (SOC 2, ISO 27001) | Premature; no customer requires it yet |
| Penetration test | After Phase 3 lands, before paid public launch |
| Bug bounty program | After first paying customers |
| 2FA | Add when we have super-admin actions worth protecting in prod |

If any of these become required by a deal, customer, or incident, revisit.

---

## 6. Known issues

Open security debt we know about but haven't fixed yet. Each should become a
dated `CHANGELOG/security/` entry when resolved.

### 6.1 Tenant filtering is by-convention, not enforced
- **Where:** Every tenant-scoped API route
- **Current:** Each route is expected to call `getSessionRestaurantId()` and pass it into every Prisma query. No mechanism catches forgetting.
- **Fix:** Phase 3 Prisma middleware.
- **Mitigation today:** `/security-review` with the Phase 2 checklist on every PR.

### 6.2 Residual medium-severity advisories
- **Where:** Dependabot dashboard. As of 2026-05-22, 2 medium-severity advisories remain (likely `postcss` via `next`, `uuid` via `next-auth` — both have only `--force` fixes that would break the stack).
- **History:** Started the day at 27 advisories (12 high, 13 moderate, 2 low). Cleared 25 by merging Dependabot bumps for `next` 15.5.18, `flatted` 3.4.2, picomatch (multi-bump), and `brace-expansion` 5.0.6.
- **Fix:** Revisit when upstream ships compatible releases. CI does not block on medium severity; Dependabot dashboard is the authoritative view.
- **Priority:** Low (monitored, not blocking).

---

## 7. Decision log (why we chose what we chose)

Short notes on non-obvious choices. New decisions append here; existing
entries shouldn't be edited (they're a record of *why* at the time).

- **2026-05-22 — Local secret scanner: secretlint, not gitleaks.** Brew install of gitleaks failed (`/opt/homebrew` not writable, needs `sudo chown`). Switched local hook to secretlint (pure-npm, no system install) and kept gitleaks in CI. Bonus: two different rule sets = defense in depth.
- **2026-05-22 — `npm audit` runs on prod deps only.** `--omit=dev` because dev-dep vulnerabilities don't ship to production. Reduces noise and false urgency.
- **2026-05-22 — `npm audit` threshold: high.** Moderate findings are informational only. Re-evaluating moderates becomes endless toil pre-launch; we monitor them in §6 instead.
- **2026-05-22 — `eslint-plugin-security`: most rules error, a few warn, `detect-object-injection` off.** That rule fires on every dynamic property access in TS — would generate hundreds of false positives and we'd disable it within a week. Better to turn it off explicitly than have everyone learn to ignore the noise.
- **2026-05-22 — Rate limiting deferred to Phase 3.** Important but not blocking pre-launch. **Re-evaluate before opening signup to the public** — auth and inbound email endpoints are abuse vectors that don't need real traffic to be exploited.
- **2026-05-22 — Two-doc model: living `SECURITY.md` + append-only `CHANGELOG/security/`.** A single folder of dated files can't answer "what's our current state?" without reading everything. Splitting current-state from history is the only way both stay honest.
- **2026-05-22 — Gitleaks runs via pinned docker image, not the `gitleaks-action@v2` GitHub Action.** The action calls the GitHub API to list PR commits and 403s on Dependabot/fork PRs (read-only token). Docker form works in both contexts (CI and local laptop) with the same command, gives content-addressed reproducibility, and avoids a supply-chain risk a re-tagged Action release would carry. Pinning a specific version (`v8.30.1`) instead of `:latest` makes the image cacheable and tamper-evident.
- **2026-05-22 — `.gitleaks.toml` allowlist over per-finding `.gitleaksignore`.** Placeholder strings (`sk_test_placeholder`, etc.) are pattern-based, not commit-specific. A regex allowlist won't need updating when the same placeholder moves files or appears in a new doc; a fingerprint ignore would. Risk that an attacker would name a real key `placeholder` is essentially zero.
- **2026-05-22 — CI uses literal placeholder env vars, not `secrets.DATABASE_URL`.** The build doesn't connect to a real database; Prisma just needs the URL string to *exist* and parse. Sourcing it from a secret broke every PR without secret access (Dependabot, forks) and concentrated blast radius without benefit. The whole point of CI here is to verify the build compiles — anything that needs a real DB belongs in a deploy workflow.

---

## 8. Reporting a vulnerability

Please do **not** open a public issue. Report privately via GitHub's
[private vulnerability reporting](https://github.com/mariosbluebox/FORKFLOW/security/advisories/new).

Set up a proper `security@` mailbox + responsible-disclosure policy before
public launch.
