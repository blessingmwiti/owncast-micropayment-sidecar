import express from "express";

import { createOwncastWebhookRouter } from "./routes/owncast-webhooks.js";
import { createViewerSessionRouter } from "./routes/viewer-sessions.js";
import {
  SessionService,
  StaticPricingPolicy,
  type PricingPolicy
} from "./services/session-service.js";
import { InMemoryLedgerStore, type LedgerStore } from "./store/ledger-store.js";

interface CreateAppOptions {
  store?: LedgerStore;
  pricingPolicy?: PricingPolicy;
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
  const sessions = new SessionService(store, pricingPolicy);

  app.use(express.json());

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
        viewerCount: 0,
        decidedAt: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(createViewerSessionRouter(store, pricingPolicy));
  app.use(createOwncastWebhookRouter(store, sessions));

  return app;
}
