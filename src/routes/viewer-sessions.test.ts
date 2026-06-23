import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryLedgerStore } from "../store/ledger-store.js";

describe("viewer session start", () => {
  it("stores a viewer authorization with a spending cap and expiry", async () => {
    const store = new InMemoryLedgerStore();
    const app = createApp({ store });

    const response = await request(app)
      .post("/session/start")
      .send({
        viewerUserId: "viewer-1",
        walletAddress: "0xviewer",
        authorizationId: "auth-1",
        spendingCapUSDC: 1,
        expiresAt: "2026-06-23T19:00:00.000Z"
      })
      .expect(201);

    expect(response.body).toMatchObject({
      ok: true,
      viewerUserId: "viewer-1",
      authorizationId: "auth-1",
      spendingCapUSDC: "1.000000",
      expiresAt: "2026-06-23T19:00:00.000Z"
    });

    const authorization = await store.getAuthorization("viewer-1");
    expect(authorization).toMatchObject({
      viewerUserId: "viewer-1",
      walletAddress: "0xviewer",
      authorizationId: "auth-1",
      spendingCapUSDC: "1.000000"
    });
  });

  it("attaches a valid authorization when Owncast reports the viewer joined", async () => {
    const store = new InMemoryLedgerStore();
    const app = createApp({ store });

    await request(app)
      .post("/session/start")
      .send({
        viewerUserId: "viewer-1",
        walletAddress: "0xviewer",
        authorizationId: "auth-1",
        spendingCapUSDC: 1,
        expiresAt: "2099-06-23T19:00:00.000Z"
      })
      .expect(201);

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

    const session = await store.getSession("viewer-1");
    expect(session).toMatchObject({
      walletAddress: "0xviewer",
      authorizationId: "auth-1",
      spendingCapUSDC: "1.000000",
      authorizationExpiresAt: "2099-06-23T19:00:00.000Z"
    });
  });

  it("rejects invalid session-start payloads", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/session/start")
      .send({ viewerUserId: "", walletAddress: "" })
      .expect(400);

    expect(response.body).toMatchObject({
      ok: false,
      error: "invalid_session_start"
    });
  });
});
