/** Singapore-specific property tax & lending calculators.
 *  NO RATES ARE HARDCODED HERE: every ratio, tier and cap resolves from the
 *  versioned policy table (`policy.ts`), and every structured result records
 *  which policy version produced it, so historical calculations stay
 *  reproducible when the government moves a rate.
 *  Figures are planning estimates only — not financial advice. */

import { maxLoanForBudget, monthlyRepayment } from "./mortgage.js";
import { policyAt, type SgPolicyVersion } from "./policy.js";

export type BuyerProfile = "citizen" | "pr" | "foreigner" | "entity";

export interface StampDutyResult {
  bsd: number;
  absd: number;
  total: number;
  breakdown: string[];
  policyVersion: string;
}

export function buyerStampDutySG(
  price: number,
  at: Date = new Date(),
): { amount: number; breakdown: string[]; policyVersion: string } {
  const policy = policyAt(at);
  let remaining = price;
  let prevCap = 0;
  let amount = 0;
  const breakdown: string[] = [];
  for (const tier of policy.bsdTiers) {
    if (remaining <= 0) break;
    const band = Math.min(remaining, tier.upTo - prevCap);
    const duty = band * tier.rate;
    amount += duty;
    breakdown.push(`${(tier.rate * 100).toFixed(0)}% on ${band.toLocaleString()} = ${Math.round(duty).toLocaleString()}`);
    remaining -= band;
    prevCap = tier.upTo;
  }
  return { amount: Math.round(amount), breakdown, policyVersion: policy.versionId };
}

export function additionalBuyerStampDutySG(
  price: number,
  profile: BuyerProfile,
  propertiesOwned: number,
  at: Date = new Date(),
): number {
  const rates = policyAt(at).absd[profile];
  const rate = rates[Math.min(propertiesOwned, rates.length - 1)];
  return Math.round(price * rate);
}

export function stampDutySG(
  price: number,
  profile: BuyerProfile,
  propertiesOwned = 0,
  at: Date = new Date(),
): StampDutyResult {
  const { amount: bsd, breakdown, policyVersion } = buyerStampDutySG(price, at);
  const absd = additionalBuyerStampDutySG(price, profile, propertiesOwned, at);
  return { bsd, absd, total: bsd + absd, breakdown, policyVersion };
}

/** Seller's Stamp Duty. `at` is the (contract) purchase date — the regime in
 *  force when the seller bought determines their SSD schedule. */
export function sellerStampDutySG(price: number, holdingYears: number, at: Date = new Date()): number {
  const tier = policyAt(at).ssdTiers.find((t) => holdingYears < t.maxYears);
  return Math.round(price * (tier?.rate ?? 0));
}

// ---------------------------------------------------------------------------
// Lending limits
// ---------------------------------------------------------------------------

export function loanToValueLimitSG(existingHousingLoans: number, at: Date = new Date()): number {
  const tiers = policyAt(at).ltvByLoanCount;
  return tiers[Math.min(Math.max(existingHousingLoans, 0), tiers.length - 1)];
}

export interface AffordabilityInput {
  grossMonthlyIncome: number;
  monthlyDebtObligations: number; // car loans, cards, other property loans…
  tenureYears: number;
  isHdbOrEc: boolean;
  existingHousingLoans: number;
  cashAndCpfAvailable: number; // for downpayment + stamp duties
  interestRatePct?: number; // actual package rate, for instalment estimate
  at?: Date;
}

export interface AffordabilityResult {
  tdsrBudget: number;
  msrBudget?: number;
  monthlyBudget: number;
  maxLoan: number;
  ltvLimit: number;
  maxPurchasePrice: number;
  estimatedMonthlyInstalment: number;
  notes: string[];
  policyVersion: string;
}

/** How much home a buyer can afford under TDSR/MSR + LTV + available funds. */
export function affordabilitySG(input: AffordabilityInput): AffordabilityResult {
  const at = input.at ?? new Date();
  const policy: SgPolicyVersion = policyAt(at);
  const notes: string[] = [];

  const tdsrBudget = Math.max(0, input.grossMonthlyIncome * policy.tdsrCap - input.monthlyDebtObligations);
  let monthlyBudget = tdsrBudget;
  let msrBudget: number | undefined;
  if (input.isHdbOrEc) {
    msrBudget = input.grossMonthlyIncome * policy.msrCap;
    monthlyBudget = Math.min(tdsrBudget, msrBudget);
    notes.push(`MSR ${policy.msrCap * 100}% applies (HDB/EC).`);
  }

  const maxLoanByIncome = maxLoanForBudget(monthlyBudget, policy.stressRatePct, input.tenureYears);
  const ltvLimit = loanToValueLimitSG(input.existingHousingLoans, at);

  // Price is capped by both LTV (loan can't exceed ltv * price) and funds
  // (downpayment + ~5% BSD/costs buffer must come from cash/CPF).
  const priceByFunds = input.cashAndCpfAvailable / (1 - ltvLimit + 0.05);
  const priceByLoan = maxLoanByIncome / ltvLimit;
  const maxPurchasePrice = Math.max(0, Math.min(priceByFunds, priceByLoan));
  const maxLoan = Math.min(maxLoanByIncome, maxPurchasePrice * ltvLimit);

  if (priceByFunds < priceByLoan) notes.push("Constrained by available cash/CPF, not income.");
  else notes.push("Constrained by income (TDSR/MSR), not funds.");
  notes.push(`Stress-tested at ${policy.stressRatePct}% p.a.; LTV limit ${ltvLimit * 100}%.`);

  const estimatedMonthlyInstalment = monthlyRepayment({
    principal: maxLoan,
    annualRatePct: input.interestRatePct ?? 3,
    tenureYears: input.tenureYears,
  });

  return {
    tdsrBudget: Math.round(tdsrBudget),
    msrBudget: msrBudget === undefined ? undefined : Math.round(msrBudget),
    monthlyBudget: Math.round(monthlyBudget),
    maxLoan: Math.round(maxLoan),
    ltvLimit,
    maxPurchasePrice: Math.round(maxPurchasePrice),
    estimatedMonthlyInstalment: Math.round(estimatedMonthlyInstalment),
    notes,
    policyVersion: policy.versionId,
  };
}
