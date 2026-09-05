import { describe, expect, it } from 'vitest';
import { BRICK_M, SCALE_MIN_M, TOTAL_YEARS, ZOOM_FACTOR, ZOOM_IN_MARGIN, ZOOM_TRIGGER } from './constants';
import { applyScroll, bricksFor, heightM, initialSim, step, type SimState } from './sim';

const DT = 1 / 60;
const BUILD_CHUNK_PX = -200; // negative page delta -> builds (scrolling up)

function settle(s: SimState, frames: number): SimState {
  let next = s;
  for (let i = 0; i < frames; i++) {
    next = step(next, DT, false);
  }
  return next;
}

describe('applyScroll + step', () => {
  it('a sustained build scroll in 200 px chunks, with frames between, reaches done between 50,000 and 80,000 px', () => {
    let s = initialSim();
    let pxApplied = 0;

    while (!s.done && pxApplied < 200000) {
      s = applyScroll(s, BUILD_CHUNK_PX);
      pxApplied += Math.abs(BUILD_CHUNK_PX);
      s = settle(s, 6);
    }

    expect(s.done).toBe(true);
    expect(pxApplied).toBeGreaterThanOrEqual(50000);
    expect(pxApplied).toBeLessThanOrEqual(80000);
  });

  it('an undo of 300 px after 300 px of building returns toward 0', () => {
    let s = initialSim();
    s = applyScroll(s, -300);
    s = settle(s, 60);
    const builtYears = s.years;
    expect(builtYears).toBeGreaterThan(0);

    s = applyScroll(s, 300);
    expect(s.targetYears).toBeCloseTo(0, 6);

    s = settle(s, 60);
    expect(s.years).toBeLessThan(builtYears);
    expect(s.years).toBeCloseTo(0, 2);
  });

  it('applyScroll is a no-op once the sim is done', () => {
    const done: SimState = { years: TOTAL_YEARS, targetYears: TOTAL_YEARS, scaleM: SCALE_MIN_M, zoom: null, done: true };
    expect(applyScroll(done, -1000)).toEqual(done);
  });

  it('zoom in triggers after an undo scroll drops height below the threshold', () => {
    const scaleM = SCALE_MIN_M * ZOOM_FACTOR; // already zoomed out once
    const thresholdM = (ZOOM_TRIGGER / ZOOM_FACTOR) * ZOOM_IN_MARGIN * scaleM;
    const startYears = thresholdM / BRICK_M + 5; // a few bricks above the threshold
    let s: SimState = { years: startYears, targetYears: startYears, scaleM, zoom: null, done: false };

    s = applyScroll(s, 2000); // a large undo, well past the threshold
    s = settle(s, 90);

    expect(s.zoom).toBeNull();
    expect(s.scaleM).toBeCloseTo(scaleM / ZOOM_FACTOR, 6);
  });

  it('finishes a zoom-out instantly in one step under reduced motion, but not under normal motion', () => {
    const startYears = (ZOOM_TRIGGER * SCALE_MIN_M) / BRICK_M + 1;
    const primed: SimState = { years: startYears, targetYears: startYears, scaleM: SCALE_MIN_M, zoom: null, done: false };

    const reduced = step(primed, DT, true);
    expect(reduced.zoom).toBeNull();
    expect(reduced.scaleM).toBeCloseTo(SCALE_MIN_M * ZOOM_FACTOR, 10);

    const normal = step(primed, DT, false);
    expect(normal.zoom).not.toBeNull();
    expect(normal.scaleM).toBeGreaterThanOrEqual(SCALE_MIN_M);
    expect(normal.scaleM).toBeLessThan(SCALE_MIN_M * ZOOM_FACTOR);
  });

  it('reduced motion snaps years to target in one step', () => {
    const s: SimState = { years: 0, targetYears: 12345, scaleM: SCALE_MIN_M, zoom: null, done: false };
    const next = step(s, DT, true);
    expect(next.years).toBe(12345);
  });

  it('clamps dt above 0.05s so a background tab does not jump', () => {
    const s: SimState = { years: 0, targetYears: 1000, scaleM: SCALE_MIN_M, zoom: null, done: false };
    const clamped = step(s, 0.05, false);
    const jumped = step(s, 5, false);
    expect(jumped.years).toBeCloseTo(clamped.years, 10);
  });

  it('never changes years when targetYears already equals years', () => {
    let s = initialSim();
    for (let i = 0; i < 300; i++) s = step(s, DT, false);
    expect(s.years).toBe(0);
    expect(s.done).toBe(false);
    expect(heightM(s)).toBe(0);
  });

  it('never exceeds TOTAL_YEARS and never goes negative, even from an out-of-range target', () => {
    let over: SimState = { years: 0, targetYears: TOTAL_YEARS * 2, scaleM: SCALE_MIN_M, zoom: null, done: false };
    over = settle(over, 10000);
    expect(over.years).toBeLessThanOrEqual(TOTAL_YEARS);
    expect(over.done).toBe(true);

    let under: SimState = { years: 100, targetYears: -1000, scaleM: SCALE_MIN_M, zoom: null, done: false };
    under = settle(under, 10000);
    expect(under.years).toBeGreaterThanOrEqual(0);
  });
});

describe('bricksFor', () => {
  it('floors to the nearest whole brick and never goes negative', () => {
    expect(bricksFor(7.9)).toBe(7);
    expect(bricksFor(0.2)).toBe(0);
    expect(bricksFor(-1)).toBe(0);
  });
});

describe('heightM', () => {
  it('uses the whole-brick count, not the fractional years, at 7.9 years', () => {
    const s: SimState = { years: 7.9, targetYears: 7.9, scaleM: SCALE_MIN_M, zoom: null, done: false };
    expect(heightM(s)).toBe(7 * BRICK_M);
  });
});
