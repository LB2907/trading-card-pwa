# Phase B — marketplace (optional backend)

Phase A of Trading Card Studio is **browser-only**: SQLite (sql.js) + OPFS/IndexedDB, no card art on a server.

This folder sketches a **future** self-hosted marketplace if you want **trades** or **sales** with strangers.

## Trust boundaries

- **Listings** need user identity (even pseudonymous accounts).
- **Payments** need a processor (e.g. Stripe Connect) or manual “mark sold”.
- **Art delivery**: prefer **buyer-verified file** (hash + out-of-band transfer) or **client-side encrypted blobs** you never decrypt—pick explicitly in a product spec.

## Suggested service layout

- `POST /v1/listings` — create listing (metadata + optional encrypted asset ref).
- `GET /v1/listings` — browse with filters.
- `POST /v1/offers` — negotiate trade / purchase intent.
- `POST /v1/reports` — abuse reporting.

## Data model (Postgres sketch)

- `users` — id, handle, created_at, stripe_account_id nullable.
- `listings` — id, seller_id, title, card_instance_hash, price_cents nullable, currency, status.
- `offers` — id, listing_id, buyer_id, amount_cents, state.
- `fulfillment` — id, listing_id, ciphertext_uri nullable, buyer_pubkey_id nullable.

Implement as a **separate** Node/Fastify or Next Route Handlers project; keep this PWA as a static/client deploy and point `NEXT_PUBLIC_MARKETPLACE_URL` at your API when ready.

See `openapi.yaml` for a minimal OpenAPI 3.1 stub (not wired to code).
