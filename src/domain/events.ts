import { z } from "zod";

export const owncastWebhookTypes = [
  "USER_JOINED",
  "USER_PARTED",
  "STREAM_STARTED",
  "STREAM_STOPPED"
] as const;

export type OwncastWebhookType = (typeof owncastWebhookTypes)[number];

const userSchema = z
  .object({
    id: z.string().min(1)
  })
  .passthrough();

const eventDataSchema = z
  .object({
    id: z.string().min(1).optional(),
    timestamp: z.string().datetime().optional(),
    user: userSchema.optional()
  })
  .passthrough();

const webhookSchema = z
  .object({
    id: z.string().min(1).optional(),
    type: z.enum(owncastWebhookTypes),
    eventData: eventDataSchema.default({})
  })
  .passthrough();

export type OwncastWebhook = z.infer<typeof webhookSchema>;

export function parseOwncastWebhook(payload: unknown): OwncastWebhook {
  return webhookSchema.parse(payload);
}

export function getWebhookTimestamp(webhook: OwncastWebhook): Date {
  const timestamp = webhook.eventData.timestamp;
  return timestamp ? new Date(timestamp) : new Date();
}

export function getWebhookEventId(webhook: OwncastWebhook): string {
  if (webhook.id) {
    return webhook.id;
  }

  const streamId = webhook.eventData.id ?? "unknown-stream";
  const userId = webhook.eventData.user?.id ?? "stream";
  const timestamp = webhook.eventData.timestamp ?? "no-timestamp";

  return `${webhook.type}:${streamId}:${userId}:${timestamp}`;
}

export function requireWebhookUserId(webhook: OwncastWebhook): string {
  const userId = webhook.eventData.user?.id;

  if (!userId) {
    throw new Error(`${webhook.type} webhook is missing eventData.user.id`);
  }

  return userId;
}

export function getWebhookStreamId(webhook: OwncastWebhook): string {
  return webhook.eventData.id ?? "default";
}
