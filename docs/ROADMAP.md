# PropOS Roadmap

From this repository's walking skeleton to the full ecosystem. Each phase ships
revenue-relevant value; nothing waits for "the big launch".

## Phase 0 — Foundation (this repo, done)

- Monorepo, domain model, country registry (SG + 7 pre-configured markets)
- AI listing content engine (11 channels, 6 personas) with LLM/template duality
- Area intelligence engine + SG seed data
- Finance engine: BSD/ABSD/SSD, TDSR/MSR affordability, mortgage, yield
- CRM lead pipeline + commissions
- API-first composition layer + demo dashboard, 40+ tests

## Phase 1 — Singapore MVP (agents first)

The wedge is the **agent**: give agents a 10× listing workflow and they bring
the inventory; inventory brings consumers.

- Postgres persistence + auth (agent accounts, CEA number verification)
- Media pipeline: photo upload, EXIF cleanup, AI enhancement v1 (lighting,
  sky replacement, decluttering)
- Live SG data: OneMap geocoding + amenity feeds, URA transactions for
  comparables, LTA DataMall
- Listing portal (search, map, listing pages) — consumer-facing
- AI sales agent embedded on every listing (WhatsApp + web chat)
- Agent dashboard: CRM pipeline, content pack editor, one-click social posting
- Free + Professional tiers

## Phase 2 — Media & marketing depth

- Virtual staging (styles: luxury, minimalist, Scandinavian, industrial,
  Japanese, Balinese…), day/night/theme variants
- Floor plan → interactive 2D/3D, furniture layout suggestions
- Virtual renovation previews per room
- 360 walkthrough assembly from photos; VR/AR-ready export
- AI video generator: TikTok/IG reels, cinematic cuts, voiceover, avatar presenter
- Ad campaign builder (Meta/Google/TikTok APIs) with budget optimization

## Phase 3 — Transactions & finance

- Offers, digital signatures, document vault, conveyancing checklist
- Mortgage marketplace: live bank offers, in-principle approval referrals
- Insurance & legal referral flows
- CPF/grant calculators for HDB flows; IRAS stamp-duty e-filing hand-off
- Escrow-backed booking deposits

## Phase 4 — Marketplace & post-purchase

- Verified vendor marketplace (interior design, reno, aircon, moving, cleaning…)
  with "Top N" curation, AI quality scores, transparent pricing
- Direct-factory catalog (CN/KR/JP/VN/MY/TH/IT/DE/TR) with consolidated shipping
- AI shopping assistant: photo → identified furniture → best suppliers
- Home management: warranty/maintenance/tax/insurance reminders
- Community: neighbourhood reviews, agent/contractor reviews, Q&A, webinars

## Phase 5 — Investment intelligence & scale

- Investment advisor: undervaluation detection, district comparison, rental
  demand modeling, portfolio tracking (educational analysis, not financial advice)
- Analytics subscriptions for agencies & developers
- API licensing + white-label platform
- Native iOS/Android apps (the API layer is already the contract)

## Phase 6 — Global expansion

Per-country launch via the playbook in `GLOBAL-EXPANSION.md`:
Malaysia → Thailand → Vietnam → Indonesia → Australia → UK → UAE → Europe.
Each launch = country config + local data providers + local partners + local
compliance review. Target: new market live in under one quarter.
