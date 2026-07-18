import type { CountryCode, PropertyType } from "./property.js";

/** Everything market-specific is declared here, so launching a new country
 *  means registering a config — not rebuilding the product (PART 14). */
export interface CountryConfig {
  code: CountryCode;
  name: string;
  currency: string;
  locales: string[]; // supported UI/content languages, BCP 47
  measurement: "sqm" | "sqft" | "both";
  propertyTypes: PropertyType[];
  /** Regulatory notes surfaced to agents & AI content generation. */
  regulations: {
    foreignOwnership: string;
    coolingMeasures?: string;
    agentLicensing: string;
  };
  /** Typical agent commission structure, for CRM defaults. */
  commission: {
    salePct: number; // typical % of sale price
    rentalWeeks?: number; // typical weeks of rent for a lease
    notes?: string;
  };
  launched: boolean;
}

const registry = new Map<CountryCode, CountryConfig>();

export function registerCountry(config: CountryConfig): void {
  registry.set(config.code, config);
}

export function getCountry(code: CountryCode): CountryConfig {
  const config = registry.get(code);
  if (!config) throw new Error(`Country ${code} is not registered`);
  return config;
}

export function listCountries(): CountryConfig[] {
  return [...registry.values()];
}

// ---------------------------------------------------------------------------
// Launch market: Singapore
// ---------------------------------------------------------------------------
registerCountry({
  code: "SG",
  name: "Singapore",
  currency: "SGD",
  locales: ["en-SG", "zh-SG", "ms-SG", "ta-SG"],
  measurement: "both",
  propertyTypes: ["hdb", "condo", "landed", "terrace", "semi-detached", "bungalow", "shophouse", "commercial", "industrial"],
  regulations: {
    foreignOwnership:
      "Foreigners may buy private condos freely; landed property requires SLA approval (except Sentosa Cove); HDB flats restricted to citizens/PRs.",
    coolingMeasures:
      "ABSD applies on top of BSD; TDSR capped at 55%; MSR 30% for HDB/EC; LTV limits by loan count.",
    agentLicensing: "Agents must be CEA-registered salespersons under a licensed estate agency.",
  },
  commission: { salePct: 2, rentalWeeks: 4.33, notes: "Typically 1–2% resale private, 2% HDB seller side; 1 month rent per 2-year lease." },
  launched: true,
});

// ---------------------------------------------------------------------------
// Expansion pipeline (configured, not yet launched)
// ---------------------------------------------------------------------------
registerCountry({
  code: "MY",
  name: "Malaysia",
  currency: "MYR",
  locales: ["ms-MY", "en-MY", "zh-MY", "ta-MY"],
  measurement: "sqft",
  propertyTypes: ["condo", "apartment", "terrace", "semi-detached", "bungalow", "townhouse", "land", "commercial"],
  regulations: {
    foreignOwnership: "Minimum purchase price thresholds per state (typically RM1M); MM2H schemes available.",
    agentLicensing: "Agents registered with BOVAEA (REN/REA).",
  },
  commission: { salePct: 3, notes: "Max 3% under BOVAEA scale." },
  launched: false,
});

registerCountry({
  code: "TH",
  name: "Thailand",
  currency: "THB",
  locales: ["th-TH", "en-TH"],
  measurement: "sqm",
  propertyTypes: ["condo", "apartment", "townhouse", "land", "commercial"],
  regulations: {
    foreignOwnership: "Foreigners may own condos up to 49% of a building's saleable area; land ownership restricted.",
    agentLicensing: "No national licensing regime; platform verification required.",
  },
  commission: { salePct: 3 },
  launched: false,
});

registerCountry({
  code: "VN",
  name: "Vietnam",
  currency: "VND",
  locales: ["vi-VN", "en-VN"],
  measurement: "sqm",
  propertyTypes: ["apartment", "condo", "townhouse", "land", "commercial"],
  regulations: {
    foreignOwnership: "Foreigners limited to 30% of units in a building; 50-year leasehold with renewal.",
    agentLicensing: "Brokers require a practicing certificate under the Law on Real Estate Business.",
  },
  commission: { salePct: 2 },
  launched: false,
});

registerCountry({
  code: "ID",
  name: "Indonesia",
  currency: "IDR",
  locales: ["id-ID", "en-ID"],
  measurement: "sqm",
  propertyTypes: ["apartment", "condo", "townhouse", "land", "commercial"],
  regulations: {
    foreignOwnership: "Foreigners may hold Hak Pakai (right-to-use) titles; freehold (Hak Milik) reserved for citizens.",
    agentLicensing: "AREBI-registered brokers.",
  },
  commission: { salePct: 2.5 },
  launched: false,
});

registerCountry({
  code: "AU",
  name: "Australia",
  currency: "AUD",
  locales: ["en-AU"],
  measurement: "sqm",
  propertyTypes: ["apartment", "townhouse", "terrace", "semi-detached", "bungalow", "land", "commercial"],
  regulations: {
    foreignOwnership: "FIRB approval required for foreign buyers; generally new dwellings only.",
    agentLicensing: "State-based agent licensing.",
  },
  commission: { salePct: 2.2 },
  launched: false,
});

registerCountry({
  code: "GB",
  name: "United Kingdom",
  currency: "GBP",
  locales: ["en-GB"],
  measurement: "sqft",
  propertyTypes: ["apartment", "terrace", "semi-detached", "bungalow", "townhouse", "land", "commercial"],
  regulations: {
    foreignOwnership: "No restrictions; 2% SDLT surcharge for non-residents.",
    agentLicensing: "Agents must belong to an approved redress scheme.",
  },
  commission: { salePct: 1.5 },
  launched: false,
});

registerCountry({
  code: "AE",
  name: "United Arab Emirates",
  currency: "AED",
  locales: ["ar-AE", "en-AE"],
  measurement: "sqft",
  propertyTypes: ["apartment", "condo", "townhouse", "bungalow", "land", "commercial"],
  regulations: {
    foreignOwnership: "Freehold ownership for foreigners in designated freehold zones.",
    agentLicensing: "RERA-registered brokers (Dubai); ADREC (Abu Dhabi).",
  },
  commission: { salePct: 2 },
  launched: false,
});
