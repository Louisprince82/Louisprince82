# PropOS — Go-Live Readiness Report

**Date:** 2026-08-04 · covers Master Prompt §1–11 and Part 2 §12–17
**Test suite:** 77 passing across 7 packages. Everything marked DONE below is tested and was verified live against a running server.

Legend: ✅ DONE · 🟡 PARTIAL · ❌ MISSING

## §1 Two-sided listings

| Item | Status | Notes |
|---|---|---|
| Customer + Agent account types | ✅ DONE | `role: customer \| agent`, separate ID prefixes; both can sign in and list. |
| Customer FSBO listing, free | ✅ DONE | Verified live. |
| **CEA agent verification** | ✅ DONE — **better than spec** | Spec asked for a format check. Built a **real lookup against the official CEA Public Register** (data.gov.sg, keyless): registered name, agency, licence no., validity dates stored on the account. Hard mode (`PROPOS_REQUIRE_CEA=1`) blocks unverified agents from publishing. Public endpoint: `/api/agents/verify/:regNo`. |
| Quarterly re-verification cron | ❌ MISSING | Data + method exist (`lastVerifiedAt`); needs a scheduler in production hosting. |
| Invite-an-agent flow | ❌ MISSING | |
| 5-minute "uncle/auntie" listing wizard UI | 🟡 PARTIAL | Address auto-fill works at API level (bare street name → coordinates + postal via OneMap, verified live). Simple wizard UI not built; studio form is functional but not "auntie-grade". |
| Separate dashboards per role | ❌ MISSING | One studio UI today. |

## §2 One listing → every channel

| Item | Status | Notes |
|---|---|---|
| 11-channel content pack | ✅ DONE | SEO, FB, IG, TikTok, LinkedIn, YouTube, X, Xiaohongshu (中文), Email, WhatsApp + description. **Douyin missing** (12th channel — trivial to add as zh-video variant). |
| Ready-to-copy pack | ✅ DONE | All copy is copyable text in studio/portal. Per-platform image-size guidance ❌. |
| OAuth direct posting ("Boost everywhere") | ❌ MISSING | Requires Meta/TikTok/LinkedIn developer apps (see Registration List). Metricool via n8n is the fast path. |
| WhatsApp click-to-chat on every listing | ✅ DONE | See §13. |

## §3 AI Virtual Showroom — ❌ MISSING (biggest build gap)
Provider recommendation: **Kling image_to_image** (already connected to your workspace as an MCP server) for photo→styled render; swap-ready behind a `render.ts` interface per spec. Indicative cost ≈ US$0.03–0.14/image depending on model/tier — confirm on your Kling plan (klingai.com). Alternative: fal.ai (Flux) ≈ US$0.03–0.05/image. Watermarking rule from your compliance pack must ship with it. **This is the next major build item.**

## §4 Location intelligence

| Item | Status | Notes |
|---|---|---|
| Auto amenity detection + distances | 🟡 PARTIAL | Engine + scoring + walk-time estimates DONE and tested; runs on a 45-amenity seed dataset. OneMap geocoding is live (keyless, verified). Full island-wide layers (all schools/MRT/hawkers) need your OneMap token + data.gov.sg dataset ingestion — client code is ready. |
| Real walking routes | 🟡 PARTIAL | Token-gated OneMap routing built + tested with mocks; activates when you supply ONEMAP credentials. |
| Travel time to Changi/CBD | ❌ MISSING | Same OneMap routing call once token exists. |
| Interactive map view | ❌ MISSING | MapLibre + OneMap tiles, not yet built. |

## §5 Calculators — ✅ DONE (strongest area)
Affordability (TDSR/MSR, CPF+cash, LTV, stress test) · mortgage (any rate/tenure; HDB-vs-bank comparison 🟡 — engine supports both, UI toggle missing) · **BSD + ABSD by profile incl. foreigner** · SSD · yield/cash flow. All rates resolve from a **versioned policy table** (no hardcoding, per your spec) and every result records its policy version. HDB rules helper (MOP/eligibility notes) ❌. Mobile-large-input UI 🟡.

## §6 Cross-border foundation — ✅ DONE (architecture) / 🟡 (content)
Country on every listing; 8-country registry (SG live; MY/TH staged with regulations, currency, languages); foreigner ABSD surfaces in the overseas-buyer persona and stamp-duty calculator. Live FX rates ❌; UI translation framework ❌ (content engine already emits 中文).

## §7 Marketplace add-ons — ❌ MISSING (skeleton not built)
## §8 Growth engine — ❌ MISSING except savings maths (commission-vs-flat-fee comparison exists in engines; landing widget not built). SEO listing pages/schema.org ❌.
## §9 Analytics & admin — ❌ MISSING (no admin dashboard; lead pipeline summaries exist per agent).

## §10 Trust, safety & compliance

| Item | Status | Notes |
|---|---|---|
| PDPA privacy policy + ToS drafts | ✅ DONE | Served at `/privacy` and `/terms`, clearly marked **DRAFT — FOR LEGAL REVIEW**, includes platform-not-agency disclaimer and CEA-register pointer. |
| Secure auth | ✅ DONE | scrypt-salted hashes, bearer sessions, ownership checks (401/403 tested). Rate limiting ❌. |
| Listing verification / moderation queue / report button | ❌ MISSING | |
| Audit log | 🟡 PARTIAL | Lead pipeline is fully journaled; no global audit log. |
| Backups | 🟡 | Atomic file persistence; real backups come with production DB hosting. |

## §12 AI everywhere — 🟡 PARTIAL
DONE: AI concierge per listing (price/stamp/loan/yield/area/viewing — engine-grounded, tested); marketing pack; persona content. MISSING: video maker (Kling `image_to_video` — connected, not wired), photo enhancement, **AI price advisor** (HDB resale + URA data are free APIs — high-value next build), auto-translation layer, enquiry summarizer, 7/30-day campaign calendar.

## §13 Leads → WhatsApp — ✅ DONE (core flow)
"WhatsApp Now" API: tap → `wa.me` deep link to the lister's number with pre-filled message + listing ref → **lead auto-logged** in the CRM (source: whatsapp), verified live. Listers without a phone get a graceful fallback. Routing owner-vs-agent follows listing ownership. MISSING: outbound WhatsApp notifications & saved-search alerts (needs WhatsApp Business Platform — see Registration List), portal UI button wiring.

## §14 Campaign tools — ❌ MISSING (lead inbox/CRM pipeline itself ✅ DONE — New→Contacted→Viewing→Offer→Closed with audit trail)
## §15 Merchant marketplace — ❌ MISSING
## §16 Open API + KPI dashboard — 🟡 PARTIAL (clean REST API exists and is documented in README; no API keys/rate limits/webhooks; no KPI dashboard)

---

# External Registration List

**Register now (free, unblocks built features):**

| # | Service | Link | Unlocks |
|---|---|---|---|
| 1 | **OneMap API** | onemap.gov.sg → register | Real walking times, island-wide amenity layers, travel time to CBD/Changi. **Code is already waiting for `ONEMAP_EMAIL`/`ONEMAP_PASSWORD`.** |
| 2 | LTA DataMall | datamall.lta.gov.sg | Bus stops + numbers, MRT exits |
| 3 | URA Data Service | ura.gov.sg/maps/api | Private transaction prices (AI price advisor) |
| 4 | data.gov.sg | (no key needed) | HDB resale prices, CEA register (already live in the platform), hawker centres |
| 5 | **Anthropic API** | console.anthropic.com | Turns AI content from template mode to full LLM mode (`ANTHROPIC_API_KEY`) |

**Register when the matching feature ships:**

| # | Service | Link | For |
|---|---|---|---|
| 6 | Kling AI | klingai.com (already MCP-connected) | Virtual showroom renders + listing videos (§3, §12) |
| 7 | Stripe | stripe.com (needs ACRA first) | Flat-fee payments. SG alternative: hitpayapp.com (PayNow) |
| 8 | Resend | resend.com | Signup emails + alerts (cheapest, simplest) |
| 9 | Meta for Developers | developers.facebook.com | FB+IG posting, later WhatsApp Business Platform |
| 10 | TikTok for Developers | developers.tiktok.com | Content Posting API |
| 11 | LinkedIn Developers | developer.linkedin.com | Share API |
| 12 | Google Cloud | console.cloud.google.com | YouTube Data API, Maps (non-SG later), Search Console + Analytics |
| 13 | Domain | e.g. Cloudflare/Namecheap; .sg via Vodien (SGNIC) | propos.sg / final name (check trademark first) |
| 14 | Hosting | Vercel or Railway/Fly + managed Postgres | Production deploy (see BUILD_STATUS.md for migration plan) |
| 15 | Sentry | sentry.io | Error tracking |

**Company/legal (from your own checklist — do in this order):** ACRA (bizfile.gov.sg) → corporate bank account → Stripe → lawyer sign-off on: CEA licensing question, EAA template, ToS/Privacy drafts (now live at `/terms`, `/privacy`), PDPA DPO registration. Optional: IPOS trademark.

---

# Recommended build order from here

1. **AI price advisor** (§12) — HDB resale + URA data are free; huge trust feature; no keys needed for HDB data.
2. **Virtual showroom** (§3) — Kling wiring + watermark pipeline; the second flagship differentiator.
3. **Interactive map + full amenity layers** — the moment your OneMap token arrives.
4. **Listing wizard UI + separate dashboards** (§1) — the "easy easy easy" front door.
5. **Moderation queue + report button + rate limiting** (§10) — before real public traffic.
6. Payments + EAA generation (§7 of the earlier spec) — after ACRA + Stripe.
