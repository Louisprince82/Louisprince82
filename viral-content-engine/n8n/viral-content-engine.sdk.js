// n8n Workflow SDK source for the Viral Content Engine.
// This is the exact code to pass to the n8n MCP `create_workflow_from_code`
// tool (or paste into any n8n Workflow SDK runner) to create the workflow
// directly in the n8n instance — full 9-stage pipeline, all 30 nodes.
// Companion to viral-content-engine.json (the hand-importable export).

import { workflow, node, trigger, sticky, placeholder, newCredential, ifElse, switchCase, merge, expr } from '@n8n/workflow-sdk';

const intakeForm = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.2,
  config: {
    name: 'Intake Form',
    position: [0, 300],
    parameters: {
      formTitle: 'Viral Content Engine - New Video',
      formDescription: 'Paste a reference video and your angle. Everything else is automatic until the Telegram approval.',
      formFields: {
        values: [
          { fieldLabel: 'reference_url', placeholder: 'TikTok / YT Short / Reel URL', requiredField: true },
          { fieldLabel: 'my_topic', placeholder: 'Your topic for this video', requiredField: true },
          { fieldLabel: 'my_proof_asset', placeholder: 'The real build/result/screenshot you can show', requiredField: true }
        ]
      },
      options: { appendAttribution: false }
    }
  },
  output: [{ reference_url: 'https://www.tiktok.com/@creator/video/123', my_topic: 'n8n automation for SMEs', my_proof_asset: 'CRM build screenshot' }]
});

const logIntake = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.5,
  config: {
    name: 'Log Intake',
    position: [220, 300],
    parameters: {
      operation: 'append',
      documentId: { __rl: true, mode: 'id', value: 'REPLACE_WITH_SPREADSHEET_ID' },
      sheetName: { __rl: true, mode: 'name', value: 'intake' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          submitted_at: expr('{{ $now.toISO() }}'),
          reference_url: expr('{{ $json.reference_url }}'),
          my_topic: expr('{{ $json.my_topic }}'),
          my_proof_asset: expr('{{ $json.my_proof_asset }}')
        }
      }
    },
    credentials: { googleSheetsOAuth2Api: newCredential('Google Sheets') }
  },
  output: [{ reference_url: 'https://www.tiktok.com/@creator/video/123', my_topic: 'n8n automation for SMEs', my_proof_asset: 'CRM build screenshot' }]
});

const fetchReference = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch Reference Video',
    position: [440, 300],
    parameters: {
      method: 'POST',
      url: 'https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpQueryAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ postURLs: [$("Intake Form").first().json.reference_url], shouldDownloadVideos: true, resultsPerPage: 1 }) }}')
    },
    credentials: { httpQueryAuth: newCredential('Apify Token (query param token)') }
  },
  output: [{ text: 'sample caption', playCount: 250000, mediaUrls: ['https://cdn.example.com/video.mp4'], videoMeta: { duration: 52 } }]
});

const downloadVideo = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Download Video File',
    position: [660, 300],
    parameters: {
      method: 'GET',
      url: expr('{{ $json.mediaUrls?.[0] ?? $json.videoUrl ?? $json.downloadAddr }}'),
      options: { response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } }
    }
  },
  output: [{}]
});

const transcribeAudio = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Transcribe Audio',
    position: [880, 300],
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/audio/transcriptions',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { name: 'model', value: 'whisper-1' },
          { name: 'response_format', value: 'verbose_json' },
          { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }
        ]
      }
    },
    credentials: { httpHeaderAuth: newCredential('OpenAI API Key (Authorization Bearer)') }
  },
  output: [{ text: 'sample transcript text', duration: 52 }]
});

const prepAgentA = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Agent A Request',
    position: [1100, 300],
    parameters: {
      jsCode: "const t = $('Transcribe Audio').first().json;\n" +
        "const meta = $('Fetch Reference Video').first().json;\n" +
        "const system = \"You are a short-form video format analyst. You will receive a transcript and metadata from a high-performing video. Your job is to extract the STRUCTURAL FORMULA only - never the specific wording, claims, or examples. Output valid JSON only. No preamble, no markdown fences. Schema: { topic_category, hook_type: one of contrarian_claim|curiosity_gap|direct_promise|pattern_interrupt|problem_agitation|result_reveal, hook_word_count, hook_mechanism (why it stops the scroll, structural terms), beat_map: [{beat, function: hook|context|proof|demo|objection|payoff, duration_sec, purpose}], pacing: {total_sec, words_per_min, avg_beat_sec}, retention_devices: [], cta_type, cta_position_pct, tone, why_it_worked (2 sentences, structural only), reusable_template (abstract skeleton with [PLACEHOLDERS]) }. CONSTRAINT: Do not reproduce sentences from the source transcript. Describe function, not content.\";\n" +
        "const body = { model: 'claude-sonnet-4-5', max_tokens: 2000, system: system, messages: [{ role: 'user', content: 'TRANSCRIPT:\\n' + (t.text || '') + '\\n\\nMETADATA: views=' + (meta.playCount || 'n/a') + ', duration_sec=' + ((meta.videoMeta && meta.videoMeta.duration) || 'n/a') }] };\n" +
        "return [{ json: { body: body } }];"
    }
  },
  output: [{ body: { model: 'claude-sonnet-4-5', max_tokens: 2000, system: 'prompt', messages: [] } }]
});

const callAgentA = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Agent A - Deconstruct',
    position: [1320, 300],
    parameters: {
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}')
    },
    credentials: { httpHeaderAuth: newCredential('Anthropic API Key (x-api-key header)') }
  },
  output: [{ content: [{ type: 'text', text: '{"hook_type":"curiosity_gap"}' }] }]
});

const validateFormatDna = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate Format DNA',
    position: [1540, 300],
    parameters: {
      jsCode: "const msg = $input.first().json;\n" +
        "let raw = (msg.content && msg.content[0]) ? msg.content[0].text : '';\n" +
        "raw = String(raw).trim().replace(/^```(json)?\\s*/i, '').replace(/\\s*```$/, '');\n" +
        "const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');\n" +
        "if (s === -1 || e === -1) throw new Error('Agent A returned no JSON');\n" +
        "const data = JSON.parse(raw.slice(s, e + 1).replace(/,\\s*([}\\]])/g, '$1'));\n" +
        "const req = ['hook_type', 'beat_map', 'pacing', 'cta_type', 'reusable_template'];\n" +
        "for (const k of req) if (data[k] === undefined) throw new Error('Agent A missing key: ' + k);\n" +
        "return [{ json: { format_dna: data } }];"
    }
  },
  output: [{ format_dna: { hook_type: 'curiosity_gap', beat_map: [], pacing: {}, cta_type: 'soft', reusable_template: 'skeleton' } }]
});

const prepAgentB = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Agent B Request',
    position: [1760, 300],
    parameters: {
      jsCode: "const dna = $json.format_dna;\n" +
        "const form = $('Intake Form').first().json;\n" +
        "const system = \"You are the scriptwriter for a Singapore-based founder who builds real AI automation systems for SMEs - ERP/CRM, property tech, n8n workflows. He is not a theorist. He ships. His edge is that he runs actual businesses and can show real builds, not recycled AI news. TASK: Write an ORIGINAL script that follows the structural formula in format_dna but contains entirely new content drawn from my_topic and my_proof_asset. RULES: 1. Hook must land in under 3 seconds and under 12 words. 2. Match the beat_map functions and durations, plus or minus 15 percent. 3. Every claim must trace to my_proof_asset. No invented statistics. 4. Spoken register - short sentences, contractions, no corporate filler. 5. Never use: in today's video, let's dive in, game-changer, revolutionize, unlock the power of. 6. One idea per video. Resist adding a second. 7. CTA at the position specified in format_dna. Soft CTA on value posts, hard CTA only 1 in 5 posts. 8. Target length: 45-75 seconds spoken at 165 wpm. OUTPUT JSON only: { hook, script_lines: [{id, text, duration_sec, emphasis: high|normal}], cta, on_screen_text: [max 5 short overlays], caption (with 3-5 hashtags, no hashtag spam), thumbnail_concept, estimated_runtime_sec }\";\n" +
        "const body = { model: 'claude-sonnet-4-5', max_tokens: 3000, system: system, messages: [{ role: 'user', content: 'format_dna:\\n' + JSON.stringify(dna) + '\\n\\nmy_topic: ' + form.my_topic + '\\nmy_proof_asset: ' + form.my_proof_asset }] };\n" +
        "return [{ json: { body: body } }];"
    }
  },
  output: [{ body: { model: 'claude-sonnet-4-5', max_tokens: 3000, system: 'prompt', messages: [] } }]
});

const callAgentB = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Agent B - Regenerate',
    position: [1980, 300],
    parameters: {
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}')
    },
    credentials: { httpHeaderAuth: newCredential('Anthropic API Key (x-api-key header)') }
  },
  output: [{ content: [{ type: 'text', text: '{"hook":"sample"}' }] }]
});

const validateScript = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate Script',
    position: [2200, 300],
    parameters: {
      jsCode: "const msg = $input.first().json;\n" +
        "let raw = (msg.content && msg.content[0]) ? msg.content[0].text : '';\n" +
        "raw = String(raw).trim().replace(/^```(json)?\\s*/i, '').replace(/\\s*```$/, '');\n" +
        "const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');\n" +
        "if (s === -1) throw new Error('Agent B returned no JSON');\n" +
        "const data = JSON.parse(raw.slice(s, e + 1).replace(/,\\s*([}\\]])/g, '$1'));\n" +
        "const req = ['hook', 'script_lines', 'cta', 'caption', 'estimated_runtime_sec'];\n" +
        "for (const k of req) if (data[k] === undefined) throw new Error('Agent B missing key: ' + k);\n" +
        "const hw = String(data.hook).trim().split(/\\s+/).length;\n" +
        "if (hw > 12) throw new Error('Hook is ' + hw + ' words (max 12)');\n" +
        "return [{ json: { script: data } }];"
    }
  },
  output: [{ script: { hook: 'sample hook', script_lines: [{ id: 1, text: 'line one', duration_sec: 3, emphasis: 'high' }], cta: 'grab the free workflow', caption: 'caption #n8n', estimated_runtime_sec: 55 } }]
});

const approvalGate = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Approval Gate',
    position: [2420, 300],
    parameters: {
      operation: 'sendAndWait',
      chatId: placeholder('Your Telegram chat ID'),
      message: expr('{{ "Script ready - 30 second review\\n\\nHOOK: " + $json.script.hook + "\\n\\n" + $json.script.script_lines.map(l => l.text).join("\\n") + "\\n\\nCTA: " + $json.script.cta + "\\nRuntime: " + $json.script.estimated_runtime_sec + "s" }}'),
      responseType: 'approval',
      approvalOptions: { values: { approvalType: 'double', approveLabel: 'Approve', disapproveLabel: 'Reject' } }
    },
    credentials: { telegramApi: newCredential('Telegram Bot') }
  },
  output: [{ data: { approved: true } }]
});

const checkApproved = ifElse({
  version: 2.2,
  config: {
    name: 'Approved?',
    position: [2640, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.data.approved }}'), operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and'
      }
    }
  }
});

const notifyRejected = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Notify Rejected',
    position: [2860, 500],
    parameters: {
      operation: 'sendMessage',
      chatId: placeholder('Your Telegram chat ID'),
      text: 'Script rejected. Tweak my_topic or my_proof_asset and resubmit the form.'
    },
    credentials: { telegramApi: newCredential('Telegram Bot') }
  },
  output: [{ ok: true }]
});

const prepAgentC = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Agent C Request',
    position: [2860, 100],
    parameters: {
      jsCode: "const script = $('Validate Script').first().json.script;\n" +
        "const system = \"You are a B-roll director. For each script line, specify the visual. Output a JSON array only, one object per line: { line_id, primary_keyword (3-5 words, literal and searchable on stock sites), fallback_keyword (broader alternative), source_class: generic_business|tech_abstract|cinematic_hero|impossible|screen_recording, shot_type: wide|medium|closeup|macro|drone|overhead|POV, motion: static|slow_push|slow_pull|pan|handheld, duration_sec, kling_prompt (ONLY if source_class is impossible - full cinematic prompt incl. lighting, lens, camera move, mood) }. RULES: Never repeat the same primary_keyword twice. Alternate shot_type between consecutive lines - never two wides in a row. Visual must be metaphorically or literally tied to the line - no random stock-office-people filler. Total B-roll duration must equal total script duration.\";\n" +
        "const body = { model: 'claude-sonnet-4-5', max_tokens: 3000, system: system, messages: [{ role: 'user', content: 'script_lines:\\n' + JSON.stringify(script.script_lines) }] };\n" +
        "return [{ json: { body: body } }];"
    }
  },
  output: [{ body: { model: 'claude-sonnet-4-5', max_tokens: 3000, system: 'prompt', messages: [] } }]
});

const callAgentC = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Agent C - B-roll Map',
    position: [3080, 100],
    parameters: {
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}')
    },
    credentials: { httpHeaderAuth: newCredential('Anthropic API Key (x-api-key header)') }
  },
  output: [{ content: [{ type: 'text', text: '[{"line_id":1}]' }] }]
});

const routeLines = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Route B-roll Lines',
    position: [3300, 100],
    parameters: {
      jsCode: "const msg = $input.first().json;\n" +
        "let raw = (msg.content && msg.content[0]) ? msg.content[0].text : '[]';\n" +
        "raw = String(raw).trim().replace(/^```(json)?\\s*/i, '').replace(/\\s*```$/, '');\n" +
        "const a = raw.indexOf('['); const o = raw.indexOf('{');\n" +
        "const s = (a === -1) ? o : ((o === -1) ? a : Math.min(a, o));\n" +
        "const e = Math.max(raw.lastIndexOf(']'), raw.lastIndexOf('}'));\n" +
        "if (s === -1) throw new Error('Agent C returned no JSON');\n" +
        "const parsed = JSON.parse(raw.slice(s, e + 1).replace(/,\\s*([}\\]])/g, '$1'));\n" +
        "const lines = Array.isArray(parsed) ? parsed : parsed.broll_map;\n" +
        "if (!Array.isArray(lines) || !lines.length) throw new Error('Agent C returned no B-roll lines');\n" +
        "const routes = { generic_business: 'pexels', tech_abstract: 'pixabay', cinematic_hero: 'library', impossible: 'kling', screen_recording: 'library' };\n" +
        "return lines.map(function (l) { return { json: Object.assign({}, l, { route: routes[l.source_class] || 'pexels', search_query: l.primary_keyword, fallback_query: l.fallback_keyword, clip_url: l.clip_url || null }) }; });"
    }
  },
  output: [{ line_id: 1, primary_keyword: 'office laptop typing', source_class: 'generic_business', shot_type: 'medium', duration_sec: 3, route: 'pexels', search_query: 'office laptop typing', clip_url: null }]
});

const sourceSwitch = switchCase({
  version: 3.2,
  config: {
    name: 'Source Switch',
    position: [3520, 100],
    parameters: {
      rules: {
        values: [
          { outputKey: 'pexels', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'pexels' }], combinator: 'and' } },
          { outputKey: 'pixabay', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'pixabay' }], combinator: 'and' } },
          { outputKey: 'kling', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'kling' }], combinator: 'and' } },
          { outputKey: 'library', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'library' }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'Unknown Class' }
    }
  }
});

const searchPexels = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Search Pexels',
    position: [3740, -200],
    parameters: {
      method: 'GET',
      url: 'https://api.pexels.com/videos/search',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'query', value: expr('{{ $json.search_query }}') },
          { name: 'orientation', value: 'portrait' },
          { name: 'per_page', value: '3' }
        ]
      }
    },
    credentials: { httpHeaderAuth: newCredential('Pexels API Key (Authorization header)') }
  },
  output: [{ videos: [{ video_files: [{ link: 'https://videos.pexels.com/sample.mp4', height: 1920 }] }] }]
});

const attachPexels = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Attach Pexels Clip',
    position: [3960, -200],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'p-line', name: 'line_id', value: expr("{{ $('Route B-roll Lines').item.json.line_id }}"), type: 'number' },
          { id: 'p-dur', name: 'duration_sec', value: expr("{{ $('Route B-roll Lines').item.json.duration_sec }}"), type: 'number' },
          { id: 'p-url', name: 'clip_url', value: expr('{{ $json.videos?.[0]?.video_files?.[0]?.link }}'), type: 'string' },
          { id: 'p-src', name: 'source', value: 'pexels', type: 'string' }
        ]
      }
    }
  },
  output: [{ line_id: 1, duration_sec: 3, clip_url: 'https://videos.pexels.com/sample.mp4', source: 'pexels' }]
});

const searchPixabay = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Search Pixabay',
    position: [3740, 0],
    parameters: {
      method: 'GET',
      url: 'https://pixabay.com/api/videos/',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpQueryAuth',
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'q', value: expr('{{ $json.search_query }}') },
          { name: 'per_page', value: '3' }
        ]
      }
    },
    credentials: { httpQueryAuth: newCredential('Pixabay API Key (query param key)') }
  },
  output: [{ hits: [{ videos: { medium: { url: 'https://cdn.pixabay.com/sample.mp4' } } }] }]
});

const attachPixabay = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Attach Pixabay Clip',
    position: [3960, 0],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'x-line', name: 'line_id', value: expr("{{ $('Route B-roll Lines').item.json.line_id }}"), type: 'number' },
          { id: 'x-dur', name: 'duration_sec', value: expr("{{ $('Route B-roll Lines').item.json.duration_sec }}"), type: 'number' },
          { id: 'x-url', name: 'clip_url', value: expr('{{ $json.hits?.[0]?.videos?.medium?.url }}'), type: 'string' },
          { id: 'x-src', name: 'source', value: 'pixabay', type: 'string' }
        ]
      }
    }
  },
  output: [{ line_id: 2, duration_sec: 3, clip_url: 'https://cdn.pixabay.com/sample.mp4', source: 'pixabay' }]
});

const klingSubmit = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Kling Generate',
    position: [3740, 200],
    parameters: {
      method: 'POST',
      url: 'https://api.klingai.com/v1/videos/text2video',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ model_name: "kling-v1-6", prompt: $json.kling_prompt || $json.search_query, duration: "5", aspect_ratio: "9:16" }) }}')
    },
    credentials: { httpHeaderAuth: newCredential('Kling API Token (Authorization Bearer)') }
  },
  output: [{ data: { task_id: 'task-123' } }]
});

const klingWait = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Wait for Kling',
    position: [3960, 200],
    parameters: { amount: 180 }
  },
  output: [{ data: { task_id: 'task-123' } }]
});

const klingPoll = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch Kling Result',
    position: [4180, 200],
    parameters: {
      method: 'GET',
      url: expr('{{ "https://api.klingai.com/v1/videos/text2video/" + $json.data.task_id }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth'
    },
    credentials: { httpHeaderAuth: newCredential('Kling API Token (Authorization Bearer)') }
  },
  output: [{ data: { task_status: 'succeed', task_result: { videos: [{ url: 'https://kling.example.com/gen.mp4' }] } } }]
});

const attachKling = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Attach Kling Clip',
    position: [4400, 200],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'k-line', name: 'line_id', value: expr("{{ $('Route B-roll Lines').item.json.line_id }}"), type: 'number' },
          { id: 'k-dur', name: 'duration_sec', value: expr("{{ $('Route B-roll Lines').item.json.duration_sec }}"), type: 'number' },
          { id: 'k-url', name: 'clip_url', value: expr('{{ $json.data?.task_result?.videos?.[0]?.url }}'), type: 'string' },
          { id: 'k-src', name: 'source', value: 'kling', type: 'string' }
        ]
      }
    }
  },
  output: [{ line_id: 3, duration_sec: 3, clip_url: 'https://kling.example.com/gen.mp4', source: 'kling' }]
});

const libraryPass = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Library Clip',
    position: [3740, 400],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'l-src', name: 'source', value: 'library', type: 'string' }
        ]
      }
    }
  },
  output: [{ line_id: 4, duration_sec: 3, clip_url: null, source: 'library' }]
});

const mergeClips = merge({
  version: 3.2,
  config: {
    name: 'Merge Clips',
    position: [4620, 100],
    parameters: { mode: 'append', numberInputs: 4 }
  }
});

const buildRenderPayload = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Render Payload',
    position: [4840, 100],
    executeOnce: true,
    parameters: {
      jsCode: "const script = $('Validate Script').first().json.script;\n" +
        "const items = $input.all().map(function (i) { return i.json; }).filter(function (j) { return j.line_id !== undefined && j.line_id !== null; });\n" +
        "const missing = items.filter(function (j) { return !j.clip_url; }).map(function (j) { return j.line_id; });\n" +
        "if (missing.length) throw new Error('No clip resolved for line(s): ' + missing.join(', ') + '. Add library clips or adjust keywords.');\n" +
        "const CUT_MAX = 2.5;\n" +
        "let cursor = 0; const elements = [];\n" +
        "for (const line of script.script_lines) {\n" +
        "  const shot = items.find(function (j) { return Number(j.line_id) === Number(line.id); });\n" +
        "  if (!shot) throw new Error('No B-roll item for line ' + line.id);\n" +
        "  const total = Number(line.duration_sec) || 3;\n" +
        "  const cuts = Math.max(1, Math.ceil(total / CUT_MAX));\n" +
        "  const cutDur = total / cuts;\n" +
        "  for (let c = 0; c < cuts; c++) {\n" +
        "    elements.push({ type: 'video', src: shot.clip_url, start: cursor + c * cutDur, duration: cutDur, muted: true, resize: 'cover' });\n" +
        "  }\n" +
        "  cursor += total;\n" +
        "}\n" +
        "const fullText = script.script_lines.map(function (l) { return l.text; }).join(' ');\n" +
        "elements.push({ type: 'voice', text: fullText, voice: 'REPLACE_WITH_ELEVENLABS_VOICE_ID', model: 'elevenlabs', start: 0 });\n" +
        "elements.push({ type: 'subtitles', language: 'en', settings: { style: 'boxed-word', position: 'mid-bottom-center', 'font-size': 90 } });\n" +
        "const movie = { resolution: 'instagram-story', quality: 'high', scenes: [{ elements: elements }] };\n" +
        "return [{ json: { movie: movie, caption: script.caption, total_duration_sec: cursor } }];"
    }
  },
  output: [{ movie: { resolution: 'instagram-story', scenes: [] }, caption: 'caption #n8n', total_duration_sec: 55 }]
});

const submitRender = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Submit Render',
    position: [5060, 100],
    parameters: {
      method: 'POST',
      url: 'https://api.json2video.com/v2/movies',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.movie) }}')
    },
    credentials: { httpHeaderAuth: newCredential('JSON2Video API Key (x-api-key header)') }
  },
  output: [{ success: true, project: 'prj-123' }]
});

const waitRender = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Wait for Render',
    position: [5280, 100],
    parameters: { amount: 120 }
  },
  output: [{ success: true, project: 'prj-123' }]
});

const renderStatus = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch Render Result',
    position: [5500, 100],
    parameters: {
      method: 'GET',
      url: expr('{{ "https://api.json2video.com/v2/movies?project=" + $json.project }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth'
    },
    credentials: { httpHeaderAuth: newCredential('JSON2Video API Key (x-api-key header)') }
  },
  output: [{ movie: { status: 'done', url: 'https://assets.json2video.com/final.mp4' } }]
});

const scheduleMetricool = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Schedule via Metricool',
    position: [5720, 100],
    parameters: {
      method: 'POST',
      url: 'https://app.metricool.com/api/v2/scheduler/posts',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpQueryAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ text: $("Build Render Payload").first().json.caption, media: [$json.movie ? $json.movie.url : ""], providers: [{ network: "tiktok" }, { network: "instagram" }, { network: "youtube" }, { network: "facebook" }], autoPublish: true }) }}')
    },
    credentials: { httpQueryAuth: newCredential('Metricool Token (query param userToken)') }
  },
  output: [{ scheduled: true }]
});

const logRun = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.5,
  config: {
    name: 'Log Run',
    position: [5940, 100],
    parameters: {
      operation: 'append',
      documentId: { __rl: true, mode: 'id', value: 'REPLACE_WITH_SPREADSHEET_ID' },
      sheetName: { __rl: true, mode: 'name', value: 'log' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          date: expr('{{ $now.toISO() }}'),
          reference_url: expr("{{ $('Intake Form').first().json.reference_url }}"),
          hook: expr("{{ $('Validate Script').first().json.script.hook }}"),
          runtime_sec: expr("{{ $('Build Render Payload').first().json.total_duration_sec }}"),
          video_url: expr("{{ $('Fetch Render Result').first().json.movie ? $('Fetch Render Result').first().json.movie.url : '' }}"),
          variant_id: 'base'
        }
      }
    },
    credentials: { googleSheetsOAuth2Api: newCredential('Google Sheets') }
  },
  output: [{ logged: true }]
});

const noteGate = sticky('## Approval Gate (non-negotiable)\nNothing renders or publishes without a 30-second approve tap on Telegram. Reject sends a notice; tweak the form inputs and resubmit.', [approvalGate, checkApproved]);
const noteSources = sticky('## B-roll routing\npexels = generic_business, pixabay = tech_abstract, kling = impossible shots (async, 180s wait), library = cinematic_hero + screen_recording.\nLibrary clips must arrive with clip_url already set (pre-tagged local/Artgrid clips).', [sourceSwitch, searchPexels, searchPixabay, klingSubmit, libraryPass]);
const noteRender = sticky('## Render + publish\nJSON2Video does the TTS via its ElevenLabs voice element - set your cloned voice ID in Build Render Payload. Renders are async: 120s wait then fetch. Replace REPLACE_WITH_SPREADSHEET_ID in both Sheets nodes.', [buildRenderPayload, submitRender, renderStatus, scheduleMetricool]);

export default workflow('viral-content-engine', 'Viral Content Engine')
  .add(intakeForm)
  .to(logIntake)
  .to(fetchReference)
  .to(downloadVideo)
  .to(transcribeAudio)
  .to(prepAgentA)
  .to(callAgentA)
  .to(validateFormatDna)
  .to(prepAgentB)
  .to(callAgentB)
  .to(validateScript)
  .to(approvalGate)
  .to(checkApproved
    .onTrue(prepAgentC
      .to(callAgentC)
      .to(routeLines)
      .to(sourceSwitch
        .onCase(0, searchPexels.to(attachPexels.to(mergeClips.input(0))))
        .onCase(1, searchPixabay.to(attachPixabay.to(mergeClips.input(1))))
        .onCase(2, klingSubmit.to(klingWait.to(klingPoll.to(attachKling.to(mergeClips.input(2))))))
        .onCase(3, libraryPass.to(mergeClips.input(3)))))
    .onFalse(notifyRejected))
  .add(mergeClips)
  .to(buildRenderPayload)
  .to(submitRender)
  .to(waitRender)
  .to(renderStatus)
  .to(scheduleMetricool)
  .to(logRun)
  .add(noteGate)
  .add(noteSources)
  .add(noteRender);
