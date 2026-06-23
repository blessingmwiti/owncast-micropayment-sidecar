export type SessionStatus =
  | "watching"
  | "parted"
  | "settled"
  | "settlement_pending";

export interface ViewerSession {
  viewerUserId: string;
  streamId: string;
  joinedAt: string;
  partedAt?: string;
  watchedSeconds?: number;
  walletAddress?: string;
  authorizationId?: string;
  ratePerSecond: number;
  amountUSDC?: string;
  status: SessionStatus;
  settled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerSnapshot {
  processedEventIds: string[];
  sessions: ViewerSession[];
}

export function computeWatchedSeconds(joinedAt: string, partedAt: string): number {
  const elapsedMs = new Date(partedAt).getTime() - new Date(joinedAt).getTime();

  return Math.max(0, Math.floor(elapsedMs / 1000));
}
