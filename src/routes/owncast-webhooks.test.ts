import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryLedgerStore } from "../store/ledger-store.js";

describe("Owncast webhook receiver", () => {
  it("creates a session from USER_JOINED and ignores duplicate events", async () => {
    const store = new InMemoryLedgerStore();
    const app = createApp({ store, ratePerSecond: 0.002 });
    const payload = {
      id: "event-1",
      type: "USER_JOINED",
      eventData: {
        id: "stream-1",
        timestamp: "2026-06-23T18:00:00.000Z",
        user: { id: "viewer-1" }
      }
    };

    await request(app).post("/webhook").send(payload).expect(202);
    const duplicate = await request(app).post("/webhook").send(payload).expect(202);

    expect(duplicate.body).toEqual({ ok: true, duplicate: true });

    const snapshot = await store.snapshot();
    expect(snapshot.processedEventIds).toEqual(["event-1"]);
    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.sessions[0]).toMatchObject({
      viewerUserId: "viewer-1",
      streamId: "stream-1",
      joinedAt: "2026-06-23T18:00:00.000Z",
      ratePerSecond: 0.002,
      status: "watching",
      settled: false
    });
  });

  it("marks a viewer session as settlement pending when USER_PARTED arrives", async () => {
    const store = new InMemoryLedgerStore();
    const app = createApp({ store, ratePerSecond: 0.001 });

    await request(app)
      .post("/webhook")
      .send({
        id: "join-1",
        type: "USER_JOINED",
        eventData: {
          id: "stream-1",
          timestamp: "2026-06-23T18:00:00.000Z",
          user: { id: "viewer-1" }
        }
      })
      .expect(202);

    await request(app)
      .post("/webhook")
      .send({
        id: "part-1",
        type: "USER_PARTED",
        eventData: {
          id: "stream-1",
          timestamp: "2026-06-23T18:00:42.000Z",
          user: { id: "viewer-1" }
        }
      })
      .expect(202);

    const session = await store.getSession("viewer-1");
    expect(session).toMatchObject({
      watchedSeconds: 42,
      amountUSDC: "0.042000",
      status: "settlement_pending"
    });
  });

  it("marks open sessions as parted when STREAM_STOPPED arrives", async () => {
    const store = new InMemoryLedgerStore();
    const app = createApp({ store, ratePerSecond: 0.001 });

    await request(app)
      .post("/webhook")
      .send({
        id: "join-1",
        type: "USER_JOINED",
        eventData: {
          id: "stream-1",
          timestamp: "2026-06-23T18:00:00.000Z",
          user: { id: "viewer-1" }
        }
      })
      .expect(202);

    await request(app)
      .post("/webhook")
      .send({
        id: "stop-1",
        type: "STREAM_STOPPED",
        eventData: {
          id: "stream-1",
          timestamp: "2026-06-23T18:01:00.000Z"
        }
      })
      .expect(202);

    const session = await store.getSession("viewer-1");
    expect(session).toMatchObject({
      partedAt: "2026-06-23T18:01:00.000Z",
      watchedSeconds: 60,
      amountUSDC: "0.060000",
      status: "settlement_pending"
    });
  });

  it("rejects malformed webhook payloads", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/webhooks/owncast")
      .send({ type: "NOPE" })
      .expect(400);

    expect(response.body).toMatchObject({
      ok: false,
      error: "invalid_owncast_webhook"
    });
  });
});
