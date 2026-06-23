import {
  computeWatchedSeconds,
  type ViewerSession
} from "../domain/sessions.js";
import type { LedgerStore } from "../store/ledger-store.js";
import type { SettlementService } from "./settlement-service.js";

export interface PricingPolicy {
  currentRatePerSecond(): Promise<number>;
}

export class StaticPricingPolicy implements PricingPolicy {
  constructor(private readonly ratePerSecond: number) {}

  async currentRatePerSecond(): Promise<number> {
    return this.ratePerSecond;
  }
}

export class SessionService {
  constructor(
    private readonly store: LedgerStore,
    private readonly pricingPolicy: PricingPolicy,
    private readonly settlements?: SettlementService
  ) {}

  async startSession(input: {
    viewerUserId: string;
    streamId: string;
    joinedAt: Date;
  }): Promise<ViewerSession> {
    const now = new Date().toISOString();
    const existing = await this.store.getSession(input.viewerUserId);

    if (existing && !existing.settled) {
      return existing;
    }

    const session: ViewerSession = {
      viewerUserId: input.viewerUserId,
      streamId: input.streamId,
      joinedAt: input.joinedAt.toISOString(),
      ratePerSecond: await this.pricingPolicy.currentRatePerSecond(),
      status: "watching",
      settled: false,
      createdAt: now,
      updatedAt: now
    };

    const authorization = await this.store.getAuthorization(input.viewerUserId);
    if (authorization && new Date(authorization.expiresAt).getTime() > Date.now()) {
      session.walletAddress = authorization.walletAddress;
      session.authorizationId = authorization.authorizationId;
      session.spendingCapUSDC = authorization.spendingCapUSDC;
      session.ratePerSecond = authorization.acceptedRatePerSecond;
      session.authorizationExpiresAt = authorization.expiresAt;
      session.x402PaymentPayload = authorization.x402PaymentPayload;
      session.x402PaymentRequirements = authorization.x402PaymentRequirements;
    }

    await this.store.upsertSession(session);
    return session;
  }

  async markParted(input: {
    viewerUserId: string;
    partedAt: Date;
  }): Promise<ViewerSession | undefined> {
    const session = await this.store.getSession(input.viewerUserId);

    if (!session || session.settled) {
      return session;
    }

    const partedAt = input.partedAt.toISOString();
    const watchedSeconds = computeWatchedSeconds(session.joinedAt, partedAt);
    const updated: ViewerSession = {
      ...session,
      partedAt,
      watchedSeconds,
      amountUSDC: (watchedSeconds * session.ratePerSecond).toFixed(6),
      status: "settlement_pending",
      updatedAt: new Date().toISOString()
    };

    await this.store.upsertSession(updated);
    return this.settlements ? this.settlements.settleSession(updated) : updated;
  }

  async markOpenSessionsParted(input: {
    streamId?: string;
    partedAt: Date;
  }): Promise<ViewerSession[]> {
    const openSessions = await this.store.listOpenSessions(input.streamId);
    const partedSessions: ViewerSession[] = [];

    for (const session of openSessions) {
      const partedSession = await this.markParted({
        viewerUserId: session.viewerUserId,
        partedAt: input.partedAt
      });

      if (partedSession) {
        partedSessions.push(partedSession);
      }
    }

    return partedSessions;
  }
}
