import { join } from "node:path";

import express from "express";

import { createOwncastWebhookRouter } from "./routes/owncast-webhooks.js";
import { createMastodonAdapterRouter } from "./routes/mastodon-adapter.js";
import { createViewerSessionRouter } from "./routes/viewer-sessions.js";
import {
  DryRunSettlementProvider,
  SettlementService,
  type SettlementProvider
} from "./services/settlement-service.js";
import {
  SessionService,
  StaticPricingPolicy,
  type PricingPolicy
} from "./services/session-service.js";
import { InMemoryLedgerStore, type LedgerStore } from "./store/ledger-store.js";

interface CreateAppOptions {
  store?: LedgerStore;
  pricingPolicy?: PricingPolicy;
  settlementProvider?: SettlementProvider;
  webhookSecret?: string;
  publicUrl?: string;
  creatorWalletAddress?: string;
  ratePerSecond?: number;
}

interface DecisionPricingPolicy extends PricingPolicy {
  currentDecision(): Promise<unknown>;
}

function hasCurrentDecision(policy: PricingPolicy): policy is DecisionPricingPolicy {
  return "currentDecision" in policy && typeof policy.currentDecision === "function";
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const store = options.store ?? new InMemoryLedgerStore();
  const pricingPolicy =
    options.pricingPolicy ?? new StaticPricingPolicy(options.ratePerSecond ?? 0.001);
  const settlements = new SettlementService(
    store,
    options.settlementProvider ?? new DryRunSettlementProvider()
  );
  const sessions = new SessionService(store, pricingPolicy, settlements);

  app.use(express.json());
  app.use(express.static(join(import.meta.dirname, "..", "public")));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "owncast-payflow"
    });
  });

  app.get("/ledger", async (_req, res, next) => {
    try {
      res.json(await store.snapshot());
    } catch (error) {
      next(error);
    }
  });

  app.get("/agent/rate", async (_req, res, next) => {
    try {
      if (hasCurrentDecision(pricingPolicy)) {
        res.json(await pricingPolicy.currentDecision());
        return;
      }

      res.json({
        ratePerSecond: await pricingPolicy.currentRatePerSecond(),
        rationale: "static rate",
        online: false,
        viewerCount: 0,
        decidedAt: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(createViewerSessionRouter(store, pricingPolicy));
  app.use(
    createMastodonAdapterRouter({
      publicUrl: options.publicUrl ?? "http://localhost:4000",
      creatorWalletAddress: options.creatorWalletAddress,
      settlements
    })
  );
  app.use(
    createOwncastWebhookRouter(store, sessions, {
      webhookSecret: options.webhookSecret
    })
  );

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      void next;
      console.error(error);
      res.status(500).json({
        ok: false,
        error: "internal_server_error"
      });
    }
  );

  return app;
}
