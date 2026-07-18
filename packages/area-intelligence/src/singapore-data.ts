import type { CountryCode, GeoPoint } from "@propos/core";
import type { Amenity, AmenityProvider } from "./types.js";
import { distanceM } from "./geo.js";

/** Static seed dataset for the Singapore CBD / Marina Bay / Tanjong Pagar area.
 *  Production replaces this with OneMap + URA + LTA DataMall feeds behind the
 *  same AmenityProvider interface. Coordinates are approximate. */
const SG_AMENITIES: Amenity[] = [
  // Transit
  { name: "Downtown MRT (DT17)", category: "mrt", location: { lat: 1.2795, lng: 103.8528 } },
  { name: "Marina Bay MRT (NS27/TE20/CE2)", category: "mrt", location: { lat: 1.2761, lng: 103.8547 } },
  { name: "Raffles Place MRT (NS26/EW14)", category: "mrt", location: { lat: 1.2837, lng: 103.8515 } },
  { name: "Shenton Way MRT (TE19)", category: "mrt", location: { lat: 1.2775, lng: 103.8501 } },
  { name: "Tanjong Pagar MRT (EW15)", category: "mrt", location: { lat: 1.2765, lng: 103.8459 } },
  { name: "Marina Boulevard Bus Stop", category: "bus", location: { lat: 1.2801, lng: 103.8544 } },
  { name: "Marina Coastal Expressway (MCE)", category: "expressway", location: { lat: 1.2745, lng: 103.8570 } },
  // Schools & childcare
  { name: "Cantonment Primary School", category: "primary-school", location: { lat: 1.2745, lng: 103.8402 } },
  { name: "My First Skool (Cecil Street)", category: "childcare", location: { lat: 1.2809, lng: 103.8486 } },
  { name: "SMU (Singapore Management University)", category: "university", location: { lat: 1.2963, lng: 103.8502 } },
  // Retail & food
  { name: "Marina Bay Sands / The Shoppes", category: "mall", location: { lat: 1.2834, lng: 103.8607 } },
  { name: "Marina Bay Link Mall", category: "mall", location: { lat: 1.2797, lng: 103.8540 } },
  { name: "Amoy Street Food Centre", category: "market", location: { lat: 1.2794, lng: 103.8465 } },
  { name: "Lau Pa Sat", category: "market", location: { lat: 1.2807, lng: 103.8504 } },
  { name: "Cold Storage (Marina Bay Link)", category: "supermarket", location: { lat: 1.2796, lng: 103.8538 } },
  { name: "Common Man Coffee (Marina One)", category: "coffee", location: { lat: 1.2779, lng: 103.8509 } },
  { name: "VUE Bar & Grill", category: "restaurant", location: { lat: 1.2828, lng: 103.8520 } },
  // Health
  { name: "Raffles Medical (Marina Bay Financial Centre)", category: "clinic", location: { lat: 1.2792, lng: 103.8546 } },
  { name: "Singapore General Hospital", category: "hospital", location: { lat: 1.2793, lng: 103.8354 } },
  // Recreation & civic
  { name: "Gardens by the Bay", category: "park", location: { lat: 1.2816, lng: 103.8636 } },
  { name: "Marina Bay Waterfront Promenade", category: "park", location: { lat: 1.2823, lng: 103.8555 } },
  { name: "Tanjong Pagar Community Club", category: "community-club", location: { lat: 1.2749, lng: 103.8437 } },
  { name: "Marina Bay Police Post", category: "police", location: { lat: 1.2820, lng: 103.8536 } },
  { name: "Marina Bay Fire Station", category: "fire-station", location: { lat: 1.2755, lng: 103.8620 } },
  { name: "ActiveSG Gym (Downtown)", category: "sports", location: { lat: 1.2788, lng: 103.8532 } },
  // Future (URA Master Plan pipeline)
  { name: "Marina South MRT (TE22) — opening", category: "future-mrt", location: { lat: 1.2743, lng: 103.8632 }, meta: { year: 2027 } },
  { name: "Marina South residential precinct (URA Master Plan)", category: "future-development", location: { lat: 1.2726, lng: 103.8618 }, meta: { year: 2030 } },
  { name: "Greater Southern Waterfront transformation", category: "future-development", location: { lat: 1.2650, lng: 103.8300 }, meta: { year: 2035 } },
];

export class SingaporeStaticProvider implements AmenityProvider {
  readonly country: CountryCode = "SG";

  async findNearby(point: GeoPoint, radiusM: number): Promise<Amenity[]> {
    return SG_AMENITIES.filter((a) => distanceM(point, a.location) <= radiusM);
  }
}
