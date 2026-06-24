import type { ViewerSession } from "../domain/sessions.js";
import type { LedgerStore } from "../store/ledger-store.js";
import type { SettlementService } from "./settlement-service.js";

export interface ReconciliationResult {
  attempted: number;
  settled: number;
  failed: number;
  sessions: ViewerSession[];
}

function shouldRetrySettlement(session: ViewerSession): boolean {
  return (
    !session.settled &&
    Boolean(session.amountUSDC) &&
    (session.status === "settlement_pending" ||
      session.status === "settlement_failed")
  );
}

export class ReconciliationService {
  constructor(
    private readonly store: LedgerStore,
    private readonly settlements: SettlementService
  ) {}

  async reconcile(): Promise<ReconciliationResult> {
    const snapshot = await this.store.snapshot();
    const retryable = snapshot.sessions.filter(shouldRetrySettlement);
    const reconciled: ViewerSession[] = [];

    for (const session of retryable) {
      reconciled.push(await this.settlements.settleSession(session));
    }

    return {
      attempted: retryable.length,
      settled: reconciled.filter((session) => session.settled).length,
      failed: reconciled.filter((session) => !session.settled).length,
      sessions: reconciled
    };
  }
}
