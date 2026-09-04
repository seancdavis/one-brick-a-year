import { describe, expect, it } from 'vitest';
import { BRICK_M, SCALE_MAX_M, SCALE_MIN_M, TOTAL_YEARS, ZOOM_FACTOR, ZOOM_TRIGGER } from './constants';

describe('constants', () => {
  it('BRICK_M is 0.0096 meters per stacked brick', () => {
    expect(BRICK_M).toBe(0.0096);
  });

  it('TOTAL_YEARS is 4.6 billion', () => {
    expect(TOTAL_YEARS).toBe(4.6e9);
  });

  it('the camera scale range is ordered min below max', () => {
    expect(SCALE_MIN_M).toBeLessThan(SCALE_MAX_M);
  });

  it('ZOOM_FACTOR is 10', () => {
    expect(ZOOM_FACTOR).toBe(10);
  });

  it('ZOOM_TRIGGER is a fraction of the screen, between 0 and 1', () => {
    expect(ZOOM_TRIGGER).toBeGreaterThan(0);
    expect(ZOOM_TRIGGER).toBeLessThan(1);
  });
});
