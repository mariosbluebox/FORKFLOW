# Postmark inbound webhook: fail-closed + constant-time token check

**Date:** 2026-05-22
**Author:** Marios
**Related:** Resolves known issue tracked in `SECURITY.md §6.1` (now removed); updates `SECURITY.md §3.3` control row to reflect both fixes

## Summary

Two related hardening fixes to the Postmark inbound email webhook auth check:

1. **Fail-open → fail-closed.** Previously, if `POSTMARK_INBOUND_WEBHOOK_TOKEN` was unset (in any environment — local, preview, staging, prod), the endpoint silently accepted all unauthenticated traffic and would process attacker-supplied CSV attachments as if they were legitimate platform statements. Now the route rejects both when the env var is missing **and** when the supplied token doesn't match.
2. **Non-constant-time → constant-time comparison.** The previous `token !== expectedToken` comparison short-circuited on the first byte mismatch, leaking timing information that could in theory let an attacker recover the secret byte-by-byte. Now uses `crypto.timingSafeEqual` with a length pre-check. Caught by `eslint-plugin-security`'s `detect-possible-timing-attacks` rule after the first fix landed.

## What changed

`app/api/inbound/email/route.ts` — auth block at the top of `POST` handler:

**Before:**
```ts
if (process.env.POSTMARK_INBOUND_WEBHOOK_TOKEN && token !== process.env.POSTMARK_INBOUND_WEBHOOK_TOKEN) {
  return NextResponse.json({ ok: false, reason: 'invalid token' })
}
```
The `process.env.X && ...` guard meant the *entire* check was skipped when
the env var was unset — accepting all traffic.

**After:**
```ts
import { timingSafeEqual } from 'node:crypto'

function tokensMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const providedBuf = Buffer.from(provided)
  const expectedBuf = Buffer.from(expected)
  if (providedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(providedBuf, expectedBuf)
}

// ...inside POST handler:
const expectedToken = process.env.POSTMARK_INBOUND_WEBHOOK_TOKEN
if (!expectedToken) {
  console.error('[postmark-inbound] POSTMARK_INBOUND_WEBHOOK_TOKEN is not set — rejecting request')
  return NextResponse.json({ ok: false, reason: 'server misconfigured' })
}
// ...read token from header/query...
if (!tokensMatch(token, expectedToken)) {
  return NextResponse.json({ ok: false, reason: 'invalid token' })
}
```

Three guarantees: rejects on missing env var, rejects on missing/wrong token,
and the comparison itself runs in constant time relative to the token length.

## How it works

- **Misconfiguration (env var missing):** Logs a loud `console.error` (visible in Vercel logs immediately) and returns `{ ok: false, reason: 'server misconfigured' }`. Surfaces the deployment mistake on the first attempted request.
- **Auth failure (token mismatch or missing):** `tokensMatch` returns false; route returns `{ ok: false, reason: 'invalid token' }`.
- **Timing-safe comparison:** `crypto.timingSafeEqual` runs in time proportional to buffer length but independent of where the first byte differs. The length pre-check exists because `timingSafeEqual` throws on differing-length buffers — we return false early instead. This does leak token length, which is fine here (Postmark tokens are fixed-length and the length is not a secret).
- **HTTP status stays 200** in both rejection paths — this is deliberate. Postmark retries 4xx/5xx responses, and we don't want retry storms on bad senders. The `{ ok: false, reason }` shape is how Postmark sees the rejection.

## Why the original code looked OK at a glance

The `&&` pattern is a common idiom for "optional environment-gated feature"
(e.g. "if Sentry DSN is set, enable Sentry"). It's the wrong pattern for an
authentication check — auth must be **required**, not **optional**. The lesson
generalizes: `if (process.env.SECRET && check)` is always wrong for a security
gate; the correct shape is `if (!process.env.SECRET) reject; if (!check) reject`.
This is now called out in the Phase 2 `SECURITY-CHECKLIST.md` (forthcoming).

## How to verify

```bash
# 1. With env var unset → server misconfigured
unset POSTMARK_INBOUND_WEBHOOK_TOKEN
curl -X POST http://localhost:3000/api/inbound/email \
  -H 'content-type: application/json' \
  -d '{}'
# expect: {"ok":false,"reason":"server misconfigured"}
# expect: server logs show the console.error line

# 2. With env var set, no token → invalid token
export POSTMARK_INBOUND_WEBHOOK_TOKEN=test-token
curl -X POST http://localhost:3000/api/inbound/email \
  -H 'content-type: application/json' \
  -d '{}'
# expect: {"ok":false,"reason":"invalid token"}

# 3. With env var set, correct token → proceeds to body parsing
curl -X POST http://localhost:3000/api/inbound/email \
  -H 'content-type: application/json' \
  -H 'x-postmark-token: test-token' \
  -d '{}'
# expect: processing continues (200 + some other ok:true/false based on body content)
```

## Follow-ups

- The fail-open `if (process.env.X && check)` pattern does NOT appear in the
  Stripe webhook handler or the cron handler (checked at fix time). Both
  already fail-closed.
- Other shared-secret checks in the codebase (`CRON_SECRET`) use direct
  string comparison too — same theoretical timing-oracle concern. Lower
  priority because the attack surface is narrower (cron URL is internal),
  but worth migrating to `tokensMatch` next time the file is touched.
- Phase 2 checklist will include two rules drawn from this fix:
  1. *Auth must use `if (!expected) reject; if (!match) reject` — never `if (expected && !match)`.*
  2. *Shared-secret comparisons must use `crypto.timingSafeEqual`, never `!==`.*
