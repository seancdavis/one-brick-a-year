// The compaction model: the tower is always drawn as whole, visible bricks,
// but once the drawn stack would outgrow the stage, ten bricks compact into
// one — `unit` (years per drawn brick) steps up by COMPACT_FACTOR — with a
// visible squish (see visualUnit) instead of the camera zooming out.
// Scrolling back expands them again, with hysteresis so the two thresholds
// don't flicker at the boundary. Pure math only — src/lib/sim.ts calls
// stepCompaction every frame; src/render/stage.ts and src/main.ts read
// drawnBricks, visualUnit, and pxPerMeter to draw the stack and place
// landmarks to scale with it.

import { BRICK_M } from './constants';

// The height of one drawn brick, in css px.
export const BRICK_PX = 30;

// How many drawn bricks fit the stage before ten compact into one.
export const MAX_DRAWN = 20;

// How many real bricks one compacted brick is worth, each compaction step.
export const COMPACT_FACTOR = 10;

// How long a compaction (or expansion) transition takes, in milliseconds.
export const COMPACT_MS = 500;

// Hysteresis: expand back only once the drawn count at the smaller unit
// would drop to this fraction of MAX_DRAWN, so undoing near the boundary
// doesn't flicker between compacting and expanding every frame.
export const EXPAND_FRACTION = 0.8;

export interface Compaction {
  // Years per drawn brick: 1, 10, 100, ... — a power of ten.
  unit: number;
  // Set while a compaction or expansion is animating; null when idle.
  transition: { from: number; to: number; elapsedMs: number } | null;
}

export const INITIAL_COMPACTION: Compaction = { unit: 1, transition: null };

// How many whole drawn bricks `bricks` real years-bricks are worth at this
// unit. Floors, same convention as sim.ts's bricksFor: a fractional drawn
// brick looks uneven and misreports the height.
export function drawnBricks(bricks: number, unit: number): number {
  return Math.floor(bricks / unit);
}

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

// Advances one frame: finishes an in-flight transition (or starts a new one
// when the drawn count has crossed a threshold), mirroring the shape of the
// zoom step this replaced — a transition that starts this frame is also
// advanced by dtMs this same frame, so it isn't stuck at elapsedMs 0 for a
// whole extra frame. Under reduced motion a transition (whether just started
// or already in flight) completes immediately.
export function stepCompaction(c: Compaction, bricks: number, dtMs: number, reducedMotion: boolean): Compaction {
  let unit = c.unit;
  let transition = c.transition;

  if (!transition) {
    if (drawnBricks(bricks, unit) > MAX_DRAWN) {
      transition = { from: unit, to: unit * COMPACT_FACTOR, elapsedMs: 0 };
    } else if (unit > 1 && drawnBricks(bricks, unit / COMPACT_FACTOR) <= MAX_DRAWN * EXPAND_FRACTION) {
      transition = { from: unit, to: unit / COMPACT_FACTOR, elapsedMs: 0 };
    }
  }

  if (transition) {
    if (reducedMotion) {
      unit = transition.to;
      transition = null;
    } else {
      const elapsedMs = transition.elapsedMs + dtMs;
      if (elapsedMs >= COMPACT_MS) {
        unit = transition.to;
        transition = null;
      } else {
        transition = { from: transition.from, to: transition.to, elapsedMs };
      }
    }
  }

  return { unit, transition };
}

// The unit to draw with right now: `unit` when idle, or a log-space,
// eased interpolation between the transition's `from` and `to` while one is
// in flight — continuous with `unit` at both ends. This is what makes the
// squish: the drawn stack's height is `bricks / visualUnit × BRICK_PX`, so
// it shrinks smoothly to a tenth of its height on a compaction (or grows
// tenfold back on an expansion) instead of jumping.
export function visualUnit(c: Compaction): number {
  if (!c.transition) return c.unit;
  const { from, to, elapsedMs } = c.transition;
  const p = Math.min(1, Math.max(0, elapsedMs / COMPACT_MS));
  const logFrom = Math.log(from);
  const logTo = Math.log(to);
  return Math.exp(logFrom + (logTo - logFrom) * easeInOut(p));
}

// Pixels per real-world meter, tracking visualUnit so landmarks stay to
// scale with the drawn stack through a squish, not just at rest.
export function pxPerMeter(c: Compaction): number {
  return BRICK_PX / (visualUnit(c) * BRICK_M);
}

// The unit whose bricks are actually being drawn right now: idle, that's
// just `unit`; mid-transition it's the finer (smaller) of `from` and `to` —
// whichever end of the transition has more, smaller bricks — held fixed for
// the whole transition so renderCourses (below) has a stable count to
// animate the height of instead of jumping between counts.
export function renderUnit(c: Compaction): number {
  if (!c.transition) return c.unit;
  return Math.min(c.transition.from, c.transition.to);
}

// How many drawn courses to render right now. Idle, that's just the normal
// drawnBricks count. A compaction (to > from) draws every one of the fine
// `from`-unit bricks, unchanged in count, and lets courseHeightPx (below)
// shrink them together. An expansion (to < from) draws the coarse
// `from`-unit bricks already on screen, exploded into their COMPACT_FACTOR
// fine sub-bricks each, and lets courseHeightPx grow them back up — so the
// count is never zero mid-transition just because the target unit's own
// drawnBricks would floor to a small number.
export function renderCourses(bricks: number, c: Compaction): number {
  if (!c.transition) return drawnBricks(bricks, c.unit);
  const { from, to } = c.transition;
  if (to > from) return drawnBricks(bricks, from);
  return drawnBricks(bricks, from) * COMPACT_FACTOR;
}

// The height of one drawn course right now, in css px: BRICK_PX at rest,
// and continuously scaled by renderUnit/visualUnit mid-transition — the
// squish. Continuous with the idle BRICK_PX at both ends of a transition
// whenever the brick count is a multiple of the coarse unit; otherwise the
// snap when the transition finishes is bounded by less than one brick's
// worth of height.
export function courseHeightPx(c: Compaction): number {
  return (BRICK_PX * renderUnit(c)) / visualUnit(c);
}

// The whole tower's height in css px right now — what src/render/stage.ts
// draws the stack at.
export function towerHeightPx(bricks: number, c: Compaction): number {
  return renderCourses(bricks, c) * courseHeightPx(c);
}

// Legend copy for what one drawn brick is worth right now — shown whenever
// unit > 1 (src/render/stage.ts). `unit` only ever takes power-of-ten
// values, so rounding to the nearest one guards against float drift from
// repeated ×/÷ COMPACT_FACTOR.
export function unitLabel(unit: number): string {
  if (unit <= 1) return 'each brick is one year';

  const exponent = Math.round(Math.log10(unit));
  if (exponent < 6) {
    const years = Math.round(unit);
    return `each brick is ${years.toLocaleString('en-US')} years`;
  }
  if (exponent < 9) {
    const millions = Math.round(unit / 1e6);
    return `each brick is ${millions.toLocaleString('en-US')} million years`;
  }
  const billions = Math.round(unit / 1e9);
  return `each brick is ${billions.toLocaleString('en-US')} billion years`;
}
