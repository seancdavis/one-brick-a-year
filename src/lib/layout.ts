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
// two labels never overlap however close their landmarks are.
export const LABEL_MIN_GAP_PX = 30;

// This module has no canvas to measure text with, so it can't tell ahead of
// render time which labels src/render/stage.ts will wrap to two lines. On a
// narrow canvas, where wrapping is common, the simplest safe choice is to
// reserve a second line's worth of gap for every label rather than guessing
// per landmark.
export const LABEL_MIN_GAP_NARROW_PX = 46;

// A landmark whose line sits within this many px of the ground line reads as
// indistinguishable from the ground itself, so it's dropped instead of drawn
// crowded against it.
export const GROUND_HIDE_PX = 24;

// Places one side's landmarks independently: ascending meters is descending
// y, so the nearest landmarks sit low, near the ground, and the farthest sit
// high, near the top. Walking this order lets each label push up against the
// one just placed below it, so the stack builds bottom-to-top with no
// overlap — but only against labels on the *same* side, so a thing and a
// time event at the same height never push each other. `excludePassed` drops
// a passed landmark from the stack entirely, rather than merely not drawing
// it, so it can't take up stacking room an upcoming label further along
// would otherwise get: a right-side time event whose label has already
// become a tag (src/tags.ts) would otherwise still crowd the labels above it
// even though nothing of it is ever drawn.
function placeSide(
  landmarks: Landmark[],
  heightM: number,
  pxPerM: number,
  stage: StageBox,
  minGapPx: number,
  excludePassed: boolean,
): PlacedLandmark[] {
  const placed: PlacedLandmark[] = [];
  const ordered = [...landmarks].sort((a, b) => a.meters - b.meters);

  let previousLabelY = Infinity;

  for (const landmark of ordered) {
    const passed = heightM >= landmark.meters;
    if (excludePassed && passed) continue;

    const lineY = stage.ground - landmark.meters * pxPerM;
    if (lineY < stage.top - 30 || lineY > stage.ground - GROUND_HIDE_PX) continue;

    const labelY = Math.min(lineY - LABEL_LINE_OFFSET_PX, previousLabelY - minGapPx);
    previousLabelY = labelY;

    placed.push({
      landmark,
      lineY,
      labelY,
      passed,
    });
  }

  return placed;
}

export function placeLandmarks(
  landmarks: Landmark[],
  heightM: number,
  pxPerMeter: number,
  stage: StageBox,
  minGapPx: number = LABEL_MIN_GAP_PX,
): PlacedLandmarks {
  return {
    // Things (left) keep their label after the stack passes them — only time
    // events hand off to a tag — so nothing is excluded here.
    left: placeSide(
      landmarks.filter((l) => l.kind === 'thing'),
      heightM,
      pxPerMeter,
      stage,
      minGapPx,
      false,
    ),
    right: placeSide(
      landmarks.filter((l) => l.kind === 'time'),
      heightM,
      pxPerMeter,
      stage,
      minGapPx,
      true,
    ),
  };
}
