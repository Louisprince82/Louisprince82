/** Versioned Singapore policy parameters (spec M11 engineering rule):
 *  ratios, duty tiers and lending caps change by government announcement,
 *  so NOTHING in the calculators hardcodes a rate. Every calculation
 *  resolves the policy version in force on its date and records which
 *  version produced the result.
 *
 *  Sources: MAS (TDSR/MSR/LTV/stress rate), IRAS (BSD/ABSD/SSD).
 *  In production this table is DB-backed (`policy_parameters`); this module
 *  is the seed + resolution logic. */

import type { BuyerProfile } from "./singapore.js";

export interface DutyTier {
  upTo: number; // upper bound of the band (Infinity for the top band)
  rate: number;
}

export interface SsdTier {
  maxYears: number; // applies when holding period < maxYears
  rate: number;
}

export interface SgPolicyVersion {
  versionId: string;
  effectiveFrom: string; // ISO date (inclusive)
  sources: string[];
  bsdTiers: DutyTier[];
  absd: Record<BuyerProfile, number[]>; // index = properties already owned
  ssdTiers: SsdTier[];
  tdsrCap: number;
  msrCap: number;
  stressRatePct: number;
  ltvByLoanCount: number[]; // index = existing housing loans (last entry = 2+)
}

/** Newest first. Append a new version when the government moves a rate —
 *  never edit an old one (historical calculations must stay reproducible). */
export const SG_POLICY_VERSIONS: SgPolicyVersion[] = [
  {
    versionId: "SG-2025.07",
    effectiveFrom: "2025-07-04", // SSD holding period extended to 4 years
    sources: ["IRAS SSD revision Jul 2025", "IRAS BSD Feb 2023", "IRAS ABSD Apr 2023", "MAS TDSR/MSR/LTV"],
    bsdTiers: [
      { upTo: 180_000, rate: 0.01 },
      { upTo: 360_000, rate: 0.02 },
      { upTo: 1_000_000, rate: 0.03 },
      { upTo: 1_500_000, rate: 0.04 },
      { upTo: 3_000_000, rate: 0.05 },
      { upTo: Infinity, rate: 0.06 },
    ],
    absd: {
      citizen: [0, 0.2, 0.3],
      pr: [0.05, 0.3, 0.35],
      foreigner: [0.6, 0.6, 0.6],
      entity: [0.65, 0.65, 0.65],
    },
    ssdTiers: [
      { maxYears: 1, rate: 0.16 },
      { maxYears: 2, rate: 0.12 },
      { maxYears: 3, rate: 0.08 },
      { maxYears: 4, rate: 0.04 },
    ],
    tdsrCap: 0.55,
    msrCap: 0.3,
    stressRatePct: 4,
    ltvByLoanCount: [0.75, 0.45, 0.35],
  },
  {
    versionId: "SG-2023.04",
    effectiveFrom: "2023-04-27", // ABSD raised (foreigners 60%)
    sources: ["IRAS BSD Feb 2023", "IRAS ABSD Apr 2023", "IRAS SSD Mar 2017", "MAS TDSR/MSR/LTV"],
    bsdTiers: [
      { upTo: 180_000, rate: 0.01 },
      { upTo: 360_000, rate: 0.02 },
      { upTo: 1_000_000, rate: 0.03 },
      { upTo: 1_500_000, rate: 0.04 },
      { upTo: 3_000_000, rate: 0.05 },
      { upTo: Infinity, rate: 0.06 },
    ],
    absd: {
      citizen: [0, 0.2, 0.3],
      pr: [0.05, 0.3, 0.35],
      foreigner: [0.6, 0.6, 0.6],
      entity: [0.65, 0.65, 0.65],
    },
    // Pre-Jul-2025 SSD: 3-year holding period
    ssdTiers: [
      { maxYears: 1, rate: 0.12 },
      { maxYears: 2, rate: 0.08 },
      { maxYears: 3, rate: 0.04 },
    ],
    tdsrCap: 0.55,
    msrCap: 0.3,
    stressRatePct: 4,
    ltvByLoanCount: [0.75, 0.45, 0.35],
  },
];

/** Resolve the policy version in force on a given date. */
export function policyAt(at: Date = new Date()): SgPolicyVersion {
  const t = at.toISOString().slice(0, 10);
  const found = SG_POLICY_VERSIONS.find((v) => v.effectiveFrom <= t);
  if (!found) {
    throw new Error(`No Singapore policy version in force on ${t} (earliest is ${SG_POLICY_VERSIONS.at(-1)?.effectiveFrom})`);
  }
  return found;
}
