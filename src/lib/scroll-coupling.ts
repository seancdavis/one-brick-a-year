// Direct, direction-aware scroll coupling: every scroll event changes the
// brick count on the same frame, in proportion to how far the user
// scrolled. Pure math only — src/lib/sim.ts folds this into
// SimState.targetYears, src/input.ts turns raw wheel/touch/keyboard events
// into the deltaPx this takes, and src/main.ts wires the two together. No
// velocity, no decay, no ramp-up: the years-per-pixel rate itself grows with
// progress, so a sustained scroll still finishes the full 4.6 billion years
// in about a minute and a half.

import { TOTAL_YEARS } from './constants';

// Years added per pixel of build scroll at years = 0. A short 100 px flick
// at the start adds about 10 bricks (see scroll-coupling.test.ts).
export const BASE_YEARS_PER_PX = 0.1;

// How fast the years-per-pixel rate grows with years already stacked (see
// yearsPerPx). Tuned so a sustained scroll covers all 4.6e9 years in
// roughly 50,000 to 80,000 px (see scroll-coupling.test.ts) — the distance a
// vigorous, sustained real scroll covers in about a minute and a half.
export const PROGRESS_K = 0.0027;

// The instantaneous rate: years added per pixel of build scroll, at a given
// years already stacked. Grows linearly with years — smooth and strictly
// increasing — so the same physical scroll distance builds faster and
// faster as the stack gets taller.
export function yearsPerPx(years: number): number {
  return BASE_YEARS_PER_PX * (1 + PROGRESS_K * years);
}

// The exact closed-form integral of dy/dx = yearsPerPx(y) over `buildPx`
// pixels of build scroll, starting from `years`. That ODE is
// dy/dx = BASE + BASE*K*y, whose solution is:
//
//   y1 = ((1 + K*y0) * exp(BASE*K*x) - 1) / K
//
// which holds exactly for negative x too, so undoing retraces the same
// curve regardless of how the distance is chopped into individual events —
// advance is composable: advance(advance(y, x1), x2) === advance(y, x1+x2).
// Clamped to [0, TOTAL_YEARS] since the stack can't build past the present
// or undo past year zero.
export function advance(years: number, buildPx: number): number {
  const next = ((1 + PROGRESS_K * years) * Math.exp(BASE_YEARS_PER_PX * PROGRESS_K * buildPx) - 1) / PROGRESS_K;
  return Math.max(0, Math.min(TOTAL_YEARS, next));
}

// Converts a raw page-scroll delta (positive = scrolling down, matching a
// wheel event's native deltaY sign) into build-scroll pixels for advance():
// scrolling down undoes (negative buildPx), scrolling up builds (positive).
export function pageDeltaToBuildPx(deltaPx: number): number {
  return -deltaPx;
}
