import { describe, expect, it } from 'vitest';
import { TOTAL_YEARS } from './constants';
import { BASE_YEARS_PER_PX, PROGRESS_K, advance, pageDeltaToBuildPx, yearsPerPx } from './scroll-coupling';

describe('advance', () => {
  it('reaches TOTAL_YEARS between 150,000 and 210,000 px of cumulative upward scroll from 0', () => {
    let years = 0;
    let px = 0;
    while (years < TOTAL_YEARS && px < 400000) {
      years = advance(years, 100);
      px += 100;
    }
    expect(years).toBeGreaterThanOrEqual(TOTAL_YEARS);
    expect(px).toBeGreaterThanOrEqual(150000);
    expect(px).toBeLessThanOrEqual(210000);
  });

  it('the first 100 years take at least 3,000 px of cumulative upward scroll', () => {
    let years = 0;
    let px = 0;
    while (years < 100 && px < 400000) {
      years = advance(years, 100);
      px += 100;
    }
    expect(years).toBeGreaterThanOrEqual(100);
    expect(px).toBeGreaterThanOrEqual(3000);
  });

  it('undoes exactly: building 5,000 px then undoing 5,000 px returns to 0', () => {
    const built = advance(0, 5000);
    const undone = advance(built, -5000);
    expect(undone).toBeCloseTo(0, 6);
  });

  it('never goes below 0', () => {
    expect(advance(0, -1000)).toBe(0);
    expect(advance(100, -1e9)).toBe(0);
  });

  it('never exceeds TOTAL_YEARS', () => {
    expect(advance(0, 1e9)).toBeLessThanOrEqual(TOTAL_YEARS);
    expect(advance(TOTAL_YEARS, 1000)).toBe(TOTAL_YEARS);
  });
});

describe('yearsPerPx', () => {
  it('is strictly increasing with years', () => {
    expect(yearsPerPx(0)).toBe(BASE_YEARS_PER_PX);
    expect(yearsPerPx(1e6)).toBeGreaterThan(yearsPerPx(0));
    expect(yearsPerPx(TOTAL_YEARS)).toBeGreaterThan(yearsPerPx(1e6));
  });

  it('matches BASE_YEARS_PER_PX * (1 + PROGRESS_K * years)', () => {
    expect(yearsPerPx(1000)).toBeCloseTo(BASE_YEARS_PER_PX * (1 + PROGRESS_K * 1000), 10);
  });
});

describe('pageDeltaToBuildPx', () => {
  it('negates the page delta: scrolling down undoes, scrolling up builds', () => {
    expect(pageDeltaToBuildPx(120)).toBe(-120);
    expect(pageDeltaToBuildPx(-120)).toBe(120);
    expect(pageDeltaToBuildPx(0)).toBeCloseTo(0);
  });
});
