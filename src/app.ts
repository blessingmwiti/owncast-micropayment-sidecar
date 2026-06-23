import express from "express";

import { createOwncastWebhookRouter } from "./routes/owncast-webhooks.js";
import {
  SessionService,
  StaticPricingPolicy
} from "./services/session-service.js";
import { InMemoryLedgerStore, type LedgerStore } from "./store/ledger-store.js";

interface CreateAppOptions {
  store?: LedgerStore;
  ratePerSecond?: number;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const store = options.store ?? new InMemoryLedgerStore();
  const pricingPolicy = new StaticPricingPolicy(options.ratePerSecond ?? 0.001);
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

  app.use(createOwncastWebhookRouter(store, sessions));

  return app;
}
