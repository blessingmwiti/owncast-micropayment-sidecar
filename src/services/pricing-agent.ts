export interface RateDecision {
  ratePerSecond: number;
  rationale: string;
  viewerCount: number;
  decidedAt: string;
}

export interface CreatorPricingPolicy {
  baseRatePerSecond: number;
  minRatePerSecond: number;
  maxRatePerSecond: number;
}

interface OwncastStatus {
  viewerCount?: number;
}

type OwncastStatusFetcher = () => Promise<OwncastStatus>;

export class PricingAgent {
  constructor(
    private readonly policy: CreatorPricingPolicy,
    private readonly fetchOwncastStatus: OwncastStatusFetcher
  ) {}

  async currentRatePerSecond(): Promise<number> {
    const decision = await this.currentDecision();
    return decision.ratePerSecond;
  }

  async currentDecision(): Promise<RateDecision> {
    const status = await this.fetchOwncastStatus().catch(() => ({ viewerCount: 0 }));
    const viewerCount = status.viewerCount ?? 0;
    const rawDecision = this.decide(viewerCount);

    return {
      ...rawDecision,
      viewerCount,
      decidedAt: new Date().toISOString()
    };
  }

  private decide(viewerCount: number): Pick<RateDecision, "ratePerSecond" | "rationale"> {
    if (viewerCount >= 50) {
      return {
        ratePerSecond: this.clamp(this.policy.baseRatePerSecond * 3),
        rationale: `surge: ${viewerCount} concurrent viewers`
      };
    }

    if (viewerCount >= 20) {
      return {
        ratePerSecond: this.clamp(this.policy.baseRatePerSecond * 2),
        rationale: `elevated: ${viewerCount} concurrent viewers`
      };
    }

    if (viewerCount < 5) {
      return {
        ratePerSecond: this.clamp(this.policy.baseRatePerSecond / 2),
        rationale: `discount: low viewership (${viewerCount})`
      };
    }

    return {
      ratePerSecond: this.clamp(this.policy.baseRatePerSecond),
      rationale: "base rate"
    };
  }

  private clamp(rate: number): number {
    return Math.min(
      this.policy.maxRatePerSecond,
      Math.max(this.policy.minRatePerSecond, rate)
    );
  }
}

export function createOwncastStatusFetcher(owncastUrl: string): OwncastStatusFetcher {
  return async () => {
    const response = await fetch(`${owncastUrl}/api/status`);

    if (!response.ok) {
      throw new Error(`Owncast status failed with HTTP ${response.status}`);
    }

    return (await response.json()) as OwncastStatus;
  };
}
