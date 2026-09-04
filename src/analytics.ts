// Session analytics: posts one row per build session to Netlify Database
// (via netlify/functions/sessions.mts) so Sean can see how the page gets
// used. DOM glue only — src/main.ts decides when a session starts and ends.
// The field types here are a deliberate, unimported duplicate of
// netlify/functions/_shared/session-payload.ts's shapes: this file must
// never import from netlify/, and never sends the child's name.
//
// The client owns the session id: start() generates it synchronously
// (generateId(), below) before it does anything else, so end() — however
// soon it's called (finish, Restart, page hide, possibly before the create
// request has even left the browser) — always has an id to send its beacon
// with. There is no waiting on the create request: the two requests are
// independent, and the server's upserts (sessions.mts) make either order
// land correctly. If no id can be generated at all (see generateId()), no
// session starts.

export type DeviceKind = 'phone' | 'tablet' | 'desktop';
export type BrowserFamily = 'chrome' | 'safari' | 'firefox' | 'edge' | 'other';

export interface SessionStartFields {
  ageYears: number | null;
  homeMeters: number | null;
  colorId: string | null;
  soundOn: boolean | null;
  inputKind: 'wheel' | 'touch' | 'keyboard' | null;
  viewportW: number | null;
  viewportH: number | null;
  deviceKind: DeviceKind | null;
  browserFamily: BrowserFamily | null;
}

interface SessionEndFields {
  yearsReached: number;
  finished: boolean;
}

// Viewport width at or above which a touch device reads as a tablet rather
// than a phone (matches common tablet breakpoints, e.g. iPad mini portrait).
const TABLET_MIN_WIDTH_PX = 768;

// Derives a coarse device category — never the exact device — from the user
// agent and viewport: an iPad, an Android UA without "Mobile" (Android's own
// tablet signal), or any touch device wide enough reads as a tablet; any
// other touch device is a phone; anything else is a desktop.
export function deriveDeviceKind(userAgent: string, viewportW: number, hasTouch: boolean): DeviceKind {
  const isIPad = /iPad/i.test(userAgent);
  const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile/i.test(userAgent);
  if (isIPad || isAndroidTablet || (hasTouch && viewportW >= TABLET_MIN_WIDTH_PX)) return 'tablet';
  if (hasTouch) return 'phone';
  return 'desktop';
}

// Derives a coarse browser family by substring, checked in an order that
// resolves the UA strings that claim more than one engine (Edge and Chrome
// both say "Chrome"; mobile Chrome and Firefox on iOS both say "Safari").
export function deriveBrowserFamily(userAgent: string): BrowserFamily {
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg')) return 'edge';
  if (ua.includes('chrome') || ua.includes('crios')) return 'chrome';
  if (ua.includes('firefox') || ua.includes('fxios')) return 'firefox';
  if (ua.includes('safari')) return 'safari';
  return 'other';
}

const START_URL = '/api/sessions';

function endUrl(id: string): string {
  return `/api/sessions/${id}/end`;
}

// Builds a v4 UUID string from 16 random bytes: sets the version nibble to
// 4 and the variant bits to 10, then formats as 8-4-4-4-12 hex groups.
function uuidFromBytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// crypto.randomUUID() is available in every browser this page targets, but
// falls back to building a v4 UUID from crypto.getRandomValues() for any
// environment where randomUUID isn't there. If neither is available, there
// is no way to produce an id the server will accept as a session id, so
// this returns null and the caller simply doesn't start a session.
function generateId(): string | null {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)));
  }
  return null;
}

interface SessionHandle {
  id: string;
  startedAt: number; // performance.now(), ms
  ended: boolean; // guards end() against being applied twice to the same handle
}

function createSession(id: string, fields: SessionStartFields): void {
  fetch(START_URL, {
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, ...fields }),
  }).catch(() => {
    // Best-effort; end() can still upsert an end-only row.
  });
}

function sendEnd(id: string, durationMs: number, fields: SessionEndFields, preferBeacon: boolean): void {
  const body = JSON.stringify({ durationMs, yearsReached: fields.yearsReached, finished: fields.finished });

  // sendBeacon is the only delivery method browsers guarantee will actually
  // leave the page during an unload; use it there, but not for a routine
  // end (finish, Restart) where a normal fetch can be tried and observed.
  if (preferBeacon) {
    try {
      if (
        typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon(endUrl(id), new Blob([body], { type: 'application/json' }))
      ) {
        return;
      }
    } catch {
      // Fall through to fetch below.
    }
  }

  fetch(endUrl(id), {
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body,
  }).catch(() => {
    // Analytics is best-effort: nothing else to do if this also fails.
  });
}

export function createAnalytics(): {
  start(fields: SessionStartFields): void;
  end(fields: SessionEndFields, opts?: { preferBeacon?: boolean }): void;
} {
  let current: SessionHandle | null = null;

  function start(fields: SessionStartFields): void {
    const id = generateId();
    if (id === null) return;
    current = { id, startedAt: performance.now(), ended: false };
    createSession(id, fields);
  }

  function end(fields: SessionEndFields, opts?: { preferBeacon?: boolean }): void {
    const handle = current;
    if (handle === null || handle.ended) return;
    handle.ended = true;
    if (current === handle) current = null;

    const durationMs = Math.max(0, Math.round(performance.now() - handle.startedAt));
    const preferBeacon = opts?.preferBeacon ?? false;

    // The id is already known — no need to wait on the create request.
    sendEnd(handle.id, durationMs, fields, preferBeacon);
  }

  return { start, end };
}
