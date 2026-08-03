import { describe, expect, it, vi } from "vitest";
import { OneMapClient, TtlCache } from "../src/index.js";

const searchPayload = {
  found: 1,
  results: [
    {
      SEARCHVAL: "CENTRALE 8 AT TAMPINES",
      BLK_NO: "520B",
      ROAD_NAME: "TAMPINES CENTRAL 8",
      BUILDING: "CENTRALE 8 AT TAMPINES",
      ADDRESS: "520B TAMPINES CENTRAL 8 CENTRALE 8 AT TAMPINES SINGAPORE 522520",
      POSTAL: "522520",
      LATITUDE: "1.35412",
      LONGITUDE: "103.94382",
    },
  ],
};

function mockFetch(payload: unknown, ok = true) {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => payload })) as unknown as typeof fetch;
}

describe("TtlCache", () => {
  it("caches within TTL and expires after", () => {
    vi.useFakeTimers();
    const c = new TtlCache<number>(1000);
    c.set("k", 42);
    expect(c.get("k")).toBe(42);
    vi.advanceTimersByTime(1500);
    expect(c.get("k")).toBeUndefined();
    vi.useRealTimers();
  });

  it("getOrFetch only fetches on miss", async () => {
    const c = new TtlCache<string>(60_000);
    const fetcher = vi.fn(async () => "value");
    expect(await c.getOrFetch("a", fetcher)).toBe("value");
    expect(await c.getOrFetch("a", fetcher)).toBe("value");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("OneMapClient.geocode", () => {
  it("parses search results into typed geocodes", async () => {
    const f = mockFetch(searchPayload);
    const client = new OneMapClient({ fetchImpl: f });
    const result = await client.geocodeOne("520B Tampines Central 8");
    expect(result).not.toBeNull();
    expect(result!.postalCode).toBe("522520");
    expect(result!.geo.lat).toBeCloseTo(1.35412, 4);
    expect(result!.blockNo).toBe("520B");
  });

  it("caches identical queries (one network call)", async () => {
    const f = mockFetch(searchPayload);
    const client = new OneMapClient({ fetchImpl: f });
    await client.geocode("Tampines Central 8");
    await client.geocode("tampines central 8"); // case-insensitive key
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns [] for empty queries without a network call", async () => {
    const f = mockFetch(searchPayload);
    const client = new OneMapClient({ fetchImpl: f });
    expect(await client.geocode("  ")).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("normalizes NIL fields to undefined", async () => {
    const f = mockFetch({
      found: 1,
      results: [{ ...searchPayload.results[0], BUILDING: "NIL", POSTAL: "NIL" }],
    });
    const client = new OneMapClient({ fetchImpl: f });
    const r = await client.geocodeOne("x");
    expect(r!.building).toBeUndefined();
    expect(r!.postalCode).toBeUndefined();
  });
});

describe("OneMapClient.walkRoute", () => {
  it("returns null (graceful degradation) when no token is configured", async () => {
    const f = mockFetch({});
    const client = new OneMapClient({ fetchImpl: f });
    expect(client.hasRouting).toBe(false);
    expect(await client.walkRoute({ lat: 1.28, lng: 103.85 }, { lat: 1.29, lng: 103.86 })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("parses route summaries when a token is present", async () => {
    const f = mockFetch({ route_summary: { total_distance: 645, total_time: 540 } });
    const client = new OneMapClient({ token: "test-token", fetchImpl: f });
    const route = await client.walkRoute({ lat: 1.28, lng: 103.85 }, { lat: 1.29, lng: 103.86 });
    expect(route).toEqual({ distanceM: 645, walkMinutes: 9 });
  });
});
