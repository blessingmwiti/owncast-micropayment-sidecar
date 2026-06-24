import request from "supertest";
import { describe, expect, it } from "vitest";

import express from "express";

import { createRateLimiter } from "./rate-limit.js";

describe("createRateLimiter", () => {
  it("rejects requests over the configured limit", async () => {
    const app = express();
    app.use(createRateLimiter({ maxRequests: 2, windowMs: 60_000 }));
    app.post("/limited", (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).post("/limited").expect(200);
    await request(app).post("/limited").expect(200);
    const limited = await request(app).post("/limited").expect(429);

    expect(limited.body).toEqual({
      ok: false,
      error: "rate_limited"
    });
  });
});
