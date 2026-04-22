# Fill real Postmark env vars

**State:** `.env` has `POSTMARK_INBOUND_WEBHOOK_TOKEN="placeholder"` and `POSTMARK_SERVER_TOKEN="placeholder"`.

**Why it matters:** `/api/inbound/email` verifies the inbound token before processing a payload — with the placeholder, any real Postmark webhook POST will be rejected (and any attacker who knows the placeholder can inject forged imports). Outbound email (`POSTMARK_SERVER_TOKEN`) is for future notification sending.

**Action:**
1. Create a Postmark account + server.
2. Configure an Inbound Stream: point its webhook URL at `https://<your-domain>/api/inbound/email` and copy the signing / auth token into `POSTMARK_INBOUND_WEBHOOK_TOKEN`.
3. Copy the Server API token into `POSTMARK_SERVER_TOKEN`.
4. Also: buy/configure the inbound email domain (current seed uses `inbound.restofinance.app`) and MX-point it at Postmark.

**Urgency:** Only when testing automated email ingestion (Phase 3 feature). App boots and runs without it.
