import { describe, expect, it } from "vitest";
import { SingaporeStaticProvider, distanceM, generateAreaReport, walkMinutes } from "../src/index.js";

const MARINA_BLVD = { lat: 1.2806, lng: 103.8541 }; // 12 Marina Boulevard

describe("geo helpers", () => {
  it("haversine distance is sane (Marina Bay ↔ Raffles Place ≈ 450m)", () => {
    const d = distanceM({ lat: 1.2761, lng: 103.8547 }, { lat: 1.2837, lng: 103.8515 });
    expect(d).toBeGreaterThan(700);
    expect(d).toBeLessThan(1100);
  });

  it("walk minutes never drops below 1", () => {
    expect(walkMinutes(10)).toBe(1);
    expect(walkMinutes(800)).toBeGreaterThan(5);
  });
});

describe("Singapore area report", () => {
  it("detects amenities, scores the area, and writes a summary", async () => {
    const report = await generateAreaReport(new SingaporeStaticProvider(), MARINA_BLVD, 1500);

    expect(report.amenities["mrt"]?.length).toBeGreaterThanOrEqual(3);
    expect(report.amenities["mall"]?.length).toBeGreaterThanOrEqual(1);
    // Nearest-first ordering
    const mrts = report.amenities["mrt"]!;
    for (let i = 1; i < mrts.length; i++) {
      expect(mrts[i].distanceM).toBeGreaterThanOrEqual(mrts[i - 1].distanceM);
    }

    // CBD location should score very well on transit
    expect(report.scores.transit).toBeGreaterThan(80);
    expect(report.scores.overall).toBeGreaterThan(50);
    expect(report.scores.overall).toBeLessThanOrEqual(100);

    expect(report.summary).toContain("MRT");
    expect(report.futureDevelopments.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty-but-valid report far from any data", async () => {
    const report = await generateAreaReport(new SingaporeStaticProvider(), { lat: 1.45, lng: 103.75 }, 1000);
    expect(Object.keys(report.amenities)).toHaveLength(0);
    expect(report.scores.overall).toBe(0);
  });
});
