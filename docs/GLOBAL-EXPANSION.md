# Global Expansion Playbook

The codebase treats a country as configuration (`packages/core/src/country.ts`).
Launching a market is a repeatable checklist, not a rebuild.

## Launch checklist per country

1. **Country config** — currency, locales, measurement units, property types,
   regulations, commission norms (already drafted for MY, TH, VN, ID, AU, UK, AE).
2. **Tax & finance adapter** — implement the country's stamp/transfer taxes and
   lending rules behind the same interface as `stampDutySG`/`affordabilitySG`.
   Examples: MY RPGT + stamp duty scale; UK SDLT bands + surcharges; AU state
   transfer duties + FIRB fees; TH transfer/withholding taxes.
3. **Amenity provider** — implement `AmenityProvider` against local data
   (MY: JUPEM/OSM; TH: Longdo; AU: state open data; UK: OS Places; AE: Makani).
4. **Content localization** — add locales to the content engine; channel mix
   per market (e.g. Xiaohongshu for zh audiences, Line for TH, Zalo for VN).
5. **Compliance review** — advertising rules, agent licensing verification,
   data protection (PDPA/GDPR), foreign-ownership disclosures (already surfaced
   in the foreign-buyer persona).
6. **Partnerships** — banks (mortgage referrals), law firms, insurers, and the
   first 20 verified vendors per marketplace category.
7. **Payments & payouts** — local rails, currency handling, invoicing/tax.
8. **Go-to-market** — recruit anchor agencies with free Professional tier;
   seed listings; localized AI sales agent from day one.

## Sequencing rationale

| Wave | Markets | Why |
|---|---|---|
| 1 | Singapore | Dense, digital, English-first, high agent commission pool, rich open data (URA/OneMap/LTA). Perfect proving ground. |
| 2 | Malaysia, Thailand | Adjacent, strong SG buyer overlap (cross-border investment flows are a feature: one platform, two markets). |
| 3 | Vietnam, Indonesia | Fast-growing middle class, under-served by modern proptech. |
| 4 | Australia, UK | Mature, high-value markets; white-label and API licensing entry. |
| 5 | UAE, Europe | Investor hubs; multi-currency and multilingual stack already proven. |

## What must stay global

- One identity, one wallet, one portfolio view across countries
- Cross-border investment search ("show me 5% yield condos in BKK vs KL")
- The AI engines (content, area scoring, sales agent) — only their data
  providers and locale packs change per market
