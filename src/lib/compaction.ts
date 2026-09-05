// The compaction model: the tower is always drawn as whole, visible bricks,
// but once the drawn stack would outgrow the stage, ten bricks compact into
// one — `unit` (years per drawn brick) steps up by COMPACT_FACTOR — with a
// visible squish (see visualUnit) rather than the whole scene shrinking to
// fit. Scrolling back expands them again, with hysteresis so the two
// thresholds don't flicker at the boundary. Pure math only — src/lib/sim.ts
// calls stepCompaction every frame; src/render/stage.ts and src/main.ts
// read renderCourses, courseHeightPx, effectiveRenderUnit, and pxPerMeter to
// draw the stack and place landmarks to scale with it.

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

// Advances one frame: finishes an in-flight transition, or starts a new one
// when the drawn count has crossed a threshold — a transition that starts
// this frame is also advanced by dtMs this same frame, so it isn't stuck at
// elapsedMs 0 for a whole extra frame. Under reduced motion a transition
// (whether just started or already in flight) completes immediately.
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

// The largest power of ten at most `n` (n >= 1) — 1, 10, 100, ...
function largestPowerOfTenAtMost(n: number): number {
  let p = 1;
  while (p * 10 <= n) p *= 10;
  return p;
}

// The unit that's actually safe to draw `bricks` at right now: renderUnit(c),
// clamped down further so it never outruns the brick count itself. renderUnit
// alone is held fixed for a whole transition at the finer of `from`/`to`, but
// a fast multi-level undo can carry `bricks` down through several compaction
// levels while a single transition is still in flight — e.g. scrolling back
// fast enough during a 1000 -> 100 expansion that `bricks` drops to 5 before
// the transition (finer end 100) finishes. renderUnit(c) alone would then
// floor renderCourses to drawnBricks(5, 100) = 0 even though bricks > 0.
// Taking the smaller of renderUnit(c) and the largest power of ten at most
// bricks (bricks floored to 1 first, so `bricks === 0` still yields the
// finest unit, 1) is what renderCourses, courseHeightPx, and the legend
// (src/render/stage.ts) all key off of, so they can't disagree about what's
// on screen.
export function effectiveRenderUnit(c: Compaction, bricks: number): number {
  return Math.min(renderUnit(c), largestPowerOfTenAtMost(Math.max(bricks, 1)));
}

// How many drawn courses to render right now: idle, that's just the normal
// drawnBricks count at `unit`; during ANY transition (compaction or
// expansion) it's drawnBricks at effectiveRenderUnit(c, bricks) — held fixed
// at the finer of `from`/`to` for the whole transition, and clamped further
// so it's never coarser than `bricks` itself — so the count never jumps
// mid-flight and, critically, is never zero while bricks > 0.
export function renderCourses(bricks: number, c: Compaction): number {
  return drawnBricks(bricks, effectiveRenderUnit(c, bricks));
}

// The height of one drawn course right now, in css px: BRICK_PX at rest,
// and continuously scaled by effectiveRenderUnit/visualUnit mid-transition —
// the squish. Total drawn height stays `bricks / visualUnit(c) × BRICK_PX`
// whenever bricks is a multiple of effectiveRenderUnit(c, bricks), since
// renderCourses(bricks, c) × courseHeightPx(bricks, c) then equals
// (bricks / effectiveUnit) × (BRICK_PX × effectiveUnit / visualUnit(c)).
export function courseHeightPx(bricks: number, c: Compaction): number {
  return (BRICK_PX * effectiveRenderUnit(c, bricks)) / visualUnit(c);
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
