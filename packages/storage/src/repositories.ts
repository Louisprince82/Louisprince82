import path from "node:path";
import type { Listing } from "@propos/core";
import type { Lead, LeadRepository, LeadStage } from "@propos/crm";
import { STAGE_TRANSITIONS } from "@propos/crm";
import { JsonStore } from "./json-store.js";

/** Durable listing repository. */
export class PersistentListingRepository {
  private readonly store: JsonStore<Listing>;

  constructor(dataDir: string) {
    this.store = new JsonStore<Listing>(path.join(dataDir, "listings.json"));
  }

  async init(): Promise<void> {
    await this.store.load();
  }

  async save(listing: Listing): Promise<Listing> {
    await this.store.set(listing.id, listing);
    return listing;
  }

  async get(id: string): Promise<Listing | undefined> {
    return this.store.get(id);
  }

  async list(): Promise<Listing[]> {
    return this.store
      .values()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listByAgent(agentId: string): Promise<Listing[]> {
    return (await this.list()).filter((l) => l.agentId === agentId);
  }
}

/** Durable lead repository — same interface as the in-memory CRM repo. */
export class PersistentLeadRepository implements LeadRepository {
  private readonly store: JsonStore<Lead>;

  constructor(dataDir: string) {
    this.store = new JsonStore<Lead>(path.join(dataDir, "leads.json"));
  }

  async init(): Promise<void> {
    await this.store.load();
  }

  async save(lead: Lead): Promise<Lead> {
    await this.store.set(lead.id, lead);
    return lead;
  }

  async get(id: string): Promise<Lead | undefined> {
    return this.store.get(id);
  }

  async listByAgent(agentId: string): Promise<Lead[]> {
    return this.store.values().filter((l) => l.agentId === agentId);
  }

  async pipelineSummary(agentId: string): Promise<Record<LeadStage, number>> {
    const summary = Object.fromEntries(
      Object.keys(STAGE_TRANSITIONS).map((s) => [s, 0]),
    ) as Record<LeadStage, number>;
    for (const lead of await this.listByAgent(agentId)) summary[lead.stage]++;
    return summary;
  }
}
