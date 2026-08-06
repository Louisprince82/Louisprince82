# Viral Content Engine

Reference link in → cinematic original short-form video out → auto-published → funnel to AI automation course sales.

This directory is the buildable implementation of the master blueprint: a 9-stage pipeline that deconstructs the *structure* of high-performing short-form videos (never their content), regenerates an original script in your voice, sources B-roll, renders the video via API, and schedules it — all orchestrated in n8n with one human approval gate.

## Pipeline

```
[1] INGEST        Paste competitor URL (TikTok / YT Short / Reel)
[2] EXTRACT       Apify download + Whisper transcript
[3] DECONSTRUCT   Agent A → format DNA as JSON          (prompts/agent-a-deconstruct.md)
[4] REGENERATE    Agent B → new original script          (prompts/agent-b-regenerate.md)
      ── APPROVAL GATE (Telegram, ~30 seconds) ──
[5] TAG           Agent C → per-line B-roll keywords     (prompts/agent-c-broll.md)
[6] SOURCE        Pexels / Pixabay / Artgrid / Kling / local library
[7] VOICE         ElevenLabs TTS
[8] ASSEMBLE      JSON timeline → JSON2Video render → MP4
[9] DISTRIBUTE    Metricool best-time scheduling
```

Stages 3–8 run unattended. Manual input is Stage 1 plus the approval gate after Stage 4.

## Directory map

| Path | What it is |
|---|---|
| `prompts/` | The three agent prompts (A: deconstruct, B: regenerate, C: B-roll tag). Single source of truth — n8n nodes load these. |
| `n8n/viral-content-engine.json` | Importable n8n workflow implementing all 14 nodes of the spec. |
| `scripts/validate_agent_json.js` | Code for NODE 05 — validates/repairs agent JSON output, signals retry. |
| `scripts/build_timeline.js` | Code for NODE 11 — merges script + B-roll map + TTS timings into a JSON2Video render payload. |
| `scripts/variant_engine.js` | The 100-variant engine — permutes hooks × B-roll sets × pace × captions × thumbnails into render payloads. |
| `scripts/broll_router.js` | Source-class routing logic (which API serves which tag class). |
| `config/broll-sources.json` | The "bureau tree": tag class → source mapping and cut-rate rules. |
| `config/.env.example` | Every API key the pipeline needs, documented. |
| `docs/build-order.md` | The 4-week build sequence. Ship stages 1–4 first. |
| `docs/monetisation-ladder.md` | The 5-tier funnel the content feeds. |
| `library/broll/` | Local B-roll library. Every downloaded/generated clip lands here with tags — the compounding asset. |

## Quick start

1. Copy `config/.env.example` to your n8n instance's credential store (each key becomes an n8n credential — never commit real keys).
2. Import `n8n/viral-content-engine.json` into n8n (Workflows → Import from file).
3. Attach credentials to the Apify, OpenAI, Anthropic, Pexels, Pixabay, Kling, ElevenLabs, JSON2Video, Metricool, Telegram, and Google Sheets nodes.
4. Run Week 1 manually first (see `docs/build-order.md`): use the three prompts by hand on 5 videos to prove the format before switching on automation.
5. Activate the workflow. Post the reference URL + your topic + your proof asset to the form trigger.

## Non-negotiables baked into this build

- **The approval gate stays.** NODE 07 (Telegram approve/edit/regenerate) is wired before anything renders or publishes. Full auto-publish under your name is a credibility risk this system refuses to take.
- **Structure, never content.** Agent A is constrained to extract format DNA only — it must not reproduce sentences from source transcripts. Agent B must trace every claim to *your* proof asset.
- **B-roll cut rate:** one cut every 1.5–2.5 s. Enforced in `build_timeline.js`.
- **Library first.** Every sourced clip is logged to `library/`. Within ~60 days the library serves ~70% of shots for free.
