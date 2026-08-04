import { describe, expect, it, vi } from "vitest";
import { CEA_REG_FORMAT, CeaRegisterClient } from "../src/index.js";

const record = {
  salesperson_name: "TAN AH KOW",
  registration_no: "R015018I",
  registration_start_date: "2011-01-01",
  registration_end_date: "2026-12-31",
  estate_agent_name: "ACME REALTY",
  estate_agent_license_no: "L3006213G",
};

const mockFetch = (records: unknown[], ok = true) =>
  vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => ({ success: true, result: { records } }) })) as unknown as typeof fetch;

describe("CEA registration format", () => {
  it("accepts R015018I / P015022G shapes and rejects junk", () => {
    expect(CEA_REG_FORMAT.test("R015018I")).toBe(true);
    expect(CEA_REG_FORMAT.test("P015022G")).toBe(true);
    expect(CEA_REG_FORMAT.test("12345")).toBe(false);
    expect(CEA_REG_FORMAT.test("RABCDEFG")).toBe(false);
  });
});

describe("CeaRegisterClient.verify", () => {
  it("verifies an active registration from the official dataset", async () => {
    const client = new CeaRegisterClient(mockFetch([record]));
    const v = await client.verify("r015018i", new Date("2026-08-03"));
    expect(v.status).toBe("verified");
    expect(v.record?.agencyName).toBe("ACME REALTY");
  });

  it("marks lapsed registrations as expired", async () => {
    const client = new CeaRegisterClient(mockFetch([{ ...record, registration_end_date: "2024-12-31" }]));
    const v = await client.verify("R015018I", new Date("2026-08-03"));
    expect(v.status).toBe("expired");
  });

  it("returns not-found for unknown numbers and bad formats (no network call for bad format)", async () => {
    const f = mockFetch([]);
    const client = new CeaRegisterClient(f);
    expect((await client.verify("R999999Z")).status).toBe("not-found");
    expect((await client.verify("garbage")).status).toBe("not-found");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("degrades to unavailable when the registry is down (and does not cache it)", async () => {
    const f = mockFetch([], false);
    const client = new CeaRegisterClient(f);
    expect((await client.verify("R015018I")).status).toBe("unavailable");
    expect((await client.verify("R015018I")).status).toBe("unavailable");
    expect(f).toHaveBeenCalledTimes(2); // retried, not cached
  });

  it("caches successful lookups", async () => {
    const f = mockFetch([record]);
    const client = new CeaRegisterClient(f);
    await client.verify("R015018I");
    await client.verify("R015018I");
    expect(f).toHaveBeenCalledTimes(1);
  });
});
