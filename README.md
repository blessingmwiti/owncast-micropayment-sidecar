# Owncast Payflow

Per-second USDC payments for self-hosted livestreams.

Owncast Payflow is a payment sidecar for [Owncast](https://owncast.online/) that lets a viewer approve a spending rate, watch a stream, and pay only for the seconds they were actually present. The creator receives testnet USDC through Circle Gateway Nanopayments on Arc.

This is built for the Lepton Agents Hackathon by Canteen, Circle, and Arc. It directly targets RFB 04, Streaming & Continuous Payments, and overlaps with RFB 06, Creator & Publisher Monetization.

## The Idea

Livestream monetization usually forces creators into platform subscriptions, ads, or coarse pay-per-view gates. Those models are a bad fit for self-hosted creators and small communities: a viewer may want to pay for five minutes, not a month.

Payflow treats live media as a flow. A viewer pre-authorizes a small USDC spending cap, the sidecar meters their Owncast presence, and settlement happens when they leave or the stream ends.

The core product question:

> What if a creator could charge for the exact seconds watched, with the rate set dynamically by an agent?

## Why This Should Work

- Owncast already exposes the hooks we need: stream status plus user join and leave webhooks.
- Circle Gateway Nanopayments makes sub-cent payments economically reasonable.
- Arc gives fast USDC-native settlement for a live demo.
- The hackathon explicitly calls out live media paid per second watched as open ground.
- The first traction loop is small and realistic: one creator, a few test viewers, one real stream, real testnet settlement.

## Product Shape

The MVP has four surfaces:

- Viewer entry page: shows the current rate, connects/signs a payment authorization, then opens the stream.
- Owncast sidecar: receives webhooks, meters session duration, and settles payment.
- Pricing agent: adjusts the per-second rate based on viewer count, stream state, and creator policy.
- Creator dashboard: shows viewer count, active rate, earned USDC, session ledger, and settlement status.

The stretch surface is a Mastodon donation-campaign adapter that reuses the same settlement core for campaign donations. It is useful as a proof that Payflow is not just an Owncast hack, but a portable creator-payment engine.

## Architecture

```text
Viewer browser
  -> approves spending cap and rate
  -> opens Owncast stream

Owncast
  -> emits USER_JOINED, USER_PARTED, STREAM_STARTED, STREAM_STOPPED

Payflow sidecar
  -> binds viewer identity to payment authorization
  -> computes watched seconds
  -> asks pricing agent for rate policy
  -> submits x402/Circle Gateway settlement

Arc testnet
  -> settles USDC to creator wallet
```

## Current Build

The `dev` branch has the working local spine:

- Express/TypeScript sidecar.
- Static viewer entry page at `http://localhost:4000/`.
- Creator dashboard at `http://localhost:4000/dashboard.html`.
- Owncast webhook receiver at `POST /webhook`.
- Viewer pre-authorization binding at `POST /session/start`.
- JSON ledger for sessions, authorizations, processed webhook IDs, and settlements.
- Deterministic pricing agent backed by Owncast `/api/status`.
- Dry-run settlement by default, with a Circle Gateway provider wired behind config.

## Local Run

```bash
npm install
cp .env.example .env
npm run owncast:up
npm run dev
```

Or run the whole local stack in Docker:

```bash
npm run stack:up
```

Useful URLs:

- Viewer entry: `http://localhost:4000/`
- Creator dashboard: `http://localhost:4000/dashboard.html`
- Sidecar health: `http://localhost:4000/health`
- Owncast: `http://localhost:8080`
- Owncast admin: `http://localhost:8080/admin`

Run checks:

```bash
npm run check
```

## Settlement Modes

`SETTLEMENT_PROVIDER=dry-run` is the default. It records deterministic local settlement IDs and lets us prove the metering, ledger, dashboard, and webhook flow before using real testnet funds.

`SETTLEMENT_PROVIDER=circle-gateway` uses Circle's x402 batching SDK and expects stored x402 payment payloads/requirements from the viewer authorization flow. This is the path to turn on after Circle project, wallet, faucet, and live signing are configured.

## Proof Plan

The first proof is not a perfect payments platform. It is a short, inspectable flow:

1. Run Owncast locally or on a VPS.
2. Start a real stream.
3. Have 2-3 viewers enter through the Payflow page.
4. Show the pricing agent setting or changing the rate.
5. End viewer sessions and settle testnet USDC.
6. Show creator dashboard totals and transaction logs.
7. Record the whole thing in under three minutes.

The submission metrics should be concrete: unique wallets, settled sessions, total testnet USDC moved, average stream duration, and rate decisions made by the agent.

## Production-Ready Direction

The demo should be designed so it can harden into a real product:

- Use Circle's maintained x402/Gateway SDKs instead of hand-rolled settlement calls.
- Store sessions, authorizations, and ledger entries durably rather than only in memory.
- Bind Owncast viewer identity to wallet authorization with a signed session token.
- Make all webhook handlers idempotent so duplicate events cannot double-charge.
- Treat `USER_PARTED` and `STREAM_STOPPED` as settlement triggers; use stale-session cleanup only with a reliable heartbeat or Owncast presence check.
- Enforce spending caps, rate locks, and clear viewer consent.
- Add creator-configured minimum and maximum rates so the agent operates inside policy.
- Keep every settlement auditable from dashboard row to Gateway transaction.

## Current Assumptions

- Payments run on Arc testnet for the hackathon.
- USDC amounts are tiny and demo-focused.
- The first creator is us.
- The first viewers are known testers, not public strangers.
- The Mastodon adapter is a stretch goal after Owncast settlement works.

## Hackathon Fit

- Agentic sophistication: the pricing agent makes real rate decisions within creator policy.
- Traction: real viewers and real testnet payments during the event window.
- Circle tool usage: Wallets, Gateway Nanopayments, x402, USDC, and Arc.
- Innovation: continuous live-media payment is a real gap, and Owncast gives us a clean distribution wedge.

## References

- [Lepton Agents Hackathon](https://lepton.thecanteenapp.com/?utm_source=luma)
- [Circle Gateway Nanopayments](https://developers.circle.com/gateway/nanopayments)
- [Circle x402 batching SDK](https://developers.circle.com/gateway/nanopayments/references/sdk)
- [Arc docs](https://docs.arc.network)
- [Owncast](https://owncast.online/)

See [ROADMAP.md](./ROADMAP.md) for the post-hackathon hardening path.
