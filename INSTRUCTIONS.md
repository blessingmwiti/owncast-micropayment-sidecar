# Lepton Agents Hackathon — Owncast Micropayment Sidecar
## Complete Build Instructions

---

## What You Are Building

A **payment sidecar** for [Owncast](https://github.com/owncast/owncast) (self-hosted live streaming) that charges viewers per second watched and pays the streamer in real-time USDC via Circle Gateway Nanopayments on Arc.

**Architecture:**
```
Viewer browser
    │  pre-signs EIP-3009 USDC authorization at session start (x402)
    ↓
Owncast server (unmodified)
    │  fires userJoined / userParted webhooks
    ↓
Sidecar (your Node.js service)
    │  computes elapsed seconds → calculates USDC amount
    │  submits signed authorizations to Circle Gateway
    ↓
Arc testnet
    │  Gateway batches and settles onchain
    ↓
Creator's Circle Wallet receives USDC
```

**Second surface (Mastodon donation-campaign adapter):**
Same settlement core, different adapter. Plugs into Mastodon's
`GET /api/v1/donation_campaigns` endpoint that merged in early 2026.
One settlement engine, two open creator platforms.

**Judging weight reminder:**
- 30% Agentic sophistication → add a rate-setting agent (surge pricing)
- 30% Traction → run real streams, get real test viewers, show real payments
- 20% Circle tool usage → Wallets + Gateway + x402 + Paymaster
- 20% Innovation → per-second live streaming pay is a documented code gap

---

## Blind Spots to Watch

Before writing a line of code, internalize these:

1. **Viewer UX is the hardest part.** Getting someone to pre-authorize USDC before they can watch is where demos die. Solve it for yourself + 2–3 test viewers. Do not try to solve general onboarding in two weeks.
2. **The agentic score.** Webhook sidecar alone scores "AI-flavored automation" (weakest bucket). You need at least one decision the AI makes — dynamic per-second rate based on viewer count is the minimum. Build this early, not as an afterthought.
3. **Owncast's 15-second prune.** A viewer who disconnects without a clean close will trigger `userParted` after 15 seconds of silence. Your sidecar must handle this as proof-of-presence termination, not as a bug.
4. **Arc testnet, not mainnet.** Everything runs on the Canteen-hosted Arc testnet. Your Circle API keys must be provisioned for this testnet. Do not accidentally hit mainnet.
5. **Demo video is your pitch.** Judging is fully async. A three-minute video of money flowing in real time while a stream runs is more valuable than any feature you add after it's working.
6. **Submit early, update often.** The form accepts multiple submissions. Submit as soon as the core works. Update with the Mastodon adapter, agent layer, and polish.
7. **Public repo required from day one.** Keep it clean and documented. Judges read the code directly.

---

## Step 0 — Hackathon Access and Accounts

### Join the communities

- Join Canteen Discord: https://discord.gg/rsVfYutFZg
  - Introduce yourself, say what you're building
- Join Arc builder Discord: https://discord.com/invite/buildonarc
  - Mention **Canteen + Lepton** in the onboarding flow
  - If rejected, ping `@kdrohan` in the Canteen Discord
- Bookmark the submission form: https://forms.gle/SMqLaw2pMGDe58LFA

### Register on Luma (if not done)

- URL: https://luma.com/5xcrazms
- Passphrase: `SITEx2224`

### Create accounts (if not existing)

- Circle Developer account: https://developers.circle.com
- Supabase account: https://supabase.com (used by the reference implementation)
- Vercel or Railway account (for deploying the sidecar publicly)

---

## Step 1 — Local Environment Setup

### Install required tooling

```bash
# Node.js v22+ (use nvm)
nvm install 22
nvm use 22

# ARC CLI (Canteen-hosted testnet access + bundled docs for your coding agent)
uv tool install git+https://github.com/the-canteen-dev/ARC-cli

# Supabase CLI (used by arc-nanopayments reference)
npm install -g supabase

# Docker Desktop must be running (Supabase local dev requires it)
# Verify:
docker --version
supabase --version
arc --version
```

### Verify Arc testnet connectivity

```bash
# The ARC CLI bundles RPC access to the Canteen-hosted Arc testnet
arc --help
# Follow any auth prompts — this is your testnet RPC
# Testnet docs: https://arc-node.thecanteenapp.com/
```

### Clone the reference implementation

```bash
# This is your starting scaffold — LangChain paying agent + x402 seller + Gateway batching
git clone https://github.com/circlefin/arc-nanopayments.git
cd arc-nanopayments
npm install
```

Read the full README before continuing. It explains the wallet generation script,
Supabase schema, environment variables, and the seller dashboard.

---

## Step 2 — Circle Platform Setup

### Provision Circle API keys for Arc testnet

- Go to https://developers.circle.com
- Create a new project scoped to **Arc testnet**
- Save your API key — you will need it for all service configs

### Understand the four Circle primitives you will use

| Primitive | What it does in your build |
|-----------|---------------------------|
| **Wallets** | Give the creator a Circle-managed wallet to receive USDC; give each viewer a spending wallet |
| **Gateway / Nanopayments** | Batch-settle the per-second USDC flows with zero per-transaction gas |
| **x402** | The HTTP 402 payment standard — viewer signs an EIP-3009 authorization at session start |
| **Paymaster** | Fees in USDC — no volatile gas token needed for either party |

Docs:
- Nanopayments: https://developers.circle.com/gateway/nanopayments
- Wallets: https://developers.circle.com/wallets
- x402 reference: https://github.com/circlefin/arc-nanopayments (the repo you cloned)
- Arc chain: https://docs.arc.network

### Generate wallets (creator + test viewer)

The reference implementation includes a wallet generation script:

```bash
# Inside arc-nanopayments/
npx tsx generate-wallets.mts
# Creates a creator wallet and one or more viewer/buyer wallets
# Save the output — addresses and keys go into your .env
```

### Fund test wallets with testnet USDC

- Get testnet USDC from the Arc faucet (ask in the Arc Discord if not documented)
- The viewer wallet needs enough USDC to pre-authorize a session
- The creator wallet starts empty — it receives settlement

---

## Step 3 — Owncast Setup

### Run Owncast locally (Docker)

```bash
mkdir owncast && cd owncast
docker run -v $PWD/data:/app/data -p 8080:8080 -p 1935:1935 \
  owncast/owncast:latest
```

Owncast admin UI: http://localhost:8080/admin
Default credentials: admin / abc123 (change immediately)

### Configure your stream key

- Admin → Stream Keys → note your stream key
- You will stream to `rtmp://localhost:1935/live` with this key

### Register your sidecar as a webhook endpoint

- Admin → Integrations → Webhooks → Add Webhook
- URL: `http://localhost:4000/webhook` (your sidecar, adjust port)
- Events to subscribe:
  - `USER_JOINED`
  - `USER_PARTED`
  - `STREAM_STARTED`
  - `STREAM_STOPPED`
- Save

### Test webhook delivery

Owncast has a "Send Test" button next to each webhook. Use it to confirm your
sidecar receives events before starting a real stream.

---

## Step 4 — Sidecar Core: Session Accounting

Create a new Node.js/TypeScript project separate from the reference implementation.
This is your main deliverable.

### Project scaffold

```bash
mkdir owncast-pay-sidecar && cd owncast-pay-sidecar
npm init -y
npm install express typescript tsx dotenv @types/express
npm install @circle-fin/circle-sdk  # or use raw fetch against Circle API
npx tsc --init
```

### Core data structures

```typescript
// src/types.ts

interface ViewerSession {
  viewerUserId: string;       // Owncast User.ID — stable per session
  streamId: string;           // which stream they're watching
  joinedAt: Date;             // server timestamp from userJoined event
  partedAt?: Date;            // server timestamp from userParted event
  walletAddress: string;      // viewer's Circle Wallet address
  spendingAuthSignature: string; // EIP-3009 authorization signed at session start
  settled: boolean;
}

interface SessionLedger {
  [viewerUserId: string]: ViewerSession;
}
```

### Webhook receiver

```typescript
// src/webhook.ts
import express from 'express';

const app = express();
app.use(express.json());

const sessions: SessionLedger = {};

app.post('/webhook', async (req, res) => {
  const { type, eventData } = req.body;

  switch (type) {
    case 'USER_JOINED':
      await handleUserJoined(eventData);
      break;
    case 'USER_PARTED':
      await handleUserParted(eventData);
      break;
    case 'STREAM_STARTED':
      console.log('Stream started:', eventData);
      break;
    case 'STREAM_STOPPED':
      await settleAllOpenSessions();
      break;
  }

  res.sendStatus(200);
});

async function handleUserJoined(data: { id: string; timestamp: string; user: { id: string } }) {
  const session: ViewerSession = {
    viewerUserId: data.user.id,
    streamId: data.id,
    joinedAt: new Date(data.timestamp),
    walletAddress: await getViewerWallet(data.user.id), // look up or provision
    spendingAuthSignature: await getSpendingAuth(data.user.id), // retrieved at session start
    settled: false,
  };
  sessions[data.user.id] = session;
}

async function handleUserParted(data: { id: string; timestamp: string; user: { id: string } }) {
  const session = sessions[data.user.id];
  if (!session || session.settled) return;

  session.partedAt = new Date(data.timestamp);
  await settleSession(session);
}

async function settleSession(session: ViewerSession) {
  const elapsedSeconds = (session.partedAt!.getTime() - session.joinedAt.getTime()) / 1000;
  const rate = await getCurrentRate(); // from your agent — see Step 6
  const amountUSDC = elapsedSeconds * rate;

  if (amountUSDC < 0.000001) {
    // Below Gateway minimum — skip
    session.settled = true;
    return;
  }

  await submitToGateway({
    fromAddress: session.walletAddress,
    toAddress: process.env.CREATOR_WALLET_ADDRESS!,
    amount: amountUSDC,
    signature: session.spendingAuthSignature,
    elapsedSeconds,
  });

  session.settled = true;
}
```

### Settlement function (Gateway call)

```typescript
// src/gateway.ts
export async function submitToGateway({ fromAddress, toAddress, amount, signature }: {
  fromAddress: string;
  toAddress: string;
  amount: number;
  signature: string;
  elapsedSeconds: number;
}) {
  // Circle Gateway accepts EIP-3009 authorizations and batches them
  // Reference: https://developers.circle.com/gateway/nanopayments
  // Use the x402 settlement endpoint from arc-nanopayments reference

  const response = await fetch('https://api.circle.com/v1/w3s/gateway/settle', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: toAddress,
      amount: amount.toFixed(6), // USDC 6 decimal places
      currency: 'USDC',
      authorization: signature,
    }),
  });

  if (!response.ok) {
    console.error('Gateway settlement failed:', await response.text());
    throw new Error('Settlement failed');
  }

  return response.json();
}
```

> **Note:** The exact Gateway settlement endpoint path and payload shape — confirm
> against the live Circle API reference at https://developers.circle.com/api-reference/gateway
> and the arc-nanopayments reference implementation. Use the `proxy.ts` in that
> repo as the ground truth for the x402 settlement call signature.

### Open sessions cleanup (15-second prune fallback)

Owncast fires `userParted` after 15 seconds of viewer silence. Your sidecar
should also run a periodic cleanup to settle any sessions that were missed:

```typescript
// Every 30 seconds, settle sessions older than 20 seconds with no parted event
setInterval(async () => {
  const now = Date.now();
  for (const [userId, session] of Object.entries(sessions)) {
    if (!session.settled && !session.partedAt) {
      const ageSeconds = (now - session.joinedAt.getTime()) / 1000;
      // If Owncast hasn't sent userParted after 20s, assume they're gone
      // In practice userParted fires at 15s — this is a safety net
      if (ageSeconds > 20) {
        session.partedAt = new Date(session.joinedAt.getTime() + ageSeconds * 1000);
        await settleSession(session);
      }
    }
  }
}, 30_000);
```

---

## Step 5 — Viewer Session Start: x402 Authorization

The viewer must pre-sign a USDC spending authorization before the stream meter
starts. This is the friction point — keep it minimal.

### Viewer-facing endpoint (pre-authorization)

Add an endpoint your viewer UI calls before the stream starts:

```typescript
// src/session-start.ts
app.post('/session/start', async (req, res) => {
  const { viewerAddress, signedAuthorization } = req.body;

  // Store the signed EIP-3009 authorization against this viewer address
  // You will use this signature when settling after userParted fires
  await storeAuthorization(viewerAddress, signedAuthorization);

  res.json({
    ok: true,
    ratePerSecond: await getCurrentRate(),
    creatorAddress: process.env.CREATOR_WALLET_ADDRESS,
  });
});
```

### Minimal viewer UI

Build the simplest possible page that:
1. Shows the current per-second rate
2. Prompts the viewer to connect their Circle Wallet
3. Signs the EIP-3009 authorization for a pre-authorized spending cap (e.g. $1.00)
4. Redirects to the Owncast stream embed

Use the `arc-nanopayments` reference `hooks/` and `components/` for the wallet
connection and signing logic — they're already built for Arc testnet.

### Environment variables

```bash
# .env
CIRCLE_API_KEY=your_circle_api_key
CREATOR_WALLET_ADDRESS=0x...      # the creator's Circle Wallet
RATE_PER_SECOND=0.001             # default rate in USDC, overridden by agent
ARC_TESTNET_RPC=https://...       # from arc-node.thecanteenapp.com
OWNCAST_URL=http://localhost:8080
PORT=4000
```

---

## Step 6 — The Agentic Layer (Surge Pricing)

This is what moves you from "automation" to "agency" in the judging rubric.
The agent makes a real decision: **what should the per-second rate be right now?**

### Rate-setting agent

```typescript
// src/agent.ts
import { getCurrentViewerCount } from './owncast-api';

interface RateDecision {
  ratePerSecond: number;
  rationale: string;
}

export async function computeOptimalRate(): Promise<RateDecision> {
  const viewerCount = await getCurrentViewerCount();

  // Simple policy to start — extend with LLM reasoning
  let rate = 0.001; // base rate: $0.001/sec
  let rationale = 'base rate';

  if (viewerCount > 50) {
    rate = 0.003;
    rationale = `surge: ${viewerCount} concurrent viewers`;
  } else if (viewerCount > 20) {
    rate = 0.002;
    rationale = `elevated: ${viewerCount} concurrent viewers`;
  } else if (viewerCount < 5) {
    rate = 0.0005;
    rationale = `discount: low viewership (${viewerCount})`;
  }

  return { ratePerSecond: rate, rationale };
}

// Fetch current viewer count from Owncast API
async function getCurrentViewerCount(): Promise<number> {
  const res = await fetch(`${process.env.OWNCAST_URL}/api/status`);
  const data = await res.json();
  return data.viewerCount ?? 0;
}
```

Update the rate every 60 seconds and log the agent's decision:

```typescript
setInterval(async () => {
  const decision = await computeOptimalRate();
  process.env.RATE_PER_SECOND = String(decision.ratePerSecond);
  console.log(`[Agent] Rate updated to $${decision.ratePerSecond}/sec — ${decision.rationale}`);
}, 60_000);
```

**Optional enhancement:** Replace the policy function with a Claude API call that
reasons over viewer count, time of day, stream category, and historical revenue —
then explains its rate decision in natural language. Log those decisions to your
dashboard. This is what "agentic sophistication" means in the judging rubric.

### Owncast status API

```typescript
// GET /api/status returns:
// { online: bool, viewerCount: number, streamTitle: string, ... }
// No auth required for the public status endpoint
```

---

## Step 7 — Creator Dashboard

A simple Next.js page (reuse the seller dashboard from `arc-nanopayments`) showing:

- Current per-second rate (set by agent) and rationale
- Live viewer count (poll Owncast `/api/status`)
- Running total earned this session (sum of settled amounts)
- Transaction log (viewerId, duration, USDC paid, timestamp)
- Cumulative earnings in creator's Circle Wallet (Circle Wallets API)
- Withdraw button (Circle Wallets API → creator's external address)

The arc-nanopayments seller dashboard already covers the wallet balance and
withdraw flow. Fork it and add the Owncast-specific panels on top.

---

## Step 8 — Mastodon Donation-Campaign Adapter

Same settlement core, new adapter. Ship this after the Owncast sidecar is working.

### What Mastodon opened

Mastodon merged `GET /api/v1/donation_campaigns` (PR #37880) in early 2026.
It expects an external campaign source that Mastodon instances can configure.
You become that source.

### What to build

A campaign-source service that Mastodon instances point to:

```typescript
// src/mastodon-adapter.ts
app.get('/mastodon/campaigns', async (req, res) => {
  // Return campaign data in the shape Mastodon's donation_campaigns API expects
  // Instance operators configure their Mastodon to point to your URL
  res.json({
    campaigns: [
      {
        id: 'creator-campaign-001',
        title: 'Support this creator directly',
        description: 'Every donation settles instantly to the creator in USDC via Arc',
        goalAmount: '100.00',
        currency: 'USDC',
        donationUrl: `${process.env.PUBLIC_URL}/donate/creator-campaign-001`,
        creatorWallet: process.env.CREATOR_WALLET_ADDRESS,
      }
    ]
  });
});

// Donation endpoint — viewer hits this, it settles via the same Gateway core
app.post('/donate/:campaignId', async (req, res) => {
  const { viewerAddress, amount, signature } = req.body;
  await submitToGateway({
    fromAddress: viewerAddress,
    toAddress: process.env.CREATOR_WALLET_ADDRESS!,
    amount: parseFloat(amount),
    signature,
    elapsedSeconds: 0, // not time-based for donations
  });
  res.json({ ok: true });
});
```

### The pitch value of this

You now have **one settlement engine, two open creator platforms**:
- Owncast: per-second, presence-based, live streaming
- Mastodon: campaign-based, federated social creator support

The hackathon article explicitly calls this shape "the settlement core that sits
under all of the above." Frame it that way in your demo video.

---

## Step 9 — Deployment

### Deploy the sidecar publicly

The sidecar needs a public URL so:
- Owncast webhooks can reach it (if Owncast runs on a VPS)
- Viewers can hit the session-start endpoint
- Mastodon instances can reach the campaign API

Recommended: deploy to Railway or Render (free tier works for a hackathon).

```bash
# Railway
npm install -g @railway/cli
railway login
railway init
railway up
# Railway gives you a public HTTPS URL
```

Or use your existing VPS (`vmi751715`) with nginx + your existing Certbot setup —
you already have that infrastructure running for Imaara. Fastest path.

### Owncast on VPS or keep local

For the demo, Owncast can run locally on your MacBook while you stream.
The sidecar must be public (Owncast webhook target needs a reachable URL).
Use ngrok for local Owncast → public sidecar during development:

```bash
# Temporarily tunnel your local sidecar
ngrok http 4000
# Use the ngrok URL as the Owncast webhook target
```

For the actual submission demo, run everything on your VPS or deploy properly.

### Stream from OBS or FFmpeg

```bash
# Test stream from terminal
ffmpeg -re -i test-video.mp4 \
  -c:v libx264 -preset veryfast -maxrate 3000k -bufsize 6000k \
  -pix_fmt yuv420p -g 50 -c:a aac -b:a 160k -ac 2 -ar 44100 \
  -f flv rtmp://localhost:1935/live/YOUR_STREAM_KEY
```

Or use OBS → Settings → Stream → Custom → `rtmp://your-server:1935/live`

---

## Step 10 — Submission

### What the form requires

URL: https://forms.gle/SMqLaw2pMGDe58LFA

- Public GitHub repo link (required)
- Recorded demo video on Loom, YouTube, or Vimeo — under 3 minutes (required)
- Live product URL (optional but strongly encouraged — build it)
- Traction questions: how many users onboarded, what user problem you're solving

### Demo video script (3 minutes)

Structure your video exactly this way:

1. **0:00–0:30** — Problem statement. "Owncast streamers have no way to charge per second. Subscriptions are the only option. We remove the floor."
2. **0:30–1:00** — Show the viewer pre-authorizing USDC in the browser. Wallet connects, signs, session starts.
3. **1:00–1:45** — Start the stream. Show the creator dashboard. Watch the earnings tick up in real time as seconds pass. Show the agent's rate decision logged ("surge: 12 viewers → $0.002/sec").
4. **1:45–2:15** — Stop the stream. Show the settlement firing. Show the creator's Circle Wallet balance increase.
5. **2:15–2:45** — Brief Mastodon adapter demo — hit your campaign endpoint, show a donation settling via the same core.
6. **2:45–3:00** — Close: "One settlement engine. Two open creator platforms. The same core extends to Jellyfin, PeerTube, Navidrome — all from a single webhook adapter pattern."

### Traction to report

Before submitting, onboard at least:
- 1 test creator (you)
- 2–3 test viewers (colleagues, friends, Discord community members)
- Run at least one real stream with real settlement on testnet
- Report: number of sessions settled, total USDC moved, number of unique wallets

### Submit early

Submit as soon as the Owncast core is working, even before the Mastodon adapter
is done. Update the form submission as you add features. You can submit as many
times as you want before the deadline (June 29).

---

## Reference Links

| Resource | URL |
|----------|-----|
| Hackathon page | https://lepton.thecanteenapp.com |
| Submission form | https://forms.gle/SMqLaw2pMGDe58LFA |
| Canteen Discord | https://discord.gg/rsVfYutFZg |
| Arc Discord | https://discord.com/invite/buildonarc |
| ARC CLI | `uv tool install git+https://github.com/the-canteen-dev/ARC-cli` |
| Arc testnet docs | https://arc-node.thecanteenapp.com |
| Arc chain docs | https://docs.arc.network |
| Circle Nanopayments | https://developers.circle.com/gateway/nanopayments |
| Circle Wallets | https://developers.circle.com/wallets |
| Circle Paymaster | https://developers.circle.com/paymaster |
| Circle API reference | https://developers.circle.com/api-reference |
| Reference implementation | https://github.com/circlefin/arc-nanopayments |
| Canteen agent explainer | https://github.com/the-canteen-dev/circle-agent |
| Owncast repo | https://github.com/owncast/owncast |
| Owncast webhooks source | `services/webhooks/webhooks.go` in above repo |
| Canteen blog post | https://thecanteenapp.com/analysis/2026/05/28/distribution-bootstrap-payments-founders.html |
| Mastodon campaign PR | https://github.com/mastodon/mastodon/pull/37880 |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Submission                         │
│                                                             │
│  ┌──────────────┐    webhooks    ┌─────────────────────┐   │
│  │   Owncast    │ ─────────────► │   Sidecar (Node.js) │   │
│  │  (unmodified)│                │                     │   │
│  └──────────────┘                │  ┌───────────────┐  │   │
│                                  │  │  Session      │  │   │
│  ┌──────────────┐  session start │  │  Accounting   │  │   │
│  │  Viewer UI   │ ─────────────► │  └───────────────┘  │   │
│  │  (Next.js)   │                │  ┌───────────────┐  │   │
│  └──────────────┘                │  │  Rate Agent   │  │   │
│                                  │  │  (surge/disc) │  │   │
│  ┌──────────────┐  campaign API  │  └───────────────┘  │   │
│  │   Mastodon   │ ─────────────► │  ┌───────────────┐  │   │
│  │  (adapter)   │                │  │  Gateway      │  │   │
│  └──────────────┘                │  │  Settlement   │  │   │
│                                  │  └───────┬───────┘  │   │
│                                  └──────────┼──────────┘   │
│                                             │               │
│                                             ▼               │
│                                  ┌─────────────────────┐   │
│                                  │  Circle Gateway     │   │
│                                  │  (Arc testnet)      │   │
│                                  │  batched USDC       │   │
│                                  └─────────┬───────────┘   │
│                                             │               │
│                                             ▼               │
│                                  ┌─────────────────────┐   │
│                                  │  Creator's Circle   │   │
│                                  │  Wallet (USDC)      │   │
│                                  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

*Hackathon: Lepton Agents — Canteen × Circle × Arc | Jun 15 – Jun 29*
*RFB 4 (Streaming & Continuous Payments) + RFB 6 (Creator & Publisher Monetization)*
