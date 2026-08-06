# Build Order — 4 Weeks

Do not attempt to build all 14 nodes at once. Ship stages 1–4, use them, then extend.

## Week 1 — Manual proof
Do 5 videos entirely by hand:
- Run the Agent A / B / C prompts (`../prompts/`) in a chat interface.
- Assemble with Submagic (the fast lane — auto-captions, ~90-sec turnaround).
- Publish manually.

**Goal:** prove the deconstruct → regenerate format works for your niche before automating a single node. If the manual videos don't perform, fix the prompts, not the plumbing.

## Week 2 — Automate Stages 1–4
- Import `../n8n/viral-content-engine.json`, wire nodes 01–07 only (intake → Apify → Whisper → Agent A → validate → Agent B → Telegram approval gate).
- Deactivate/skip nodes 08+ for now — take the approved script into Submagic by hand.

## Week 3 — Automate Stages 5–8
- Wire Agent C, the B-roll router + Switch (Pexels / Pixabay / Kling / library), ElevenLabs TTS, timeline builder, JSON2Video render.
- Start the local B-roll library from day one: every clip fetched or generated gets saved to `../library/broll/` and appended to `index.json` with tags.

## Week 4 — Distribution + the variant engine
- Wire Metricool scheduling (best-time slots) and the Google Sheets iteration log.
- Switch on `../scripts/variant_engine.js`: permute a proven script into up to 160 render payloads; post 3–5 variants per week across accounts.
- After ~40 logged data points, the winning hook_type and broll_set stop being a guess.

## Standing rules
- **NODE 07 approval gate is non-negotiable.** A 30-second approval on your phone protects the credibility being monetised.
- One B-roll cut every 1.5–2.5 seconds.
- Structure only from references, never wording. Every claim traces to a real proof asset.
- Build in public: the build of this pipeline is itself the first content series. The system that makes the content becomes the content.
