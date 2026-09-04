import { describe, expect, it } from 'vitest';
import type { Landmark } from './landmarks';
import { GROUND_HIDE_PX, LABEL_MIN_GAP_PX, placeLandmarks, type StageBox } from './layout';

// top=150, ground=650 -> a 500px tall stage; scaleM=10 -> pxPerM=50.
const stage: StageBox = { top: 150, ground: 650 };
const scaleM = 10;

function mark(id: string, meters: number): Landmark {
  return { id, meters, years: meters * 100, label: id, icon: 'bricks' };
}

describe('placeLandmarks', () => {
  it('stacks a cluster of nearby landmarks so no two labels are ever closer than LABEL_MIN_GAP_PX', () => {
    // meters 0.1 apart -> lineY 5px apart, well inside a 30px cluster.
    const landmarks = [mark('a', 5.0), mark('b', 5.1), mark('c', 5.2), mark('d', 5.3), mark('e', 5.4)];
    const placed = placeLandmarks(landmarks, 0, scaleM, stage);

    expect(placed).toHaveLength(5);
    const labelYs = [...placed].sort((a, b) => a.labelY - b.labelY);
    for (let i = 1; i < labelYs.length; i++) {
      const gap = labelYs[i].labelY - labelYs[i - 1].labelY;
      expect(gap).toBeGreaterThanOrEqual(LABEL_MIN_GAP_PX);
    }
  });

  it('excludes a landmark whose line is within GROUND_HIDE_PX of the ground', () => {
    // meters=0.2 -> lineY = 650 - 0.2*50 = 640, 10px above the ground.
    const landmarks = [mark('near-ground', 0.2), mark('visible', 5)];
    const placed = placeLandmarks(landmarks, 0, scaleM, stage);

    expect(placed.map((p) => p.landmark.id)).toEqual(['visible']);
    expect(650 - 640).toBeLessThan(GROUND_HIDE_PX);
  });

  it('excludes landmarks above the top margin', () => {
    // meters=11 -> lineY=100, which is above top-30=120: excluded.
    const landmarks = [mark('too-high', 11), mark('visible', 5)];
    const placed = placeLandmarks(landmarks, 0, scaleM, stage);

    expect(placed.map((p) => p.landmark.id)).toEqual(['visible']);
  });

  it("flips passed as heightM crosses a landmark's meters", () => {
    const landmarks = [mark('mark', 5)];

    const before = placeLandmarks(landmarks, 4, scaleM, stage);
    expect(before[0].passed).toBe(false);

    const after = placeLandmarks(landmarks, 5, scaleM, stage);
    expect(after[0].passed).toBe(true);
  });

  it('decreases lineY as meters increases', () => {
    const landmarks = [mark('low', 1), mark('high', 5)];
    const placed = placeLandmarks(landmarks, 0, scaleM, stage);

    const low = placed.find((p) => p.landmark.id === 'low');
    const high = placed.find((p) => p.landmark.id === 'high');
    expect(low).toBeDefined();
    expect(high).toBeDefined();
    expect(high!.lineY).toBeLessThan(low!.lineY);
  });
});
