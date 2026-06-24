import { Router } from "express";

import { requireAdminToken } from "../middleware/admin-auth.js";
import type { ReconciliationService } from "../services/reconciliation-service.js";

export function createAdminRouter(options: {
  adminToken?: string;
  reconciliation: ReconciliationService;
}) {
  const router = Router();
  const adminAuth = requireAdminToken(options.adminToken);

  router.post("/admin/reconcile", adminAuth, async (_req, res, next) => {
    try {
      res.json({
        ok: true,
        result: await options.reconciliation.reconcile()
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
