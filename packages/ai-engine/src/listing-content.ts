import type { Listing } from "@propos/core";
import { formatMoney, getCountry, pricePerSqft } from "@propos/core";
import type { LLMProvider } from "./provider.js";

/** One upload → a full omnichannel marketing pack (PART 1 + PART 3). */

export type Channel =
  | "description"
  | "seo"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "youtube"
  | "xiaohongshu"
  | "twitter"
  | "email"
  | "whatsapp";

export type Persona = "standard" | "luxury" | "investment" | "family" | "young-couple" | "foreign-buyer";

export interface ContentPack {
  listingId: string;
  generatedBy: string; // provider name or "template"
  channels: Record<Channel, string>;
  personas: Record<Persona, string>;
}

export const ALL_CHANNELS: Channel[] = [
  "description", "seo", "facebook", "instagram", "tiktok", "linkedin",
  "youtube", "xiaohongshu", "twitter", "email", "whatsapp",
];

export const ALL_PERSONAS: Persona[] = [
  "standard", "luxury", "investment", "family", "young-couple", "foreign-buyer",
];

interface Facts {
  headline: string;
  typeLabel: string;
  price: string;
  psf: string;
  beds: number;
  baths: number;
  areaSqft: number;
  location: string;
  tenure: string;
  features: string[];
  intent: "sale" | "rent";
  regulations: string;
}

function extractFacts(listing: Listing): Facts {
  const p = listing.property;
  const country = getCountry(p.address.country);
  const areaSqft = Math.round(p.floorAreaSqm * 10.7639);
  const tenure =
    p.tenure?.kind === "freehold" ? "Freehold" :
    p.tenure?.kind === "leasehold" ? `${p.tenure.years}-year leasehold` : "";
  const typeLabel = p.type === "hdb" ? "HDB flat" : p.type.replace("-", " ");
  return {
    headline: `${p.bedrooms}-Bedroom ${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} at ${p.address.line1}`,
    typeLabel,
    price: formatMoney(listing.price),
    psf: pricePerSqft(listing.price, p.floorAreaSqm).toFixed(0),
    beds: p.bedrooms,
    baths: p.bathrooms,
    areaSqft,
    location: [p.address.line1, p.address.district, country.name].filter(Boolean).join(", "),
    tenure,
    features: p.features,
    intent: listing.intent,
    regulations: country.regulations.foreignOwnership,
  };
}

// ---------------------------------------------------------------------------
// Deterministic templates — the offline/fallback content engine.
// ---------------------------------------------------------------------------

const featureLine = (f: Facts) => (f.features.length ? ` Highlights include ${f.features.join(", ")}.` : "");
const dealWord = (f: Facts) => (f.intent === "sale" ? "for sale" : "for rent");

const channelTemplates: Record<Channel, (f: Facts) => string> = {
  description: (f) =>
    `${f.headline}\n\n` +
    `Presenting a ${f.beds}-bedroom, ${f.baths}-bathroom ${f.typeLabel} ${dealWord(f)} at ${f.location}. ` +
    `Spanning ${f.areaSqft.toLocaleString()} sqft${f.tenure ? ` on a ${f.tenure.toLowerCase()} title` : ""}, ` +
    `this home is offered at ${f.price} (${f.psf} psf).${featureLine(f)} ` +
    `Arrange a viewing today and experience it for yourself.`,
  seo: (f) =>
    `${f.beds}-bedroom ${f.typeLabel} ${dealWord(f)} in ${f.location} — ${f.areaSqft.toLocaleString()} sqft, ` +
    `${f.price}, ${f.psf} psf${f.tenure ? `, ${f.tenure.toLowerCase()}` : ""}. View photos, floor plan, area insights and mortgage estimates.`,
  facebook: (f) =>
    `🏡 JUST LISTED — ${f.headline}\n${f.beds}🛏 ${f.baths}🛁 | ${f.areaSqft.toLocaleString()} sqft | ${f.price}` +
    `${featureLine(f)}\n📩 DM us or comment "INFO" for the full brochure and viewing slots!`,
  instagram: (f) =>
    `✨ ${f.headline} ✨\n${f.price} · ${f.beds} beds · ${f.areaSqft.toLocaleString()} sqft` +
    `${featureLine(f)}\n#property #${f.typeLabel.replace(/\s/g, "")} #realestate #homesweethome #newlisting`,
  tiktok: (f) =>
    `POV: you just found your dream ${f.typeLabel} 🤯 ${f.beds} beds, ${f.areaSqft.toLocaleString()} sqft, ${f.price}. ` +
    `Wait for the ${f.features[0] ?? "living room"} 👀 #hometour #propertytok #housetour`,
  linkedin: (f) =>
    `New listing: ${f.headline}. A ${f.areaSqft.toLocaleString()} sqft ${f.typeLabel} ${dealWord(f)} at ${f.price} (${f.psf} psf)` +
    `${f.tenure ? `, ${f.tenure.toLowerCase()}` : ""}.${featureLine(f)} Reach out for the investment brief or to schedule a private viewing.`,
  youtube: (f) =>
    `Full walkthrough of ${f.headline}. In this tour we cover the layout (${f.beds} bed / ${f.baths} bath, ` +
    `${f.areaSqft.toLocaleString()} sqft), pricing (${f.price}, ${f.psf} psf), the neighbourhood, and who this home suits best. ` +
    `Timestamps below — enquiries via the link in the description.`,
  xiaohongshu: (f) =>
    `🏠 ${f.location}好房推荐！${f.beds}房${f.baths}卫，${f.areaSqft.toLocaleString()}平方英尺，${f.price}。` +
    `${f.features.length ? `亮点：${f.features.join("、")}。` : ""}想看房的宝子们快来私信我～ #买房 #房产 #安家`,
  twitter: (f) =>
    `Just listed: ${f.beds}-bed ${f.typeLabel} in ${f.location} — ${f.areaSqft.toLocaleString()} sqft at ${f.price} (${f.psf} psf). DM for viewing. 🏡`,
  email: (f) =>
    `Subject: New on the market — ${f.headline}\n\nHi {{first_name}},\n\n` +
    `A ${f.typeLabel} matching your search just went live: ${f.beds} bedrooms, ${f.baths} bathrooms, ` +
    `${f.areaSqft.toLocaleString()} sqft at ${f.location}, offered at ${f.price} (${f.psf} psf).` +
    `${featureLine(f)}\n\nReply to this email or book a viewing slot directly here: {{booking_link}}\n\nWarm regards,\n{{agent_name}}`,
  whatsapp: (f) =>
    `Hi! 👋 Sharing a new listing you might love: *${f.headline}* — ${f.beds}🛏 ${f.baths}🛁, ` +
    `${f.areaSqft.toLocaleString()} sqft, ${f.price}.${featureLine(f)} Shall I arrange a viewing this week?`,
};

const personaTemplates: Record<Persona, (f: Facts) => string> = {
  standard: (f) => channelTemplates.description(f),
  luxury: (f) =>
    `An exceptional residence for the discerning few. ${f.headline} offers ${f.areaSqft.toLocaleString()} sqft of ` +
    `refined living${f.tenure ? ` held on a coveted ${f.tenure.toLowerCase()} title` : ""}, quietly positioned in ${f.location}. ` +
    `${f.features.length ? `Signature touches — ${f.features.join(", ")} — elevate every day.` : ""} ` +
    `Offered at ${f.price}. Private viewings by appointment.`,
  investment: (f) =>
    `Investment brief: ${f.headline}. Entry at ${f.price} (${f.psf} psf) for ${f.areaSqft.toLocaleString()} sqft` +
    `${f.tenure ? `, ${f.tenure.toLowerCase()}` : ""}. Strong rentability drivers: ${f.features.slice(0, 3).join(", ") || "well-connected location"}. ` +
    `Request the full numbers pack — projected rental yield, cash flow and area appreciation data included.`,
  family: (f) =>
    `Room for everyone to grow. This ${f.beds}-bedroom ${f.typeLabel} in ${f.location} gives your family ` +
    `${f.areaSqft.toLocaleString()} sqft of space${f.features.length ? `, plus ${f.features.join(" and ")}` : ""}. ` +
    `Schools, parks and daily conveniences are close at hand — ask us for the full area report. ${f.price}.`,
  "young-couple": (f) =>
    `Your first home, done right. 💕 A smart ${f.beds}-bedroom ${f.typeLabel} at ${f.location} — ` +
    `${f.areaSqft.toLocaleString()} sqft at ${f.price} (${f.psf} psf). ` +
    `We'll walk you through the loan, grants and stamp duty numbers so there are no surprises. Book a weekend viewing!`,
  "foreign-buyer": (f) =>
    `International buyer brief: ${f.headline}, offered at ${f.price} (${f.psf} psf). ` +
    `Eligibility note: ${f.regulations} ` +
    `Our team handles financing, legal and tax guidance end-to-end for overseas purchasers.`,
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export class ListingContentGenerator {
  constructor(private readonly provider: LLMProvider | null = null) {}

  /** Deterministic pack, instantly. */
  generateTemplatePack(listing: Listing): ContentPack {
    const facts = extractFacts(listing);
    const channels = Object.fromEntries(
      ALL_CHANNELS.map((c) => [c, channelTemplates[c](facts)]),
    ) as Record<Channel, string>;
    const personas = Object.fromEntries(
      ALL_PERSONAS.map((p) => [p, personaTemplates[p](facts)]),
    ) as Record<Persona, string>;
    return { listingId: listing.id, generatedBy: "template", channels, personas };
  }

  /** LLM-polished pack when a provider is configured; template pack otherwise.
   *  The template pack is always the safety net — an LLM failure never breaks
   *  the listing flow. */
  async generate(listing: Listing): Promise<ContentPack> {
    const base = this.generateTemplatePack(listing);
    if (!this.provider) return base;
    try {
      const facts = extractFacts(listing);
      const prompt =
        `You are the marketing engine of a property platform. Rewrite each draft below into polished, ` +
        `channel-native copy. Keep every fact exactly as given (price, size, rooms, tenure). ` +
        `Return ONLY a JSON object with the same keys.\n\nFacts: ${JSON.stringify(facts)}\n\n` +
        `Drafts: ${JSON.stringify(base.channels)}`;
      const raw = await this.provider.complete(prompt, { maxTokens: 4096 });
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}");
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const polished = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Partial<Record<Channel, string>>;
        for (const c of ALL_CHANNELS) {
          if (typeof polished[c] === "string" && polished[c]!.trim()) base.channels[c] = polished[c]!;
        }
        base.generatedBy = this.provider.name;
      }
      return base;
    } catch {
      return base; // graceful degradation to template mode
    }
  }
}
