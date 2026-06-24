import { join } from "node:path";

import express from "express";

import { requireAdminToken } from "./middleware/admin-auth.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { createAdminRouter } from "./routes/admin.js";
import { createOwncastWebhookRouter } from "./routes/owncast-webhooks.js";
import { createMastodonAdapterRouter } from "./routes/mastodon-adapter.js";
import { createViewerSessionRouter } from "./routes/viewer-sessions.js";
import {
  DryRunSettlementProvider,
  SettlementService,
  type SettlementProvider
} from "./services/settlement-service.js";
import { ReconciliationService } from "./services/reconciliation-service.js";
import { MetricsService } from "./services/metrics-service.js";
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
  creatorDashboardToken?: string;
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
  const reconciliation = new ReconciliationService(store, settlements);
  const metrics = new MetricsService(store);
  const sessions = new SessionService(store, pricingPolicy, settlements);
  const publicDir = join(import.meta.dirname, "..", "public");
  const adminAuth = requireAdminToken(options.creatorDashboardToken);
  const publicMutationLimiter = createRateLimiter({
    maxRequests: 60,
    windowMs: 60_000
  });

  app.use(express.json());

  app.get("/", (_req, res) => {
    res.sendFile(join(publicDir, "index.html"));
  });

  app.get("/dashboard.html", adminAuth, (_req, res) => {
    res.sendFile(join(publicDir, "dashboard.html"));
  });

  app.use(express.static(publicDir, { index: false }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "owncast-payflow"
    });
  });

  app.get("/ledger", adminAuth, async (_req, res, next) => {
    try {
      res.json(await store.snapshot());
    } catch (error) {
      next(error);
    }
  });

  app.get("/metrics", adminAuth, async (_req, res, next) => {
    try {
      res.json(await metrics.current());
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

  app.use("/session", publicMutationLimiter);
  app.use("/donate", publicMutationLimiter);

  app.use(
    createAdminRouter({
      adminToken: options.creatorDashboardToken,
      reconciliation
    })
  );
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
