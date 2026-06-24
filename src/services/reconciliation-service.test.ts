import { describe, expect, it } from "vitest";

import type { ViewerSession } from "../domain/sessions.js";
import { InMemoryLedgerStore } from "../store/ledger-store.js";
import { ReconciliationService } from "./reconciliation-service.js";
import {
  DryRunSettlementProvider,
  SettlementService
} from "./settlement-service.js";

function pendingSession(overrides: Partial<ViewerSession> = {}): ViewerSession {
  return {
    viewerUserId: "viewer-1",
    streamId: "stream-1",
    joinedAt: "2026-06-23T18:00:00.000Z",
    partedAt: "2026-06-23T18:01:00.000Z",
    watchedSeconds: 60,
    ratePerSecond: 0.001,
    amountUSDC: "0.060000",
    spendingCapUSDC: "1.000000",
    status: "settlement_pending",
    settled: false,
    createdAt: "2026-06-23T18:00:00.000Z",
    updatedAt: "2026-06-23T18:01:00.000Z",
    ...overrides
  };
}

describe("ReconciliationService", () => {
  it("retries retryable sessions and records the settlement", async () => {
    const store = new InMemoryLedgerStore();
    await store.upsertSession(pendingSession());
    const settlements = new SettlementService(
      store,
      new DryRunSettlementProvider()
    );
    const reconciliation = new ReconciliationService(store, settlements);

    const result = await reconciliation.reconcile();
    const snapshot = await store.snapshot();

    expect(result).toMatchObject({
      attempted: 1,
      settled: 1,
      failed: 0
    });
    expect(snapshot.sessions[0]).toMatchObject({
      status: "settled",
      settled: true
    });
    expect(snapshot.settlements[0]).toMatchObject({
      provider: "dry-run",
      amountUSDC: "0.060000"
    });
  });

  it("ignores sessions that do not have an amount to settle", async () => {
    const store = new InMemoryLedgerStore();
    await store.upsertSession(
      pendingSession({ amountUSDC: undefined, status: "watching" })
    );
    const settlements = new SettlementService(
      store,
      new DryRunSettlementProvider()
    );
    const reconciliation = new ReconciliationService(store, settlements);

    await expect(reconciliation.reconcile()).resolves.toMatchObject({
      attempted: 0,
      settled: 0,
      failed: 0
    });
  });
});
