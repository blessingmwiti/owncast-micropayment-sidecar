import { describe, expect, it } from "vitest";

import { envSchema } from "./config.js";

describe("envSchema", () => {
  it("accepts dry-run defaults", () => {
    expect(envSchema.parse({})).toMatchObject({
      SETTLEMENT_PROVIDER: "dry-run",
      LEDGER_DRIVER: "json"
    });
  });

  it("requires Circle credentials for live settlement", () => {
    const result = envSchema.safeParse({
      SETTLEMENT_PROVIDER: "circle-gateway"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["CIRCLE_API_KEY", "CREATOR_WALLET_ADDRESS"])
      );
    }
  });

  it("rejects an inverted pricing policy", () => {
    const result = envSchema.safeParse({
      MIN_RATE_PER_SECOND: "0.005",
      BASE_RATE_PER_SECOND: "0.001",
      MAX_RATE_PER_SECOND: "0.003"
    });

    expect(result.success).toBe(false);
  });
});
