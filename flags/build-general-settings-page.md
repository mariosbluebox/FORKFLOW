# Build general `/settings` page

**State:** `app/(dashboard)/settings/billing/page.tsx` and `app/(dashboard)/settings/integrations/page.tsx` exist, but there is **no `app/(dashboard)/settings/page.tsx`** — the `/settings` URL hits a 404 / falls through to the billing child depending on routing behaviour.

**Why it matters:** SPEC.md §11.7 specifies `/settings` should hold restaurant profile (name, currency) + password change. Without it, an owner has no way to rename their restaurant or change their login password inside the app — they'd need direct DB access.

**Action:**
1. Create `app/(dashboard)/settings/page.tsx` — client component, tabbed or sectioned layout.
2. Sections:
   - Restaurant profile form (name, currency dropdown) → `PATCH /api/settings/profile`
   - Change password form (current pw, new pw, confirm) → `POST /api/settings/password`
3. Build the two matching API routes if they don't already exist (quick grep in `app/api/settings/`).
4. Link from sidebar / topbar (settings should already be in nav — just ensure it points at `/settings`).

**Urgency:** Phase 1 gap — low functional impact while you're the only user, meaningful the moment a real customer signs up.
