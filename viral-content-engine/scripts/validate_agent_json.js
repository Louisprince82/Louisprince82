/**
 * NODE 05 — validate agent JSON, signal retry on parse failure.
 *
 * Paste into an n8n Code node (Run Once for Each Item) placed after every
 * Claude agent call. Agents are instructed to output raw JSON with no
 * fences, but this repairs the common failure modes anyway:
 * markdown fences, preamble text before the first brace, trailing commas.
 *
 * Output: { ok: true, data } on success,
 *         { ok: false, retry: true, error } on failure — route the false
 *         branch back into the agent node via an IF node (max 2 retries,
 *         tracked in `attempt`).
 */

const REQUIRED_KEYS = {
  agent_a: ['hook_type', 'beat_map', 'pacing', 'cta_type', 'reusable_template'],
  agent_b: ['hook', 'script_lines', 'cta', 'caption', 'estimated_runtime_sec'],
  agent_c: [], // agent C returns an array; validated structurally below
};

function extractJson(raw) {
  let text = String(raw).trim();
  // strip markdown fences
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  // cut preamble/postamble: take from first { or [ to last } or ]
  const start = Math.min(
    ...['{', '['].map((c) => (text.indexOf(c) === -1 ? Infinity : text.indexOf(c)))
  );
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start === Infinity || end === -1) throw new Error('no JSON found in agent output');
  text = text.slice(start, end + 1);
  // remove trailing commas
  text = text.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(text);
}

function validate(agent, data) {
  if (agent === 'agent_c') {
    const lines = Array.isArray(data) ? data : data.broll_map;
    if (!Array.isArray(lines) || lines.length === 0) throw new Error('agent_c: no broll lines');
    for (const l of lines) {
      for (const k of ['line_id', 'primary_keyword', 'source_class', 'shot_type', 'duration_sec']) {
        if (l[k] === undefined) throw new Error(`agent_c: line missing ${k}`);
      }
    }
    return lines;
  }
  for (const k of REQUIRED_KEYS[agent] || []) {
    if (data[k] === undefined) throw new Error(`${agent}: missing key ${k}`);
  }
  if (agent === 'agent_b') {
    const words = data.hook.trim().split(/\s+/).length;
    if (words > 12) throw new Error(`agent_b: hook is ${words} words (max 12)`);
    if (data.estimated_runtime_sec < 40 || data.estimated_runtime_sec > 80) {
      throw new Error(`agent_b: runtime ${data.estimated_runtime_sec}s outside 45-75s target`);
    }
  }
  return data;
}

// n8n entry point
const item = $input.item.json;
const agent = item.agent || 'agent_a'; // set via a Set node before this one
const attempt = (item.attempt || 0) + 1;

try {
  const data = validate(agent, extractJson(item.raw ?? item.content ?? item.text));
  return { json: { ok: true, agent, data } };
} catch (error) {
  return { json: { ok: false, retry: attempt <= 2, attempt, agent, error: error.message } };
}
