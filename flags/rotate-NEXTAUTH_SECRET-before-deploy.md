# Rotate `NEXTAUTH_SECRET`

**State:** `.env` currently has the literal placeholder `"change-me-to-a-random-32-char-secret"` (line 6).

**Why it matters:** This secret signs every NextAuth JWT session token. A placeholder / public string means anyone who reads the repo or this chat could forge a valid session for any user, including the super-admin.

**Action:**
1. Generate a real secret: `openssl rand -base64 32`
2. Replace `NEXTAUTH_SECRET` in `.env` on every machine (Mac Mini + MacBook Air).
3. Set the same value in Vercel env vars before first deploy.
4. Existing sessions will invalidate on change — users will need to log in again. Fine for now, account for it at deploy time.

**Urgency:** Must do before any deploy or before the app is reachable from anything beyond localhost. Not urgent for local-only dev.
