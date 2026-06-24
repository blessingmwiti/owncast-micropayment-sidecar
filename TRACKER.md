# Payflow Build Tracker

This is the chronological build plan. We will mark items complete as we finish them.

## 0. Project Framing

- [x] Read existing `INSTRUCTIONS.md`.
- [x] Review the Lepton hackathon brief and judging criteria.
- [x] Tighten the idea around RFB 04 Streaming & Continuous Payments.
- [x] Create a concise public-facing `README.md`.
- [x] Create this implementation tracker.

## 1. Repo and Environment

- [x] Initialize the project repository.
- [x] Choose the app structure: single Node/TypeScript service first, dashboard second.
- [x] Install Node.js dependencies.
- [x] Add `.env.example` with non-secret configuration names.
- [x] Add basic lint, typecheck, and dev scripts.
- [x] Add secret hygiene: `.gitignore`, no real keys, no private hostnames.

## 2. Arc and Circle Setup

- [ ] Install and verify ARC CLI.
- [ ] Install and verify Circle CLI.
- [ ] Create or select Circle project for Arc testnet.
- [ ] Create creator wallet.
- [ ] Create at least one test viewer wallet.
- [ ] Fund test wallets with testnet USDC.
- [ ] Confirm Circle Gateway/x402 SDK flow against current docs.

## 3. Owncast Setup

- [x] Run Owncast locally with Docker.
- [ ] Change default admin credentials.
- [ ] Configure a stream key.
- [ ] Start a test stream with OBS or FFmpeg.
- [ ] Register the sidecar webhook endpoint.
- [ ] Confirm test webhook delivery.
- [ ] Verify actual `USER_JOINED`, `USER_PARTED`, `STREAM_STARTED`, and `STREAM_STOPPED` payload shapes.

## 4. Sidecar MVP

- [x] Scaffold Express/TypeScript service.
- [x] Add health endpoint.
- [x] Add webhook receiver.
- [x] Add typed event parsing and validation.
- [x] Add idempotency keys for webhook events.
- [x] Add durable session store.
- [x] Add session ledger model.
- [x] Implement `USER_JOINED` handling.
- [x] Implement `USER_PARTED` handling.
- [x] Implement `STREAM_STOPPED` open-session settlement.
- [x] Add tests for session duration and duplicate webhooks.

## 5. Viewer Authorization Flow

- [x] Build minimal viewer entry page.
- [x] Show active stream state and current rate.
- [ ] Connect viewer wallet.
- [ ] Create payment authorization using Circle/x402 tooling.
- [x] Bind Owncast viewer/session identity to wallet authorization.
- [x] Enforce spending cap and authorization expiry.
- [x] Redirect or embed the Owncast stream after authorization.

## 6. Settlement Core

- [x] Integrate Circle's `@circle-fin/x402-batching` SDK.
- [ ] Settle a fixed test payment end to end.
- [x] Convert watched seconds into USDC minor units safely.
- [x] Settle a real viewer session on `USER_PARTED`.
- [ ] Record settlement result and Gateway transaction data.
- [x] Prevent double settlement for repeated events.
- [x] Add failure states and retry strategy.

## 7. Pricing Agent

- [x] Define creator policy: base rate, min rate, max rate, surge rules.
- [x] Implement simple deterministic pricing policy.
- [x] Poll Owncast viewer count.
- [x] Log rate decisions with rationale.
- [x] Lock each viewer session to the visible rate they accepted.
- [ ] Add optional LLM-backed rationale after deterministic policy works.
- [x] Surface agent decisions in the dashboard.

## 8. Creator Dashboard

- [x] Show stream status and viewer count.
- [x] Show current rate and agent rationale.
- [x] Show active sessions.
- [x] Show settled sessions and USDC totals.
- [x] Show failed/retryable settlements.
- [ ] Show creator wallet balance if API access permits.

## 9. Demo Hardening

- [ ] Run one complete local stream with one viewer wallet.
- [ ] Run one complete stream with 2-3 real test viewers.
- [x] Capture metrics: sessions, wallets, USDC settled, average duration, agent decisions.
- [ ] Deploy sidecar to a public URL.
- [ ] Verify webhook delivery against deployed sidecar.
- [ ] Record a sub-3-minute demo video.
- [ ] Submit early with repo, video, and live URL if available.

## 10. Stretch: Mastodon Adapter

- [x] Confirm current Mastodon donation-campaign API shape.
- [x] Add campaign endpoint backed by the same settlement core.
- [x] Add donation page.
- [x] Settle one test donation.
- [ ] Include it as a brief stretch segment in the demo only after Owncast works.

## 11. Production Follow-Through

- [ ] Replace demo storage with production database migrations.
- [x] Add authentication for creator dashboard.
- [ ] Add observability: structured logs, metrics, error reporting.
- [x] Add rate-limit and abuse protections.
- [x] Add reconciliation job for unsettled sessions.
- [x] Add deployment documentation.
- [ ] Write post-hackathon roadmap.
