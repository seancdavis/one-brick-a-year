// The stacking simulation: a pure state machine advanced one step at a time.
// No DOM, no timers — src/main.ts drives this with real frame deltas.

import {
  BRICK_M,
  RATE0,
  RATE_K,
  SCALE_MAX_M,
  SCALE_MIN_M,
  TOTAL_YEARS,
  ZOOM_FACTOR,
  ZOOM_MS,
  ZOOM_TRIGGER,
} from './constants';

// Longest dt accepted in one step, so a backgrounded tab regaining focus
// doesn't leap the sim forward. Ports the prototype's `Math.min(dt, 0.05)`.
const MAX_DT_SECONDS = 0.05;

export interface SimState {
  years: number;
  heldSeconds: number;
  scaleM: number;
  zoom: { from: number; to: number; elapsedMs: number } | null;
  done: boolean;
}

export function initialSim(): SimState {
  return {
    years: 0,
    heldSeconds: 0,
    scaleM: SCALE_MIN_M,
    zoom: null,
    done: false,
  };
}

// Years per second at a given number of seconds held, per the prototype's
// accelerating pace: rate = RATE0 * e^(RATE_K * heldSeconds).
export function rateFor(heldSeconds: number): number {
  return RATE0 * Math.exp(RATE_K * heldSeconds);
}

export function heightM(s: SimState): number {
  return s.years * BRICK_M;
}

// The stack only ever renders whole bricks — years is continuous, but a
// fractional brick looks uneven and misreports the height. Floors, and never
// goes negative (years is never negative in practice, but callers might hand
// this a raw, unclamped number).
export function bricksFor(years: number): number {
  return Math.max(0, Math.floor(years));
}

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

export function step(s: SimState, dtSeconds: number, held: boolean, reducedMotion: boolean): SimState {
  const dt = Math.min(dtSeconds, MAX_DT_SECONDS);

  let years = s.years;
  let heldSeconds = s.heldSeconds;
  let done = s.done;

  if (held && !done) {
    heldSeconds += dt;
    const rate = rateFor(heldSeconds);
    years = Math.min(TOTAL_YEARS, years + rate * dt);
    if (years >= TOTAL_YEARS) {
      done = true;
    }
  }

  const h = years * BRICK_M;

  let scaleM = s.scaleM;
  let zoom = s.zoom;

  if (!zoom && h > ZOOM_TRIGGER * scaleM && scaleM < SCALE_MAX_M) {
    zoom = { from: scaleM, to: scaleM * ZOOM_FACTOR, elapsedMs: 0 };
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

  return { years, heldSeconds, scaleM, zoom, done };
}
