# Fill real Stripe env vars

**State:** `.env` has placeholders: `STRIPE_SECRET_KEY="sk_test_placeholder"`, `STRIPE_WEBHOOK_SECRET="whsec_placeholder"`, `STRIPE_BASIC_PRICE_ID="price_placeholder_basic"`, `STRIPE_PRO_PRICE_ID="price_placeholder_pro"`.

**Why it matters:** `/settings/billing`, `/api/billing/checkout`, `/api/billing/portal`, and `/api/stripe/webhook` will fail the moment they talk to Stripe. `lib/stripe.ts` uses a lazy Proxy so the app *boots* fine — but any plan upgrade / subscription test will 500.

**Action:**
1. Stripe dashboard → create two products: Basic and Pro, each with a recurring price. Copy both Price IDs.
2. Copy the Stripe secret key (use a test key, `sk_test_…`, until you go live).
3. For the webhook secret: run `stripe listen --forward-to localhost:3000/api/stripe/webhook` locally, or create a webhook endpoint in the dashboard for the deployed URL.
4. Update `.env` on every machine + Vercel.

**Urgency:** Only when you want to test billing / the subscription upgrade flow. Doesn't block anything else.
