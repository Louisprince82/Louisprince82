import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

let app: FastifyInstance;
let listingId: string;

beforeAll(async () => {
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const demoProperty = {
  id: "",
  type: "condo",
  address: {
    line1: "12 Marina Boulevard",
    district: "D01",
    country: "SG",
    geo: { lat: 1.2806, lng: 103.8541 },
  },
  bedrooms: 3,
  bathrooms: 2,
  floorAreaSqm: 110,
  tenure: { kind: "leasehold", years: 99 },
  features: ["marina view", "renovated kitchen"],
};

describe("PropOS API", () => {
  it("reports health with country registry", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.countries.find((c: any) => c.code === "SG")?.launched).toBe(true);
    expect(body.countries.length).toBeGreaterThanOrEqual(8);
  });

  it("creates a listing and returns content pack + area report in one call", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/listings",
      payload: { property: demoProperty, intent: "sale", price: 1_680_000 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    listingId = body.listing.id;
    expect(Object.keys(body.contentPack.channels)).toHaveLength(11);
    expect(Object.keys(body.contentPack.personas)).toHaveLength(6);
    expect(body.areaReport.scores.overall).toBeGreaterThan(0);
  });

  it("answers buyer questions via the listing's AI sales agent", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/listings/${listingId}/ask`,
      payload: { question: "What stamp duty would I pay?", context: { buyerProfile: "citizen" } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().intent).toBe("stamp-duty");
  });

  it("computes stamp duty, mortgage and yield", async () => {
    const duty = await app.inject({
      method: "POST",
      url: "/api/finance/stamp-duty",
      payload: { price: 1_500_000, profile: "citizen", propertiesOwned: 0 },
    });
    expect(duty.json().bsd).toBe(44_600);

    const mortgage = await app.inject({
      method: "POST",
      url: "/api/finance/mortgage",
      payload: { principal: 750_000, annualRatePct: 3, tenureYears: 25 },
    });
    expect(mortgage.json().monthlyRepayment).toBe(3557);

    const yld = await app.inject({
      method: "POST",
      url: "/api/finance/yield",
      payload: { purchasePrice: 1_200_000, monthlyRent: 4_000 },
    });
    expect(yld.json().grossYieldPct).toBe(4);
  });

  it("runs a lead through the CRM pipeline", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: { listingId, agentId: "A-1", contact: { name: "Sarah Lim" }, source: "ai-agent" },
    });
    expect(created.statusCode).toBe(201);
    const leadId = created.json().id;

    const advanced = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/advance`,
      payload: { to: "contacted" },
    });
    expect(advanced.json().stage).toBe("contacted");

    const illegal = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/advance`,
      payload: { to: "closed-won" },
    });
    expect(illegal.statusCode).toBe(422);

    const summary = await app.inject({ method: "GET", url: "/api/leads/summary/A-1" });
    expect(summary.json().contacted).toBe(1);
  });

  it("serves the demo dashboard at /", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("PropOS");
  });
});
