# CHANGELOG

Human-readable, **append-only** log of changes to the FORKFLOW app, organized
by category. Each entry is its own dated Markdown file so the log is easy to
scan, search, and link to.

> **Don't edit old entries.** They're a record of what happened and why we
> thought it was the right call *at the time*. If something later turns out
> wrong or is superseded, write a new entry that links back — don't rewrite
> history.

## Source-of-truth docs vs. this log

For **current state** of the app (especially security), the CHANGELOG is the
wrong place to look — you'd have to read every dated entry to piece it
together. Instead:

| Question | Look at |
|---|---|
| "How is the app secured *right now*?" | [`/SECURITY.md`](../SECURITY.md) (living doc, update in place) |
| "When did we add X and why?" | This folder (append-only history) |

The two are linked: every change to `SECURITY.md` should also land a dated
entry here, and each entry can reference the SECURITY.md section it changed.

## Categories

| Folder | What goes here |
|---|---|
| [`security/`](./security) | Auth, secrets, dependencies, tenant isolation, webhook verification, CSP, rate limiting, audits |
| [`features/`](./features) | New user-visible functionality (modules, pages, reports, exports) |
| [`fixes/`](./fixes) | Bug fixes, behavioural corrections, regression patches |
| [`infrastructure/`](./infrastructure) | CI/CD, deploy config, build tooling, dev environment, migrations, scripts |

## File naming

Use `YYYY-MM-DD-short-slug.md`, e.g. `2026-05-22-husky-gitleaks-ci.md`.
If multiple entries land on one day, append `-1`, `-2`, etc.

## Entry template

```markdown
# <Title>

**Date:** YYYY-MM-DD
**Author:** <name>
**Related:** <PR / issue / commit refs, optional>

## Summary
One paragraph: what changed and why.

## What changed
- Bullet list of concrete changes.

## How it works
Short explanation of the new behaviour (for future-you).

## How to verify
Steps to confirm it's working.

## Follow-ups
Anything intentionally deferred.
```
