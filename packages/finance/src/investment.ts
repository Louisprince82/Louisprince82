/** Investment analytics: yield, cash flow, ROI (PARTS 8–9).
 *  Educational analysis only — not financial advice. */

export interface RentalYieldInput {
  purchasePrice: number;
  monthlyRent: number;
  annualExpenses?: number; // maintenance, tax, insurance, vacancy allowance…
}

export function grossRentalYieldPct({ purchasePrice, monthlyRent }: RentalYieldInput): number {
  return purchasePrice > 0 ? ((monthlyRent * 12) / purchasePrice) * 100 : 0;
}

export function netRentalYieldPct({ purchasePrice, monthlyRent, annualExpenses = 0 }: RentalYieldInput): number {
  return purchasePrice > 0 ? ((monthlyRent * 12 - annualExpenses) / purchasePrice) * 100 : 0;
}

export interface CashFlowInput {
  monthlyRent: number;
  monthlyMortgage: number;
  monthlyMaintenance: number;
  monthlyOtherCosts?: number;
  vacancyRatePct?: number; // expected vacancy, default 5%
}

export function monthlyCashFlow(input: CashFlowInput): number {
  const vacancy = (input.vacancyRatePct ?? 5) / 100;
  const effectiveRent = input.monthlyRent * (1 - vacancy);
  return effectiveRent - input.monthlyMortgage - input.monthlyMaintenance - (input.monthlyOtherCosts ?? 0);
}

export interface RoiInput {
  purchasePrice: number;
  totalCashInvested: number; // downpayment + stamp duty + reno
  annualNetIncome: number;
  projectedAnnualAppreciationPct?: number;
}

/** Cash-on-cash return plus (optionally) appreciation-inclusive total return. */
export function returnOnInvestment(input: RoiInput): { cashOnCashPct: number; totalReturnPct: number } {
  const cashOnCashPct = input.totalCashInvested > 0
    ? (input.annualNetIncome / input.totalCashInvested) * 100
    : 0;
  const appreciation = input.purchasePrice * ((input.projectedAnnualAppreciationPct ?? 0) / 100);
  const totalReturnPct = input.totalCashInvested > 0
    ? ((input.annualNetIncome + appreciation) / input.totalCashInvested) * 100
    : 0;
  return { cashOnCashPct, totalReturnPct };
}
