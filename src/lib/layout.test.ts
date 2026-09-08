import { describe, expect, it } from 'vitest';
import type { Landmark } from './landmarks';
import {
  boxesIntersect,
  GROUND_HIDE_PX,
  iconXFor,
  LABEL_METRICS,
  LABEL_METRICS_NARROW,
  LABEL_RISE_PX,
  LEADER_MIN_PX,
  placeLandmarks,
  STAGE_TOP_GAP_PX,
  stageTopFor,
  UPCOMING_PER_SIDE,
  visibleUpcoming,
  type LabelMetrics,
  type PlacedLandmark,
  type StageBox,
} from './layout';

// top=150, ground=650 -> a 500px tall stage; pxPerMeter=50.
const stage: StageBox = { top: 150, ground: 650 };
// Taller again, for the cluster test: enough headroom that a unit is only
// ever dropped by the test's own doing, never for running out of stage.
const tallStage: StageBox = { top: 40, ground: 650 };
const pxPerMeter = 50;

// The rectangle a placed label unit occupies: its icon, centered on its own
// baseline, reaching metrics.risePx above it and standing metrics.heightPx
// tall. Every unit on a side shares the same x range, so only the vertical
// spans can separate them.
function unitBox(p: PlacedLandmark, metrics: LabelMetrics) {
  return { x: 0, y: p.labelY - metrics.risePx, w: 100, h: metrics.heightPx };
}

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

  it('stacks a cluster of nearby landmarks on one side so no two label units ever intersect', () => {
    // meters 0.1 apart -> lineY 5px apart: without stacking, every one of
    // these units would be drawn on top of the last.
    const landmarks = [mark('a', 5.0), mark('b', 5.1), mark('c', 5.2), mark('d', 5.3), mark('e', 5.4)];

    for (const [metricsLabel, metrics] of [
      ['wide', LABEL_METRICS],
      ['narrow', LABEL_METRICS_NARROW],
    ] as const) {
      const placed = placeLandmarks(landmarks, 0, pxPerMeter, tallStage, metrics);
      expect(placed.left, metricsLabel).toHaveLength(5);
      expect(placed.right, metricsLabel).toHaveLength(0);

      const boxes = placed.left.map((p) => unitBox(p, metrics));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(boxesIntersect(boxes[i], boxes[j]), `${metricsLabel}: units ${i} and ${j}`).toBe(false);
        }
      }
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
    // meters=11 -> lineY=100, so the whole label unit would sit well above
    // top=150: excluded.
    const landmarks = [mark('too-high', 11), mark('visible', 5)];
    const placed = placeLandmarks(landmarks, 0, pxPerMeter, stage);

    expect(placed.left.map((p) => p.landmark.id)).toEqual(['visible']);
  });

  it('never places a label unit above the stage top, however hard stacking pushes', () => {
    // A stage whose usable top is only 150px above the ground: a cluster this
    // tight would otherwise stack its labels straight up past it and under the
    // HUD's corner block.
    const lowStage: StageBox = { top: 500, ground: 650 };
    const landmarks = Array.from({ length: 12 }, (_, i) => mark(`m-${i}`, 1 + i * 0.05));

    const placed = placeLandmarks(landmarks, 0, pxPerMeter, lowStage);

    expect(placed.left.length).toBeGreaterThan(0);
    for (const p of placed.left) {
      expect(p.labelY - LABEL_RISE_PX).toBeGreaterThanOrEqual(lowStage.top);
      expect(p.lineY).toBeGreaterThan(lowStage.top);
    }
    // And it really is the top doing the work: the same cluster on the normal
    // stage keeps every one of them.
    expect(placed.left.length).toBeLessThan(placeLandmarks(landmarks, 0, pxPerMeter, stage).left.length);
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
    // Eight is as many as this stage's usable top has room for once they
    // stack — enough to show they are kept, few enough that none is dropped
    // for reaching above stage.top.
    const passedThings = Array.from({ length: 8 }, (_, i) => mark(`thing-${i}`, 1 + i * 0.05, 'thing'));

    const placed = placeLandmarks(passedThings, 5, pxPerMeter, stage);

    expect(placed.left).toHaveLength(8);
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

describe('visibleUpcoming', () => {
  function placedItem(id: string, meters: number, passed: boolean): PlacedLandmark {
    return { landmark: mark(id, meters), lineY: 0, labelY: 0, passed };
  }

  it('keeps at most `count` unpassed landmarks', () => {
    const list = [
      placedItem('a', 1, false),
      placedItem('b', 2, false),
      placedItem('c', 3, false),
      placedItem('d', 4, false),
    ];

    expect(visibleUpcoming(list, UPCOMING_PER_SIDE).filter((p) => !p.passed)).toHaveLength(UPCOMING_PER_SIDE);
  });

  it('keeps the nearest unpassed landmarks by ascending meters, dropping the rest', () => {
    const list = [
      placedItem('far', 10, false),
      placedItem('near', 1, false),
      placedItem('mid', 5, false),
      placedItem('farthest', 20, false),
    ];

    expect(visibleUpcoming(list, 2).map((p) => p.landmark.id)).toEqual(['near', 'mid']);
  });

  it('drops every passed landmark', () => {
    const list = [
      placedItem('p1', 1, true),
      placedItem('p2', 2, true),
      placedItem('u1', 3, false),
      placedItem('u2', 4, false),
    ];

    const visible = visibleUpcoming(list, 3);
    expect(visible.some((p) => p.passed)).toBe(false);
    expect(visible.map((p) => p.landmark.id)).toEqual(['u1', 'u2']);
  });

  it('returns every unpassed landmark when there are fewer than `count`', () => {
    const list = [placedItem('a', 1, false), placedItem('b', 2, false)];
    expect(visibleUpcoming(list, UPCOMING_PER_SIDE)).toHaveLength(2);
  });
});

describe('iconXFor', () => {
  // A 768px stage with a 60px stack centered: stackLeft=354, stackRight=414.
  const stackLeft = 354;
  const stackRight = 414;
  const iconSize = 36;

  it('leaves exactly the leader gap between the stack edge and the icon, on both sides', () => {
    const left = iconXFor('left', stackLeft, iconSize);
    const right = iconXFor('right', stackRight, iconSize);

    // Left: icon ... gap ... stack. Right: stack ... gap ... icon.
    expect(stackLeft - (left + iconSize)).toBe(LEADER_MIN_PX);
    expect(right - stackRight).toBe(LEADER_MIN_PX);
  });

  it('is symmetric for a stack centered on the stage', () => {
    const width = 768;
    const left = iconXFor('left', stackLeft, iconSize);
    const right = iconXFor('right', stackRight, iconSize);

    expect(width - (right + iconSize)).toBe(left);
  });

  it('moves the icon with its size on the left and leaves it put on the right', () => {
    const small = 20;

    expect(iconXFor('left', stackLeft, small)).toBeGreaterThan(iconXFor('left', stackLeft, iconSize));
    expect(iconXFor('right', stackRight, small)).toBe(iconXFor('right', stackRight, iconSize));
  });
});

describe('stageTopFor', () => {
  it('sits STAGE_TOP_GAP_PX below the deepest HUD block', () => {
    expect(stageTopFor([120, 260, 90], 150)).toBe(260 + STAGE_TOP_GAP_PX);
  });

  it('picks the larger of two corner blocks regardless of order', () => {
    expect(stageTopFor([300, 180], 150)).toBe(stageTopFor([180, 300], 150));
    expect(stageTopFor([300, 180], 150)).toBe(300 + STAGE_TOP_GAP_PX);
  });

  it('never drops below minTop even when every measured block is shallow', () => {
    expect(stageTopFor([10, 20], 150)).toBe(150);
  });

  it('is positive on a 768px stage with realistic HUD bottoms', () => {
    expect(stageTopFor([180, 250], 150)).toBeGreaterThan(0);
  });

  it('treats an empty list as having no HUD block at all, falling back to minTop', () => {
    expect(stageTopFor([], 150)).toBe(150);
  });
});

describe('boxesIntersect', () => {
  const popup = { x: 100, y: 200, w: 220, h: 90 };

  it('finds a label box that lands inside the popup', () => {
    expect(boxesIntersect({ x: 150, y: 240, w: 60, h: 20 }, popup)).toBe(true);
  });

  it("finds a label box that only clips the popup's corner", () => {
    expect(boxesIntersect({ x: 60, y: 170, w: 60, h: 40 }, popup)).toBe(true);
  });

  it('lets a box clear of the popup through, above, below, and to either side', () => {
    expect(boxesIntersect({ x: 100, y: 100, w: 220, h: 40 }, popup)).toBe(false);
    expect(boxesIntersect({ x: 100, y: 400, w: 220, h: 40 }, popup)).toBe(false);
    expect(boxesIntersect({ x: 0, y: 200, w: 60, h: 90 }, popup)).toBe(false);
    expect(boxesIntersect({ x: 400, y: 200, w: 60, h: 90 }, popup)).toBe(false);
  });

  it('treats touching edges as clear, not overlapping', () => {
    expect(boxesIntersect({ x: 40, y: 200, w: 60, h: 90 }, popup)).toBe(false);
    expect(boxesIntersect({ x: 100, y: 110, w: 220, h: 90 }, popup)).toBe(false);
  });
});
