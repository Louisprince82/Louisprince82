import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AccountService,
  AuthError,
  JsonStore,
  PersistentLeadRepository,
  PersistentListingRepository,
  hashPassword,
  verifyPassword,
} from "../src/index.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "propos-storage-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("JsonStore", () => {
  it("persists across reloads", async () => {
    const file = path.join(dir, "things.json");
    const a = new JsonStore<{ v: number }>(file);
    await a.load();
    await a.set("x", { v: 1 });
    await a.set("y", { v: 2 });

    const b = new JsonStore<{ v: number }>(file);
    await b.load();
    expect(b.get("x")).toEqual({ v: 1 });
    expect(b.size).toBe(2);
  });

  it("writes valid JSON (atomic rename, no temp leftovers in content)", async () => {
    const file = path.join(dir, "t.json");
    const s = new JsonStore<number>(file);
    await s.load();
    await Promise.all([s.set("a", 1), s.set("b", 2), s.set("c", 3)]);
    const raw = JSON.parse(await readFile(file, "utf8"));
    expect(Object.keys(raw).sort()).toEqual(["a", "b", "c"]);
  });

  it("refuses use before load()", async () => {
    const s = new JsonStore<number>(path.join(dir, "n.json"));
    expect(() => s.get("a")).toThrow(/before load/);
  });
});

describe("password hashing", () => {
  it("verifies correct passwords and rejects wrong ones", () => {
    const stored = hashPassword("s3cret-pass");
    expect(verifyPassword("s3cret-pass", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("uses a unique salt per hash", () => {
    expect(hashPassword("same")).not.toEqual(hashPassword("same"));
  });
});

describe("AccountService", () => {
  it("registers, logs in, and authenticates via token", async () => {
    const svc = new AccountService(dir);
    await svc.init();
    const reg = await svc.register({ name: "Louis Prince", email: "Louis@Example.com", password: "password123", ceaNumber: "R123456A" });
    expect(reg.agent.email).toBe("louis@example.com");
    expect((reg.agent as Record<string, unknown>).passwordHash).toBeUndefined();

    const login = await svc.login("louis@example.com", "password123");
    expect(svc.authenticate(login.token)?.id).toBe(reg.agent.id);
    expect(svc.authenticate("bogus")).toBeUndefined();

    await svc.logout(login.token);
    expect(svc.authenticate(login.token)).toBeUndefined();
  });

  it("survives a restart (accounts and sessions persist)", async () => {
    const svc = new AccountService(dir);
    await svc.init();
    const { token } = await svc.register({ name: "A", email: "a@b.co", password: "password123" });

    const svc2 = new AccountService(dir);
    await svc2.init();
    expect(svc2.authenticate(token)?.email).toBe("a@b.co");
    await expect(svc2.login("a@b.co", "password123")).resolves.toBeTruthy();
  });

  it("rejects duplicates, weak passwords and bad emails", async () => {
    const svc = new AccountService(dir);
    await svc.init();
    await svc.register({ name: "A", email: "a@b.co", password: "password123" });
    await expect(svc.register({ name: "B", email: "a@b.co", password: "password123" })).rejects.toThrow(AuthError);
    await expect(svc.register({ name: "C", email: "c@d.co", password: "short" })).rejects.toThrow(/8 characters/);
    await expect(svc.register({ name: "D", email: "not-an-email", password: "password123" })).rejects.toThrow(/valid email/);
    await expect(svc.login("a@b.co", "wrongpass")).rejects.toThrow(/incorrect/);
  });
});

describe("persistent repositories", () => {
  it("listings survive restart and filter by agent", async () => {
    const repo = new PersistentListingRepository(dir);
    await repo.init();
    const base = {
      intent: "sale" as const,
      price: { amount: 1_000_000, currency: "SGD" },
      photos: [],
      status: "active" as const,
      property: {
        id: "P1", type: "condo" as const, bedrooms: 2, bathrooms: 1, floorAreaSqm: 70,
        features: [], address: { line1: "1 Test St", country: "SG" as const },
      },
    };
    await repo.save({ ...base, id: "L1", agentId: "A-1", createdAt: "2026-07-18T01:00:00Z" });
    await repo.save({ ...base, id: "L2", agentId: "A-2", createdAt: "2026-07-18T02:00:00Z" });

    const repo2 = new PersistentListingRepository(dir);
    await repo2.init();
    expect((await repo2.list()).map((l) => l.id)).toEqual(["L2", "L1"]); // newest first
    expect(await repo2.listByAgent("A-1")).toHaveLength(1);
  });

  it("leads persist and summarize", async () => {
    const repo = new PersistentLeadRepository(dir);
    await repo.init();
    await repo.save({
      id: "lead-1", listingId: "L1", agentId: "A-1", contact: { name: "T" },
      source: "portal", stage: "contacted", history: [], createdAt: "2026-07-18T01:00:00Z",
    });
    const repo2 = new PersistentLeadRepository(dir);
    await repo2.init();
    expect((await repo2.pipelineSummary("A-1"))["contacted"]).toBe(1);
  });
});
