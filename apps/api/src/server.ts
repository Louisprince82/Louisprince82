import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
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
import { advanceLead, commissionForSale, type Lead, type LeadStage } from "@propos/crm";
import { OneMapClient } from "@propos/datasources";
import {
  AccountService,
  AuthError,
  PersistentLeadRepository,
  PersistentListingRepository,
  type PublicAgent,
} from "@propos/storage";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, "../../web/public");
const DEFAULT_DATA_DIR = path.resolve(HERE, "../../../data");

export interface ServerOptions {
  dataDir?: string;
}

export async function buildServer(opts: ServerOptions = {}): Promise<FastifyInstance> {
  const dataDir = opts.dataDir ?? process.env.PROPOS_DATA_DIR ?? DEFAULT_DATA_DIR;
  const app = Fastify({ logger: false });

  const llm = providerFromEnv();
  const contentGenerator = new ListingContentGenerator(llm);
  const areaProvider = new SingaporeStaticProvider();

  const oneMap = OneMapClient.fromEnv();
  const accounts = new AccountService(dataDir);
  const listingRepo = new PersistentListingRepository(dataDir);
  const leadRepo = new PersistentLeadRepository(dataDir);
  await Promise.all([accounts.init(), listingRepo.init(), leadRepo.init()]);

  const bearer = (req: FastifyRequest): string | undefined =>
    req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const currentAgent = (req: FastifyRequest): PublicAgent | undefined =>
    accounts.authenticate(bearer(req));

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

  // ---- Auth (Phase 1) -------------------------------------------------------
  app.post<{ Body: { name: string; email: string; password: string; ceaNumber?: string } }>(
    "/api/auth/register",
    async (req, reply) => {
      const b = req.body ?? ({} as Record<string, never>);
      if (!b.name || !b.email || !b.password) {
        return reply.code(400).send({ error: "name, email and password are required" });
      }
      try {
        return reply.code(201).send(await accounts.register(b));
      } catch (err) {
        if (err instanceof AuthError) return reply.code(422).send({ error: err.message });
        throw err;
      }
    },
  );

  app.post<{ Body: { email: string; password: string } }>("/api/auth/login", async (req, reply) => {
    const b = req.body ?? ({} as Record<string, never>);
    if (!b.email || !b.password) return reply.code(400).send({ error: "email and password are required" });
    try {
      return await accounts.login(b.email, b.password);
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ error: err.message });
      throw err;
    }
  });

  app.post("/api/auth/logout", async (req) => {
    const token = bearer(req);
    if (token) await accounts.logout(token);
    return { ok: true };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const agent = currentAgent(req);
    return agent ?? reply.code(401).send({ error: "not authenticated" });
  });

  // ---- Geocoding (OneMap, spec M2 backbone) ---------------------------------
  app.get<{ Querystring: { q: string } }>("/api/geocode", async (req, reply) => {
    if (!req.query.q?.trim()) return reply.code(400).send({ error: "q query param is required" });
    try {
      return await oneMap.geocode(req.query.q);
    } catch {
      return reply.code(502).send({ error: "OneMap is unreachable right now — try again shortly" });
    }
  });

  // ---- PART 1: AI listing system (agent-authenticated) ----------------------
  app.post<{ Body: { property: Property; intent: "sale" | "rent"; price: number; currency?: string } }>(
    "/api/listings",
    async (req, reply) => {
      const agent = currentAgent(req);
      if (!agent) return reply.code(401).send({ error: "Sign in to create listings" });
      const { property, intent, price, currency = "SGD" } = req.body ?? ({} as Record<string, never>);
      if (!property || !intent || !price) {
        return reply.code(400).send({ error: "property, intent and price are required" });
      }
      // Auto-geocode Singapore addresses when no coordinates were supplied
      // (OneMap search is keyless; failures leave geo unset rather than block).
      if (!property.address.geo && property.address.country === "SG" && property.address.line1) {
        try {
          const match = await oneMap.geocodeOne(
            [property.address.line1, property.address.postalCode].filter(Boolean).join(" "),
          );
          if (match) {
            property.address.geo = match.geo;
            property.address.postalCode ??= match.postalCode;
          }
        } catch {
          // OneMap down — listing still publishes, area report just needs a retry later
        }
      }
      const listing: Listing = {
        id: `L-${randomUUID().slice(0, 8)}`,
        property: { ...property, id: property.id || `P-${randomUUID().slice(0, 8)}`, features: property.features ?? [] },
        intent,
        price: { amount: price, currency },
        agentId: agent.id,
        photos: [],
        createdAt: new Date().toISOString(),
        status: "active",
      };
      await listingRepo.save(listing);
      const contentPack = await contentGenerator.generate(listing);
      const areaReport = listing.property.address.geo
        ? await generateAreaReport(areaProvider, listing.property.address.geo)
        : null;
      return reply.code(201).send({ listing, contentPack, areaReport });
    },
  );

  app.get("/api/listings", async () => listingRepo.list());

  app.get<{ Params: { id: string } }>("/api/listings/:id", async (req, reply) => {
    const listing = await listingRepo.get(req.params.id);
    return listing ?? reply.code(404).send({ error: "listing not found" });
  });

  // ---- PART 4: AI sales agent (public — consumers ask questions) ------------
  app.post<{ Params: { id: string }; Body: { question: string; context?: SalesAgentContext } }>(
    "/api/listings/:id/ask",
    async (req, reply) => {
      const listing = await listingRepo.get(req.params.id);
      if (!listing) return reply.code(404).send({ error: "listing not found" });
      if (!req.body?.question) return reply.code(400).send({ error: "question is required" });
      const salesAgent = new ListingSalesAgent(listing, llm);
      return salesAgent.ask(req.body.question, req.body.context ?? {});
    },
  );

  // ---- PART 2: Area intelligence (public) -----------------------------------
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

  // ---- PART 8: Finance (public) ---------------------------------------------
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
  // Lead capture is public (consumers submit enquiries); managing them is not.
  app.post<{ Body: { listingId: string; contact: Lead["contact"]; source?: Lead["source"] } }>(
    "/api/leads",
    async (req, reply) => {
      const b = req.body;
      if (!b?.contact?.name || !b.listingId) {
        return reply.code(400).send({ error: "contact.name and listingId are required" });
      }
      const listing = await listingRepo.get(b.listingId);
      if (!listing) return reply.code(404).send({ error: "listing not found" });
      const lead: Lead = {
        id: `lead-${randomUUID().slice(0, 8)}`,
        listingId: b.listingId,
        agentId: listing.agentId,
        contact: b.contact,
        source: b.source ?? "portal",
        stage: "new",
        history: [],
        createdAt: new Date().toISOString(),
      };
      return reply.code(201).send(await leadRepo.save(lead));
    },
  );

  app.post<{ Params: { id: string }; Body: { to: LeadStage; note?: string } }>(
    "/api/leads/:id/advance",
    async (req, reply) => {
      const agent = currentAgent(req);
      if (!agent) return reply.code(401).send({ error: "Sign in to manage leads" });
      const lead = await leadRepo.get(req.params.id);
      if (!lead) return reply.code(404).send({ error: "lead not found" });
      if (lead.agentId !== agent.id) return reply.code(403).send({ error: "This lead belongs to another agent" });
      try {
        return await leadRepo.save(advanceLead(lead, req.body.to, new Date().toISOString(), req.body.note));
      } catch (err) {
        return reply.code(422).send({ error: (err as Error).message });
      }
    },
  );

  app.get("/api/leads", async (req, reply) => {
    const agent = currentAgent(req);
    if (!agent) return reply.code(401).send({ error: "Sign in to view leads" });
    return leadRepo.listByAgent(agent.id);
  });

  app.get("/api/leads/summary", async (req, reply) => {
    const agent = currentAgent(req);
    if (!agent) return reply.code(401).send({ error: "Sign in to view your pipeline" });
    return leadRepo.pipelineSummary(agent.id);
  });

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
