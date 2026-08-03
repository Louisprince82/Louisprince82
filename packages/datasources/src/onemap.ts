/** OneMap (Singapore Land Authority) client — the backbone of neighbourhood
 *  intelligence (spec M2, §4).
 *
 *  - `geocode` / address search: public, NO token required.
 *  - Walking routes and thematic amenity layers: require a free OneMap token
 *    (register at onemap.gov.sg, then set ONEMAP_EMAIL + ONEMAP_PASSWORD or
 *    ONEMAP_TOKEN). Calls degrade gracefully when unconfigured.
 *
 *  Never call these live on page render — results are cached (postal-code
 *  keyed upstream) and precomputed on listing publish. */

import type { GeoPoint } from "@propos/core";
import { TtlCache } from "./cache.js";

const BASE = "https://www.onemap.gov.sg/api";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface GeocodeResult {
  address: string;
  building?: string;
  blockNo?: string;
  roadName?: string;
  postalCode?: string;
  geo: GeoPoint;
}

export interface WalkRoute {
  distanceM: number;
  walkMinutes: number;
}

interface OneMapSearchResponse {
  found: number;
  results: Array<{
    SEARCHVAL: string;
    BLK_NO: string;
    ROAD_NAME: string;
    BUILDING: string;
    ADDRESS: string;
    POSTAL: string;
    LATITUDE: string;
    LONGITUDE: string;
  }>;
}

export interface OneMapClientOptions {
  token?: string;
  email?: string;
  password?: string;
  fetchImpl?: typeof fetch;
}

export class OneMapClient {
  private readonly fetchImpl: typeof fetch;
  private token?: string;
  private tokenExpiresAt = 0;
  private readonly opts: OneMapClientOptions;
  private readonly geocodeCache = new TtlCache<GeocodeResult[]>(7 * DAY_MS);
  private readonly routeCache = new TtlCache<WalkRoute | null>(7 * DAY_MS);

  constructor(opts: OneMapClientOptions = {}) {
    this.opts = opts;
    this.token = opts.token;
    if (opts.token) this.tokenExpiresAt = Number.MAX_SAFE_INTEGER;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): OneMapClient {
    return new OneMapClient({
      token: env.ONEMAP_TOKEN,
      email: env.ONEMAP_EMAIL,
      password: env.ONEMAP_PASSWORD,
    });
  }

  /** Address / postal-code search. Public endpoint, no auth. */
  async geocode(query: string): Promise<GeocodeResult[]> {
    const q = query.trim();
    if (!q) return [];
    return this.geocodeCache.getOrFetch(q.toLowerCase(), async () => {
      const url = `${BASE}/common/elastic/search?searchVal=${encodeURIComponent(q)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
      const res = await this.fetchImpl(url);
      if (!res.ok) throw new Error(`OneMap search failed: ${res.status}`);
      const data = (await res.json()) as OneMapSearchResponse;
      return (data.results ?? []).slice(0, 8).map((r) => ({
        address: r.ADDRESS,
        building: r.BUILDING === "NIL" ? undefined : r.BUILDING,
        blockNo: r.BLK_NO || undefined,
        roadName: r.ROAD_NAME || undefined,
        postalCode: r.POSTAL === "NIL" ? undefined : r.POSTAL,
        geo: { lat: Number(r.LATITUDE), lng: Number(r.LONGITUDE) },
      }));
    });
  }

  /** Best single match for an address, or null. */
  async geocodeOne(query: string): Promise<GeocodeResult | null> {
    const results = await this.geocode(query);
    return results[0] ?? null;
  }

  get hasRouting(): boolean {
    return Boolean(this.token || (this.opts.email && this.opts.password));
  }

  /** Real walking route (spec M2 step 4). Returns null when no token is
   *  configured — callers fall back to the distance heuristic and say so. */
  async walkRoute(from: GeoPoint, to: GeoPoint): Promise<WalkRoute | null> {
    if (!this.hasRouting) return null;
    const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}|${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
    return this.routeCache.getOrFetch(key, async () => {
      const token = await this.ensureToken();
      if (!token) return null;
      const url =
        `${BASE}/public/routingsvc/route?start=${from.lat},${from.lng}&end=${to.lat},${to.lng}&routeType=walk`;
      const res = await this.fetchImpl(url, { headers: { Authorization: token } });
      if (!res.ok) return null;
      const data = (await res.json()) as { route_summary?: { total_distance: number; total_time: number } };
      if (!data.route_summary) return null;
      return {
        distanceM: Math.round(data.route_summary.total_distance),
        walkMinutes: Math.max(1, Math.round(data.route_summary.total_time / 60)),
      };
    });
  }

  private async ensureToken(): Promise<string | undefined> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    if (!this.opts.email || !this.opts.password) return undefined;
    const res = await this.fetchImpl(`${BASE}/auth/post/getToken`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: this.opts.email, password: this.opts.password }),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { access_token?: string; expiry_timestamp?: string };
    this.token = data.access_token;
    this.tokenExpiresAt = data.expiry_timestamp ? Number(data.expiry_timestamp) * 1000 : Date.now() + 2 * DAY_MS;
    return this.token;
  }
}
