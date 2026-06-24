import type { LedgerSnapshot } from "../domain/sessions.js";
import type { LedgerStore } from "../store/ledger-store.js";

export interface DemoMetrics {
  uniqueWallets: number;
  viewerAuthorizations: number;
  settledSessions: number;
  failedSettlements: number;
  totalUSDCSettled: string;
  averageWatchedSeconds: number;
}

export function computeDemoMetrics(snapshot: LedgerSnapshot): DemoMetrics {
  const walletAddresses = new Set(
    snapshot.authorizations
      .map((authorization) => authorization.walletAddress)
      .filter(Boolean)
  );
  const settledSessions = snapshot.sessions.filter((session) => session.settled);
  const watchedSessions = settledSessions.filter(
    (session) => typeof session.watchedSeconds === "number"
  );
  const totalWatchedSeconds = watchedSessions.reduce(
    (sum, session) => sum + (session.watchedSeconds ?? 0),
    0
  );
  const totalUSDCSettled = snapshot.settlements
    .filter((settlement) => settlement.status === "settled")
    .reduce((sum, settlement) => sum + Number(settlement.amountUSDC), 0);

  return {
    uniqueWallets: walletAddresses.size,
    viewerAuthorizations: snapshot.authorizations.length,
    settledSessions: settledSessions.length,
    failedSettlements: snapshot.settlements.filter(
      (settlement) => settlement.status === "failed"
    ).length,
    totalUSDCSettled: totalUSDCSettled.toFixed(6),
    averageWatchedSeconds:
      watchedSessions.length > 0
        ? Math.round(totalWatchedSeconds / watchedSessions.length)
        : 0
  };
}

export class MetricsService {
  constructor(private readonly store: LedgerStore) {}

  async current(): Promise<DemoMetrics> {
    return computeDemoMetrics(await this.store.snapshot());
  }
}
