// Which landmarks are in view, where their dashed lines land, and where
// their labels stack when neighbors crowd together. Ports the placement math
// inside the prototype's `render()` loop (docs/prototype/brick-stack.html),
// reworked to use real label stacking instead of a pairwise collision
// offset — see docs/autopilot/2026-09-04-one-brick-a-year-round-2.md, slice 1.

import type { Landmark } from './landmarks';

export interface StageBox {
  top: number;
  ground: number;
}

export interface PlacedLandmark {
  landmark: Landmark;
  lineY: number;
  labelY: number;
  passed: boolean;
}

// A label always starts this far above its own line...
const LABEL_LINE_OFFSET_PX = 6;

// ...but never closer than this to the previous (lower) label's baseline, so
// two labels never overlap however close their landmarks are.
export const LABEL_MIN_GAP_PX = 16;

// A landmark whose line sits within this many px of the ground line reads as
// indistinguishable from the ground itself, so it's dropped instead of drawn
// crowded against it.
export const GROUND_HIDE_PX = 24;

export function placeLandmarks(
  landmarks: Landmark[],
  heightM: number,
  scaleM: number,
  stage: StageBox,
): PlacedLandmark[] {
  const pxPerM = (stage.ground - stage.top) / scaleM;
  const placed: PlacedLandmark[] = [];

  // Ascending meters is descending y: the nearest landmarks sit low, near
  // the ground, and the farthest sit high, near the top. Walking this order
  // lets each label push up against the one just placed below it, so the
  // stack builds bottom-to-top with no overlap.
  const ordered = [...landmarks].sort((a, b) => a.meters - b.meters);

  let previousLabelY = Infinity;

  for (const landmark of ordered) {
    const lineY = stage.ground - landmark.meters * pxPerM;
    if (lineY < stage.top - 30 || lineY > stage.ground - GROUND_HIDE_PX) continue;

    const labelY = Math.min(lineY - LABEL_LINE_OFFSET_PX, previousLabelY - LABEL_MIN_GAP_PX);
    previousLabelY = labelY;

    placed.push({
      landmark,
      lineY,
      labelY,
      passed: heightM >= landmark.meters,
    });
  }

  return placed;
}
