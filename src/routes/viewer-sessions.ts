import { randomUUID } from "node:crypto";

import { Router } from "express";
import { z, ZodError } from "zod";

import { config } from "../config.js";
import type { ViewerAuthorization } from "../domain/sessions.js";
import type { LedgerStore } from "../store/ledger-store.js";

const sessionStartSchema = z.object({
  viewerUserId: z.string().min(1),
  walletAddress: z.string().min(1),
  authorizationId: z.string().min(1).optional(),
  spendingCapUSDC: z.coerce.number().positive().max(100).default(1),
  expiresAt: z.string().datetime().optional()
});

export function createViewerSessionRouter(store: LedgerStore) {
  const router = Router();

  router.post("/session/start", async (req, res, next) => {
    try {
      const input = sessionStartSchema.parse(req.body);
      const expiresAt =
        input.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const authorization: ViewerAuthorization = {
        viewerUserId: input.viewerUserId,
        walletAddress: input.walletAddress,
        authorizationId: input.authorizationId ?? randomUUID(),
        spendingCapUSDC: input.spendingCapUSDC.toFixed(6),
        expiresAt,
        createdAt: new Date().toISOString()
      };

      await store.upsertAuthorization(authorization);

      res.status(201).json({
        ok: true,
        viewerUserId: authorization.viewerUserId,
        authorizationId: authorization.authorizationId,
        ratePerSecond: config.BASE_RATE_PER_SECOND,
        spendingCapUSDC: authorization.spendingCapUSDC,
        expiresAt: authorization.expiresAt,
        creatorAddress: config.CREATOR_WALLET_ADDRESS ?? null
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          ok: false,
          error: "invalid_session_start",
          details: error.issues
        });
        return;
      }

      next(error);
    }
  });

  return router;
}
