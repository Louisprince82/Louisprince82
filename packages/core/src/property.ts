/** Core property domain model. Country-agnostic: anything market-specific
 *  lives in the CountryConfig, never in these types. */

export type CountryCode =
  | "SG" | "MY" | "TH" | "VN" | "ID" | "AU" | "GB" | "AE";

export type PropertyType =
  | "hdb"
  | "condo"
  | "apartment"
  | "landed"
  | "terrace"
  | "semi-detached"
  | "bungalow"
  | "townhouse"
  | "shophouse"
  | "commercial"
  | "industrial"
  | "land";

export type ListingIntent = "sale" | "rent";

export type Tenure =
  | { kind: "freehold" }
  | { kind: "leasehold"; years: number; startYear?: number };

export interface Money {
  amount: number;
  currency: string; // ISO 4217
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address {
  line1: string;
  line2?: string;
  district?: string;
  city?: string;
  postalCode?: string;
  country: CountryCode;
  geo?: GeoPoint;
}

export interface Property {
  id: string;
  type: PropertyType;
  address: Address;
  bedrooms: number;
  bathrooms: number;
  floorAreaSqm: number;
  landAreaSqm?: number;
  tenure?: Tenure;
  builtYear?: number;
  floor?: number;
  totalFloors?: number;
  furnishing?: "unfurnished" | "partial" | "full";
  facing?: string;
  features: string[]; // e.g. "pool view", "renovated kitchen", "corner unit"
}

export interface Listing {
  id: string;
  property: Property;
  intent: ListingIntent;
  price: Money;
  agentId: string;
  photos: string[];
  floorPlanUrl?: string;
  createdAt: string; // ISO timestamp
  status: "draft" | "active" | "under-offer" | "sold" | "rented" | "withdrawn";
}

export function pricePerSqm(price: Money, floorAreaSqm: number): number {
  return floorAreaSqm > 0 ? price.amount / floorAreaSqm : 0;
}

export function pricePerSqft(price: Money, floorAreaSqm: number): number {
  const sqft = floorAreaSqm * 10.7639;
  return sqft > 0 ? price.amount / sqft : 0;
}

export function formatMoney(m: Money, locale = "en-SG"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    maximumFractionDigits: 0,
  }).format(m.amount);
}
