# Triage `npm audit` vulnerabilities

**State:** After `npm install` on 2026-04-22, `npm audit` reported **4 vulnerabilities: 1 moderate, 3 high**.

**Why it matters:** The most recent commit (`369d172`) is literally titled *"Pin all dependencies to exact versions for supply chain security."* Having unpatched high-severity advisories directly contradicts that stated policy.

**Action:**
1. `npm audit` — read the actual advisories and affected packages.
2. For each: check if a patched version exists within the same minor (safe bump) or requires a major bump (risk review).
3. Either `npm audit fix` (safe, minor/patch only) or bump individual packages manually and re-pin to exact versions.
4. Re-run `npm audit` until clean.
5. Consider adding `npm audit --audit-level=high` to a pre-deploy check so this doesn't regress silently.

**Urgency:** Medium. Not blocking local dev or a first deploy, but the pinning commit implies you care about this class of issue — worth an hour sometime soon.
