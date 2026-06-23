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

describe("static app surfaces", () => {
  it("serves the viewer entry page", async () => {
    const response = await request(createApp()).get("/").expect(200);

    expect(response.text).toContain("Owncast Payflow");
    expect(response.text).toContain("Session entry");
  });

  it("serves the creator dashboard", async () => {
    const response = await request(createApp()).get("/dashboard.html").expect(200);

    expect(response.text).toContain("Creator dashboard");
    expect(response.text).toContain("Settlements");
  });
});
