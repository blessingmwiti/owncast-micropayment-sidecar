import { describe, expect, it } from "vitest";

import { PricingAgent } from "./pricing-agent.js";

const policy = {
  baseRatePerSecond: 0.001,
  minRatePerSecond: 0.0005,
  maxRatePerSecond: 0.003
};

describe("PricingAgent", () => {
  it("discounts low viewership", async () => {
    const agent = new PricingAgent(policy, async () => ({ viewerCount: 3 }));

    await expect(agent.currentDecision()).resolves.toMatchObject({
      ratePerSecond: 0.0005,
      rationale: "discount: low viewership (3)",
      viewerCount: 3
    });
  });

  it("raises price for elevated and surge viewership", async () => {
    const elevated = new PricingAgent(policy, async () => ({ viewerCount: 20 }));
    const surge = new PricingAgent(policy, async () => ({ viewerCount: 50 }));

    await expect(elevated.currentDecision()).resolves.toMatchObject({
      ratePerSecond: 0.002,
      rationale: "elevated: 20 concurrent viewers"
    });
    await expect(surge.currentDecision()).resolves.toMatchObject({
      ratePerSecond: 0.003,
      rationale: "surge: 50 concurrent viewers"
    });
  });

  it("falls back to low-viewer discount when Owncast status is unavailable", async () => {
    const agent = new PricingAgent(policy, async () => {
      throw new Error("offline");
    });

    await expect(agent.currentDecision()).resolves.toMatchObject({
      ratePerSecond: 0.0005,
      viewerCount: 0
    });
  });
});
