# AegisFX AI — Go-Live Guide

**From demo to real platform: exactly what to sign up for, in what order.**

Written in plain language for a founder who is new to trading technology.

---

## 1. First, the honest foundation (please read this twice)

**No AI in the world can guarantee daily profits.** Not ours, not anyone's.
Real trading always has losing days — even the best hedge funds lose money
regularly. A platform that promises "earn $500–$2,000 every day" would be:

- **Lying** — it is mathematically impossible to guarantee, and
- **Illegal** — advertising guaranteed trading income breaks financial-promotion
  law in nearly every country (Singapore MAS, Malaysia SC, EU MiFID, US
  CFTC/NFA…). Penalties include fines, app-store removal, and prosecution.

**What you CAN truthfully and legally say** (and what the demo already says):

> "The AI risks 1% aiming for 2–3% per trade, with a stop-loss on every trade
> and automatic loss limits. Fewer trades, better decisions. Losses are part
> of trading — the system's job is to keep them small and survivable."

This honest version is *also* the better business: platforms that promise
riches attract regulators and refunds; platforms that protect users keep them
for years.

**Your real first step:** a 30–60 minute consultation with a fintech lawyer in
your country. Providing trading signals/advice is a regulated activity in many
places (in Singapore, for example, it falls under the Financial Advisers Act).
The lawyer tells you exactly how the app must be worded and whether you need a
license or an exemption. This costs a few hundred dollars and protects
everything else you build.

---

## 2. How you make money (without being a broker)

You never hold anyone's money. Users' funds stay in **their own broker
account**. You earn from:

1. **Introducing Broker (IB) / affiliate commissions** — free to sign up:
   - IC Markets, Pepperstone, OANDA, Exness, Vantage, ThinkMarkets (all have
     partner programs on their websites).
   - You get a referral link. When your users open a broker account through it
     and trade, the broker pays you a rebate per lot — every trade, forever.
   - This is the answer to your commission question: **yes, this is exactly
     how signal platforms earn broker commissions.**
2. **Subscriptions** — the Starter / Professional / Elite / Institutional tiers
   already on your landing page, billed through Stripe.

---

## 3. What to sign up for — the technical stack (in order)

| # | Service | What it does | Cost to start |
|---|---|---|---|
| 1 | **Domain + Vercel or Cloudflare Pages** | Hosts the web app at your own address | ~$10/yr + free tier |
| 2 | **Supabase** (or Firebase) | User accounts, login, MFA, database | Free tier |
| 3 | **TwelveData or Polygon.io** | Live forex/gold/index price feed | Free tier → ~$29–79/mo |
| 4 | **MetaApi (metaapi.cloud)** | THE key piece: connects your platform to any user's MT4/MT5 account by API — read balance, place the orders they confirm | Free dev tier → usage-based |
| 5 | **cTrader Open API** (spotware.com) | Same idea for cTrader users | Free |
| 6 | **Anthropic Claude API** | The AI brain — the manager + specialist agents that score every setup | Usage-based |
| 7 | **OneSignal or Firebase Cloud Messaging** | Push notifications ("High-probability EUR/USD setup detected") | Free tier |
| 8 | **Stripe** | Subscription payments | Per-transaction |
| 9 | **Broker partner programs** (section 2) | Your commission income | Free |

**Mobile app note:** start as a **PWA** (installable web app — works on every
phone immediately, no app store approval). Move to React Native for the App
Store / Play Store in phase 3; both stores have strict rules for finance apps
and will check your wording (another reason section 1 matters).

---

## 4. Build order and realistic timeline

**Phase 1 — Live signals (4–8 weeks of development)**
- Web app + accounts + real price data + AI scoring engine + push alerts
- Users trade manually in their own broker app; AegisFX journals it
- Running cost roughly $100–300/month
- **You can launch and earn IB commissions at this phase already**

**Phase 2 — One-tap trading (4–6 weeks more)**
- MetaApi account linking: user connects MT5 → sees balance → taps BUY →
  order goes to *their* account with the stop-loss attached
- Loss limits + trading lock enforced server-side (exactly like the demo)

**Phase 3 — Scale**
- App Store / Play Store apps, more markets, portfolio tools, API tier

---

## 5. Compliance checklist before anything goes live

- [ ] Lawyer consultation done; wording approved for your country
- [ ] Risk disclosure on every screen (already in the demo — keep it)
- [ ] **Zero profit promises anywhere** — no "$X per day", no "everyone wins"
- [ ] Terms of Service + Privacy Policy (PDPA/GDPR as applicable)
- [ ] KYC is handled by the broker (one more reason never to hold funds)
- [ ] Clear label: decision support / education — the user always decides

---

## 6. Slogans (honest AND powerful — pick your favorite)

1. **"The AI watches. You decide."**
2. **"24 hours of AI. 15 minutes of you."**
3. **"Trade less. Decide better."**
4. **"One alert is worth a thousand charts."**
5. **"Your shield in the market."** (fits the Aegis name — an aegis is a shield)

---

## 7. What to ask Claude to build next

- The Phase-1 backend: real price feed + the multi-agent scoring engine
  (AEGIS Prime + specialists) on the Claude API, with push notifications
- The PWA version of the app with real signup (Supabase)
- The MetaApi integration for broker linking
- Stripe subscription pages for the four tiers

Bring this guide to each session and we build it piece by piece.
