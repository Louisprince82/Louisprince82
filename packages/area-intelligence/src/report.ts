import type { GeoPoint } from "@propos/core";
import type { AmenityProvider, AreaReport, AreaScores, NearbyAmenity } from "./types.js";
import { distanceM, walkMinutes } from "./geo.js";

/** Scores decay with distance: full points inside `fullM`, zero beyond `zeroM`. */
function proximityScore(distM: number, fullM: number, zeroM: number): number {
  if (distM <= fullM) return 1;
  if (distM >= zeroM) return 0;
  return 1 - (distM - fullM) / (zeroM - fullM);
}

function nearest(amenities: NearbyAmenity[], category: string): NearbyAmenity | undefined {
  return amenities.find((a) => a.category === category); // list is pre-sorted by distance
}

function count(amenities: NearbyAmenity[], ...categories: string[]): number {
  return amenities.filter((a) => categories.includes(a.category)).length;
}

function computeScores(all: NearbyAmenity[]): AreaScores {
  const pct = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 100);

  const mrt = nearest(all, "mrt");
  const transit = pct(
    (mrt ? proximityScore(mrt.distanceM, 400, 1600) : 0) * 0.8 +
    (nearest(all, "bus") ? 0.2 : 0),
  );

  const daily = ["supermarket", "market", "coffee", "restaurant", "mall", "clinic", "park"];
  const walkability = pct(
    daily.reduce((sum, c) => {
      const n = nearest(all, c);
      return sum + (n ? proximityScore(n.distanceM, 300, 1200) : 0);
    }, 0) / daily.length,
  );

  const families = pct(
    ((nearest(all, "primary-school") ? proximityScore(nearest(all, "primary-school")!.distanceM, 1000, 2000) : 0) +
      (nearest(all, "childcare") ? 1 : 0) * 0.6 +
      (nearest(all, "park") ? 1 : 0) * 0.4 +
      (nearest(all, "community-club") ? 1 : 0) * 0.3) / 2.3,
  );

  const lifestyle = pct(
    Math.min(1, count(all, "restaurant", "coffee", "mall", "sports", "park") / 6),
  );

  // Investment: connectivity now + committed future infrastructure nearby.
  const future = count(all, "future-mrt", "future-development");
  const investment = pct(transit / 100 * 0.5 + Math.min(1, future / 3) * 0.5);

  const overall = Math.round(
    transit * 0.25 + walkability * 0.25 + families * 0.15 + lifestyle * 0.15 + investment * 0.2,
  );

  return { walkability, transit, families, lifestyle, investment, overall };
}

function buildSummary(all: NearbyAmenity[], scores: AreaScores): string {
  const parts: string[] = [];
  const mrt = nearest(all, "mrt");
  if (mrt) parts.push(`${mrt.name} is a ${mrt.walkMinutes}-min walk (${Math.round(mrt.distanceM)}m)`);
  const school = nearest(all, "primary-school");
  if (school) parts.push(`${school.name} is ${Math.round(school.distanceM)}m away`);
  const mall = nearest(all, "mall");
  if (mall) parts.push(`${mall.name} covers retail and dining`);
  const future = all.filter((a) => a.category === "future-mrt" || a.category === "future-development");
  if (future.length) {
    parts.push(
      `upcoming: ${future.map((f) => `${f.name}${f.meta?.year ? ` (~${f.meta.year})` : ""}`).join("; ")} — a tailwind for long-term value`,
    );
  }
  const headline =
    scores.overall >= 80 ? "Outstanding location." :
    scores.overall >= 60 ? "Well-connected location." : "Quieter location.";
  return `${headline} ${parts.join(". ")}.`;
}

export async function generateAreaReport(
  provider: AmenityProvider,
  point: GeoPoint,
  radiusM = 1500,
): Promise<AreaReport> {
  const found = await provider.findNearby(point, radiusM);
  const enriched: NearbyAmenity[] = found
    .map((a) => {
      const d = distanceM(point, a.location);
      return { ...a, distanceM: Math.round(d), walkMinutes: walkMinutes(d) };
    })
    .sort((a, b) => a.distanceM - b.distanceM);

  const grouped: Record<string, NearbyAmenity[]> = {};
  for (const a of enriched) (grouped[a.category] ??= []).push(a);

  const scores = computeScores(enriched);
  return {
    point,
    radiusM,
    amenities: grouped,
    scores,
    summary: buildSummary(enriched, scores),
    futureDevelopments: enriched.filter(
      (a) => a.category === "future-mrt" || a.category === "future-development",
    ),
  };
}
