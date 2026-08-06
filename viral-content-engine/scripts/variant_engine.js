#!/usr/bin/env node
/**
 * THE 100-VARIANT ENGINE (Stage 8, volume lane)
 *
 * Once one video works, mine it: permute the render variables of a proven
 * script into up to 160 distinct JSON2Video payloads.
 *
 *   hook_variant    × 5
 *   broll_set       × 4
 *   voice_pace      × 2   (165 / 185 wpm)
 *   caption_style   × 2
 *   thumbnail_frame × 2
 *                  -----
 *                   160 permutations from ONE script
 *
 * Usage (standalone):
 *   node variant_engine.js base_video.json > variants.json
 *
 * where base_video.json is:
 * {
 *   "script": { ...Agent B output... },
 *   "hooks": ["hook line 1", ... up to 5],
 *   "broll_sets": [ [broll map A], [broll map B], ... up to 4 ],
 *   "voice_paces": [165, 185],
 *   "caption_styles": ["boxed-word", "karaoke"],
 *   "thumbnail_frames": [0.0, 0.4]   // pct of runtime to freeze for thumb
 * }
 *
 * Output: array of { variant_id, overrides } — feed each into the render
 * workflow (NODE 11/12), post 3–5 per week, log results per variant_id in
 * Sheets. After ~40 data points the winning hook_type and broll_set are
 * no longer a guess.
 *
 * Also usable inside an n8n Code node: call buildVariants(baseVideo).
 */

function buildVariants(base) {
  const hooks = base.hooks?.length ? base.hooks : [base.script.hook];
  const brollSets = base.broll_sets?.length ? base.broll_sets : [null];
  const paces = base.voice_paces?.length ? base.voice_paces : [165];
  const captions = base.caption_styles?.length ? base.caption_styles : ['boxed-word'];
  const thumbs = base.thumbnail_frames?.length ? base.thumbnail_frames : [0];

  const variants = [];
  let n = 0;
  for (const [hi, hook] of hooks.entries())
    for (const [bi, broll] of brollSets.entries())
      for (const pace of paces)
        for (const cap of captions)
          for (const thumb of thumbs) {
            n += 1;
            variants.push({
              variant_id: `v${String(n).padStart(3, '0')}_h${hi + 1}_b${bi + 1}_p${pace}_${cap}_t${thumb}`,
              overrides: {
                hook,
                broll_set: broll,
                voice_wpm: pace,
                caption_style: cap,
                thumbnail_frame_pct: thumb,
              },
            });
          }
  return variants;
}

module.exports = { buildVariants };

if (require.main === module) {
  const fs = require('fs');
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node variant_engine.js base_video.json');
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(file, 'utf8'));
  const variants = buildVariants(base);
  console.error(`${variants.length} variants generated`);
  console.log(JSON.stringify(variants, null, 2));
}
