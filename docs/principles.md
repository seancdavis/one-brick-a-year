# Principles

How this codebase is built and why, as of the end of the `1-one-brick-a-year`
branch (slices 1–8). Read this first; read an ADR in `docs/decisions/` only
when a rule here seems arbitrary (none exist yet for this project).

## Architecture

Three layers, strictly separated:

- **`src/lib/`** — pure logic. No `document`, `window`, `HTMLElement`,
  `CanvasRenderingContext2D`, `Path2D`, `AudioContext`, or `localStorage`.
  Every file has a sibling `*.test.ts`. This is what makes the pacing,
  landmark math, and personalization rules testable without a browser:
  `constants.ts`, `format.ts`, `landmarks.ts`, `sim.ts`, `layout.ts`,
  `beats.ts`, `personalize.ts`, `audio-schedule.ts`.
- **`src/render/`** — reads state and draws. Never mutates it.
  `stage.ts` (canvas: sky, ground, scale bar, stack, landmark lines and
  labels) and `icons.ts` (one flat `Path2D` per landmark icon, 24×24 box).
- **DOM glue**, one file per concern, at the top of `src/`: `input.ts`
  (pointer/keyboard hold → boolean), `hud.ts`, `beats.ts` (milestone cards),
  `start-screen.ts`, `end-screen.ts`, `audio.ts`. Each exposes a small
  `createX(root, ...)` factory. `main.ts` is the only file that owns state
  (`sim`, `profile`, `held`, ...) and wires everything together in one `rAF`
  loop — it reads localStorage and the URL; nothing else does.

No classes, no default exports (except `vite.config.ts`), no dependencies
beyond `@netlify/vite-plugin` and the Vite/Vitest/TypeScript toolchain.

## The constants that shape the feel

All in `src/lib/constants.ts`, each with a one-line comment:

- `BRICK_M` (0.0096 m) — one stacked 2×4 LEGO brick, the page's whole unit.
- `TOTAL_YEARS` (4.6e9) — the book's number; every landmark derives from it.
- `RATE0` / `RATE_K` — the hold accelerates as
  `rate = RATE0 * e^(RATE_K * heldSeconds)`, tuned so a full hold lands
  between 60–90 s (see `sim.test.ts`).
- `ZOOM_TRIGGER`, `ZOOM_FACTOR`, `ZOOM_MS` — the camera zooms out ×10 whenever
  the stack passes 82% of the visible screen, tweened over 750 ms.
- `SCALE_MIN_M` / `SCALE_MAX_M` — the camera's zoom range.

Sound has its own constants in `src/lib/audio-schedule.ts` (`TICK_CAP_PER_S`,
the `HUM_*` thresholds) — the same "one file, pure math, tested" pattern.

## Facts policy

Every landmark (`src/lib/landmarks.ts`) and beat (`src/lib/beats.ts`) carries
a one-line source comment above its entry — where the number came from, and
"roughly"/"about" when precision is unwarranted. Nobody invents a fact; if
it's uncertain, it's rounded and hedged. Icons (`src/render/icons.ts`) are
flat, single-color labels next to a landmark's line — never drawn to scale,
and never a stand-in for the (real, to-scale) landmark line itself.

## Personalization and privacy

`src/lib/personalize.ts` is the one place that decides what a valid profile
looks like (name, age, home height), with one precedence rule: URL params
override stored `localStorage` values, which override defaults
(`DEFAULT_PROFILE`). `src/main.ts` is the only code that touches
`localStorage` (key `oby:profile`) or reads the URL. The child's name is
never written back into a URL the page generates — "Copy link"
(`src/end-screen.ts`) copies `location.origin + location.pathname` only,
never `location.search` and never the name.

## Sound

Off by default (`SOUND_DEFAULT_ENABLED = false` in `audio-schedule.ts`),
synthesized only (no audio files), and only ever started by a user gesture:
either the HUD's sound toggle, or — if the stored preference is already
on — the first hold gesture, so a returning visitor doesn't have to tap the
toggle twice (`src/main.ts`, the `createHoldInput` callback). Every method on
the `Audio` interface (`src/audio.ts`) is a safe no-op before `enable()` has
run, so call sites never need to guard on whether sound is active.

## Accessibility baseline

- Keyboard hold: Space or Enter, in addition to pointer, everywhere holding
  works (`src/input.ts`).
- Visible focus: every interactive control (`.hud-button`, `.start-button`,
  `.start-field input/select`, `.end-button`) has a `:focus-visible` outline
  in `src/style.css`.
- `prefers-reduced-motion: reduce` is honored in one place per concern: the
  sim skips the zoom tween entirely (`src/lib/sim.ts`), and a single
  `@media (prefers-reduced-motion: reduce)` block in `src/style.css` turns
  off the remaining CSS transitions (the prompt fade, the beat card
  transition). The start and end screens toggle via the `hidden` attribute,
  which has no transition to guard.
- Beat cards (`src/beats.ts`) and the HUD (`src/hud.ts`) use `aria-live` so
  changing text is announced without moving focus; the end screen instead
  moves focus to "Build it again" when it appears, since it needs deliberate
  attention.
- Idle frames (`src/main.ts`) skip `drawStage`/`hud.update` when nothing
  changed, but the loop itself never stops, so input is always live.

## Run and test

```bash
npm run dev        # Vite dev server
npm run build      # typecheck, then vite build to dist/
npm run typecheck  # tsc --noEmit
npm test           # vitest run, src/lib/**/*.test.ts
npm run preview    # serve dist/
```
