/**
 * NODE 09 helper — B-roll source routing.
 *
 * Paste into an n8n Code node placed after Agent C validation and before the
 * Switch node. Annotates every B-roll line with the concrete fetch action the
 * Switch routes on, and applies the library-first rule: if a tagged clip
 * already exists in the local library index, it wins over any API pull.
 *
 * The library index (library/broll/index.json) is an array of
 *   { file, tags: [..], source_class, shot_type, duration_sec, url }
 * appended to by NODE 14 every time a new clip is fetched or generated.
 */

const ROUTES = {
  generic_business: { route: 'pexels', method: 'GET', url: 'https://api.pexels.com/videos/search' },
  tech_abstract: { route: 'pixabay', method: 'GET', url: 'https://pixabay.com/api/videos/' },
  cinematic_hero: { route: 'library', note: 'Artgrid has no API — hero shots are pre-pulled into the library' },
  impossible: { route: 'kling', method: 'POST', note: 'async: submit text_to_video, poll query_tasks until succeed' },
  screen_recording: { route: 'library' },
};

const libraryIndex = $('Load Library Index').first()?.json?.clips || [];

function libraryMatch(line) {
  const wanted = line.primary_keyword.toLowerCase().split(/\s+/);
  let best = null;
  let bestScore = 0;
  for (const clip of libraryIndex) {
    const tags = clip.tags.map((t) => t.toLowerCase());
    const score = wanted.filter((w) => tags.some((t) => t.includes(w))).length;
    if (score > bestScore && (clip.shot_type === line.shot_type || score === wanted.length)) {
      best = clip;
      bestScore = score;
    }
  }
  // require at least 2 keyword hits to trust a library clip
  return bestScore >= 2 ? best : null;
}

const out = [];
for (const item of $input.all()) {
  const line = item.json;
  const route = ROUTES[line.source_class];
  if (!route) throw new Error(`Unknown source_class "${line.source_class}" on line ${line.line_id}`);

  const cached = libraryMatch(line);
  out.push({
    json: {
      ...line,
      route: cached ? 'library' : route.route,
      route_meta: route,
      clip_url: cached ? cached.url || cached.file : null,
      from_library: Boolean(cached),
      search_query: line.primary_keyword,
      fallback_query: line.fallback_keyword,
    },
  });
}
return out;
