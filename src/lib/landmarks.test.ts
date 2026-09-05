import { describe, expect, it } from 'vitest';
import { BRICK_M } from './constants';
import { DEFAULT_COLOR_ID } from './lego-colors';
import { buildLandmarks, type PaperColor } from './landmarks';

const PAPER_COLOR_NAMES: readonly PaperColor[] = ['navy', 'leaf', 'mustard', 'coral'];

const profile = { name: 'Kid', ageYears: 8, homeMeters: 8, colorId: DEFAULT_COLOR_ID };

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

  it('gives every landmark a kind, with both kinds present', () => {
    const landmarks = buildLandmarks(profile);
    for (const landmark of landmarks) {
      expect(['thing', 'time']).toContain(landmark.kind);
    }
    expect(landmarks.some((l) => l.kind === 'thing')).toBe(true);
    expect(landmarks.some((l) => l.kind === 'time')).toBe(true);
  });

  it('gives every landmark one of the four cut-paper color names', () => {
    const landmarks = buildLandmarks(profile);
    for (const landmark of landmarks) {
      expect(PAPER_COLOR_NAMES).toContain(landmark.paper);
    }
  });

  it('reflects the profile for personal landmarks', () => {
    const landmarks = buildLandmarks({ name: 'Kid', ageYears: 10, homeMeters: 4, colorId: DEFAULT_COLOR_ID });
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
