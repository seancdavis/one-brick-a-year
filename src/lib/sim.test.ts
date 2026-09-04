import { describe, expect, it } from 'vitest';
import { BRICK_M, SCALE_MAX_M, SCALE_MIN_M, TOTAL_YEARS, ZOOM_FACTOR, ZOOM_TRIGGER } from './constants';
import { bricksFor, heightM, initialSim, step, type SimState } from './sim';

const DT = 1 / 60;
// An arbitrary constant rate used to exercise step()'s own mechanics (zoom,
// dt clamp, monotonicity, the TOTAL_YEARS ceiling). The pacing math that
// turns a scroll into a realistic rate over time lives in
// src/lib/scroll-state.ts and is tested there.
const RATE = 1e8;

describe('step', () => {
  it('never regresses years, never exceeds TOTAL_YEARS, and keeps scale on powers of ten between zooms', () => {
    let s = initialSim();
    let seconds = 0;

    while (!s.done && seconds < 200) {
      const prevYears = s.years;
      const next = step(s, DT, RATE, false);

      expect(next.years).toBeGreaterThanOrEqual(prevYears);
      expect(next.years).toBeLessThanOrEqual(TOTAL_YEARS);

      if (next.zoom === null) {
        const n = Math.log10(next.scaleM / SCALE_MIN_M);
        expect(Math.abs(n - Math.round(n))).toBeLessThan(1e-6);
        expect(next.scaleM).toBeLessThanOrEqual(SCALE_MAX_M + 1e-6);
      }

      s = next;
      seconds += DT;
    }

    expect(s.done).toBe(true);
  });

  it('never advances years while the rate is 0', () => {
    let s = initialSim();
    for (let i = 0; i < 300; i++) {
      s = step(s, DT, 0, false);
    }
    expect(s.years).toBe(0);
    expect(s.done).toBe(false);
    expect(heightM(s)).toBe(0);
  });

  it('clamps dt above 0.05s so a background tab does not jump', () => {
    const s = initialSim();
    const clamped = step(s, 0.05, RATE, false);
    const jumped = step(s, 5, RATE, false);
    expect(jumped.years).toBeCloseTo(clamped.years, 10);
  });

  it('finishes a zoom instantly in one step under reduced motion, but not under normal motion', () => {
    // A state whose height already clears the zoom trigger at SCALE_MIN_M.
    const primed: SimState = {
      years: (ZOOM_TRIGGER * SCALE_MIN_M) / BRICK_M + 1,
      scaleM: SCALE_MIN_M,
      zoom: null,
      done: false,
    };

    const reduced = step(primed, DT, 0, true);
    expect(reduced.zoom).toBeNull();
    expect(reduced.scaleM).toBeCloseTo(SCALE_MIN_M * ZOOM_FACTOR, 10);

    const normal = step(primed, DT, 0, false);
    expect(normal.zoom).not.toBeNull();
    expect(normal.scaleM).toBeGreaterThanOrEqual(SCALE_MIN_M);
    expect(normal.scaleM).toBeLessThan(SCALE_MIN_M * ZOOM_FACTOR);
  });

  it('progresses a zoom even at rate 0', () => {
    const primed: SimState = {
      years: (ZOOM_TRIGGER * SCALE_MIN_M) / BRICK_M + 1,
      scaleM: SCALE_MIN_M,
      zoom: null,
      done: false,
    };
    const next = step(primed, DT, 0, false);
    expect(next.zoom).not.toBeNull();
    expect(next.zoom?.elapsedMs).toBeGreaterThan(0);
  });
});

describe('bricksFor', () => {
  it('floors to the nearest whole brick and never goes negative', () => {
    expect(bricksFor(7.9)).toBe(7);
    expect(bricksFor(0.2)).toBe(0);
    expect(bricksFor(-1)).toBe(0);
  });
});
