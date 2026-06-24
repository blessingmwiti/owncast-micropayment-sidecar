import { describe, expect, it } from "vitest";

import type { LedgerSnapshot } from "../domain/sessions.js";
import { computeDemoMetrics } from "./metrics-service.js";

describe("computeDemoMetrics", () => {
  it("summarizes proof metrics from ledger data", () => {
    const snapshot: LedgerSnapshot = {
      processedEventIds: [],
      authorizations: [
        {
          viewerUserId: "viewer-1",
          walletAddress: "0xone",
          authorizationId: "auth-1",
          spendingCapUSDC: "1.000000",
          acceptedRatePerSecond: 0.001,
          expiresAt: "2099-01-01T00:00:00.000Z",
          createdAt: "2026-06-23T18:00:00.000Z"
        },
        {
          viewerUserId: "viewer-2",
          walletAddress: "0xtwo",
          authorizationId: "auth-2",
          spendingCapUSDC: "1.000000",
          acceptedRatePerSecond: 0.001,
          expiresAt: "2099-01-01T00:00:00.000Z",
          createdAt: "2026-06-23T18:00:00.000Z"
        }
      ],
      settlements: [
        {
          id: "settle-1",
          viewerUserId: "viewer-1",
          streamId: "stream-1",
          provider: "dry-run",
          status: "settled",
          amountUSDC: "0.050000",
          amountUnits: "50000",
          createdAt: "2026-06-23T18:01:00.000Z"
        },
        {
          id: "settle-2",
          viewerUserId: "viewer-2",
          streamId: "stream-1",
          provider: "dry-run",
          status: "failed",
          amountUSDC: "0.010000",
          amountUnits: "10000",
          createdAt: "2026-06-23T18:01:00.000Z"
        }
      ],
      sessions: [
        {
          viewerUserId: "viewer-1",
          streamId: "stream-1",
          joinedAt: "2026-06-23T18:00:00.000Z",
          watchedSeconds: 100,
          ratePerSecond: 0.0005,
          status: "settled",
          settled: true,
          createdAt: "2026-06-23T18:00:00.000Z",
          updatedAt: "2026-06-23T18:01:40.000Z"
        },
        {
          viewerUserId: "viewer-2",
          streamId: "stream-1",
          joinedAt: "2026-06-23T18:00:00.000Z",
          watchedSeconds: 60,
          ratePerSecond: 0.0005,
          status: "settled",
          settled: true,
          createdAt: "2026-06-23T18:00:00.000Z",
          updatedAt: "2026-06-23T18:01:00.000Z"
        }
      ]
    };

    expect(computeDemoMetrics(snapshot)).toEqual({
      uniqueWallets: 2,
      viewerAuthorizations: 2,
      settledSessions: 2,
      failedSettlements: 1,
      totalUSDCSettled: "0.050000",
      averageWatchedSeconds: 80
    });
  });
});
