import { describe, expect, it } from "vitest";
import type { Listing } from "@propos/core";
import {
  ALL_CHANNELS,
  ALL_PERSONAS,
  ListingContentGenerator,
  ListingSalesAgent,
} from "../src/index.js";

const listing: Listing = {
  id: "L-1001",
  intent: "sale",
  price: { amount: 1_680_000, currency: "SGD" },
  agentId: "A-1",
  photos: [],
  createdAt: "2026-07-18T00:00:00Z",
  status: "active",
  property: {
    id: "P-1001",
    type: "condo",
    address: { line1: "12 Marina Boulevard", district: "D01", country: "SG", geo: { lat: 1.2806, lng: 103.8541 } },
    bedrooms: 3,
    bathrooms: 2,
    floorAreaSqm: 110,
    tenure: { kind: "leasehold", years: 99 },
    features: ["marina view", "renovated kitchen", "high floor"],
  },
};

describe("ListingContentGenerator (template mode)", () => {
  const pack = new ListingContentGenerator(null).generateTemplatePack(listing);

  it("generates every channel", () => {
    for (const c of ALL_CHANNELS) {
      expect(pack.channels[c], `channel ${c}`).toBeTruthy();
      expect(pack.channels[c].length).toBeGreaterThan(40);
    }
  });

  it("generates every persona variant, and they differ", () => {
    for (const p of ALL_PERSONAS) expect(pack.personas[p]).toBeTruthy();
    expect(pack.personas.luxury).not.toEqual(pack.personas.investment);
    expect(pack.personas.family).not.toEqual(pack.personas["young-couple"]);
  });

  it("keeps hard facts in the main description", () => {
    expect(pack.channels.description).toContain("3-bedroom");
    expect(pack.channels.description).toContain("1,184 sqft"); // 110 sqm
    expect(pack.channels.description).toMatch(/1,680,000/);
  });

  it("produces localized Xiaohongshu copy", () => {
    expect(pack.channels.xiaohongshu).toMatch(/[一-鿿]/);
  });

  it("works without an LLM provider via generate()", async () => {
    const p = await new ListingContentGenerator(null).generate(listing);
    expect(p.generatedBy).toBe("template");
  });
});

describe("ListingSalesAgent", () => {
  const agent = new ListingSalesAgent(listing, null);

  it("answers price questions from listing data", async () => {
    const a = await agent.ask("How much is the asking price?");
    expect(a.intent).toBe("price");
    expect(a.answer).toMatch(/1,680,000/);
  });

  it("computes stamp duty via the finance engine", async () => {
    const a = await agent.ask("What stamp duty will I pay?", { buyerProfile: "foreigner" });
    expect(a.intent).toBe("stamp-duty");
    // BSD on 1.68M = 1,800+3,600+19,200+20,000+9,000 = 53,600; ABSD 60% = 1,008,000
    expect(a.answer).toContain("53,600");
    expect(a.answer).toContain("1,008,000");
  });

  it("estimates a monthly instalment", async () => {
    const a = await agent.ask("What would my monthly mortgage payment be?");
    expect(a.intent).toBe("loan");
    expect(a.answer).toMatch(/S\$5,3\d\d/); // ≈ 75% loan at 3%/30y
  });

  it("handles viewing requests", async () => {
    const a = await agent.ask("Can I visit this Saturday?");
    expect(a.intent).toBe("viewing");
  });
});
