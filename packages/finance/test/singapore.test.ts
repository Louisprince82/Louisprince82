import { describe, expect, it } from "vitest";
import {
  affordabilitySG,
  buyerStampDutySG,
  loanToValueLimitSG,
  monthlyRepayment,
  maxLoanForBudget,
  policyAt,
  sellerStampDutySG,
  stampDutySG,
  grossRentalYieldPct,
  monthlyCashFlow,
} from "../src/index.js";

describe("Versioned policy engine (M11 rule: no hardcoded rates)", () => {
  it("resolves the version in force on a date", () => {
    expect(policyAt(new Date("2026-08-03")).versionId).toBe("SG-2025.07");
    expect(policyAt(new Date("2024-06-01")).versionId).toBe("SG-2023.04");
  });

  it("throws for dates before the earliest version", () => {
    expect(() => policyAt(new Date("2020-01-01"))).toThrow(/No Singapore policy version/);
  });

  it("applies the SSD regime of the purchase date: 3-year pre-Jul-2025, 4-year after", () => {
    // Bought mid-2024 (old regime): 3.5 years held → 0%
    expect(sellerStampDutySG(1_000_000, 3.5, new Date("2024-06-01"))).toBe(0);
    // Bought after Jul 2025 (new regime): 3.5 years held → 4%
    expect(sellerStampDutySG(1_000_000, 3.5, new Date("2025-08-01"))).toBe(40_000);
    // Old regime, sold within year 1 → 12% (not 16%)
    expect(sellerStampDutySG(1_000_000, 0.5, new Date("2024-06-01"))).toBe(120_000);
  });

  it("stamps every structured result with its policy version", () => {
    expect(stampDutySG(1_000_000, "citizen").policyVersion).toBe("SG-2025.07");
    expect(
      affordabilitySG({
        grossMonthlyIncome: 10_000, monthlyDebtObligations: 0, tenureYears: 30,
        isHdbOrEc: false, existingHousingLoans: 0, cashAndCpfAvailable: 300_000,
      }).policyVersion,
    ).toBe("SG-2025.07");
  });
});

describe("Singapore Buyer's Stamp Duty (post Feb-2023 tiers)", () => {
  it("computes BSD for a $1.5M condo", () => {
    // 1% × 180k + 2% × 180k + 3% × 640k + 4% × 500k = 44,600
    expect(buyerStampDutySG(1_500_000).amount).toBe(44_600);
  });

  it("computes BSD for a $3.5M property crossing the 6% tier", () => {
    expect(buyerStampDutySG(3_500_000).amount).toBe(149_600);
  });

  it("computes BSD for a $500k HDB flat", () => {
    // 1,800 + 3,600 + 3% × 140k = 9,600
    expect(buyerStampDutySG(500_000).amount).toBe(9_600);
  });
});

describe("ABSD (post Apr-2023 rates)", () => {
  it("is zero for a citizen's first property", () => {
    expect(stampDutySG(1_000_000, "citizen", 0).absd).toBe(0);
  });

  it("is 20% for a citizen's second property", () => {
    expect(stampDutySG(1_000_000, "citizen", 1).absd).toBe(200_000);
  });

  it("is 60% for foreigners regardless of count", () => {
    expect(stampDutySG(2_000_000, "foreigner", 0).absd).toBe(1_200_000);
  });

  it("is 5% for a PR's first property", () => {
    expect(stampDutySG(1_000_000, "pr", 0).absd).toBe(50_000);
  });
});

describe("Seller's Stamp Duty (Jul-2025 4-year regime)", () => {
  it("charges 16% within year 1 and 0% after 4 years", () => {
    expect(sellerStampDutySG(1_000_000, 0.5)).toBe(160_000);
    expect(sellerStampDutySG(1_000_000, 3.5)).toBe(40_000);
    expect(sellerStampDutySG(1_000_000, 4)).toBe(0);
  });
});

describe("Mortgage math", () => {
  it("computes a standard annuity instalment", () => {
    // $750k, 3% p.a., 25 years → ≈ $3,556.75/month
    const pmt = monthlyRepayment({ principal: 750_000, annualRatePct: 3, tenureYears: 25 });
    expect(pmt).toBeCloseTo(3556.75, 0);
  });

  it("maxLoanForBudget inverts monthlyRepayment", () => {
    const loan = maxLoanForBudget(3556.75, 3, 25);
    expect(loan).toBeCloseTo(750_000, -2);
  });

  it("handles zero interest", () => {
    expect(monthlyRepayment({ principal: 120_000, annualRatePct: 0, tenureYears: 10 })).toBe(1000);
  });
});

describe("LTV limits", () => {
  it("steps down 75% → 45% → 35% by loan count", () => {
    expect(loanToValueLimitSG(0)).toBe(0.75);
    expect(loanToValueLimitSG(1)).toBe(0.45);
    expect(loanToValueLimitSG(2)).toBe(0.35);
  });
});

describe("Affordability (TDSR/MSR)", () => {
  it("applies TDSR 55% for private property", () => {
    const r = affordabilitySG({
      grossMonthlyIncome: 12_000,
      monthlyDebtObligations: 1_000,
      tenureYears: 30,
      isHdbOrEc: false,
      existingHousingLoans: 0,
      cashAndCpfAvailable: 400_000,
    });
    expect(r.tdsrBudget).toBe(5_600); // 12k × 0.55 − 1k
    expect(r.monthlyBudget).toBe(5_600);
    expect(r.maxLoan).toBeGreaterThan(0);
    expect(r.ltvLimit).toBe(0.75);
  });

  it("caps HDB buyers at MSR 30% when tighter than TDSR", () => {
    const r = affordabilitySG({
      grossMonthlyIncome: 8_000,
      monthlyDebtObligations: 0,
      tenureYears: 25,
      isHdbOrEc: true,
      existingHousingLoans: 0,
      cashAndCpfAvailable: 200_000,
    });
    expect(r.msrBudget).toBe(2_400);
    expect(r.monthlyBudget).toBe(2_400); // MSR (2,400) < TDSR (4,400)
  });
});

describe("Investment analytics", () => {
  it("computes gross rental yield", () => {
    expect(grossRentalYieldPct({ purchasePrice: 1_200_000, monthlyRent: 4_000 })).toBeCloseTo(4.0, 5);
  });

  it("computes monthly cash flow with vacancy allowance", () => {
    const cf = monthlyCashFlow({
      monthlyRent: 4_000,
      monthlyMortgage: 2_800,
      monthlyMaintenance: 350,
      vacancyRatePct: 5,
    });
    expect(cf).toBeCloseTo(650, 5); // 3,800 − 2,800 − 350
  });
});
