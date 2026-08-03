# BUILD STATUS REPORT

**Audited:** 2026-08-03 · against the OMNIX PROPERTY OS master specification (Prompt B)
**Method:** direct read of every source file. No code changed in this pass.

---

## 1. Repo map

```
.
├── apps
│   ├── api            Fastify REST API (22 routes) — auth, listings, AI, finance, CRM
│   └── web/public     2 static frontends: portal.html (consumer SPA), index.html (agent studio)
├── packages
│   ├── core           Domain model + 8-country config registry
│   ├── finance        SG BSD/ABSD/SSD, TDSR/MSR/LTV, mortgage, yield engines
│   ├── ai-engine      Listing content generator (11 channels, 6 personas) + rule-based sales agent + Claude provider
│   ├── area-intelligence  Haversine geo scoring over a static 45-amenity SG dataset
│   ├── crm            Lead pipeline state machine + commission splits
│   └── storage        JSON-file persistence: accounts (scrypt auth), listings, leads, sessions
└── docs               Architecture, roadmap, expansion playbook, revenue model
```

**Stack detected:** TypeScript 5.6 monorepo (pnpm workspaces) · Fastify 5 · vanilla-JS static frontends · vitest (55 tests, all passing) · Node 22.
**Not present from the spec stack:** Next.js, Tailwind/shadcn, Prisma, **PostgreSQL/PostGIS**, Redis, BullMQ, S3, Clerk/Supabase, Stripe, MapLibre, Sentry, zod, Typesense.
**Dependencies:** minimal and clean — `fastify` is the only runtime dependency; dev deps are `typescript`, `vitest`, `@types/node`. Nothing unused or duplicated.
**Hosting:** none. Runs locally only. No CI pipeline.

## 2. Feature inventory

| Feature | Files | Status | Blocking issue |
|---|---|---|---|
| Listing CRUD | `apps/api/src/server.ts`, `packages/storage/src/repositories.ts` | **Partial** | Create + read only. No update, delete, or Draft→Pending→Published lifecycle (spec M1). |
| Search / filter | `apps/web/public/portal.html` | **Partial** | Client-side filtering over **8 hardcoded demo listings**. Real API listings are not searchable anywhere. No price/PSF/walk-time/school filters (M4). |
| Map | — | **Absent** | No MapLibre/OneMap tiles anywhere. |
| User auth | `packages/storage/src/accounts.ts` | **Partial** | Email/password + bearer sessions, scrypt-hashed, persisted. **Agent role only** — no buyer/owner/vendor/admin roles (M0 wants 5). |
| Agent profiles | `accounts.ts` | **Partial** | `ceaNumber` is *stored* but **never verified against the CEA Public Register** — a Section-2 non-negotiable. No `cea_status`, no `last_verified_at`, no publish-block for unverified agents. |
| Image upload | — | **Absent** | No S3/storage pipeline; `photos[]` exists in the model but nothing populates it. |
| AI: listing copy | `packages/ai-engine/src/listing-content.ts` | **Complete** (template mode) | 11 channels + 6 personas per listing; single batched LLM call with deterministic fallback. Only EN + one zh channel — no BM/Tamil (M8). |
| AI: sales agent Q&A | `packages/ai-engine/src/sales-agent.ts` | **Complete** (rule-based) | Finance-grounded answers; LLM long-tail unused without API key. Not RAG over amenity payload (M4 "Ask about this area"). |
| AI: neighbourhood intelligence | `packages/area-intelligence/` | **Partial** | Correct architecture (provider interface, scoring, distance buckets) but: **static 45-amenity dataset, not OneMap**; straight-line distance ×1.3 heuristic, **not real walking routes**; no ≤100/300/500/1km buckets; no Liveability pillar maths shown; no postal-code cache (M2 ⭐). |
| AI: interior renders | — | **Absent** | No Kling/image pipeline in code (Kling is connected as an MCP server at session level, not wired into the product). No watermarking. (M3 ⭐) |
| Payments | — | **Absent** | No Stripe, no packages, no EAA generation (M7 ⭐). |
| Admin panel | — | **Absent** | No moderation queue, no audit log, no AI-spend dashboard (M10, §8). |
| Messaging | — | **Absent** | Lead capture exists; no buyer↔agent messaging, no notifications. |
| Mortgage/financing engine | `packages/finance/src/singapore.ts` | **Partial — strong core** | TDSR 55 / MSR 30 / LTV tiers / stress rate / BSD / ABSD / SSD all correctly implemented **and tested** — this is M11.1's heart. But every rate is **hardcoded**, violating the spec's "never hardcode a percentage" rule; no `PolicyParameter` versioning, no per-listing personal repayment on cards (M11.2), no rate comparison or lead routing (M11.3). |
| CRM pipeline | `packages/crm/` | **Complete** (for its scope) | Journaled state machine, ownership enforcement, commission splits. No viewing scheduler, no bulk upload (M8). |

## 3. Data layer

**No database.** Persistence is JSON files with atomic writes (`data/*.json` via `JsonStore`):

| Store | Fields | Populated? |
|---|---|---|
| `agents.json` | id, name, email, passwordHash, ceaNumber?, tier, createdAt | Empty until registration; created at runtime |
| `sessions.json` | token → agentId, createdAt | Runtime |
| `listings.json` | full `Listing` (property, price, agentId, status, photos[]) | Empty in repo; populated via API |
| `leads.json` | contact, source, stage, history[], agentId | Runtime |

**Listing data origin:** direct agent upload via `POST /api/listings` only. The consumer portal's 8 listings are **hardcoded in `portal.html`** and never touch the store — the two halves of the product are not connected.
**Geo data origin:** 45 amenities hand-seeded in `singapore-data.ts` + 45 duplicated client-side in `portal.html` (D01/D04/D09/D10/D15/D18/D19 only). Any address outside those pockets returns an empty area report.
**Relationships** are by string ID with no referential integrity and no migrations. Radius queries are O(n) haversine in JS — fine at 45 rows, unusable at OneMap scale. **PostGIS is genuinely required for M2**, exactly as the spec says.

## 4. External APIs already wired

| API | File | Key present? |
|---|---|---|
| Anthropic Messages API (optional) | `packages/ai-engine/src/provider.ts` | **No** — `ANTHROPIC_API_KEY` unset; system runs in template mode. No `.env` files exist; no env validation (spec wants zod). |
| OneMap / data.gov.sg / URA / LTA / MOE | — | **Not integrated at all.** The entire official data backbone of M2 is absent. |
| Kling, ElevenLabs, n8n, Metricool, Gmail, Calendar, Drive | — | Connected as **session MCP servers** (available to the AI assistant), but **zero product code** calls them. M9's automation spine exists as infrastructure, not as workflows. |

## 5. AI integrations in code

| Call | Model | Prompt location | Cost handling |
|---|---|---|---|
| Listing content polish (1 batched call → all 11 channels) | `claude-sonnet-5` (override: `PROPOS_LLM_MODEL`) | `listing-content.ts` `generate()` | **No `cost_cents` logging** — violates §8. Batched design is good; graceful fallback on failure. |
| Sales-agent long-tail Q&A | same | `sales-agent.ts` `ask()` | Same gap. Rule-based intents answer ~90% without any LLM spend — good cost posture. |

No image, video, or TTS calls exist in code.

## 6. Dead weight

Very little. Notable items:
- `apps/web/public/index.html` (studio) duplicates portal functionality and calls `/api/finance/*` endpoints the portal re-implements client-side; portal.html duplicates the finance/area/content engines in browser JS (~300 lines of parallel logic that will drift from the packages — a maintenance hazard, not dead code).
- `GET /api/area-report` and `POST /api/finance/affordability` are reachable but no UI calls them.
- `docs/` describe far more platform than exists (aspirational, clearly labelled roadmap — keep, but they are not code).

## 7. Top 10 gaps blocking a demo-able MVP (ranked)

1. **Live amenity data (OneMap + data.gov.sg + LTA + MOE)** — M2 is the differentiator and currently runs on 45 fake rows. Nothing else matters until "any Singapore postal code" works.
2. **Real walking times** (OneMap routing) — the spec is explicit that straight-line kills the "feels real" factor.
3. **Postgres + PostGIS + Prisma migration** — JSON files cannot do `ST_DWithin`; blocks M2 at any scale.
4. **Portal ↔ API disconnect** — consumer search must read real published listings, not hardcoded demos.
5. **Listing lifecycle + photo upload (S3)** — no MVP demo without real photos and Draft→Published flow.
6. **CEA Public Register verification** — legal non-negotiable; currently a free-text field.
7. **AI render pipeline (Kling behind `/lib/ai/render.ts`, queued, watermarked)** — second differentiator, entirely absent; MCP connection exists but is not product code.
8. **`PolicyParameter` versioned rate table** — the strong finance engine must stop hardcoding MAS/IRAS rates before M11 ships.
9. **Payments (Stripe) + EAA generation** — no revenue and no compliant engagement without them.
10. **Roles (buyer/owner/vendor/admin) + admin moderation queue** — every module above assumes them.

## 8. Honest verdict

**~15–20% of the Prompt-B MVP exists** — but it is the *right* 15–20%: the deterministic calculation engines (M11.1's TDSR/MSR/LTV/ABSD maths, correct and tested), the content generator (M8), a clean CRM state machine, working auth + persistence, and 55 green tests on a modular architecture whose package boundaries map almost 1-to-1 onto the spec's modules. What exists is production-quality logic on a prototype substrate (JSON files, static data, no cloud).

The three ⭐ differentiators are respectively: **M2** ~25% (architecture right, data fake), **M3** 0%, **M7** 0%. Compliance layer (CEA verify, EAA, PDPA, watermarking): 0%.

**Estimated effort to close the gap to the Phase 1–3 deliverable** (M0–M2 real, M3, M4, M7, M8 basics), reusing the existing engines:

| Workstream | Build-days |
|---|---|
| Postgres/PostGIS/Prisma migration + roles + S3 + env validation (M0) | 6–8 |
| Listing lifecycle + photos + portal wired to live data (M1, M4 core) | 6–8 |
| OneMap/data.gov.sg/LTA/MOE clients + walk-time amenity job + caching + Liveability maths + brief (M2) | 8–10 |
| Kling render pipeline, queue, watermark, rate limits (M3) | 5–7 |
| Stripe packages + EAA generation + savings widget (M7) | 4–6 |
| CEA verification + re-check cron (§2) | 2–3 |
| PolicyParameter versioning refactor (M11 prerequisite) | 2–3 |
| **Total** | **33–45 focused build-days** |

Prerequisites that are decisions/accounts, not code: OneMap + URA + LTA API registrations, cloud Postgres + S3 + hosting accounts, Stripe SG account, Kling/LLM API budget, and the Section-10 listing-supply problem — which no amount of code solves.

**Recommendation:** do not rebuild what exists. Port `finance`, `ai-engine`, `crm`, and the `area-intelligence` interfaces into the spec's Next.js/Prisma substrate as workspace packages — they are the hardest logic and they are already tested. Start with gap #1: ship M2 as the free public address-checker the spec's build order (§9 Phase 1) demands.
