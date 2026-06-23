import { Router } from "express";
import { z, ZodError } from "zod";

import type { ViewerSession } from "../domain/sessions.js";
import type { SettlementService } from "../services/settlement-service.js";

const donationSchema = z.object({
  viewerUserId: z.string().min(1).default("mastodon-donor"),
  walletAddress: z.string().min(1).optional(),
  amountUSDC: z.coerce.number().positive().max(100),
  spendingCapUSDC: z.coerce.number().positive().max(100).optional(),
  x402PaymentPayload: z.record(z.string(), z.unknown()).optional(),
  x402PaymentRequirements: z.record(z.string(), z.unknown()).optional()
});

export function createMastodonAdapterRouter(options: {
  publicUrl: string;
  creatorWalletAddress?: string;
  settlements: SettlementService;
}) {
  const router = Router();

  router.get("/mastodon/campaigns", (req, res) => {
    const locale = typeof req.query.locale === "string" ? req.query.locale : "en";
    const environment =
      typeof req.query.environment === "string" ? req.query.environment : "test";

    res.json({
      id: "owncast-payflow-creator",
      locale,
      environment,
      title: "Support the Owncast creator",
      description:
        "A direct USDC campaign that settles through the same Payflow engine as per-second livestream access.",
      goal_amount: "100.00",
      currency: "USDC",
      donation_url: `${options.publicUrl}/donate/owncast-payflow-creator`,
      creator_wallet: options.creatorWalletAddress ?? null
    });
  });

  router.post("/donate/:campaignId", async (req, res, next) => {
    try {
      const input = donationSchema.parse(req.body);
      const amountUSDC = input.amountUSDC.toFixed(6);
      const spendingCapUSDC = (input.spendingCapUSDC ?? input.amountUSDC).toFixed(6);
      const now = new Date().toISOString();
      const donationSession: ViewerSession = {
        viewerUserId: input.viewerUserId,
        streamId: req.params.campaignId,
        joinedAt: now,
        partedAt: now,
        watchedSeconds: 0,
        walletAddress: input.walletAddress,
        ratePerSecond: 0,
        amountUSDC,
        spendingCapUSDC,
        status: "settlement_pending",
        settled: false,
        createdAt: now,
        updatedAt: now,
        x402PaymentPayload: input.x402PaymentPayload,
        x402PaymentRequirements: input.x402PaymentRequirements
      };
      const settled = await options.settlements.settleSession(donationSession);

      res.status(settled.settled ? 201 : 202).json({
        ok: settled.settled,
        campaignId: req.params.campaignId,
        status: settled.status,
        amountUSDC: settled.amountUSDC
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          ok: false,
          error: "invalid_donation",
          details: error.issues
        });
        return;
      }

      next(error);
    }
  });

  return router;
}
