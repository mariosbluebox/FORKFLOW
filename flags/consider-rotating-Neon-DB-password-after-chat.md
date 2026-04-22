# Consider rotating the Neon DB password

**State:** The `DATABASE_URL` in `.env` includes a real Neon password (`neondb_owner` role, `eu-west-2` region). That password ended up in this chat's context when I read `.env` during setup on 2026-04-22. It's not in git history — `.env*` is gitignored (`.gitignore:34`).

**Why it matters:** If the conversation transcript ever leaks — screenshot, copy-paste into another system, Claude conversation export — anyone with it can connect as `neondb_owner` and read/write/destroy the entire database. The blast radius is total tenant data loss.

**Action (only if you're worried about transcript leakage):**
1. Neon dashboard → your project → Roles → `neondb_owner` → Reset password.
2. Copy the new connection string.
3. Update `.env` on the Mac Mini and the MacBook Air.
4. Update Vercel env vars when you deploy.
5. Restart the dev server after the change (Next.js caches env vars until restart).

**Urgency:** Low and optional. Depends on how carefully you treat this chat transcript. If you never export / share it, the risk is essentially contained. If you routinely export conversations (to Notion, docs, etc.), do this now.
