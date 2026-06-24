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

  it("serves the donation page", async () => {
    const response = await request(createApp()).get("/donate.html").expect(200);

    expect(response.text).toContain("Payflow donation");
    expect(response.text).toContain("Donation");
  });
});

describe("admin surface protection", () => {
  it("protects the dashboard and ledger when an admin token is configured", async () => {
    const app = createApp({ creatorDashboardToken: "top-secret" });

    await request(app).get("/dashboard.html").expect(401);
    await request(app).get("/ledger").expect(401);

    await request(app)
      .get("/dashboard.html?token=top-secret")
      .expect("set-cookie", /payflow_admin_token=top-secret/)
      .expect(200);

    await request(app)
      .get("/ledger")
      .set("x-payflow-admin-token", "top-secret")
      .expect(200);
  });

  it("leaves dashboard and ledger open for local demos when no token is configured", async () => {
    const app = createApp();

    await request(app).get("/dashboard.html").expect(200);
    await request(app).get("/ledger").expect(200);
  });

  it("protects reconciliation when an admin token is configured", async () => {
    const app = createApp({ creatorDashboardToken: "top-secret" });

    await request(app).post("/admin/reconcile").expect(401);
    await request(app)
      .post("/admin/reconcile")
      .set("x-payflow-admin-token", "top-secret")
      .expect(200);
  });

  it("protects metrics when an admin token is configured", async () => {
    const app = createApp({ creatorDashboardToken: "top-secret" });

    await request(app).get("/metrics").expect(401);
    await request(app)
      .get("/metrics")
      .set("x-payflow-admin-token", "top-secret")
      .expect(200);
  });
});
