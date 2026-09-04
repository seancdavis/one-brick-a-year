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

Every number that shapes the feel — brick height, the pace of the hold,
zoom thresholds, sound thresholds — is a named constant with a one-line
comment saying what it does, not a number inlined at its use site. Tune the
feel by changing one number in one place.

## Facts have a source

Every landmark and beat carries a one-line source comment: where the number
came from. Nobody invents a fact. If a number is uncertain, it's rounded
and hedged ("about", "roughly"). Icons are flat, single-color labels next
to a landmark's line — never drawn to scale, and never a stand-in for the
(real, to-scale) line itself.

## Privacy boundary

A child's name lives in `localStorage` only. It may be read from URL
params on load, but the page never writes it — or anything else personal —
back into a URL it generates. URL params are stripped from the address bar
immediately after being read, so nothing personal lingers in the browser
history or gets shared if the page's URL is copied mid-session.

## Sound

Off by default. Synthesized only — no audio files. The audio context is
created lazily, and starting it always requires a user gesture; browsers
refuse to start audio any other way.

## Accessibility baseline

Holding works by pointer or by keyboard (Space or Enter), everywhere
holding works. Every interactive control has a visible focus state.
`prefers-reduced-motion: reduce` is honored: the zoom tween and other
transitions become instant. Text that changes without user action
(milestone cards, the HUD counter) is announced via `aria-live` rather
than moving focus; a modal screen that needs deliberate attention moves
focus to it instead.

## Run and test

```bash
npm run dev        # Vite dev server
npm run build      # typecheck, then vite build to dist/
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run preview    # serve dist/
```
