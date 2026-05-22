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
2. **Gitleaks now runs via direct docker invocation** instead of `gitleaks/gitleaks-action@v2`. The action calls `GET /repos/.../pulls/{n}/commits` to scope the scan, which returns 403 on Dependabot PRs (their `GITHUB_TOKEN` is read-only by GitHub policy). The docker form scans the checked-out filesystem and full history — no API calls, no permissions issue.

## How it works

**DATABASE_URL placeholder:** Set as a literal value in both the `Generate Prisma client` step and the `Build` step. Functionally identical to a real URL for build purposes — only matters at runtime. Reduces the secret blast radius too: there's no longer a reason for `secrets.DATABASE_URL` to exist on CI at all (it can be cleaned up separately).

**Gitleaks docker:** Equivalent to running `gitleaks detect --source=. --redact --no-banner` locally. Pulls `zricethezav/gitleaks:latest` (the official image), mounts the workspace, scans, exits 0 on clean / 1 on findings. GitHub Actions reads the exit code to set the check status. No PR comments (the action's only extra feature) — but the check status is enough.

## How to verify

This PR itself is the test:
- If `ci` (Type check, Lint & Build) goes green on this PR, the DATABASE_URL fix works.
- If `gitleaks` goes green on this PR, the docker swap works.

After merge, PR #22 (next bump) should be re-runnable and pass.

## Trade-offs / what we lose

- **gitleaks-action@v2 PR comments:** The action would auto-comment on a PR with finding details. We lose that. The job-failure check status still surfaces findings; you click into the run logs to see what gitleaks reported. Acceptable trade for working on all PR sources.
- **Pulling the docker image adds ~5–10s per run.** Negligible vs. the value of CI actually working.

## Follow-ups

- **Delete `DATABASE_URL` from repo secrets** if nothing else uses it. (Anything that *should* hit a real DB belongs in a deploy workflow, not CI.) Verify with: Settings → Secrets and variables → Actions.
- **Note in SECURITY.md** the discovery that `npm audit --omit=dev --audit-level=high` reports 0 vulns while Dependabot reports 9 high CVEs for the same `next` version. Our audit gate has a real coverage gap vs. GHSA. Worth a §6 entry once the dust settles.
