// Which landmarks are in view, where their dashed lines land, and where
// their labels stack when neighbors crowd together. Two-sided: things stack
// on the left, time events on the right, each side independently, so a
// thing and a time event at the same height never push each other.

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

export interface PlacedLandmarks {
  left: PlacedLandmark[];
  right: PlacedLandmark[];
}

// A label always starts this far above its own line...
const LABEL_LINE_OFFSET_PX = 6;

// ...but never closer than this to the previous (lower) label's baseline, so
// two labels never overlap however close their landmarks are. Large enough
// to clear a wrapped label's second line (src/render/stage.ts draws it
// SECOND_LINE_HEIGHT_PX = 12 below the first) so a two-line label never
// touches the label stacked above it.
export const LABEL_MIN_GAP_PX = 30;

// A landmark whose line sits within this many px of the ground line reads as
// indistinguishable from the ground itself, so it's dropped instead of drawn
// crowded against it.
export const GROUND_HIDE_PX = 24;

// Places one side's landmarks independently: ascending meters is descending
// y, so the nearest landmarks sit low, near the ground, and the farthest sit
// high, near the top. Walking this order lets each label push up against the
// one just placed below it, so the stack builds bottom-to-top with no
// overlap — but only against labels on the *same* side, so a thing and a
// time event at the same height never push each other.
function placeSide(landmarks: Landmark[], heightM: number, pxPerM: number, stage: StageBox): PlacedLandmark[] {
  const placed: PlacedLandmark[] = [];
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

export function placeLandmarks(
  landmarks: Landmark[],
  heightM: number,
  pxPerMeter: number,
  stage: StageBox,
): PlacedLandmarks {
  return {
    left: placeSide(
      landmarks.filter((l) => l.kind === 'thing'),
      heightM,
      pxPerMeter,
      stage,
    ),
    right: placeSide(
      landmarks.filter((l) => l.kind === 'time'),
      heightM,
      pxPerMeter,
      stage,
    ),
  };
}
