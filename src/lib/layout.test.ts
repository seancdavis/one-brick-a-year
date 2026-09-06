import { describe, expect, it } from 'vitest';
import type { Landmark } from './landmarks';
import {
  GROUND_HIDE_PX,
  LABEL_MARGIN_PX,
  LABEL_MIN_GAP_PX,
  labelRoom,
  placeLandmarks,
  type StageBox,
} from './layout';

// top=150, ground=650 -> a 500px tall stage; pxPerMeter=50.
const stage: StageBox = { top: 150, ground: 650 };
const pxPerMeter = 50;

function mark(id: string, meters: number, kind: Landmark['kind'] = 'thing'): Landmark {
  const base = { id, meters, years: meters * 100, label: id, icon: 'bricks' as const, paper: 'navy' as const };
  return kind === 'thing'
    ? { ...base, kind, orientation: 'tall', tallerThanPhrase: `taller than ${id}!` }
    : { ...base, kind };
}

describe('placeLandmarks', () => {
  it('places a thing on the left and a time event on the right', () => {
    const landmarks = [mark('t', 5, 'thing'), mark('e', 8, 'time')];
    const placed = placeLandmarks(landmarks, 0, pxPerMeter, stage);

    expect(placed.left.map((p) => p.landmark.id)).toEqual(['t']);
    expect(placed.right.map((p) => p.landmark.id)).toEqual(['e']);
  });

  it('stacks each side independently: a thing and a time event at the same height do not push each other', () => {
    const landmarks = [mark('t', 5, 'thing'), mark('e', 5, 'time')];
    const placed = placeLandmarks(landmarks, 0, pxPerMeter, stage);

    expect(placed.left).toHaveLength(1);
    expect(placed.right).toHaveLength(1);
    // Same meters -> same lineY -> the same labelY on each side, since
    // neither side has a same-side neighbor to push against.
    expect(placed.left[0].lineY).toBe(placed.right[0].lineY);
    expect(placed.left[0].labelY).toBe(placed.right[0].labelY);
  });

  it('stacks a cluster of nearby landmarks on one side so no two labels are ever closer than LABEL_MIN_GAP_PX', () => {
    // meters 0.1 apart -> lineY 5px apart, well inside a 30px cluster.
    const landmarks = [mark('a', 5.0), mark('b', 5.1), mark('c', 5.2), mark('d', 5.3), mark('e', 5.4)];
    const placed = placeLandmarks(landmarks, 0, pxPerMeter, stage);

    expect(placed.left).toHaveLength(5);
    expect(placed.right).toHaveLength(0);
    const labelYs = [...placed.left].sort((a, b) => a.labelY - b.labelY);
    for (let i = 1; i < labelYs.length; i++) {
      const gap = labelYs[i].labelY - labelYs[i - 1].labelY;
      expect(gap).toBeGreaterThanOrEqual(LABEL_MIN_GAP_PX);
    }
  });

  it('excludes a landmark whose line is within GROUND_HIDE_PX of the ground', () => {
    // meters=0.2 -> lineY = 650 - 0.2*50 = 640, 10px above the ground.
    const landmarks = [mark('near-ground', 0.2), mark('visible', 5)];
    const placed = placeLandmarks(landmarks, 0, pxPerMeter, stage);

    expect(placed.left.map((p) => p.landmark.id)).toEqual(['visible']);
    expect(650 - 640).toBeLessThan(GROUND_HIDE_PX);
  });

  it('excludes landmarks above the top margin', () => {
    // meters=11 -> lineY=100, which is above top-30=120: excluded.
    const landmarks = [mark('too-high', 11), mark('visible', 5)];
    const placed = placeLandmarks(landmarks, 0, pxPerMeter, stage);

    expect(placed.left.map((p) => p.landmark.id)).toEqual(['visible']);
  });

  it("flips passed as heightM crosses a landmark's meters", () => {
    const landmarks = [mark('mark', 5)];

    const before = placeLandmarks(landmarks, 4, pxPerMeter, stage);
    expect(before.left[0].passed).toBe(false);

    const after = placeLandmarks(landmarks, 5, pxPerMeter, stage);
    expect(after.left[0].passed).toBe(true);
  });

  it('excludes passed time landmarks from stacking so an upcoming label keeps its natural line', () => {
    // 20 passed time events, all below heightM, followed by one upcoming
    // event well above the stack. If the passed ones still counted toward
    // the stacking chain, the upcoming label would get pushed up away from
    // its own line by their (invisible) presence.
    const passedEvents = Array.from({ length: 20 }, (_, i) => mark(`passed-${i}`, 1 + i * 0.05, 'time'));
    const upcoming = mark('upcoming', 8, 'time');

    const withPassed = placeLandmarks([...passedEvents, upcoming], 5, pxPerMeter, stage);
    const aloneUpcoming = placeLandmarks([upcoming], 5, pxPerMeter, stage);

    expect(withPassed.right.map((p) => p.landmark.id)).toEqual(['upcoming']);
    expect(withPassed.right[0].labelY).toBe(aloneUpcoming.right[0].labelY);
  });

  it('keeps a passed thing (left side) in the stack, unlike a passed time event', () => {
    const passedThings = Array.from({ length: 20 }, (_, i) => mark(`thing-${i}`, 1 + i * 0.05, 'thing'));

    const placed = placeLandmarks(passedThings, 5, pxPerMeter, stage);

    expect(placed.left).toHaveLength(20);
    expect(placed.left.every((p) => p.passed)).toBe(true);
  });

  it('decreases lineY as meters increases', () => {
    const landmarks = [mark('low', 1), mark('high', 5)];
    const placed = placeLandmarks(landmarks, 0, pxPerMeter, stage);

    const low = placed.left.find((p) => p.landmark.id === 'low');
    const high = placed.left.find((p) => p.landmark.id === 'high');
    expect(low).toBeDefined();
    expect(high).toBeDefined();
    expect(high!.lineY).toBeLessThan(low!.lineY);
  });
});

describe('labelRoom', () => {
  // A 768px stage with a 60px stack centered: stackLeft=354, stackRight=414.
  const width = 768;
  const stackLeft = 354;
  const stackRight = 414;
  const iconSize = 36;

  it('gives both sides positive room for their text', () => {
    const left = labelRoom('left', stackLeft, width, iconSize, false);
    const right = labelRoom('right', stackRight, width, iconSize, false);

    expect(left.textMaxWidth).toBeGreaterThan(0);
    expect(right.textMaxWidth).toBeGreaterThan(0);
  });

  it('sits the icon on the far side of the text from the stack, mirrored on each side', () => {
    const left = labelRoom('left', stackLeft, width, iconSize, false);
    const right = labelRoom('right', stackRight, width, iconSize, false);

    // Left: margin ... text ... icon ... stack. Right: stack ... icon ... text ... margin.
    expect(left.textX).toBeLessThan(left.iconX);
    expect(right.iconX).toBeLessThan(right.textX);
  });

  it('is symmetric for a stack centered on the stage', () => {
    const left = labelRoom('left', stackLeft, width, iconSize, false);
    const right = labelRoom('right', stackRight, width, iconSize, false);

    expect(right.textMaxWidth).toBe(left.textMaxWidth);
  });

  it('starts the text within 60px of the stack edge on a wide stage', () => {
    // A wider stage than the narrow breakpoint, with a small icon: the text
    // hugs the icon, which hugs the stack — "labels next to their icons"
    // replaces the old margin-anchored layout, where a wide screen could
    // leave the label stranded far from its icon.
    const wideWidth = 1180;
    const wideStackLeft = 560;
    const wideStackRight = 620;
    const smallIcon = 20;

    const left = labelRoom('left', wideStackLeft, wideWidth, smallIcon, false);
    const right = labelRoom('right', wideStackRight, wideWidth, smallIcon, false);

    expect(wideStackLeft - left.textX).toBeLessThanOrEqual(60);
    expect(right.textX - wideStackRight).toBeLessThanOrEqual(60);
  });

  it('keeps the text within the screen margin', () => {
    const left = labelRoom('left', stackLeft, width, iconSize, false);
    const right = labelRoom('right', stackRight, width, iconSize, false);

    expect(left.textX - left.textMaxWidth).toBeGreaterThanOrEqual(LABEL_MARGIN_PX - 1);
    expect(right.textX + right.textMaxWidth).toBeLessThanOrEqual(width - LABEL_MARGIN_PX + 1);
  });
});
