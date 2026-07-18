import { describe, expect, it } from "vitest";
import {
  InMemoryLeadRepository,
  InvalidTransitionError,
  advanceLead,
  commissionForSale,
  type Lead,
} from "../src/index.js";

function makeLead(id = "lead-1"): Lead {
  return {
    id,
    listingId: "L-1001",
    agentId: "A-1",
    contact: { name: "Tan Wei Ming", phone: "+65 9123 4567" },
    source: "ai-agent",
    stage: "new",
    history: [],
    createdAt: "2026-07-18T02:00:00Z",
  };
}

describe("lead pipeline state machine", () => {
  it("walks the happy path to closed-won", () => {
    let lead = makeLead();
    const t = "2026-07-18T03:00:00Z";
    for (const stage of ["contacted", "viewing-scheduled", "viewed", "offer-made", "negotiation", "closed-won"] as const) {
      lead = advanceLead(lead, stage, t);
    }
    expect(lead.stage).toBe("closed-won");
    expect(lead.history).toHaveLength(6);
  });

  it("rejects illegal transitions", () => {
    const lead = makeLead();
    expect(() => advanceLead(lead, "offer-made", "2026-07-18T03:00:00Z")).toThrow(InvalidTransitionError);
  });

  it("treats closed stages as terminal", () => {
    let lead = makeLead();
    lead = advanceLead(lead, "closed-lost", "2026-07-18T03:00:00Z");
    expect(() => advanceLead(lead, "contacted", "2026-07-18T04:00:00Z")).toThrow(InvalidTransitionError);
  });
});

describe("commission tracking", () => {
  it("splits a 2% commission on a $1.68M sale", () => {
    const s = commissionForSale(1_680_000, 2, { agentPct: 70, agencyPct: 30 });
    expect(s.gross).toBe(33_600);
    expect(s.agent).toBe(23_520);
    expect(s.agency).toBe(10_080);
    expect(s.coBroke).toBe(0);
  });

  it("handles co-broke splits", () => {
    const s = commissionForSale(1_000_000, 2, { agentPct: 70, agencyPct: 30, coBrokePct: 50 });
    expect(s.coBroke).toBe(10_000);
    expect(s.agent + s.agency).toBe(10_000);
  });
});

describe("repository & pipeline summary", () => {
  it("aggregates the agent dashboard", async () => {
    const repo = new InMemoryLeadRepository();
    await repo.save(makeLead("l1"));
    await repo.save({ ...makeLead("l2"), stage: "contacted" });
    await repo.save({ ...makeLead("l3"), stage: "contacted" });
    const summary = await repo.pipelineSummary("A-1");
    expect(summary["new"]).toBe(1);
    expect(summary["contacted"]).toBe(2);
    expect(summary["closed-won"]).toBe(0);
  });
});
