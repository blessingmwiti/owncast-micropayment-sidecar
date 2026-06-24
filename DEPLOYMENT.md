# Deployment Notes

Payflow is a Node.js service plus static viewer/dashboard pages. Owncast can run separately on the same VPS, on another host, or locally for a recorded demo.

## Required Commands

```bash
npm ci
npm run build
npm start
```

For local Owncast:

```bash
npm run owncast:up
```

For the full local Docker stack:

```bash
npm run stack:up
npm run stack:down
```

Docker image:

```bash
docker build -t owncast-payflow .
docker run --env-file .env -p 4000:4000 owncast-payflow
```

## Required Environment

```bash
NODE_ENV=production
PORT=4000
PUBLIC_URL=https://payflow.example.com
CREATOR_DASHBOARD_TOKEN=choose-a-dashboard-token
LEDGER_DRIVER=sqlite
SQLITE_FILE=data/payflow.sqlite

OWNCAST_URL=https://stream.example.com
OWNCAST_WEBHOOK_SECRET=choose-a-shared-secret

BASE_RATE_PER_SECOND=0.001
MIN_RATE_PER_SECOND=0.0005
MAX_RATE_PER_SECOND=0.003

SETTLEMENT_PROVIDER=dry-run
```

Use `SETTLEMENT_PROVIDER=dry-run` for the first public demo pass. It proves webhook metering, rate decisions, dashboard totals, and settlement records without risking live payment failures during recording.

Switch to live Circle settlement only after wallets, faucet funding, and viewer x402 signing are verified:

```bash
SETTLEMENT_PROVIDER=circle-gateway
CIRCLE_GATEWAY_URL=https://gateway-api-testnet.circle.com
CIRCLE_API_KEY=...
CREATOR_WALLET_ADDRESS=0x...
ARC_TESTNET_RPC=...
```

## Owncast Webhook

Configure Owncast to send these events to:

```text
https://payflow.example.com/webhook
```

Subscribe to:

- `USER_JOINED`
- `USER_PARTED`
- `STREAM_STARTED`
- `STREAM_STOPPED`

If `OWNCAST_WEBHOOK_SECRET` is set, include the same value in the `x-payflow-webhook-secret` header when configuring the webhook sender or reverse proxy.

## Demo Checklist

1. Start Owncast and Payflow.
2. Open `PUBLIC_URL` and approve a viewer session.
3. Start a stream.
4. Trigger or receive `USER_JOINED`.
5. Trigger or receive `USER_PARTED` or stop the stream.
6. Open `/dashboard.html` and show the session, agent rate, and settlement row.
7. Open `/mastodon/campaigns` and submit one `/donate/:campaignId` dry-run donation if using the stretch segment.

## Current Production Gaps

- Use `LEDGER_DRIVER=sqlite` before real users.
- Add authentication to the creator dashboard.
- Complete real wallet connection and x402 signing in the viewer page.
- Reconcile failed live Circle settlements.
- Put the service behind HTTPS before any wallet/payment interaction.
