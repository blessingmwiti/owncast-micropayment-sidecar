import { Router } from "express";
import { ZodError } from "zod";

import {
  getWebhookEventId,
  getWebhookStreamId,
  getWebhookTimestamp,
  parseOwncastWebhook,
  requireWebhookUserId
} from "../domain/events.js";
import type { LedgerStore } from "../store/ledger-store.js";
import type { SessionService } from "../services/session-service.js";

export function createOwncastWebhookRouter(
  store: LedgerStore,
  sessions: SessionService,
  options: { webhookSecret?: string } = {}
) {
  const router = Router();

  router.post(["/webhook", "/webhooks/owncast"], async (req, res, next) => {
    try {
      if (options.webhookSecret) {
        const header = req.header("x-payflow-webhook-secret");

        if (header !== options.webhookSecret) {
          res.status(401).json({ ok: false, error: "invalid_webhook_secret" });
          return;
        }
      }

      const webhook = parseOwncastWebhook(req.body);
      const eventId = getWebhookEventId(webhook);

      if (await store.hasProcessedEvent(eventId)) {
        res.status(202).json({ ok: true, duplicate: true });
        return;
      }

      switch (webhook.type) {
        case "USER_JOINED":
          await sessions.startSession({
            viewerUserId: requireWebhookUserId(webhook),
            streamId: getWebhookStreamId(webhook),
            joinedAt: getWebhookTimestamp(webhook)
          });
          break;
        case "USER_PARTED":
          await sessions.markParted({
            viewerUserId: requireWebhookUserId(webhook),
            partedAt: getWebhookTimestamp(webhook)
          });
          break;
        case "STREAM_STOPPED":
          await sessions.markOpenSessionsParted({
            streamId: getWebhookStreamId(webhook),
            partedAt: getWebhookTimestamp(webhook)
          });
          break;
        case "STREAM_STARTED":
          break;
      }

      await store.markProcessedEvent(eventId);
      res.status(202).json({ ok: true, duplicate: false });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          ok: false,
          error: "invalid_owncast_webhook",
          details: error.issues
        });
        return;
      }

      next(error);
    }
  });

  return router;
}
