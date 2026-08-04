import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { JsonStore } from "./json-store.js";

/** Agent accounts + session tokens (Phase 1 auth).
 *  Passwords are scrypt-hashed with a per-account salt; tokens are opaque
 *  random bearer tokens. No external dependencies. */

export type AgentTier = "free" | "professional" | "agency" | "enterprise";

/** Two-sided platform: customers (owners/buyers, can list FSBO for free)
 *  and CEA-registered agents. */
export type AccountRole = "customer" | "agent";

export interface CeaDetails {
  status: "verified" | "expired" | "not-found" | "unavailable" | "unchecked";
  registeredName?: string;
  agencyName?: string;
  agencyLicenseNo?: string;
  validUntil?: string;
  lastVerifiedAt?: string;
}

export interface AgentAccount {
  id: string;
  role: AccountRole;
  name: string;
  email: string;
  phone?: string; // E.164-ish, for the WhatsApp lead flow
  passwordHash: string; // salt:hex
  ceaNumber?: string; // Singapore CEA registration number
  cea?: CeaDetails; // result of the official register check
  tier: AgentTier;
  createdAt: string;
}

export type PublicAgent = Omit<AgentAccount, "passwordHash">;

export function toPublicAgent({ passwordHash: _passwordHash, ...rest }: AgentAccount): PublicAgent {
  return rest;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

interface Session {
  token: string;
  agentId: string;
  createdAt: string;
}

export class AccountService {
  private readonly agents: JsonStore<AgentAccount>;
  private readonly sessions: JsonStore<Session>;

  constructor(dataDir: string) {
    this.agents = new JsonStore<AgentAccount>(path.join(dataDir, "agents.json"));
    this.sessions = new JsonStore<Session>(path.join(dataDir, "sessions.json"));
  }

  async init(): Promise<void> {
    await this.agents.load();
    await this.sessions.load();
  }

  async register(input: {
    name: string;
    email: string;
    password: string;
    role?: AccountRole;
    phone?: string;
    ceaNumber?: string;
  }): Promise<{ agent: PublicAgent; token: string }> {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError("A valid email is required");
    if (input.password.length < 8) throw new AuthError("Password must be at least 8 characters");
    if (this.agents.find((a) => a.email === email)) throw new AuthError("An account with this email already exists");

    const role = input.role ?? "agent";
    const ceaNumber = input.ceaNumber?.trim().toUpperCase() || undefined;
    const agent: AgentAccount = {
      id: `${role}-${randomUUID().slice(0, 8)}`,
      role,
      name: input.name.trim(),
      email,
      phone: input.phone?.replace(/[^+\d]/g, "") || undefined,
      passwordHash: hashPassword(input.password),
      ceaNumber: role === "agent" ? ceaNumber : undefined,
      cea: role === "agent" && ceaNumber ? { status: "unchecked" } : undefined,
      tier: "free",
      createdAt: new Date().toISOString(),
    };
    await this.agents.set(agent.id, agent);
    return { agent: toPublicAgent(agent), token: await this.issueToken(agent.id) };
  }

  /** Record the outcome of an official CEA register check (spec §2:
   *  store status + last-verified, re-check quarterly). */
  async updateCeaVerification(agentId: string, cea: CeaDetails): Promise<PublicAgent | undefined> {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;
    const updated: AgentAccount = { ...agent, cea };
    await this.agents.set(agentId, updated);
    return toPublicAgent(updated);
  }

  getById(agentId: string): PublicAgent | undefined {
    const agent = this.agents.get(agentId);
    return agent ? toPublicAgent(agent) : undefined;
  }

  async login(email: string, password: string): Promise<{ agent: PublicAgent; token: string }> {
    const agent = this.agents.find((a) => a.email === email.trim().toLowerCase());
    if (!agent || !verifyPassword(password, agent.passwordHash)) {
      throw new AuthError("Email or password is incorrect");
    }
    return { agent: toPublicAgent(agent), token: await this.issueToken(agent.id) };
  }

  /** Returns the account for a bearer token, or undefined. */
  authenticate(token: string | undefined): PublicAgent | undefined {
    if (!token) return undefined;
    const session = this.sessions.get(token);
    if (!session) return undefined;
    const agent = this.agents.get(session.agentId);
    return agent ? toPublicAgent(agent) : undefined;
  }

  async logout(token: string): Promise<void> {
    await this.sessions.delete(token);
  }

  private async issueToken(agentId: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    await this.sessions.set(token, { token, agentId, createdAt: new Date().toISOString() });
    return token;
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
