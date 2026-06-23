export type SessionStatus =
  | "watching"
  | "parted"
  | "settled"
  | "settlement_pending"
  | "settlement_failed";

export interface ViewerSession {
  viewerUserId: string;
  streamId: string;
  joinedAt: string;
  partedAt?: string;
  watchedSeconds?: number;
  walletAddress?: string;
  authorizationId?: string;
  spendingCapUSDC?: string;
  authorizationExpiresAt?: string;
  ratePerSecond: number;
  amountUSDC?: string;
  status: SessionStatus;
  settled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerSnapshot {
  processedEventIds: string[];
  authorizations: ViewerAuthorization[];
  settlements: SettlementRecord[];
  sessions: ViewerSession[];
}

export interface ViewerAuthorization {
  viewerUserId: string;
  walletAddress: string;
  authorizationId: string;
  spendingCapUSDC: string;
  acceptedRatePerSecond: number;
  expiresAt: string;
  createdAt: string;
}

export interface SettlementRecord {
  id: string;
  viewerUserId: string;
  streamId: string;
  provider: "dry-run" | "circle-gateway";
  status: "settled" | "failed";
  amountUSDC: string;
  amountUnits: string;
  transactionId?: string;
  error?: string;
  createdAt: string;
}

export function computeWatchedSeconds(joinedAt: string, partedAt: string): number {
  const elapsedMs = new Date(partedAt).getTime() - new Date(joinedAt).getTime();

  return Math.max(0, Math.floor(elapsedMs / 1000));
}
