// Which landmarks are in view, where their lines land, and whether their
// labels need to dodge a neighbor. Ports the placement math inside the
// prototype's `render()` loop (docs/prototype/brick-stack.html) verbatim.

import type { Landmark } from './landmarks';

export interface StageBox {
  top: number;
  ground: number;
}

export interface PlacedLandmark {
  landmark: Landmark;
  y: number;
  labelDy: number;
  passed: boolean;
}

// Two landmark lines closer together than this (in px) would overlap labels,
// so the second one's label is pushed below its line instead of above.
const LABEL_COLLISION_PX = 18;

export function placeLandmarks(
  landmarks: Landmark[],
  heightM: number,
  scaleM: number,
  stage: StageBox,
): PlacedLandmark[] {
  const pxPerM = (stage.ground - stage.top) / scaleM;
  const placed: PlacedLandmark[] = [];

  // Tracks the y of the previously placed (i.e. visible) landmark, walked in
  // ascending meters order, so label offsets only dodge their nearest
  // on-screen neighbor.
  let lastY = -999;

  for (const landmark of landmarks) {
    const y = stage.ground - landmark.meters * pxPerM;
    if (y < stage.top - 30 || y > stage.ground - 1) continue;

    const labelDy = Math.abs(y - lastY) < LABEL_COLLISION_PX ? 15 : -6;
    lastY = y;

    placed.push({
      landmark,
      y,
      labelDy,
      passed: heightM >= landmark.meters,
    });
  }

  return placed;
}
