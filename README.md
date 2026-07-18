# PropOS — The AI Operating System for Real Estate

> Not another property listing site. PropOS is the operating system for the entire
> real estate industry: buy, sell, rent, renovate, invest, furnish, finance, move,
> manage and grow property wealth — one login, everything inside.

**Launch market: Singapore 🇸🇬 → then MY, TH, VN, ID, AU, UK, AE, and worldwide.**

## What's in this repository

A working, tested monorepo foundation for the platform. Real engines, not mockups:

| Module | Vision part | What it does today |
|---|---|---|
| `packages/core` | 14 | Country-agnostic domain model + a **country config registry** (SG launched; MY/TH/VN/ID/AU/UK/AE pre-configured). New market = new config, not a rebuild. |
| `packages/ai-engine` | 1, 3, 4 | **One upload → full marketing pack**: description, SEO, Facebook, Instagram, TikTok, LinkedIn, YouTube, Xiaohongshu (中文), Twitter, email & WhatsApp copy, plus 6 persona variants (luxury / investment / family / young couple / foreign buyer). **Per-listing 24/7 AI sales agent** that answers price, stamp duty, loan, yield, area and viewing questions — with real computed numbers. Pluggable LLM provider (Claude API) + deterministic template fallback, so the platform is AI-first but never AI-dependent. |
| `packages/area-intelligence` | 2 | Address in → **area report** out: nearby MRT, schools, malls, parks, clinics, future MRT lines & URA developments, each with distance and walking time; scores for transit, walkability, families, lifestyle and investment. Pluggable `AmenityProvider` per market. |
| `packages/finance` | 8, 9 | Singapore **BSD / ABSD / SSD** stamp duty engine (2025/26 rates), **TDSR/MSR affordability** with LTV limits and 4% stress test, mortgage amortization, rental yield, cash flow and ROI analytics. |
| `packages/crm` | 5 | **Lead pipeline state machine** (new → contacted → viewing → offer → negotiation → closed) with a full audit trail, commission splitting, and team dashboard summaries. |
| `apps/api` | 15 | API-first Fastify service composing all engines: listings, content generation, area reports, finance calculators, AI sales agent, CRM. |
| `apps/web` | — | Interactive demo dashboard exercising the entire flow end-to-end. |
| `docs/` | all | Full architecture, global expansion playbook, roadmap and revenue model. |

## Quick start

```bash
pnpm install
pnpm build
pnpm test        # 40+ tests across all engines
pnpm start       # → http://localhost:3000 (demo dashboard + API)
```

Optional: set `ANTHROPIC_API_KEY` to switch content generation and the sales
agent from template mode to Claude-powered mode. Everything degrades gracefully
without it.

## Try the API

```bash
# One upload → marketing pack + area intelligence + AI sales agent
curl -s localhost:3000/api/listings -X POST -H 'content-type: application/json' -d '{
  "intent": "sale", "price": 1680000,
  "property": {
    "id": "", "type": "condo", "bedrooms": 3, "bathrooms": 2, "floorAreaSqm": 110,
    "tenure": {"kind": "leasehold", "years": 99},
    "features": ["marina view", "renovated kitchen"],
    "address": {"line1": "12 Marina Boulevard", "country": "SG",
                "geo": {"lat": 1.2806, "lng": 103.8541}}
  }
}'

# Ask the listing's AI agent anything
curl -s localhost:3000/api/listings/<id>/ask -X POST -H 'content-type: application/json' \
  -d '{"question": "What stamp duty will I pay?", "context": {"buyerProfile": "foreigner"}}'

# Stamp duty / affordability / mortgage / yield
curl -s localhost:3000/api/finance/stamp-duty -X POST -H 'content-type: application/json' \
  -d '{"price": 1500000, "profile": "citizen", "propertiesOwned": 1}'
```

## Where this is going

The full build-out — photo enhancement & virtual staging, floor-plan 3D, video
generation, marketplace & direct-factory commerce, mortgage referrals, home
management, community, memberships — is specified in:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, microservice decomposition, AI infrastructure
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased delivery plan from this foundation to the full ecosystem
- [`docs/GLOBAL-EXPANSION.md`](docs/GLOBAL-EXPANSION.md) — the country-launch playbook
- [`docs/REVENUE-MODEL.md`](docs/REVENUE-MODEL.md) — monetization streams and sequencing

*Estimates produced by the platform are for planning only — not financial advice.*
