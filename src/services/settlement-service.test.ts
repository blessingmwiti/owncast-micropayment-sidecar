import { describe, expect, it } from "vitest";

import type { ViewerSession } from "../domain/sessions.js";
import { InMemoryLedgerStore } from "../store/ledger-store.js";
import {
  DryRunSettlementProvider,
  SettlementService,
  assertWithinSpendingCap,
  usdcToUnits
} from "./settlement-service.js";

const baseSession: ViewerSession = {
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
  updatedAt: "2026-06-23T18:01:00.000Z"
};

describe("settlement service", () => {
  it("converts USDC to 6-decimal minor units", () => {
    expect(usdcToUnits("0.060000")).toBe(60_000n);
    expect(usdcToUnits("1.000001")).toBe(1_000_001n);
  });

  it("rejects settlement amounts above the accepted spending cap", () => {
    expect(() =>
      assertWithinSpendingCap({
        ...baseSession,
        amountUSDC: "1.100000",
        spendingCapUSDC: "1.000000"
      })
    ).toThrow("exceeds cap");
  });

  it("stores a dry-run settlement record and marks the session settled", async () => {
    const store = new InMemoryLedgerStore();
    const service = new SettlementService(store, new DryRunSettlementProvider());

    const settled = await service.settleSession(baseSession);
    const snapshot = await store.snapshot();

    expect(settled).toMatchObject({
      status: "settled",
      settled: true
    });
    expect(snapshot.settlements[0]).toMatchObject({
      provider: "dry-run",
      status: "settled",
      amountUSDC: "0.060000",
      amountUnits: "60000"
    });
  });
});
