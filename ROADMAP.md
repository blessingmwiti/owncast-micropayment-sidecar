# Post-Hackathon Roadmap

Owncast Payflow is currently optimized for a clear hackathon proof: metered viewing, agent-set rates, dry-run settlement, and a Circle Gateway path ready for live x402 payloads. After submission, harden it in this order.

## Phase 1: Live Testnet Settlement

- Replace manual wallet fields with a real wallet connection flow.
- Generate x402 payment payloads from the viewer page.
- Validate signed payloads before accepting a viewer session.
- Run fixed-amount Circle Gateway settlement on Arc testnet.
- Reconcile dashboard settlement rows against Gateway transaction responses.

## Phase 2: Durable Ledger

- Replace the JSON ledger with a database.
- Add migrations for authorizations, sessions, settlements, rate decisions, and webhook events.
- Add unique constraints for webhook idempotency and settlement idempotency.
- Add a reconciliation worker for pending and failed settlements.

## Phase 3: Creator Controls

- Add authenticated creator onboarding.
- Let creators set min/base/max rates and spending-cap defaults.
- Add payout destination settings.
- Add exportable session and settlement reports.

## Phase 4: Better Agent

- Keep deterministic pricing as the safety layer.
- Add optional LLM-generated rationale inside creator-defined policy bounds.
- Include stream title, category, historical conversion, viewer count, and time-of-day signals.
- Store every decision and show policy-bound explanations in the dashboard.

## Phase 5: Multi-Platform Adapters

- Harden the Mastodon donation adapter.
- Add PeerTube and Jellyfin proof adapters.
- Extract the settlement core into a reusable package.
- Document the webhook adapter contract for other open creator platforms.

## Phase 6: Public Product

- Deploy behind HTTPS.
- Add monitoring, error reporting, and alerting.
- Add abuse protection around viewer entry and donation endpoints.
- Add privacy policy, payment terms, and creator-facing risk disclosures.
- Run a small beta with real Owncast creators.
