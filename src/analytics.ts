// Session analytics: posts one row per build session to Netlify Database
// (via netlify/functions/sessions.mts) so Sean can see how the page gets
// used. DOM glue only — src/main.ts decides when a session starts and ends.
// The field types here are a deliberate, unimported duplicate of
// netlify/functions/_shared/session-payload.ts's shapes: this file must
// never import from netlify/, and never sends the child's name.

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

export function createAnalytics(): {
  start(fields: SessionStartFields): void;
  end(fields: SessionEndFields): void;
} {
  // Set once the create request resolves with an id; cleared by end() so a
  // second end() call (or one racing ahead of the create response) is a
  // no-op until the next start().
  let sessionId: string | null = null;
  let startedAtMs: number | null = null;

  async function start(fields: SessionStartFields): Promise<void> {
    const startedAt = performance.now();
    try {
      const res = await fetch(START_URL, {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) return;
      const data: unknown = await res.json();
      const id = data && typeof data === 'object' ? (data as { id?: unknown }).id : undefined;
      if (typeof id === 'string') {
        sessionId = id;
        startedAtMs = startedAt;
      }
    } catch {
      // Analytics is best-effort: a failed create just leaves sessionId
      // unset, so the eventual end() call below is a no-op.
    }
  }

  function end(fields: SessionEndFields): void {
    if (sessionId === null || startedAtMs === null) return;

    const id = sessionId;
    const durationMs = Math.max(0, Math.round(performance.now() - startedAtMs));
    sessionId = null;
    startedAtMs = null;

    const body = JSON.stringify({ durationMs, yearsReached: fields.yearsReached, finished: fields.finished });

    try {
      const sent =
        typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon(endUrl(id), new Blob([body], { type: 'application/json' }));
      if (sent) return;
    } catch {
      // Fall through to fetch below.
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

  return { start, end };
}
