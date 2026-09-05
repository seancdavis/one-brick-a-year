# Principles

Durable rules for this codebase — not a history of how it was built.

## Pure logic lives in src/lib/

Anything that shapes the simulation, the landmark and beat data, formatting,
or personalization parsing is pure: no DOM, no canvas, no timers, no
storage. That's what makes the pacing math, the landmark table, and the
personalization rules testable without a browser, and safe to reason about
without worrying what order effects ran in. Every file there has a sibling
test file. Rendering reads state and draws; it never mutates it. Everything
else — input handling, the HUD, cards, screens, audio, storage, the URL — is
DOM glue, kept out of the pure layer.

## Where the feel lives

Every number that shapes the feel — brick height, the pace of the scroll,
zoom thresholds, sound thresholds — is a named constant with a one-line
comment saying what it does, not a number inlined at its use site. Tune the
feel by changing one number in one place.

## Look

The picture-book look — cream paper, navy ink, coral and mustard accents,
teal paper hills, square corners, and a flat "paper drop" (an offset copy in
a warm shadow tint, never a blur) on anything that sits on the paper — is
defined in two places kept in sync by eye, since a canvas can't read CSS:
`src/style.css`'s custom properties (`--paper`, `--navy`, `--coral`,
`--mustard`, `--muted`, `--paper-shadow`, `--font-display`, `--font-hand`)
for the DOM chrome, and matching constants at the top of
`src/render/stage.ts` for the canvas-drawn scene. Two hand-lettered
typefaces carry all the type: Fredoka for the big numbers and footer values,
Patrick Hand for everything else.

## Compaction

Every drawn brick is worth `unit` years (`src/lib/compaction.ts`), and the
legend beside the tower's base always says so (`unitLabel(unit)`, shown
whenever `unit > 1`) — nothing is ever drawn that the legend doesn't
account for.

## Facts have a source

Scientific and historical facts carry a named source in their comment;
everyday reference objects (ruler, door, home) are marked approximate and
carry none. Nobody invents a fact. If a number is uncertain, it's rounded
and hedged ("about", "roughly"). Icons are flat, single-color labels next
to a landmark's line — never drawn to scale, and never a stand-in for the
(real, to-scale) line itself.

## Privacy boundary

A child's name lives in `localStorage` only. Links that personalize should
use the fragment form (`#name=Ada&age=8&home=8`) — a URL fragment is never
sent to the server, so it never reaches a server log. The query form
(`?name=Ada&age=8&home=8`) still works, but a query string does reach
server logs before the page has a chance to strip it. Either way, the page
reads and saves the values, then strips both the fragment and the query
from the address bar, so nothing personal lingers in the browser history or
gets shared if the page's URL is copied mid-session. The page never writes
the name — or anything else personal — into a URL it generates.

## Sessions

Netlify Database gets one row per build session (`sessions` table, `netlify/database/migrations/`): when it started and ended, how long it ran, how far the stack got, whether it finished, and coarse context for reading the numbers later — age, home height, brick color, sound on/off, input kind, viewport size, device kind (`phone` / `tablet` / `desktop`), and browser family (`chrome` / `safari` / `firefox` / `edge` / `other`).

The browser generates the session id (`src/analytics.ts`) and sends it with both requests. Create (`POST /api/sessions`) and end (`POST /api/sessions/:id/end`) are independent upserts, so either can arrive at the server first and the row still lands correctly (`netlify/functions/sessions.mts`). Ending a session when the page is hidden (backgrounded or closed mid-build) is followed by a new session on the next qualifying scroll if the page comes back — one row per stretch of engagement, not one row per tab.

A row never contains the child's name or any other free-form client text: `netlify/functions/_shared/session-payload.ts` rejects any payload that even carries a `name` key, and allowlists device kind and browser family rather than storing whatever string the client sends. The write endpoint is public and unauthenticated by design — it stays safe by being tiny, write-only, rate-limited per IP, and by rejecting requests that aren't same-origin JSON — with no read endpoint yet. A deploy preview writes to its own database branch, so preview traffic never lands in the production table.

## Sound

Off by default. Synthesized only — no audio files. The audio context is
created lazily, and starting it always requires a user gesture; browsers
refuse to start audio any other way.

## Accessibility baseline

Scroll is the only build input: mouse wheel, trackpad, touch drag, or a
keyboard equivalent (Arrow Up/Down, Space, Page Up/Down) anywhere the wheel
and touch drag work. Scrolling one way builds the stack and the other way
undoes it, both instantly and in direct proportion to scroll distance
(`src/lib/scroll-coupling.ts`'s exact closed form) — no velocity tracking,
ramp-up, or spin-down. Every interactive control has a visible focus state.
`prefers-reduced-motion: reduce` is honored: the zoom tween and other
transitions become instant. Milestone cards are the live region
(`aria-live="polite"`): they announce a beat without moving focus. The HUD
counter is deliberately silent (`aria-live="off"`) — it changes every
frame, and announcing it would be constant noise, not a milestone. A modal
screen that needs deliberate attention moves focus to it instead.

## Run and test

```bash
npm run dev        # Vite dev server
npm run build      # typecheck, then vite build to dist/
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run preview    # serve dist/
```
