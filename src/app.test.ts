import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

describe("health endpoint", () => {
  it("returns service status", async () => {
    const response = await request(createApp()).get("/health").expect(200);

    expect(response.body).toEqual({
      ok: true,
      service: "owncast-payflow"
    });
  });
});
