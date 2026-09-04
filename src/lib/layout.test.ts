import { describe, expect, it } from 'vitest';
import type { Landmark } from './landmarks';
import { placeLandmarks, type StageBox } from './layout';

// top=150, ground=650 -> a 500px tall stage; scaleM=10 -> pxPerM=50.
const stage: StageBox = { top: 150, ground: 650 };
const scaleM = 10;

function mark(id: string, meters: number): Landmark {
  return { id, meters, years: meters * 100, label: id, icon: 'bricks' };
}

describe('placeLandmarks', () => {
  it('gives two landmarks within 18px of each other different label offsets', () => {
    // y = 650 - meters*50: meters=1 -> y=600; meters=1.3 -> y=585 (15px apart).
    const landmarks = [mark('a', 1), mark('b', 1.3)];
    const placed = placeLandmarks(landmarks, 0, scaleM, stage);

    expect(placed).toHaveLength(2);
    expect(placed[0].labelDy).not.toBe(placed[1].labelDy);
  });

  it('excludes landmarks above the top margin or at/below the ground', () => {
    // meters=11 -> y=100, which is above top-30=120: excluded.
    // meters=0.001 -> y=649.95, which is above ground-1=649: excluded.
    // meters=5 -> y=400: included.
    const landmarks = [mark('too-high', 11), mark('too-low', 0.001), mark('visible', 5)];
    const placed = placeLandmarks(landmarks, 0, scaleM, stage);

    expect(placed.map((p) => p.landmark.id)).toEqual(['visible']);
  });

  it('flips passed as heightM crosses a landmark\'s meters', () => {
    const landmarks = [mark('mark', 5)];

    const before = placeLandmarks(landmarks, 4, scaleM, stage);
    expect(before[0].passed).toBe(false);

    const after = placeLandmarks(landmarks, 5, scaleM, stage);
    expect(after[0].passed).toBe(true);
  });

  it('decreases y as meters increases', () => {
    const landmarks = [mark('low', 1), mark('high', 5)];
    const placed = placeLandmarks(landmarks, 0, scaleM, stage);

    const low = placed.find((p) => p.landmark.id === 'low');
    const high = placed.find((p) => p.landmark.id === 'high');
    expect(low).toBeDefined();
    expect(high).toBeDefined();
    expect(high!.y).toBeLessThan(low!.y);
  });
});
