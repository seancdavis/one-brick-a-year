// The stacking simulation: a pure state machine advanced one step at a time.
// No DOM, no timers — src/main.ts drives this with real frame deltas and
// scroll events. Scroll coupling is direct and direction-aware:
// applyScroll moves `targetYears` instantly, via src/lib/scroll-coupling.ts's
// exact closed form; step() then eases the displayed `years` toward that
// target every frame, so a wheel notch reads as motion rather than a jump.

import {
  BRICK_M,
  SCALE_MAX_M,
  SCALE_MIN_M,
  SMOOTH_S,
  SMOOTH_SNAP_YEARS,
  TOTAL_YEARS,
  ZOOM_FACTOR,
  ZOOM_IN_MARGIN,
  ZOOM_MS,
  ZOOM_TRIGGER,
} from './constants';
import { advance, pageDeltaToBuildPx } from './scroll-coupling';

// Longest dt accepted in one step, so a backgrounded tab regaining focus
// doesn't leap the sim forward. Ports the prototype's `Math.min(dt, 0.05)`.
const MAX_DT_SECONDS = 0.05;

export interface SimState {
  years: number;
  targetYears: number;
  scaleM: number;
  zoom: { from: number; to: number; elapsedMs: number } | null;
  done: boolean;
}

export function initialSim(): SimState {
  return {
    years: 0,
    targetYears: 0,
    scaleM: SCALE_MIN_M,
    zoom: null,
    done: false,
  };
}

// The stack only ever renders whole bricks — years is continuous, but a
// fractional brick looks uneven and misreports the height. Floors, and never
// goes negative (years is never negative in practice, but callers might hand
// this a raw, unclamped number).
export function bricksFor(years: number): number {
  return Math.max(0, Math.floor(years));
}

// The stack's actual height: always a whole number of bricks, never a
// fractional one, so this must agree with what's drawn (src/render/stage.ts)
// and with the HUD's brick count.
export function heightM(s: SimState): number {
  return bricksFor(s.years) * BRICK_M;
}

// Folds one scroll event's page delta straight into `targetYears`, via the
// exact closed form in scroll-coupling.ts — no ramp-up, no velocity: the
// same event that scrolls also moves the target. A no-op once the sim is
// done, so undoing after the stack finishes needs a reset first.
export function applyScroll(s: SimState, deltaPx: number): SimState {
  if (s.done) return s;
  const buildPx = pageDeltaToBuildPx(deltaPx);
  return { ...s, targetYears: advance(s.targetYears, buildPx) };
}

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

export function step(s: SimState, dtSeconds: number, reducedMotion: boolean): SimState {
  const dt = Math.min(dtSeconds, MAX_DT_SECONDS);

  const target = s.targetYears;
  let years = s.years;
  const diff = target - years;

  if (reducedMotion || Math.abs(diff) <= SMOOTH_SNAP_YEARS) {
    years = target;
  } else {
    // Exponential approach with time constant SMOOTH_S: the exact
    // discretization of dy/dt = (target - y) / SMOOTH_S.
    years += diff * (1 - Math.exp(-dt / SMOOTH_S));
  }
  years = Math.max(0, Math.min(TOTAL_YEARS, years));

  let done = s.done;
  if (years >= TOTAL_YEARS) {
    done = true;
  }

  const h = bricksFor(years) * BRICK_M;

  let scaleM = s.scaleM;
  let zoom = s.zoom;

  if (!zoom && h > ZOOM_TRIGGER * scaleM && scaleM < SCALE_MAX_M) {
    zoom = { from: scaleM, to: scaleM * ZOOM_FACTOR, elapsedMs: 0 };
  } else if (!zoom && scaleM > SCALE_MIN_M && h < (ZOOM_TRIGGER / ZOOM_FACTOR) * ZOOM_IN_MARGIN * scaleM) {
    // Undoing shrank the stack back below (a hysteresis margin under) the
    // height that would trigger zooming back out at the next scale down —
    // zoom back in to match.
    zoom = { from: scaleM, to: scaleM / ZOOM_FACTOR, elapsedMs: 0 };
  }

  if (zoom) {
    if (reducedMotion) {
      scaleM = zoom.to;
      zoom = null;
    } else {
      const elapsedMs = zoom.elapsedMs + dt * 1000;
      const p = Math.min(1, elapsedMs / ZOOM_MS);
      const logFrom = Math.log(zoom.from);
      const logTo = Math.log(zoom.to);
      scaleM = Math.exp(logFrom + (logTo - logFrom) * easeInOut(p));
      if (p >= 1) {
        scaleM = zoom.to;
        zoom = null;
      } else {
        zoom = { from: zoom.from, to: zoom.to, elapsedMs };
      }
    }
  }

  return { years, targetYears: target, scaleM, zoom, done };
}
