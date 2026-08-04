import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

let app: FastifyInstance;
let dataDir: string;
let token: string;
let listingId: string;
let leadId: string;

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "propos-api-"));
  app = await buildServer({ dataDir });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
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

  it("registers an agent account and authenticates", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Louis Prince", email: "louis@propos.sg", password: "password123", ceaNumber: "R123456A" },
    });
    expect(res.statusCode).toBe(201);
    token = res.json().token;
    expect(token).toBeTruthy();

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${token}` } });
    expect(me.json().email).toBe("louis@propos.sg");

    const dup = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "X", email: "louis@propos.sg", password: "password123" },
    });
    expect(dup.statusCode).toBe(422);

    const badLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "louis@propos.sg", password: "wrong-password" },
    });
    expect(badLogin.statusCode).toBe(401);
  });

  it("rejects listing creation without a session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/listings",
      payload: { property: demoProperty, intent: "sale", price: 1_680_000 },
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates a listing (authenticated) with content pack + area report", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/listings",
      headers: { authorization: `Bearer ${token}` },
      payload: { property: demoProperty, intent: "sale", price: 1_680_000 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    listingId = body.listing.id;
    expect(body.listing.agentId).toMatch(/^agent-/);
    expect(Object.keys(body.contentPack.channels)).toHaveLength(11);
    expect(Object.keys(body.contentPack.personas)).toHaveLength(6);
    expect(body.areaReport.scores.overall).toBeGreaterThan(0);
  });

  it("persists listings across server restarts", async () => {
    const app2 = await buildServer({ dataDir });
    await app2.ready();
    const res = await app2.inject({ method: "GET", url: `/api/listings/${listingId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(listingId);
    // session token also survives the restart
    const me = await app2.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${token}` } });
    expect(me.statusCode).toBe(200);
    await app2.close();
  });

  it("answers buyer questions via the listing's AI sales agent (public)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/listings/${listingId}/ask`,
      payload: { question: "What stamp duty would I pay?", context: { buyerProfile: "citizen" } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().intent).toBe("stamp-duty");
  });

  it("computes stamp duty, mortgage and yield (public)", async () => {
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

  it("captures leads publicly and routes them to the listing agent", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/leads",
      payload: { listingId, contact: { name: "Sarah Lim" }, source: "ai-agent" },
    });
    expect(created.statusCode).toBe(201);
    leadId = created.json().id;
    expect(created.json().agentId).toMatch(/^agent-/);
  });

  it("only the owning agent can manage leads", async () => {
    const anon = await app.inject({ method: "POST", url: `/api/leads/${leadId}/advance`, payload: { to: "contacted" } });
    expect(anon.statusCode).toBe(401);

    const advanced = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/advance`,
      headers: { authorization: `Bearer ${token}` },
      payload: { to: "contacted" },
    });
    expect(advanced.json().stage).toBe("contacted");

    const illegal = await app.inject({
      method: "POST",
      url: `/api/leads/${leadId}/advance`,
      headers: { authorization: `Bearer ${token}` },
      payload: { to: "closed-won" },
    });
    expect(illegal.statusCode).toBe(422);

    const summary = await app.inject({
      method: "GET",
      url: "/api/leads/summary",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(summary.json().contacted).toBe(1);
  });

  it("registers a customer (FSBO) account that can also list", async () => {
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Uncle Lim", email: "lim@home.sg", password: "password123", role: "customer", phone: "+65 9111 2222" },
    });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().agent.role).toBe("customer");
    expect(reg.json().agent.id).toMatch(/^customer-/);

    const res = await app.inject({
      method: "POST",
      url: "/api/listings",
      headers: { authorization: `Bearer ${reg.json().token}` },
      payload: { property: { ...demoProperty, id: "" }, intent: "sale", price: 750_000 },
    });
    expect(res.statusCode).toBe(201);
  });

  it("provides the WhatsApp lead flow and logs the lead", async () => {
    // Lister for `listingId` (registered without phone) → 409 with guidance
    const noPhone = await app.inject({ method: "GET", url: `/api/listings/${listingId}/whatsapp` });
    expect(noPhone.statusCode).toBe(409);

    // Customer with phone creates a listing → WhatsApp link works
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Mdm Ho", email: "ho@home.sg", password: "password123", role: "customer", phone: "+6598765432" },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/listings",
      headers: { authorization: `Bearer ${reg.json().token}` },
      payload: { property: { ...demoProperty, id: "" }, intent: "rent", price: 3_200 },
    });
    const wa = await app.inject({ method: "GET", url: `/api/listings/${created.json().listing.id}/whatsapp?name=Interested Buyer` });
    expect(wa.statusCode).toBe(200);
    expect(wa.json().url).toContain("https://wa.me/6598765432?text=");
    expect(decodeURIComponent(wa.json().url)).toContain(created.json().listing.id);
    expect(wa.json().leadId).toMatch(/^lead-/);
  });

  it("blocks unverified agents from publishing when CEA hard mode is on", async () => {
    const strict = await buildServer({ dataDir, requireCeaVerification: true });
    await strict.ready();
    const res = await strict.inject({
      method: "POST",
      url: "/api/listings",
      headers: { authorization: `Bearer ${token}` }, // agent registered without valid CEA record
      payload: { property: { ...demoProperty, id: "" }, intent: "sale", price: 1_000_000 },
    });
    expect(res.statusCode).toBe(403);
    await strict.close();
  });

  it("serves DRAFT legal pages", async () => {
    const privacy = await app.inject({ method: "GET", url: "/privacy" });
    expect(privacy.statusCode).toBe(200);
    expect(privacy.body).toContain("DRAFT — FOR LEGAL REVIEW");
    const terms = await app.inject({ method: "GET", url: "/terms" });
    expect(terms.body).toContain("not an estate agency");
  });

  it("serves the portal at / and the studio at /studio", async () => {
    const portal = await app.inject({ method: "GET", url: "/" });
    expect(portal.statusCode).toBe(200);
    expect(portal.body).toContain("PropOS");
    const studio = await app.inject({ method: "GET", url: "/studio" });
    expect(studio.statusCode).toBe(200);
    expect(studio.body).toContain("PropOS");
  });
});
