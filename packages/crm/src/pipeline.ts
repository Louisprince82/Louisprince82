import type { Money } from "@propos/core";

/** Lead pipeline (PART 5). A strict state machine: every transition is
 *  validated and journaled, so the team dashboard and analytics are always
 *  reconstructable from the event log. */

export type LeadStage =
  | "new"
  | "contacted"
  | "viewing-scheduled"
  | "viewed"
  | "offer-made"
  | "negotiation"
  | "closed-won"
  | "closed-lost";

export const STAGE_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  "new": ["contacted", "closed-lost"],
  "contacted": ["viewing-scheduled", "closed-lost"],
  "viewing-scheduled": ["viewed", "contacted", "closed-lost"],
  "viewed": ["offer-made", "viewing-scheduled", "closed-lost"],
  "offer-made": ["negotiation", "closed-lost"],
  "negotiation": ["closed-won", "offer-made", "closed-lost"],
  "closed-won": [],
  "closed-lost": [],
};

export interface LeadEvent {
  at: string; // ISO timestamp
  from: LeadStage;
  to: LeadStage;
  note?: string;
}

export interface Lead {
  id: string;
  listingId: string;
  agentId: string;
  contact: { name: string; phone?: string; email?: string };
  source: "portal" | "ai-agent" | "social" | "referral" | "walk-in" | "whatsapp";
  stage: LeadStage;
  offerAmount?: Money;
  history: LeadEvent[];
  createdAt: string;
}

export class InvalidTransitionError extends Error {
  constructor(from: LeadStage, to: LeadStage) {
    super(`Cannot move lead from '${from}' to '${to}'. Allowed: ${STAGE_TRANSITIONS[from].join(", ") || "(none — terminal stage)"}`);
    this.name = "InvalidTransitionError";
  }
}

export function advanceLead(lead: Lead, to: LeadStage, at: string, note?: string): Lead {
  if (!STAGE_TRANSITIONS[lead.stage].includes(to)) {
    throw new InvalidTransitionError(lead.stage, to);
  }
  return {
    ...lead,
    stage: to,
    history: [...lead.history, { at, from: lead.stage, to, note }],
  };
}

// ---------------------------------------------------------------------------
// Commission tracking
// ---------------------------------------------------------------------------

export interface CommissionSplit {
  agentPct: number; // share of gross commission to the closing agent
  agencyPct: number;
  coBrokePct?: number;
}

export interface CommissionStatement {
  gross: number;
  agent: number;
  agency: number;
  coBroke: number;
}

export function commissionForSale(
  salePrice: number,
  commissionPct: number,
  split: CommissionSplit,
): CommissionStatement {
  const gross = salePrice * (commissionPct / 100);
  const coBroke = gross * ((split.coBrokePct ?? 0) / 100);
  const remainder = gross - coBroke;
  return {
    gross: Math.round(gross),
    agent: Math.round(remainder * (split.agentPct / (split.agentPct + split.agencyPct))),
    agency: Math.round(remainder * (split.agencyPct / (split.agentPct + split.agencyPct))),
    coBroke: Math.round(coBroke),
  };
}

// ---------------------------------------------------------------------------
// In-memory repository (swapped for Postgres in production; same interface)
// ---------------------------------------------------------------------------

export interface LeadRepository {
  save(lead: Lead): Promise<Lead>;
  get(id: string): Promise<Lead | undefined>;
  listByAgent(agentId: string): Promise<Lead[]>;
  pipelineSummary(agentId: string): Promise<Record<LeadStage, number>>;
}

export class InMemoryLeadRepository implements LeadRepository {
  private leads = new Map<string, Lead>();

  async save(lead: Lead): Promise<Lead> {
    this.leads.set(lead.id, lead);
    return lead;
  }

  async get(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async listByAgent(agentId: string): Promise<Lead[]> {
    return [...this.leads.values()].filter((l) => l.agentId === agentId);
  }

  async pipelineSummary(agentId: string): Promise<Record<LeadStage, number>> {
    const summary = Object.fromEntries(
      Object.keys(STAGE_TRANSITIONS).map((s) => [s, 0]),
    ) as Record<LeadStage, number>;
    for (const lead of await this.listByAgent(agentId)) summary[lead.stage]++;
    return summary;
  }
}
