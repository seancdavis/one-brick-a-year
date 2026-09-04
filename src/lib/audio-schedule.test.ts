import { describe, expect, it } from 'vitest';
import {
  HUM_START_RATE,
  HUM_MAX_GAIN,
  SOUND_DEFAULT_ENABLED,
  TICK_CAP_PER_S,
  humFor,
  ticksPerSecond,
} from './audio-schedule';

// A spread of rates from released (0) up past well beyond the fastest the
// sim ever reaches (rateFor climbs far past TOTAL_YEARS before a hold ends).
const RATES = [0, 1, 5, 11, 12, 12.5, 50, 500, 999, 1000, 1000.1, 1e4, 1e5, 1e6, 1e7, 1e8, 4.6e9, 1e10];

describe('ticksPerSecond', () => {
  it('never exceeds the cap across rates from 0 to 1e10', () => {
    for (const rate of RATES) {
      expect(ticksPerSecond(rate)).toBeLessThanOrEqual(TICK_CAP_PER_S);
    }
  });

  it('equals the rate below the cap', () => {
    for (const rate of [0.5, 1, 5, 11, 11.9]) {
      expect(ticksPerSecond(rate)).toBeCloseTo(rate, 10);
    }
  });

  it('is 0 when the rate is 0 or negative', () => {
    expect(ticksPerSecond(0)).toBe(0);
    expect(ticksPerSecond(-5)).toBe(0);
  });

  it('is capped at TICK_CAP_PER_S once the rate passes it', () => {
    expect(ticksPerSecond(TICK_CAP_PER_S)).toBe(TICK_CAP_PER_S);
    expect(ticksPerSecond(1e10)).toBe(TICK_CAP_PER_S);
  });
});

describe('humFor', () => {
  it('is silent at and below 1,000 years per second', () => {
    for (const rate of [0, 1, 500, 999, 1000]) {
      expect(humFor(rate).gain).toBe(0);
    }
  });

  it('is audible above 1,000 years per second', () => {
    for (const rate of [1000.1, 1e4, 1e6, 4.6e9, 1e10]) {
      expect(humFor(rate).gain).toBeGreaterThan(0);
    }
  });

  it('never exceeds the max gain', () => {
    for (const rate of RATES) {
      expect(humFor(rate).gain).toBeLessThanOrEqual(HUM_MAX_GAIN);
    }
  });

  it('hz is monotonic non-decreasing as the rate rises', () => {
    let prevHz = -Infinity;
    for (const rate of RATES) {
      const { hz } = humFor(rate);
      expect(hz).toBeGreaterThanOrEqual(prevHz);
      prevHz = hz;
    }
  });

  it('hz starts at 110 at and below the start rate', () => {
    expect(humFor(0).hz).toBe(110);
    expect(humFor(HUM_START_RATE).hz).toBe(110);
  });

  it('hz reaches 440 by 4.6 billion years per second and does not exceed it', () => {
    expect(humFor(4.6e9).hz).toBeCloseTo(440, 6);
    expect(humFor(1e10).hz).toBeCloseTo(440, 6);
  });
});

it('defaults sound to off', () => {
  expect(SOUND_DEFAULT_ENABLED).toBe(false);
});
