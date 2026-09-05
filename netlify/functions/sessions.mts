// The session analytics endpoint: creates (or upserts) a row keyed by a
// client-generated id, and closes it — also via upsert — on finish, restart,
// or page hide. Upserting both ways means an end that beats its own create
// to the server still lands, and a create that arrives after its own end
// fills in the start fields without clearing what the end already set (see
// src/analytics.ts). Public and unauthenticated by design; safe by staying
// tiny and write-only, and by layering payload validation
// (session-payload.ts), a body size cap, a per-IP rate limit, a content-type
// check, and a same-origin check.

import type { Config, Context } from '@netlify/functions';
import { getDb } from './_shared/db';
import { isUuid, parseSessionEnd, parseSessionStart } from './_shared/session-payload';

const MAX_BODY_BYTES = 4096; // 4 KB — a session payload is a handful of small fields; anything bigger is rejected outright.

function noBody(status: number): Response {
  return new Response(null, { status });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// The media type portion of a Content-Type header: everything up to the
// first ';' (dropping any charset or other parameter), trimmed and
// lowercased, then compared for exact equality — a startsWith check would
// wrongly accept a near-miss like "application/jsonp".
function mediaType(contentType: string | null): string | null {
  if (contentType === null) return null;
  return contentType.split(';', 1)[0]!.trim().toLowerCase();
}

// Reads the body as text, rejecting (without JSON-parsing it) anything over
// MAX_BODY_BYTES — checked against the Content-Length header first so an
// oversized request can be rejected without reading it, and again against
// the actual bytes read in case the header is missing or wrong.
async function readBody(req: Request): Promise<{ tooLarge: true } | { tooLarge: false; text: string }> {
  const contentLength = req.headers.get('content-length');
  if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
    return { tooLarge: true };
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { tooLarge: true };
  }
  return { tooLarge: false, text };
}

export default async (req: Request, context: Context): Promise<Response> => {
  if (req.method !== 'POST') return noBody(405);

  if (mediaType(req.headers.get('content-type')) !== 'application/json') return noBody(415);

  // Sec-Fetch-Site is set by the browser, not the caller, so a same-origin
  // request always carries it as 'same-origin'; a cross-site request that
  // sends it at all names itself as 'cross-site' or 'none'. Absent entirely
  // (older browsers, non-browser clients) it's simply not checked.
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite !== null && secFetchSite !== 'same-origin') return noBody(403);

  const body = await readBody(req);
  if (body.tooLarge) return noBody(413);

  let payload: unknown;
  try {
    payload = body.text.length === 0 ? {} : JSON.parse(body.text);
  } catch {
    return noBody(400);
  }

  const db = getDb();
  const id = context.params.id;

  if (id !== undefined) {
    // POST /api/sessions/:id/end — upserted so an end that beats its own
    // create to the server still creates the row outright; ON CONFLICT only
    // fills in the end fields when the row isn't already ended, so the
    // first end always wins over a later, redundant one (e.g. a duplicate
    // pagehide beacon). When this INSERT is the one that creates the row,
    // started_at is backdated by duration_ms rather than defaulting to
    // now() — otherwise an end-before-create row would record a start time
    // equal to its end time. started_at is never part of the UPDATE SET
    // list, so a create that lands after this row already exists (via
    // ON CONFLICT) can't overwrite the backdated value either.
    if (!isUuid(id)) return noBody(400);

    const end = parseSessionEnd(payload);
    if (end === null) return noBody(400);

    await db.sql`
      INSERT INTO sessions (id, started_at, ended_at, duration_ms, years_reached, finished)
      VALUES (${id}, now() - (${end.durationMs} * interval '1 millisecond'), now(), ${end.durationMs}, ${end.yearsReached}, ${end.finished})
      ON CONFLICT (id) DO UPDATE SET
        ended_at = COALESCE(sessions.ended_at, EXCLUDED.ended_at),
        duration_ms = CASE WHEN sessions.ended_at IS NULL THEN EXCLUDED.duration_ms ELSE sessions.duration_ms END,
        years_reached = CASE WHEN sessions.ended_at IS NULL THEN EXCLUDED.years_reached ELSE sessions.years_reached END,
        finished = CASE WHEN sessions.ended_at IS NULL THEN EXCLUDED.finished ELSE sessions.finished END
    `;
    return noBody(204);
  }

  // POST /api/sessions — upserted so a create that arrives after its own end
  // (page hide raced ahead of the create's response) fills in the start
  // fields without clearing the end fields the other request already set.
  // The UPDATE SET list below only ever touches profile fields — never
  // started_at — so a late create can't clobber the started_at the end
  // route may have already backdated.
  const start = parseSessionStart(payload);
  if (start === null) return noBody(400);

  const rows = await db.sql<{ id: string }>`
    INSERT INTO sessions (id, age_years, home_meters, color_id, sound_on, input_kind, viewport_w, viewport_h, device_kind, browser_family)
    VALUES (${start.id}, ${start.ageYears}, ${start.homeMeters}, ${start.colorId}, ${start.soundOn}, ${start.inputKind}, ${start.viewportW}, ${start.viewportH}, ${start.deviceKind}, ${start.browserFamily})
    ON CONFLICT (id) DO UPDATE SET
      age_years = EXCLUDED.age_years,
      home_meters = EXCLUDED.home_meters,
      color_id = EXCLUDED.color_id,
      sound_on = EXCLUDED.sound_on,
      input_kind = EXCLUDED.input_kind,
      viewport_w = EXCLUDED.viewport_w,
      viewport_h = EXCLUDED.viewport_h,
      device_kind = EXCLUDED.device_kind,
      browser_family = EXCLUDED.browser_family
    RETURNING id
  `;
  return json(201, { id: rows[0].id });
};

export const config: Config = {
  path: ['/api/sessions', '/api/sessions/:id/end'],
  method: ['POST'],
  // Per-IP cap so the public write endpoint can't be flooded.
  // https://ntl.fyi/rate-limiting-code
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip'] },
};
