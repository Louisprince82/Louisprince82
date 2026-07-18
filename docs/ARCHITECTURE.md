# PropOS Architecture

## Principles

1. **API-first.** Every capability is an API before it is a screen. Web, iOS,
   Android, partner integrations and white-label deployments all consume the
   same contracts.
2. **AI-first, never AI-dependent.** Every AI feature has a deterministic
   fallback (see `ListingContentGenerator`): an LLM outage degrades quality,
   never availability. Numbers (stamp duty, loans, yields) always come from the
   deterministic finance engine — the LLM presents them, it never invents them.
3. **Country as configuration.** Market-specific rules (taxes, regulations,
   commission norms, languages, data sources) live behind interfaces
   (`CountryConfig`, `AmenityProvider`, tax adapters). Launching a country is a
   data + integration exercise, not a rebuild.
4. **Event-sourced where money or trust is involved.** Lead pipeline, offers,
   commissions and supplier reviews are journaled state machines — auditable and
   reconstructable.

## Current monorepo (the walking skeleton)

```
packages/
  core                domain model, country registry
  ai-engine           content generation, sales agent, LLM provider abstraction
  area-intelligence   amenity providers, geo scoring, area reports
  finance             mortgage, stamp duty, affordability, investment analytics
  crm                 lead pipeline, commissions, repositories
apps/
  api                 Fastify composition layer (REST)
  web                 demo dashboard
```

The package boundaries are the future **microservice boundaries**. They start as
libraries in one deployable (fast iteration, no distributed-systems tax), and
split into services as load and team size demand — the interfaces don't change.

## Target system (full build-out)

```
                        ┌─────────────────────────────┐
   Web / iOS / Android  │        API Gateway           │  Partner APIs /
   ──────────────────►  │  (auth, rate limit, tenancy) │  White-label
                        └──────────────┬──────────────┘
        ┌───────────┬───────────┬──────┴─────┬────────────┬───────────┐
   Listing Svc   AI Studio   Area Intel   Finance Svc   CRM Svc   Marketplace
   (properties,  (content,   (amenities,  (calculators, (leads,   (vendors,
    media,        video,      scores,      bank offers,  deals,    orders,
    search)       staging)    URA data)    referrals)    teams)    factory-direct)
        │             │            │            │            │          │
        └────────┬────┴────────────┴────┬───────┴────────────┴──────────┘
            Event bus (Kafka/NATS): listing.created, lead.advanced, order.paid…
                 │                        │
        ┌────────┴────────┐      ┌───────┴────────┐
        │  AI Inference    │      │  Data platform │
        │  (LLM routing,   │      │  (warehouse,   │
        │  image models,   │      │  analytics,    │
        │  embeddings)     │      │  ML training)  │
        └─────────────────┘      └────────────────┘
```

### Service notes

- **Listing service** — property CRUD, media pipeline, search (OpenSearch),
  geo-indexing. Emits `listing.created` → AI Studio auto-generates the content
  pack (exactly the flow the demo API implements synchronously today).
- **AI Studio** — text (Claude), image enhancement/staging (diffusion models),
  floor-plan → 3D, video assembly, avatar/voiceover. All jobs async via queue;
  results attached to the listing. GPU workloads isolated in their own pool.
- **Area intelligence** — per-country provider adapters: SG = OneMap + URA
  Master Plan + LTA DataMall; elsewhere OSM/Google Places. Scores computed by
  the same engine shipped here.
- **Finance** — the deterministic calculators here, plus a bank-offer ingestion
  pipeline and referral tracking for mortgage/insurance/legal partners.
- **CRM** — the lead state machine here, plus scheduling, e-signature
  integration, document vault, team roles.
- **Marketplace** — vendor onboarding + verification workflow ("Top 10/20/50",
  AI quality score), quotes, escrowed orders, factory-direct catalog, reviews.
- **AI sales agent** — conversational layer over listing + area + finance APIs;
  answers grounded in APIs only (the pattern `ListingSalesAgent` establishes:
  rules for high-frequency intents, LLM for the long tail, hard numbers always
  from the finance engine).

### Cross-cutting

- **Multi-tenancy** — agencies and white-label partners are tenants; row-level
  tenancy in Postgres, tenant claim in every token.
- **Identity & roles** — one login; roles: consumer, agent, agency admin,
  vendor, partner (bank/lawyer/insurer), platform admin.
- **i18n** — all content pipelines take a locale list from `CountryConfig`
  (the Xiaohongshu channel already renders zh copy).
- **Compliance** — PDPA (SG) / GDPR (EU) data handling; CEA advertising rules
  in content templates; per-country disclaimer injection (already in the sales
  agent).
- **Infra** — containerized, IaC, autoscaling; CI runs `pnpm build && pnpm test`
  per package; trunk-based deploys behind feature flags.

## AI model strategy

| Workload | Model class | Fallback |
|---|---|---|
| Listing copy, translations, sales agent long-tail | Claude (Sonnet tier), routed via `LLMProvider` | Deterministic templates |
| Photo enhancement, staging, day/night themes | Diffusion + segmentation models | Original photos |
| Floor-plan parsing → 3D | Vision + geometry pipeline | Manual upload of 3D tour |
| Area summaries | LLM over structured amenity data | Template summary (shipped) |
| Investment scoring | Gradient-boosted models on transaction history | Heuristic scores (shipped) |

Grounding rule: **LLMs never produce a number a calculator can produce.**
