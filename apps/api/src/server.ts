import Fastify, { type FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { listCountries, type Listing, type Property } from "@propos/core";
import {
  ListingContentGenerator,
  ListingSalesAgent,
  providerFromEnv,
  type SalesAgentContext,
} from "@propos/ai-engine";
import { SingaporeStaticProvider, generateAreaReport } from "@propos/area-intelligence";
import {
  affordabilitySG,
  grossRentalYieldPct,
  monthlyCashFlow,
  monthlyRepayment,
  netRentalYieldPct,
  stampDutySG,
  totalInterest,
  type AffordabilityInput,
  type BuyerProfile,
} from "@propos/finance";
import {
  InMemoryLeadRepository,
  advanceLead,
  commissionForSale,
  type Lead,
  type LeadStage,
} from "@propos/crm";

const WEB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../web/public",
);

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false });

  const llm = providerFromEnv();
  const contentGenerator = new ListingContentGenerator(llm);
  const areaProvider = new SingaporeStaticProvider();
  const leadRepo = new InMemoryLeadRepository();
  const listings = new Map<string, Listing>();

  // ---- Web UI ---------------------------------------------------------------
  // "/" is the consumer portal (fully standalone — also works opened as a file);
  // "/studio" is the agent listing-creation demo wired to the live API.
  app.get("/", async (_req, reply) => {
    const html = await readFile(path.join(WEB_ROOT, "portal.html"), "utf8");
    reply.type("text/html").send(html);
  });

  app.get("/studio", async (_req, reply) => {
    const html = await readFile(path.join(WEB_ROOT, "index.html"), "utf8");
    reply.type("text/html").send(html);
  });

  app.get("/api/health", async () => ({
    status: "ok",
    llmProvider: llm?.name ?? "template",
    countries: listCountries().map((c) => ({ code: c.code, name: c.name, launched: c.launched })),
  }));

  app.get("/api/countries", async () => listCountries());

  // ---- PART 1: AI listing system -------------------------------------------
  app.post<{ Body: { property: Property; intent: "sale" | "rent"; price: number; currency?: string; agentId?: string } }>(
    "/api/listings",
    async (req, reply) => {
      const { property, intent, price, currency = "SGD", agentId = "demo-agent" } = req.body;
      if (!property || !intent || !price) {
        return reply.code(400).send({ error: "property, intent and price are required" });
      }
      const listing: Listing = {
        id: `L-${randomUUID().slice(0, 8)}`,
        property: { ...property, id: property.id || `P-${randomUUID().slice(0, 8)}`, features: property.features ?? [] },
        intent,
        price: { amount: price, currency },
        agentId,
        photos: [],
        createdAt: new Date().toISOString(),
        status: "active",
      };
      listings.set(listing.id, listing);
      const contentPack = await contentGenerator.generate(listing);
      const areaReport = listing.property.address.geo
        ? await generateAreaReport(areaProvider, listing.property.address.geo)
        : null;
      return reply.code(201).send({ listing, contentPack, areaReport });
    },
  );

  app.get("/api/listings", async () => [...listings.values()]);

  app.get<{ Params: { id: string } }>("/api/listings/:id", async (req, reply) => {
    const listing = listings.get(req.params.id);
    return listing ?? reply.code(404).send({ error: "listing not found" });
  });

  // ---- PART 4: AI sales agent ----------------------------------------------
  app.post<{ Params: { id: string }; Body: { question: string; context?: SalesAgentContext } }>(
    "/api/listings/:id/ask",
    async (req, reply) => {
      const listing = listings.get(req.params.id);
      if (!listing) return reply.code(404).send({ error: "listing not found" });
      if (!req.body?.question) return reply.code(400).send({ error: "question is required" });
      const agent = new ListingSalesAgent(listing, llm);
      return agent.ask(req.body.question, req.body.context ?? {});
    },
  );

  // ---- PART 2: Area intelligence -------------------------------------------
  app.get<{ Querystring: { lat: string; lng: string; radius?: string } }>(
    "/api/area-report",
    async (req, reply) => {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return reply.code(400).send({ error: "lat and lng query params are required" });
      }
      return generateAreaReport(areaProvider, { lat, lng }, Number(req.query.radius) || 1500);
    },
  );

  // ---- PART 8: Finance ------------------------------------------------------
  app.post<{ Body: { price: number; profile?: BuyerProfile; propertiesOwned?: number } }>(
    "/api/finance/stamp-duty",
    async (req, reply) => {
      if (!req.body?.price) return reply.code(400).send({ error: "price is required" });
      return stampDutySG(req.body.price, req.body.profile ?? "citizen", req.body.propertiesOwned ?? 0);
    },
  );

  app.post<{ Body: { principal: number; annualRatePct: number; tenureYears: number } }>(
    "/api/finance/mortgage",
    async (req, reply) => {
      const { principal, annualRatePct, tenureYears } = req.body ?? {};
      if (!principal || !tenureYears) return reply.code(400).send({ error: "principal and tenureYears are required" });
      const input = { principal, annualRatePct: annualRatePct ?? 3, tenureYears };
      return {
        monthlyRepayment: Math.round(monthlyRepayment(input)),
        totalInterest: Math.round(totalInterest(input)),
        totalPayable: Math.round(monthlyRepayment(input) * tenureYears * 12),
      };
    },
  );

  app.post<{ Body: Partial<AffordabilityInput> }>("/api/finance/affordability", async (req, reply) => {
    const b = req.body ?? {};
    if (!b.grossMonthlyIncome) return reply.code(400).send({ error: "grossMonthlyIncome is required" });
    return affordabilitySG({
      grossMonthlyIncome: b.grossMonthlyIncome,
      monthlyDebtObligations: b.monthlyDebtObligations ?? 0,
      tenureYears: b.tenureYears ?? 30,
      isHdbOrEc: b.isHdbOrEc ?? false,
      existingHousingLoans: b.existingHousingLoans ?? 0,
      cashAndCpfAvailable: b.cashAndCpfAvailable ?? 0,
      interestRatePct: b.interestRatePct,
    });
  });

  app.post<{ Body: { purchasePrice: number; monthlyRent: number; annualExpenses?: number; monthlyMortgage?: number; monthlyMaintenance?: number } }>(
    "/api/finance/yield",
    async (req, reply) => {
      const b = req.body ?? {};
      if (!b.purchasePrice || !b.monthlyRent) {
        return reply.code(400).send({ error: "purchasePrice and monthlyRent are required" });
      }
      return {
        grossYieldPct: +grossRentalYieldPct(b).toFixed(2),
        netYieldPct: +netRentalYieldPct(b).toFixed(2),
        monthlyCashFlow: b.monthlyMortgage !== undefined
          ? Math.round(monthlyCashFlow({
              monthlyRent: b.monthlyRent,
              monthlyMortgage: b.monthlyMortgage,
              monthlyMaintenance: b.monthlyMaintenance ?? 0,
            }))
          : undefined,
      };
    },
  );

  // ---- PART 5: CRM ----------------------------------------------------------
  app.post<{ Body: Omit<Lead, "id" | "stage" | "history" | "createdAt"> }>("/api/leads", async (req, reply) => {
    const b = req.body;
    if (!b?.contact?.name || !b.listingId) {
      return reply.code(400).send({ error: "contact.name and listingId are required" });
    }
    const lead: Lead = {
      ...b,
      id: `lead-${randomUUID().slice(0, 8)}`,
      agentId: b.agentId ?? "demo-agent",
      source: b.source ?? "portal",
      stage: "new",
      history: [],
      createdAt: new Date().toISOString(),
    };
    return reply.code(201).send(await leadRepo.save(lead));
  });

  app.post<{ Params: { id: string }; Body: { to: LeadStage; note?: string } }>(
    "/api/leads/:id/advance",
    async (req, reply) => {
      const lead = await leadRepo.get(req.params.id);
      if (!lead) return reply.code(404).send({ error: "lead not found" });
      try {
        return await leadRepo.save(advanceLead(lead, req.body.to, new Date().toISOString(), req.body.note));
      } catch (err) {
        return reply.code(422).send({ error: (err as Error).message });
      }
    },
  );

  app.get<{ Params: { agentId: string } }>("/api/leads/summary/:agentId", async (req) =>
    leadRepo.pipelineSummary(req.params.agentId),
  );

  app.post<{ Body: { salePrice: number; commissionPct?: number; agentPct?: number; agencyPct?: number; coBrokePct?: number } }>(
    "/api/crm/commission",
    async (req, reply) => {
      const b = req.body ?? {};
      if (!b.salePrice) return reply.code(400).send({ error: "salePrice is required" });
      return commissionForSale(b.salePrice, b.commissionPct ?? 2, {
        agentPct: b.agentPct ?? 70,
        agencyPct: b.agencyPct ?? 30,
        coBrokePct: b.coBrokePct,
      });
    },
  );

  return app;
}
