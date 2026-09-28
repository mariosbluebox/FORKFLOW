import { db } from './db'

// Fixed-window rate limiter backed by Postgres, so the count is shared across
// every serverless instance (an in-memory Map would reset per instance).
// One atomic upsert per check: start a new window if the old one has expired,
// otherwise increment.

export const RATE_LIMITS = {
  loginPerEmail: { limit: 10, windowMs: 15 * 60 * 1000 },
  loginPerIp: { limit: 20, windowMs: 15 * 60 * 1000 },
  signupPerIp: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const

export async function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const [row] = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + ${windowMs} * interval '1 millisecond')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now()
        THEN now() + ${windowMs} * interval '1 millisecond'
        ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `

  // Occasionally prune long-expired rows so the table doesn't grow forever.
  if (Math.random() < 0.01) {
    await db.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now() - interval '1 day'`
  }

  const retryAfterSec = Math.max(0, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000))
  return { allowed: row.count <= limit, retryAfterSec }
}

// Vercel sets x-real-ip / x-forwarded-for itself (client-supplied values are
// overwritten), so the first entry is the caller's address.
export function clientIp(headers: Headers | Record<string, unknown> | undefined): string {
  const get = (name: string): string | null => {
    if (!headers) return null
    if (headers instanceof Headers) return headers.get(name)
    const v = headers[name]
    return typeof v === 'string' ? v : null
  }
  return get('x-real-ip') ?? get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}
