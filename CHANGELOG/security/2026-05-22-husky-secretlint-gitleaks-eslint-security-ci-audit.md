# Phase 1: Pre-commit + CI security gates

**Date:** 2026-05-22
**Author:** Marios
**Related:** Security hardening Phase 1 (Husky + secretlint + gitleaks + eslint-plugin-security + npm audit)

## Summary

Set up automated security gates on every commit (local) and every push / PR
(GitHub Actions) so that secrets, vulnerable dependencies, and known insecure
code patterns are caught **before** anything reaches the remote repository.

This is Phase 1 of a three-phase plan:
- **Phase 1 (this entry)** — automated gates
- **Phase 2 (next)** — project-specific `SECURITY-CHECKLIST.md` for `/security-review`
- **Phase 3 (incremental)** — Zod input validation + Prisma tenant-scope middleware

## What changed

### New dev dependencies
- `husky@^9.1.7` — git-hook runner
- `lint-staged@^17.0.5` — runs linters on staged files only
- `secretlint@^13.0.2` + `@secretlint/secretlint-rule-preset-recommend@^13.0.2` — local secret scanning
- `eslint-plugin-security@^4.0.0` — static analysis for insecure JS/TS patterns

### New / modified files
| File | Purpose |
|---|---|
| `.husky/pre-commit` | Runs `npx lint-staged` before every commit |
| `.secretlintrc.json` | Enables the secretlint recommended preset |
| `package.json` | Adds `prepare: husky` script + `lint-staged` config block |
| `eslint.config.mjs` | Registers `eslint-plugin-security` rules (most as errors, a few noisy ones as warnings) |
| `.github/workflows/ci.yml` | Adds two new jobs: `gitleaks` (full-history scan) + `audit` (prod-deps `npm audit`) |
| `CHANGELOG/**` | New folder structure for tracking changes by category |

### Why two different secret scanners?
- **secretlint** runs locally on the pre-commit hook (pure-npm, no system install)
- **gitleaks** runs in CI as a full git-history scan (Docker action, no install)

They use different rule sets, so anything one misses the other may catch.
Defense in depth.

> **Note:** `gitleaks` was originally going to run locally too, but `brew install
> gitleaks` failed because `/opt/homebrew` isn't writable by the current user
> (requires `sudo chown -R mariosarapi /opt/homebrew`). Switched the local hook
> to `secretlint` to avoid the sudo dance. To restore local gitleaks later, fix
> the homebrew permissions then either `brew install gitleaks` or add a
> `gitleaks protect --staged` line to `.husky/pre-commit`.

## How it works

### On every `git commit` (local)
1. Husky fires `.husky/pre-commit`
2. That runs `npx lint-staged`
3. `lint-staged` (configured in `package.json`) processes only the staged files:
   - `*.{ts,tsx,js,jsx,mjs,cjs}` → `eslint --fix` then `secretlint`
   - `*.{json,md,yml,yaml}` → `secretlint`
4. If anything fails, the commit is aborted with a non-zero exit code.

### On every push to `main` or PR targeting `main` (CI)
Three independent jobs run in parallel:
- **`ci`** — type check, lint, build (unchanged)
- **`gitleaks`** — `gitleaks/gitleaks-action@v2` with `fetch-depth: 0` for full
  history scan; fails the build on any finding
- **`audit`** — `npm audit --audit-level=high --omit=dev`; fails the build on any
  high/critical prod-dep vulnerability

### ESLint security rules
Most rules are set to `error` (eval, child_process, weak randomness, bidi
characters, CSRF). A few that produce false positives in idiomatic Next.js code
are set to `warn` (non-literal fs/regex/require, timing attacks, unsafe regex),
and `detect-object-injection` is `off` because it triggers on every dynamic
property access — it's almost pure noise in a TS codebase.

## How to verify

> Note: this doc deliberately doesn't embed literal secret-shaped strings —
> our own pre-commit hook would (correctly) reject the commit that adds them.
> The verification steps generate the fake-secret strings at runtime instead.

```bash
# 1. Confirm husky installed the hook
ls -la .husky/pre-commit
# expected: file exists, contents = "npx lint-staged"

# 2. Confirm secretlint catches a Stripe-key-shaped string
#    (Generated at runtime so this command can live in committed docs.)
TOKEN=$(openssl rand -hex 24)
printf 'const k = "sk_%s_%s"\n' "live" "$TOKEN" > /tmp/x.js
npx secretlint /tmp/x.js
# expected: error: STRIPE_SECRET_KEY_LIVE detected; exit 1
rm /tmp/x.js

# 3. Confirm eslint security plugin is loaded
npm run lint
# expected: clean (no errors on current code)

# 4. Trigger the pre-commit hook end-to-end with an AWS-key-shaped string
#    (Note: AWS keys are exactly 20 chars after the prefix.)
KEY="AKIA$(LC_ALL=C tr -dc 'A-Z0-9' </dev/urandom | head -c 16)"
printf 'const k = "%s"\n' "$KEY" > app/test-secret.ts
git add app/test-secret.ts
git commit -m "test: should be blocked"
# expected: commit aborted by secretlint
git restore --staged app/test-secret.ts
rm app/test-secret.ts

# 5. After push: check Actions tab for green ci / gitleaks / audit jobs
```

## Known follow-ups

- **Existing audit findings** (informational only — currently CI passes):
  - 4 moderate-severity vulns in prod deps (`postcss` via `next`, `uuid` via
    `next-auth`). Both have only `--force` fixes that would break us; safe to
    leave until upstream releases a clean fix.
  - Run `npm audit` periodically and reassess.
- **Local gitleaks** — restore once homebrew permissions are fixed (see note
  above). It adds belt-and-braces secret scanning against the working tree.
- **Phase 2** — write `SECURITY-CHECKLIST.md` covering tenant isolation,
  webhook signature verification, `CRON_SECRET` checks, super-admin gating,
  CSV parser safety. Used as a `/security-review` prompt.
- **Phase 3** — Zod schemas at API boundaries + Prisma middleware that throws
  on tenant-scoped queries missing `restaurantId`. Roll out incrementally as
  routes are touched.
- **Rate limiting** — defer to Phase 3 but consider adding to
  `POST /api/inbound/email` and the self-signup endpoint before public launch.
