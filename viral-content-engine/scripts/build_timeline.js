/**
 * NODE 11 — build the JSON2Video render timeline.
 *
 * Paste into an n8n Code node (Run Once for All Items). Merges:
 *   - script     : Agent B output (script_lines, on_screen_text, cta)
 *   - brollMap   : Agent C output merged with resolved clip URLs from NODE 09
 *   - voiceover  : ElevenLabs result from NODE 10 (audio URL + per-line timings)
 *
 * Output: a JSON2Video "movie" payload for NODE 12.
 * Enforces the cut-rate rule: every B-roll segment is clamped to 1.5–2.5s;
 * longer lines get the clip split into multiple cuts rather than one long hold.
 */

const CUT_MIN = 1.5;
const CUT_MAX = 2.5;

const script = $('Validate Agent B').first().json.data;
const brollMap = $('Merge B-roll Results').all().map((i) => i.json);
const voice = $('ElevenLabs TTS').first().json;

// Align B-roll timings to actual spoken timings when ElevenLabs provides them,
// otherwise fall back to the durations Agent B estimated.
const timings = voice.line_timings || null; // [{line_id, start_sec, end_sec}]

function lineWindow(line) {
  if (timings) {
    const t = timings.find((t) => t.line_id === line.id);
    if (t) return { start: t.start_sec, dur: t.end_sec - t.start_sec };
  }
  return null;
}

let cursor = 0;
const videoElements = [];

for (const line of script.script_lines) {
  const shot = brollMap.find((b) => b.line_id === line.id);
  if (!shot || !shot.clip_url) {
    throw new Error(`No resolved B-roll for line ${line.id} ("${line.text.slice(0, 40)}…")`);
  }
  const win = lineWindow(line) || { start: cursor, dur: line.duration_sec };

  // Split long lines into multiple cuts inside the cut-rate band.
  let remaining = win.dur;
  let offset = 0;
  while (remaining > 0.01) {
    const cut = remaining > CUT_MAX ? Math.max(CUT_MIN, Math.min(CUT_MAX, remaining / Math.ceil(remaining / CUT_MAX))) : Math.max(remaining, Math.min(remaining, CUT_MIN));
    videoElements.push({
      type: 'video',
      src: shot.clip_url,
      start: win.start + offset,
      duration: Math.min(cut, remaining),
      // vary the in-point per cut so repeated use of one clip still reads as separate shots
      seek: offset,
      'z-index': 1,
      resize: 'cover',
      zoom: shot.motion === 'slow_push' ? 1 : shot.motion === 'slow_pull' ? -1 : 0,
    });
    offset += cut;
    remaining -= cut;
  }
  cursor = win.start + win.dur;
}

// On-screen text overlays: spread the (max 5) overlays across the runtime,
// high-emphasis lines first.
const totalDur = cursor;
const overlays = (script.on_screen_text || []).slice(0, 5).map((text, i, arr) => ({
  type: 'text',
  text,
  style: '005',
  start: (totalDur / (arr.length + 1)) * (i + 1) - 1,
  duration: 2.2,
  'z-index': 3,
  position: 'center-center',
}));

const movie = {
  resolution: 'instagram-story', // 1080x1920, correct for TikTok/Reels/Shorts
  quality: 'high',
  scenes: [
    {
      elements: [
        ...videoElements,
        ...overlays,
        { type: 'audio', src: voice.audio_url, start: 0, 'z-index': 0 },
        {
          type: 'subtitles',
          // JSON2Video generates word-level captions from the audio track
          settings: { style: 'boxed-word', 'font-family': 'Inter', 'font-size': 90, position: 'mid-bottom' },
          language: 'en',
        },
      ],
    },
  ],
};

return [{ json: { movie, total_duration_sec: totalDur, caption: script.caption } }];
