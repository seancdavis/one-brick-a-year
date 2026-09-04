// Session analytics: posts one row per build session to Netlify Database
// (via netlify/functions/sessions.mts) so Sean can see how the page gets
// used. DOM glue only — src/main.ts decides when a session starts and ends.
// The field types here are a deliberate, unimported duplicate of
// netlify/functions/_shared/session-payload.ts's shapes: this file must
// never import from netlify/, and never sends the child's name.
//
// start() and end() are not necessarily called in that order relative to
// the network: start() fires a create request whose id can take a while to
// come back, and end() can be called (finish, Restart, page hide) before it
// does. So each start() makes a session "handle" — its own started-at time,
// its own in-flight create request — and becomes the current handle; end()
// marks whichever handle is current as ended and chains the end request
// after that handle's own create request resolves, whenever that happens.
// A handle only ever acts on itself, never on `current`, so a handle that a
// later start() has superseded can't stomp on the session that replaced it.

export interface SessionStartFields {
  ageYears: number | null;
  homeMeters: number | null;
  colorId: string | null;
  soundOn: boolean | null;
  inputKind: 'wheel' | 'touch' | 'keyboard' | null;
  viewportW: number | null;
  viewportH: number | null;
  userAgent: string | null;
}

interface SessionEndFields {
  yearsReached: number;
  finished: boolean;
}

const START_URL = '/api/sessions';

function endUrl(id: string): string {
  return `/api/sessions/${id}/end`;
}

interface SessionHandle {
  startedAt: number; // performance.now(), ms
  idPromise: Promise<string | null>; // resolves to the created row's id, or null if the create failed
  ended: boolean; // guards end() against being applied twice to the same handle
}

async function createSession(fields: SessionStartFields): Promise<string | null> {
  try {
    const res = await fetch(START_URL, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const id = data && typeof data === 'object' ? (data as { id?: unknown }).id : undefined;
    return typeof id === 'string' ? id : null;
  } catch {
    // Analytics is best-effort: a failed create just means the eventual
    // end() call for this handle has nothing to send.
    return null;
  }
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
    const handle: SessionHandle = {
      startedAt: performance.now(),
      idPromise: createSession(fields),
      ended: false,
    };
    current = handle;
  }

  function end(fields: SessionEndFields, opts?: { preferBeacon?: boolean }): void {
    const handle = current;
    if (handle === null || handle.ended) return;
    handle.ended = true;
    if (current === handle) current = null;

    const durationMs = Math.max(0, Math.round(performance.now() - handle.startedAt));
    const preferBeacon = opts?.preferBeacon ?? false;

    // Chains onto this handle's own create request, whether it already
    // resolved or is still in flight — either way the end is sent the
    // moment (and only once) an id becomes available.
    void handle.idPromise.then((id) => {
      if (id === null) return;
      sendEnd(id, durationMs, fields, preferBeacon);
    });
  }

  return { start, end };
}
