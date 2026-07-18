/** Country-agnostic mortgage math (PART 8). */

export interface MortgageInput {
  principal: number;
  annualRatePct: number;
  tenureYears: number;
}

export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

/** Standard annuity formula. Returns the fixed monthly instalment. */
export function monthlyRepayment({ principal, annualRatePct, tenureYears }: MortgageInput): number {
  const n = tenureYears * 12;
  if (n <= 0 || principal <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function amortizationSchedule(input: MortgageInput): AmortizationRow[] {
  const payment = monthlyRepayment(input);
  const r = input.annualRatePct / 100 / 12;
  const rows: AmortizationRow[] = [];
  let balance = input.principal;
  for (let month = 1; month <= input.tenureYears * 12; month++) {
    const interest = balance * r;
    const principalPaid = Math.min(payment - interest, balance);
    balance = Math.max(0, balance - principalPaid);
    rows.push({ month, payment, interest, principal: principalPaid, balance });
  }
  return rows;
}

export function totalInterest(input: MortgageInput): number {
  return monthlyRepayment(input) * input.tenureYears * 12 - input.principal;
}

/** Max loan such that the instalment (at a stress-test rate) stays within a
 *  debt-service budget. Inverse of the annuity formula. */
export function maxLoanForBudget(monthlyBudget: number, stressRatePct: number, tenureYears: number): number {
  const n = tenureYears * 12;
  if (monthlyBudget <= 0 || n <= 0) return 0;
  const r = stressRatePct / 100 / 12;
  if (r === 0) return monthlyBudget * n;
  return (monthlyBudget * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
}
