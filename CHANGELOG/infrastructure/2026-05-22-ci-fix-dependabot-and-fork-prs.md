# CI: Fix workflow for Dependabot and fork PRs

**Date:** 2026-05-22
**Author:** Marios
**Related:** Unblocks Dependabot PRs (e.g. #22 `next 15.5.12 → 15.5.18`, #21 `brace-expansion`) — needed before merging the next round of CVE-fix bumps

## Summary

Two CI workflow fixes so that PRs without access to repository secrets — most
importantly Dependabot PRs — can pass the `ci` and `gitleaks` jobs.

Before this fix, every Dependabot PR failed both jobs, which would have
forced us into either ignoring CI status, hand-merging dep bumps, or sitting
on known CVEs. None of those are compatible with the security framework we
set up in Phase 1.

## What changed

`.github/workflows/ci.yml`:

1. **`DATABASE_URL` is now a literal placeholder** (`postgresql://ci:ci@localhost:5432/ci`) instead of `${{ secrets.DATABASE_URL }}`. The build doesn't connect to a database — Prisma only needs the URL string to *exist* and parse as a valid connection string. Sourcing it from a secret was unnecessary and broke any PR that doesn't get secret access (Dependabot, forks).
2. **Gitleaks now runs via direct docker invocation** (pinned to `zricethezav/gitleaks:v8.30.1`) instead of `gitleaks/gitleaks-action@v2`. The action calls `GET /repos/.../pulls/{n}/commits` to scope the scan, which returns 403 on Dependabot PRs (their `GITHUB_TOKEN` is read-only by GitHub policy). The docker form scans the checked-out filesystem and full history — no API calls, no permissions issue. Pinning a version (not `:latest`) keeps CI reproducible and avoids the supply-chain risk of an upstream image bump silently changing behaviour.
3. **Added `.gitleaks.toml`** with an allowlist for obvious placeholder strings (`sk_test_placeholder`, `whsec_placeholder`, `price_placeholder`). With the docker fix in place, gitleaks finally ran a full-history scan for the first time and flagged 2 findings — both the same CI/docs placeholder caught by its pattern-based `stripe-access-token` rule. The allowlist neutralizes the false positives without weakening real-secret detection.

## How to verify

This PR itself is the test:
- If `ci` (Type check, Lint & Build) goes green on this PR, the DATABASE_URL fix works.
- If `gitleaks` goes green on this PR, the docker swap works.

After merge, PR #22 (next bump) should be re-runnable and pass.

## Follow-ups

- **Delete `DATABASE_URL` from repo secrets** if nothing else uses it. (Anything that *should* hit a real DB belongs in a deploy workflow, not CI.) Verify with: Settings → Secrets and variables → Actions.
- **Note in SECURITY.md** the discovery that `npm audit --omit=dev --audit-level=high` reports 0 vulns while Dependabot reports 9 high CVEs for the same `next` version. Our audit gate has a real coverage gap vs. GHSA. Worth a §6 entry once the dust settles.
