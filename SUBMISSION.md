# Submission Runbook

Use this to record the first hackathon submission quickly.

## Local Dry-Run Recording

Start the stack:

```bash
npm run stack:up
```

Docker Desktop must be running before this command.

Open:

- Viewer: `http://localhost:4000/`
- Dashboard: `http://localhost:4000/dashboard.html`
- Donation page: `http://localhost:4000/donate.html`
- Owncast: `http://localhost:8080`

Seed a repeatable demo flow:

```bash
BASE_URL=http://localhost:4000 npm run demo:dry-run
```

Collect metrics:

```bash
curl -sS http://localhost:4000/metrics
```

Stop the stack:

```bash
npm run stack:down
```

## Video Structure

Keep it under three minutes.

1. Problem: self-hosted livestreamers lack per-second monetization.
2. Viewer: show current rate and approve a session.
3. Stream metering: show Owncast/sidecar webhook flow or run the dry-run script.
4. Dashboard: show sessions, settled amount, agent rationale, and metrics.
5. Stretch: show Mastodon campaign endpoint or donation page.
6. Close: one settlement core, multiple open creator platforms.

## Metrics to Report

Use the dashboard or `/metrics`:

- Unique wallets
- Viewer authorizations
- Settled sessions
- Total USDC settled
- Average watched seconds
- Failed settlements, if any

## Live Settlement Upgrade

Before recording live testnet settlement:

- Set `SETTLEMENT_PROVIDER=circle-gateway`.
- Add `CIRCLE_API_KEY`.
- Add `CREATOR_WALLET_ADDRESS`.
- Fund the viewer wallet with testnet USDC.
- Confirm the viewer page is producing real x402 payloads.
- Run one fixed test payment before recording.
