// The session analytics endpoint: creates a row on the first scroll and
// closes it on finish, restart, or page hide. Public and unauthenticated by
// design; safe by staying tiny and write-only, and by layering payload
// validation (session-payload.ts), a body size cap, a per-IP rate limit,
// a content-type check, and a same-origin check.

import type { Config, Context } from '@netlify/functions';
import { getDb } from './_shared/db';
import { parseSessionEnd, parseSessionStart } from './_shared/session-payload';

const MAX_BODY_BYTES = 4096; // 4 KB — a session payload is a handful of small fields; anything bigger is rejected outright.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function noBody(status: number): Response {
  return new Response(null, { status });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
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

  const contentType = req.headers.get('content-type');
  if (contentType === null || !contentType.toLowerCase().startsWith('application/json')) return noBody(415);

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
    // POST /api/sessions/:id/end
    if (!UUID_PATTERN.test(id)) return noBody(400);

    const end = parseSessionEnd(payload);
    if (end === null) return noBody(400);

    const rows = await db.sql<{ id: string }>`
      UPDATE sessions
      SET ended_at = now(), duration_ms = ${end.durationMs}, years_reached = ${end.yearsReached}, finished = ${end.finished}
      WHERE id = ${id} AND ended_at IS NULL
      RETURNING id
    `;
    return rows.length === 0 ? noBody(404) : noBody(204);
  }

  // POST /api/sessions
  const start = parseSessionStart(payload);
  if (start === null) return noBody(400);

  const rows = await db.sql<{ id: string }>`
    INSERT INTO sessions (age_years, home_meters, color_id, sound_on, input_kind, viewport_w, viewport_h, device_kind, browser_family)
    VALUES (${start.ageYears}, ${start.homeMeters}, ${start.colorId}, ${start.soundOn}, ${start.inputKind}, ${start.viewportW}, ${start.viewportH}, ${start.deviceKind}, ${start.browserFamily})
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
