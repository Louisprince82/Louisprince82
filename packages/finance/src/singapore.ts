/** Singapore-specific property tax & lending rules (launch market).
 *  Rates current as of 2025/2026:
 *  - BSD tiers from 15 Feb 2023
 *  - ABSD rates from 27 Apr 2023
 *  - SSD regime from 4 Jul 2025 (4-year holding period)
 *  - TDSR 55%, MSR 30%, medium-term stress-test floor 4%
 *  Figures are for planning only — not financial advice. */

export type BuyerProfile = "citizen" | "pr" | "foreigner" | "entity";

export interface StampDutyResult {
  bsd: number;
  absd: number;
  total: number;
  breakdown: string[];
}

const BSD_TIERS: Array<{ upTo: number; rate: number }> = [
  { upTo: 180_000, rate: 0.01 },
  { upTo: 360_000, rate: 0.02 },
  { upTo: 1_000_000, rate: 0.03 },
  { upTo: 1_500_000, rate: 0.04 },
  { upTo: 3_000_000, rate: 0.05 },
  { upTo: Infinity, rate: 0.06 },
];

const ABSD_RATES: Record<BuyerProfile, number[]> = {
  // index = number of residential properties already owned (0 = first purchase)
  citizen: [0, 0.2, 0.3],
  pr: [0.05, 0.3, 0.35],
  foreigner: [0.6, 0.6, 0.6],
  entity: [0.65, 0.65, 0.65],
};

export function buyerStampDutySG(price: number): { amount: number; breakdown: string[] } {
  let remaining = price;
  let prevCap = 0;
  let amount = 0;
  const breakdown: string[] = [];
  for (const tier of BSD_TIERS) {
    if (remaining <= 0) break;
    const band = Math.min(remaining, tier.upTo - prevCap);
    const duty = band * tier.rate;
    amount += duty;
    breakdown.push(`${(tier.rate * 100).toFixed(0)}% on ${band.toLocaleString()} = ${Math.round(duty).toLocaleString()}`);
    remaining -= band;
    prevCap = tier.upTo;
  }
  return { amount: Math.round(amount), breakdown };
}

export function additionalBuyerStampDutySG(price: number, profile: BuyerProfile, propertiesOwned: number): number {
  const rates = ABSD_RATES[profile];
  const rate = rates[Math.min(propertiesOwned, rates.length - 1)];
  return Math.round(price * rate);
}

export function stampDutySG(price: number, profile: BuyerProfile, propertiesOwned = 0): StampDutyResult {
  const { amount: bsd, breakdown } = buyerStampDutySG(price);
  const absd = additionalBuyerStampDutySG(price, profile, propertiesOwned);
  return { bsd, absd, total: bsd + absd, breakdown };
}

/** Seller's Stamp Duty — residential purchases from 4 Jul 2025 (4-year regime). */
export function sellerStampDutySG(price: number, holdingYears: number): number {
  const rate =
    holdingYears < 1 ? 0.16 :
    holdingYears < 2 ? 0.12 :
    holdingYears < 3 ? 0.08 :
    holdingYears < 4 ? 0.04 : 0;
  return Math.round(price * rate);
}

// ---------------------------------------------------------------------------
// Lending limits
// ---------------------------------------------------------------------------

export const TDSR_LIMIT = 0.55;
export const MSR_LIMIT = 0.3;
export const STRESS_TEST_RATE_PCT = 4;

/** LTV limit by existing housing-loan count (bank loans, standard tenure/age). */
export function loanToValueLimitSG(existingHousingLoans: number): number {
  if (existingHousingLoans <= 0) return 0.75;
  if (existingHousingLoans === 1) return 0.45;
  return 0.35;
}

export interface AffordabilityInput {
  grossMonthlyIncome: number;
  monthlyDebtObligations: number; // car loans, cards, other property loans…
  tenureYears: number;
  isHdbOrEc: boolean;
  existingHousingLoans: number;
  cashAndCpfAvailable: number; // for downpayment + stamp duties
  interestRatePct?: number; // actual package rate, for instalment estimate
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
}

import { maxLoanForBudget, monthlyRepayment } from "./mortgage.js";

/** How much home a buyer can afford under TDSR/MSR + LTV + available funds. */
export function affordabilitySG(input: AffordabilityInput): AffordabilityResult {
  const notes: string[] = [];
  const tdsrBudget = Math.max(0, input.grossMonthlyIncome * TDSR_LIMIT - input.monthlyDebtObligations);
  let monthlyBudget = tdsrBudget;
  let msrBudget: number | undefined;
  if (input.isHdbOrEc) {
    msrBudget = input.grossMonthlyIncome * MSR_LIMIT;
    monthlyBudget = Math.min(tdsrBudget, msrBudget);
    notes.push("MSR 30% applies (HDB/EC).");
  }

  const maxLoanByIncome = maxLoanForBudget(monthlyBudget, STRESS_TEST_RATE_PCT, input.tenureYears);
  const ltvLimit = loanToValueLimitSG(input.existingHousingLoans);

  // Price is capped by both LTV (loan can't exceed ltv * price) and funds
  // (downpayment + ~5% BSD/costs buffer must come from cash/CPF).
  const priceByFunds = input.cashAndCpfAvailable / (1 - ltvLimit + 0.05);
  const priceByLoan = maxLoanByIncome / ltvLimit;
  const maxPurchasePrice = Math.max(0, Math.min(priceByFunds, priceByLoan));
  const maxLoan = Math.min(maxLoanByIncome, maxPurchasePrice * ltvLimit);

  if (priceByFunds < priceByLoan) notes.push("Constrained by available cash/CPF, not income.");
  else notes.push("Constrained by income (TDSR/MSR), not funds.");
  notes.push(`Stress-tested at ${STRESS_TEST_RATE_PCT}% p.a.; LTV limit ${ltvLimit * 100}%.`);

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
  };
}
