import type { CountryCode, GeoPoint } from "@propos/core";

export type AmenityCategory =
  | "mrt"
  | "bus"
  | "primary-school"
  | "secondary-school"
  | "childcare"
  | "university"
  | "mall"
  | "supermarket"
  | "restaurant"
  | "coffee"
  | "clinic"
  | "hospital"
  | "park"
  | "sports"
  | "police"
  | "fire-station"
  | "community-club"
  | "market"
  | "expressway"
  | "future-mrt"
  | "future-development";

export interface Amenity {
  name: string;
  category: AmenityCategory;
  location: GeoPoint;
  /** e.g. opening year for future infrastructure */
  meta?: Record<string, string | number>;
}

export interface NearbyAmenity extends Amenity {
  distanceM: number;
  walkMinutes: number;
}

/** Pluggable data source per market — static datasets today, live APIs
 *  (OneMap, OpenStreetMap, Google Places) as drop-in replacements. */
export interface AmenityProvider {
  country: CountryCode;
  findNearby(point: GeoPoint, radiusM: number): Promise<Amenity[]>;
}

export interface AreaScores {
  walkability: number; // 0–100
  transit: number;
  families: number;
  lifestyle: number;
  investment: number;
  overall: number;
}

export interface AreaReport {
  point: GeoPoint;
  radiusM: number;
  amenities: Record<string, NearbyAmenity[]>; // grouped by category, nearest first
  scores: AreaScores;
  summary: string;
  futureDevelopments: NearbyAmenity[];
}
