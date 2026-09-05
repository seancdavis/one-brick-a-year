import { describe, expect, it } from 'vitest';
import { TOTAL_YEARS } from './constants';
import { initialSim, step } from './sim';
import {
  IDLE_VELOCITY_PX_S,
  INITIAL_SCROLL,
  SCROLL_HALF_LIFE_S,
  decayVelocity,
  pushScroll,
  yearsPerSecond,
  type ScrollState,
} from './scroll-state';

const DT = 1 / 60;

describe('a sustained 1,500 px/s scroll', () => {
  it('still reads as individual bricks ten seconds in, but finishes all 4.6e9 years between 60 and 120 simulated seconds', () => {
    let scroll: ScrollState = INITIAL_SCROLL;
    let sim = initialSim();
    let seconds = 0;
    let yearsAt10: number | null = null;

    while (!sim.done && seconds < 200) {
      seconds += DT;
      // Push a delta of 1,500/60 px this frame, then let the tracked
      // velocity decay to "now" (a no-op here since the push above already
      // brought it current, but it mirrors src/main.ts's real per-frame
      // flow: pushScroll on each scroll event, decayVelocity every frame).
      scroll = pushScroll(scroll, 1500 / 60, seconds);
      scroll = decayVelocity(scroll, seconds);

      const rate = yearsPerSecond(scroll.velocity, sim.years);
      sim = step(sim, DT, rate, false);

      if (yearsAt10 === null && seconds >= 10) {
        yearsAt10 = sim.years;
      }
    }

    expect(yearsAt10).not.toBeNull();
    expect(yearsAt10 as number).toBeLessThan(200);

    expect(sim.done).toBe(true);
    expect(seconds).toBeGreaterThanOrEqual(60);
    expect(seconds).toBeLessThanOrEqual(120);
  });
});

describe('no pushes', () => {
  it('velocity decays to below 1 px/s within 5 s and the sim never advances', () => {
    let scroll: ScrollState = INITIAL_SCROLL;
    let sim = initialSim();
    let seconds = 0;

    while (seconds < 5) {
      seconds += DT;
      scroll = decayVelocity(scroll, seconds);
      const rate = yearsPerSecond(scroll.velocity, sim.years);
      sim = step(sim, DT, rate, false);
    }

    expect(scroll.velocity).toBeLessThan(1);
    expect(sim.years).toBe(0);
    expect(sim.done).toBe(false);
  });
});

describe('decayVelocity', () => {
  it('halves velocity after 0.5 s with no input', () => {
    const pushed = pushScroll(INITIAL_SCROLL, 500, 0);
    const decayed = decayVelocity(pushed, SCROLL_HALF_LIFE_S);
    expect(decayed.velocity).toBeCloseTo(pushed.velocity / 2, 6);
  });

  it('snaps a velocity below IDLE_VELOCITY_PX_S to exactly 0', () => {
    const state: ScrollState = { velocity: IDLE_VELOCITY_PX_S - 0.001, lastAt: 0 };
    expect(decayVelocity(state, 0).velocity).toBe(0);
  });

  it('leaves a velocity at or above IDLE_VELOCITY_PX_S alone (no elapsed time)', () => {
    const state: ScrollState = { velocity: IDLE_VELOCITY_PX_S + 5, lastAt: 0 };
    expect(decayVelocity(state, 0).velocity).toBeGreaterThanOrEqual(IDLE_VELOCITY_PX_S);
  });

  it('eventually reaches exactly 0, not just near it, given enough time', () => {
    let state: ScrollState = pushScroll(INITIAL_SCROLL, 500, 0);
    for (let t = 1; t <= 20; t++) {
      state = decayVelocity(state, t);
    }
    expect(state.velocity).toBe(0);
  });
});

describe('yearsPerSecond', () => {
  it('is lower for a gentler 300 px/s scroll than for 1,500 px/s at the same years', () => {
    const years = 1e6;
    expect(yearsPerSecond(300, years)).toBeLessThan(yearsPerSecond(1500, years));
  });

  it('never goes negative', () => {
    expect(yearsPerSecond(0, 0)).toBe(0);
    expect(yearsPerSecond(-10, 100)).toBe(0);
  });
});

// Sanity-check the total years constant this pacing test relies on hasn't
// drifted out from under it.
describe('TOTAL_YEARS', () => {
  it('is 4.6 billion', () => {
    expect(TOTAL_YEARS).toBe(4.6e9);
  });
});
