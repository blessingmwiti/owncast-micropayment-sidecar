import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryLedgerStore } from "../store/ledger-store.js";

describe("Mastodon donation campaign adapter", () => {
  it("returns a single external campaign object Mastodon can cache", async () => {
    const app = createApp({
      publicUrl: "https://payflow.example",
      creatorWalletAddress: "0xcreator"
    });

    const response = await request(app)
      .get("/mastodon/campaigns?locale=fr&environment=preview")
      .expect(200);

    expect(response.body).toMatchObject({
      id: "owncast-payflow-creator",
      locale: "fr",
      environment: "preview",
      currency: "USDC",
      donation_url: "https://payflow.example/donate/owncast-payflow-creator",
      creator_wallet: "0xcreator"
    });
  });

  it("settles a dry-run donation through the shared settlement core", async () => {
    const store = new InMemoryLedgerStore();
    const app = createApp({ store });

    const response = await request(app)
      .post("/donate/owncast-payflow-creator")
      .send({
        viewerUserId: "donor-1",
        walletAddress: "0xdonor",
        amountUSDC: "2.50"
      })
      .expect(201);

    expect(response.body).toMatchObject({
      ok: true,
      campaignId: "owncast-payflow-creator",
      status: "settled",
      amountUSDC: "2.500000"
    });

    const snapshot = await store.snapshot();
    expect(snapshot.settlements[0]).toMatchObject({
      viewerUserId: "donor-1",
      streamId: "owncast-payflow-creator",
      provider: "dry-run",
      amountUSDC: "2.500000",
      amountUnits: "2500000"
    });
  });
});
