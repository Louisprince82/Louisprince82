import type { Listing } from "@propos/core";
import { formatMoney, pricePerSqft } from "@propos/core";
import {
  grossRentalYieldPct,
  monthlyRepayment,
  stampDutySG,
  type BuyerProfile,
} from "@propos/finance";
import type { LLMProvider } from "./provider.js";

/** Every listing gets its own 24/7 AI sales agent (PART 4).
 *  A rule-based core answers the high-frequency questions instantly and
 *  accurately (numbers come from the finance engine, never hallucinated);
 *  an optional LLM handles everything else. */

export interface AgentAnswer {
  intent: string;
  answer: string;
  handledBy: "rules" | "llm";
}

export interface SalesAgentContext {
  buyerProfile?: BuyerProfile;
  propertiesOwned?: number;
  estimatedMonthlyRent?: number;
}

const disclaimer = "This is an estimate for planning only, not financial advice.";

export class ListingSalesAgent {
  constructor(
    private readonly listing: Listing,
    private readonly provider: LLMProvider | null = null,
  ) {}

  async ask(question: string, ctx: SalesAgentContext = {}): Promise<AgentAnswer> {
    const q = question.toLowerCase();
    const l = this.listing;
    const price = l.price.amount;
    const isSG = l.property.address.country === "SG";

    if (/(price|how much|cost of the|asking)/.test(q) && !/stamp|duty|loan|mortgage/.test(q)) {
      return {
        intent: "price",
        handledBy: "rules",
        answer:
          `The asking ${l.intent === "rent" ? "rent" : "price"} is ${formatMoney(l.price)}` +
          (l.intent === "sale"
            ? ` (about ${pricePerSqft(l.price, l.property.floorAreaSqm).toFixed(0)} psf). The seller is open to serious offers — would you like to arrange a viewing?`
            : ` per month. Would you like to arrange a viewing?`),
      };
    }

    if (isSG && /(stamp duty|absd|bsd)/.test(q)) {
      const profile = ctx.buyerProfile ?? "citizen";
      const owned = ctx.propertiesOwned ?? 0;
      const d = stampDutySG(price, profile, owned);
      return {
        intent: "stamp-duty",
        handledBy: "rules",
        answer:
          `For a ${profile} buying their ${owned === 0 ? "first" : `${owned + 1}th`} residential property at ` +
          `${formatMoney(l.price)}: BSD ≈ S$${d.bsd.toLocaleString()}, ABSD ≈ S$${d.absd.toLocaleString()}, ` +
          `total ≈ S$${d.total.toLocaleString()}. ${disclaimer}`,
      };
    }

    if (/(loan|mortgage|instalment|installment|monthly payment|repayment)/.test(q)) {
      const loan = price * 0.75;
      const pmt = monthlyRepayment({ principal: loan, annualRatePct: 3, tenureYears: 30 });
      return {
        intent: "loan",
        handledBy: "rules",
        answer:
          `With a 75% loan (S$${Math.round(loan).toLocaleString()}) at 3% p.a. over 30 years, the monthly ` +
          `instalment is about S$${Math.round(pmt).toLocaleString()}. I can run the numbers with your own income ` +
          `and rate — or connect you with our mortgage partners. ${disclaimer}`,
      };
    }

    if (/(yield|rental income|investment|roi)/.test(q)) {
      const rent = ctx.estimatedMonthlyRent ?? Math.round((price * 0.035) / 12);
      const y = grossRentalYieldPct({ purchasePrice: price, monthlyRent: rent });
      return {
        intent: "investment",
        handledBy: "rules",
        answer:
          `At an estimated rent of S$${rent.toLocaleString()}/month, gross rental yield is about ` +
          `${y.toFixed(2)}%. Ask me for the full investment brief — cash flow, area appreciation and ` +
          `comparable transactions. ${disclaimer}`,
      };
    }

    if (/(school|mrt|nearby|amenities|transport|around the area)/.test(q)) {
      return {
        intent: "area",
        handledBy: "rules",
        answer:
          `I've got a full area intelligence report for this address — schools, MRT stations, malls, parks, ` +
          `clinics and future developments, each with distances. Tap "Area Report" on the listing or tell me ` +
          `what matters most to you (schools? commute?) and I'll pull the details.`,
      };
    }

    if (/(view|visit|appointment|see the (place|house|unit)|available (this|on))/.test(q)) {
      return {
        intent: "viewing",
        handledBy: "rules",
        answer:
          `I'd love to show you the place! Viewings are available daily 10am–8pm. Share a day and time that ` +
          `suits you and I'll confirm with the agent right away.`,
      };
    }

    if (this.provider) {
      const answer = await this.provider.complete(
        `You are the sales agent for this property listing. Answer helpfully, honestly and concisely. ` +
        `Never invent facts not present in the data. Listing: ${JSON.stringify(this.listing)}\n\nQuestion: ${question}`,
        { maxTokens: 512 },
      );
      return { intent: "general", handledBy: "llm", answer };
    }

    return {
      intent: "general",
      handledBy: "rules",
      answer:
        `Great question — I've flagged it for the listing agent, who will reply shortly. Meanwhile I can help ` +
        `instantly with price, stamp duty, loan estimates, rental yield, the neighbourhood, or booking a viewing.`,
    };
  }
}
