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
compaction thresholds, sound thresholds — is a named constant with a
one-line comment saying what it does, not a number inlined at its use site,
living in `src/lib/constants.ts` or `src/lib/compaction.ts`. Tune the feel
by changing one number in one place.

## Look

The picture-book look — cream paper, navy ink, coral and mustard accents,
teal paper hills, square corners, and a flat "paper drop" (an offset copy in
a warm shadow tint, never a blur) on anything that sits on the paper — is
defined once. Shared colors and fonts are CSS custom properties in
`src/style.css`, the canonical token file, and the canvas resolves them once
per resize rather than keeping its own copies. Nothing is duplicated by
hand. Two hand-lettered typefaces carry all the type: Fredoka for the big
numbers and footer values, Patrick Hand for everything else.

Controls live behind one compact menu: a single paper tab (`src/menu.ts`)
alone in the top-right corner, 16 px from the top and right edges, rather
than a scattered row of tabs and chips. Its panel holds sound, "my facts",
restart, and the color chips, in that order, and closes on Escape or a tap
outside.

Below the ground line is the ground band: the scroll prompt above the
compaction legend, both centered under the tower in the paper color, and
nothing else. The band's height is reserved above the footer strip
(`src/render/stage.ts`'s `groundY` lifts the ground line by the footer's
measured height plus the band), so the footer never covers either line and
nothing overlaps the prompt on first load.

## Compaction

Every drawn brick is worth `unit` years (`src/lib/compaction.ts`). The legend
always describes the effective render unit actually on screen — nothing is
ever drawn that the legend doesn't account for — and sits in the ground band
under the tower at every width.

## Facts

Time events — everything the stack passes on its way back through 4.6 billion
years — have one source of truth: `src/lib/beats.ts`'s `BEATS` array, a
`Beat` per event. `src/lib/landmarks.ts` derives the right-side "time"
landmarks from that same list, so a beat's title, line, and years reach the
landmark label, the popup, and the footer's "before" phrase without being
written twice.

Copy rules for a beat: `title` is 2 to 5 words with no period; `line` is at
most two short sentences, present tense, second person where natural, under
140 characters, with no dates and no "BCE" (the popup shows the years, not
the line). A line may use the tokens `{age}` and `{brickAge}`, filled in by
`src/lib/personalize.ts`'s `fillTokens`; `beats.test.ts` fails on any other
token. Where the candidate list gave no
line, the developer writes one in this voice and sets `needsReview: true` so
Sean can find and check it.

Popups and pins: at most one popup is open per side at any moment — the
latest time event on the right, the latest physical comparison on the left
— modeled by `src/lib/popups.ts`'s `popupsFor` and rendered by
`src/popups.ts`. An upcoming landmark is a muted icon on a short dashed
leader, with no text or years beside it, and only the nearest
`UPCOMING_PER_SIDE` unpassed ones per side are drawn at all
(`src/lib/layout.ts`'s `visibleUpcoming`, `src/render/stage.ts`). Each draws
completely or not at all — a leader never points at nothing — so a landmark
beyond the cap, or one whose icon would land inside an open popup, draws
neither icon nor leader. The moment the stack passes a landmark, its icon
leaves the canvas and its popup flips out of the tower, and whatever
popup it replaces on that side collapses into a small paper pin on its own
brick. A pin holds its landmark's icon and reopens its popup (or, for a
bundle, a list of every fact sharing that brick) on tap; when compaction
draws several events' years into one drawn brick, their pins fold into a
single bundle pin showing a count instead of an icon, and expanding the
tower splits the bundle back. Left-side popups work the same way for
physical comparisons ("a giraffe", "the Eiffel Tower"): the popup's line is
the thing's `funLine` when one is written, else its `tallerThanPhrase`, with
its height and brick count underneath. Scrolling back below a landmark's
year (or height) turns its popup or pin back into the muted upcoming icon —
undo really takes it off the tower. The scrapbook (`src/scrapbook.ts`) sits
outside that lifecycle: it lists every beat the build's peak years has ever
reached (`atYears <= peakYears`, a high-water mark `src/main.ts` tracks
independently of the current, undo-able `sim.years`), so a fact stays
collected even after undo drops its popup. Restart empties it; opening the
scrapbook is one item in `src/menu.ts`'s compact menu (see "Look" below).

## Facts have a source

Scientific and historical facts carry a named source in their comment;
everyday reference objects (ruler, door, home) are marked approximate and
carry none. Nobody invents a fact. If a number is uncertain, it's rounded
and hedged ("about", "roughly"). Icons are flat, single-color labels next
to a landmark's line — never drawn to scale, and never a stand-in for the
(real, to-scale) line itself.

## Privacy boundary

The page never asks for or carries a child's name — not in the profile, the
URL, storage, or the analytics payload — so nothing it holds identifies
anyone. What personalization it does take (age, home height, brick color)
lives in `localStorage` and can be shared as a link. Links should use the
fragment form (`#age=8&home=8`) — a URL fragment is never sent to the
server, so it never reaches a server log. The query form (`?age=8&home=8`)
still works, but a query string does reach server logs before the page has a
chance to strip it. Either way, the page reads and saves the values, then
strips both the fragment and the query from the address bar, so nothing
lingers in the browser history or gets shared if the page's URL is copied
mid-session. The page never writes anything personal into a URL it
generates.

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
ramp-up, or spin-down. A hard scroll takes about three minutes of hard
scrolling to finish the full stack; a curious one takes much longer.
Every interactive control has a visible focus state.
`prefers-reduced-motion: reduce` is honored: the compaction squish and other
transitions become instant. A hidden `aria-live="polite"` region under the
app root (`src/popups.ts`) announces each newly arrived popup's title as it
flips out of the tower — a bundle announces its newest title, the same one
shown on the popup itself — without moving focus. The HUD counter is
deliberately silent (`aria-live="off"`) — it changes every frame, and
announcing it would be constant noise, not a milestone. Any modal screen —
the start screen, the end screen, an opened popup's card, or the scrapbook
panel — is `role="dialog"` with `aria-modal="true"`, moves focus into itself
(its close button, where there is one) when it opens, traps Escape, and
returns focus to whatever opened it when it closes. The menu's own panel
(`src/menu.ts`) is a lighter-weight popover rather than a modal dialog — it
moves focus into itself on open and back to its tab on close, and closes on
Escape or a tap outside, but doesn't trap focus or block the page behind it.

## Run and test

```bash
npm run dev        # Vite dev server
npm run build      # typecheck, then vite build to dist/
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run preview    # serve dist/
```
