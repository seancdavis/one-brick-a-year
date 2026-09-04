import { describe, expect, it } from 'vitest';
import { BRICK_M } from './constants';
import { buildLandmarks } from './landmarks';

const profile = { name: 'Kid', ageYears: 8, homeMeters: 8 };

describe('buildLandmarks', () => {
  it('sorts landmarks ascending by meters', () => {
    const landmarks = buildLandmarks(profile);
    for (let i = 1; i < landmarks.length; i++) {
      expect(landmarks[i].meters).toBeGreaterThanOrEqual(landmarks[i - 1].meters);
    }
  });

  it('keeps years and meters consistent with BRICK_M within 0.5%', () => {
    const landmarks = buildLandmarks(profile);
    for (const landmark of landmarks) {
      const expectedMeters = landmark.years * BRICK_M;
      const tolerance = Math.abs(expectedMeters) * 0.005;
      expect(Math.abs(landmark.meters - expectedMeters)).toBeLessThanOrEqual(tolerance);
    }
  });

  it('reflects the profile for personal landmarks', () => {
    const landmarks = buildLandmarks({ name: 'Kid', ageYears: 10, homeMeters: 4 });
    const life = landmarks.find((l) => l.id === 'life');
    const home = landmarks.find((l) => l.id === 'home');
    expect(life?.years).toBe(10);
    expect(home?.meters).toBe(4);
  });

  it('includes every landmark from the table exactly once', () => {
    const landmarks = buildLandmarks(profile);
    const ids = landmarks.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(
      [
        'life',
        'ruler',
        'door',
        'home',
        'writing',
        'liberty',
        'eiffel',
        'burj',
        'humans',
        'everest',
        'planes',
        'space',
        'iss',
        'asteroid',
        'dinosaurs',
        'animals',
        'earth-wide',
        'oxygen',
        'life-first',
        'around',
      ].sort(),
    );
  });
});
