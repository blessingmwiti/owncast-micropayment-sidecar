import { randomUUID } from "node:crypto";

import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import { Decimal } from "decimal.js";

import type { SettlementRecord, ViewerSession } from "../domain/sessions.js";
import type { LedgerStore } from "../store/ledger-store.js";

export interface SettlementProviderResult {
  provider: SettlementRecord["provider"];
  transactionId: string;
}

export interface SettlementProvider {
  readonly provider: SettlementRecord["provider"];
  settle(session: ViewerSession, amountUnits: bigint): Promise<SettlementProviderResult>;
}

export class DryRunSettlementProvider implements SettlementProvider {
  readonly provider = "dry-run";

  async settle(
    session: ViewerSession,
    amountUnits: bigint
  ): Promise<SettlementProviderResult> {
    return {
      provider: "dry-run",
      transactionId: `dryrun_${session.viewerUserId}_${amountUnits.toString()}`
    };
  }
}

export class CircleGatewaySettlementProvider implements SettlementProvider {
  readonly provider = "circle-gateway";
  private readonly client: BatchFacilitatorClient;

  constructor(options: { gatewayUrl: string; apiKey?: string }) {
    this.client = new BatchFacilitatorClient({
      url: options.gatewayUrl,
      createAuthHeaders: options.apiKey
        ? async () => {
            const authorization = `Bearer ${options.apiKey}`;
            return {
              verify: { Authorization: authorization },
              settle: { Authorization: authorization },
              supported: { Authorization: authorization }
            };
          }
        : undefined
    });
  }

  async settle(
    session: ViewerSession,
    amountUnits: bigint
  ): Promise<SettlementProviderResult> {
    void amountUnits;

    if (!session.x402PaymentPayload || !session.x402PaymentRequirements) {
      throw new Error("Missing x402 payment payload or payment requirements");
    }

    type PaymentPayload = Parameters<BatchFacilitatorClient["settle"]>[0];
    type PaymentRequirements = Parameters<BatchFacilitatorClient["settle"]>[1];
    const response = await this.client.settle(
      session.x402PaymentPayload as unknown as PaymentPayload,
      session.x402PaymentRequirements as unknown as PaymentRequirements
    );

    if (!response.success) {
      throw new Error(response.errorReason ?? "Circle Gateway settlement failed");
    }

    return {
      provider: "circle-gateway",
      transactionId: response.transaction
    };
  }
}

export function usdcToUnits(amountUSDC: string): bigint {
  const units = new Decimal(amountUSDC).mul(1_000_000);

  if (!units.isInteger() || units.isNegative()) {
    throw new Error(`Invalid USDC amount: ${amountUSDC}`);
  }

  return BigInt(units.toFixed(0));
}

export function assertWithinSpendingCap(session: ViewerSession): void {
  if (!session.amountUSDC || !session.spendingCapUSDC) {
    return;
  }

  if (new Decimal(session.amountUSDC).gt(session.spendingCapUSDC)) {
    throw new Error(
      `Settlement amount ${session.amountUSDC} exceeds cap ${session.spendingCapUSDC}`
    );
  }
}

export class SettlementService {
  constructor(
    private readonly store: LedgerStore,
    private readonly provider: SettlementProvider
  ) {}

  async settleSession(session: ViewerSession): Promise<ViewerSession> {
    if (session.settled) {
      return session;
    }

    if (!session.amountUSDC) {
      return session;
    }

    try {
      assertWithinSpendingCap(session);
      const amountUnits = usdcToUnits(session.amountUSDC);
      const result = await this.provider.settle(session, amountUnits);
      const settlement = this.toSettlementRecord(session, {
        amountUnits,
        provider: result.provider,
        status: "settled",
        transactionId: result.transactionId
      });
      const updated: ViewerSession = {
        ...session,
        status: "settled",
        settled: true,
        updatedAt: settlement.createdAt
      };

      await this.store.appendSettlement(settlement);
      await this.store.upsertSession(updated);
      return updated;
    } catch (error) {
      const settlement = this.toSettlementRecord(session, {
        amountUnits: session.amountUSDC ? usdcToUnits(session.amountUSDC) : 0n,
        provider: this.provider.provider,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown settlement failure"
      });
      const updated: ViewerSession = {
        ...session,
        status: "settlement_failed",
        settled: false,
        updatedAt: settlement.createdAt
      };

      await this.store.appendSettlement(settlement);
      await this.store.upsertSession(updated);
      return updated;
    }
  }

  private toSettlementRecord(
    session: ViewerSession,
    input: {
      amountUnits: bigint;
      provider: SettlementRecord["provider"];
      status: SettlementRecord["status"];
      transactionId?: string;
      error?: string;
    }
  ): SettlementRecord {
    return {
      id: randomUUID(),
      viewerUserId: session.viewerUserId,
      streamId: session.streamId,
      provider: input.provider,
      status: input.status,
      amountUSDC: session.amountUSDC ?? "0.000000",
      amountUnits: input.amountUnits.toString(),
      transactionId: input.transactionId,
      error: input.error,
      createdAt: new Date().toISOString()
    };
  }
}
