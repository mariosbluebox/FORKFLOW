# Set a real `CRON_SECRET`

**State:** `.env` has `CRON_SECRET="placeholder"`.

**Why it matters:** Protected cron routes (currently `/api/cron/import-check`, and the planned `/api/cron/analytics-recalc` for Phase 4) check an `Authorization: Bearer $CRON_SECRET` header. With a known-placeholder secret, anyone can trigger these crons from the internet and cause unwanted writes / notifications.

**Action:**
1. Generate: `openssl rand -hex 32`
2. Set in `.env` locally and in Vercel env vars.
3. Make sure `vercel.json` cron config passes the header (Vercel Cron does this automatically when the env var is set on the project).

**Urgency:** Must be done before deploy. For local dev this is only hit if you manually curl the endpoint.
