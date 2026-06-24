import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import type { SettlementRecord, ViewerAuthorization, ViewerSession } from "../domain/sessions.js";
import { JsonLedgerStore, SqliteLedgerStore, type LedgerStore } from "./ledger-store.js";

const tempDirs: string[] = [];

async function tempPath(filename: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "payflow-ledger-"));
  tempDirs.push(dir);
  return join(dir, filename);
}

const authorization: ViewerAuthorization = {
  viewerUserId: "viewer-1",
  walletAddress: "0xviewer",
  authorizationId: "auth-1",
  spendingCapUSDC: "1.000000",
  acceptedRatePerSecond: 0.001,
  expiresAt: "2099-01-01T00:00:00.000Z",
  createdAt: "2026-06-23T18:00:00.000Z"
};

const session: ViewerSession = {
  viewerUserId: "viewer-1",
  streamId: "stream-1",
  joinedAt: "2026-06-23T18:00:00.000Z",
  ratePerSecond: 0.001,
  status: "watching",
  settled: false,
  createdAt: "2026-06-23T18:00:00.000Z",
  updatedAt: "2026-06-23T18:00:00.000Z"
};

const settlement: SettlementRecord = {
  id: "settle-1",
  viewerUserId: "viewer-1",
  streamId: "stream-1",
  provider: "dry-run",
  status: "settled",
  amountUSDC: "0.050000",
  amountUnits: "50000",
  createdAt: "2026-06-23T18:01:00.000Z"
};

async function exerciseStore(store: LedgerStore) {
  await store.markProcessedEvent("event-1");
  await store.upsertAuthorization(authorization);
  await store.upsertSession(session);
  await store.appendSettlement(settlement);

  return store.snapshot();
}

describe("ledger stores", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true })));
  });

  it("persists the ledger through the JSON store", async () => {
    const snapshot = await exerciseStore(
      new JsonLedgerStore(await tempPath("ledger.json"))
    );

    expect(snapshot).toMatchObject({
      processedEventIds: ["event-1"],
      authorizations: [authorization],
      settlements: [settlement],
      sessions: [session]
    });
  });

  it("persists the ledger through the SQLite store", async () => {
    const snapshot = await exerciseStore(
      new SqliteLedgerStore(await tempPath("ledger.sqlite"))
    );

    expect(snapshot).toMatchObject({
      processedEventIds: ["event-1"],
      authorizations: [authorization],
      settlements: [settlement],
      sessions: [session]
    });
  });
});
