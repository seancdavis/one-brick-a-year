// Which landmarks are in view, where their dashed leaders land, and where
// their icons stack when neighbors crowd together. Two-sided: things stack
// on the left, time events on the right, each side independently, so a
// thing and a time event at the same height never push each other.

import type { Landmark } from './landmarks';

export interface StageBox {
  top: number;
  ground: number;
}

// The gap kept between the bottom of the HUD's corner block(s) and the stage's
// usable top, so nothing the canvas draws is placed under the HUD.
export const STAGE_TOP_GAP_PX = 16;

// StageBox.top, measured from the real HUD rather than guessed as a fraction
// of the viewport: src/main.ts hands over the bottom
// (getBoundingClientRect) of every HUD block that could crowd the stage —
// today just the top-left number block, since the top-right corner holds only
// the menu tab, which sits well above the stage's own top — and this returns
// the top clear of the deepest one. `minTop` is a floor (src/render/stage.ts's
// TOP_MIN_PX) so a stray zero-height measurement never collapses the stage.
export function stageTopFor(hudBottoms: readonly number[], minTop: number): number {
  const deepest = hudBottoms.reduce((max, bottom) => Math.max(max, bottom), 0);
  return Math.max(minTop, deepest + STAGE_TOP_GAP_PX);
}

// A rectangle in stage coordinates (CSS px, the same space the canvas draws
// in and the popup layer is positioned in) that something already occupies:
// src/popups.ts reports one per open popup, and src/render/stage.ts draws
// nothing of an upcoming landmark that would land inside one.
export interface OccupiedBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Whether two stage-coordinate rectangles share any area. Touching edges
// don't count as an overlap, so a label placed exactly against a popup's edge
// still draws.
export function boxesIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
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

// A label unit is never closer to the unit below it than that unit's own
// height plus this much clear air, so two never overlap however close their
// landmarks are.
export const LABEL_STACK_GAP_PX = 4;

// The two sizes an upcoming landmark's icon is ever drawn at — wide
// (desktop) and narrow (src/main.ts's NARROW_BREAKPOINT_PX) — defined once
// here and imported by src/render/stage.ts, which draws at exactly these
// sizes, so the two can never drift apart.
export const ICON_PX = 36;
export const ICON_PX_NARROW = 20;

// One label unit is a landmark's icon alone — src/render/stage.ts draws an
// upcoming landmark as a muted icon on a dashed leader, with no text beside
// it — so a unit is as tall as the icon and, being centered on its own
// baseline, reaches half that above it.
export const LABEL_RISE_PX = ICON_PX / 2;
export const LABEL_RISE_NARROW_PX = ICON_PX_NARROW / 2;
const LABEL_HEIGHT_PX = ICON_PX;
const LABEL_HEIGHT_NARROW_PX = ICON_PX_NARROW;

// What one side's label units cost vertically: how tall each is, and how far
// each reaches above its own baseline. The rise is what StageBox.top is
// enforced against, so a unit is never placed with any part of itself under
// the HUD's corner block.
export interface LabelMetrics {
  heightPx: number;
  risePx: number;
}

export const LABEL_METRICS: LabelMetrics = {
  heightPx: LABEL_HEIGHT_PX,
  risePx: LABEL_RISE_PX,
};
export const LABEL_METRICS_NARROW: LabelMetrics = {
  heightPx: LABEL_HEIGHT_NARROW_PX,
  risePx: LABEL_RISE_NARROW_PX,
};

// A landmark whose line sits within this many px of the ground line reads as
// indistinguishable from the ground itself, so it's dropped instead of drawn
// crowded against it.
export const GROUND_HIDE_PX = 24;

// On both sides the icon sits this close to the stack edge — the dashed
// leader src/render/stage.ts draws spans exactly this gap, so it never reads
// as zero-length with the icon touching the tower.
export const LEADER_MIN_PX = 24;

// The left edge of one side's landmark icon: a fixed LEADER_MIN_PX out from
// the stack edge, mirrored so the leader always runs away from the tower.
// Nothing here changes with viewport width; only iconSize does.
export function iconXFor(side: 'left' | 'right', stackEdgeX: number, iconSize: number): number {
  return side === 'left' ? stackEdgeX - LEADER_MIN_PX - iconSize : stackEdgeX + LEADER_MIN_PX;
}

// Places one side's landmarks independently: ascending meters is descending
// y, so the nearest landmarks sit low, near the ground, and the farthest sit
// high, near the top. Walking this order lets each unit push up against the
// one just placed below it, so the stack builds bottom-to-top with no
// overlap — but only against units on the *same* side, so a thing and a
// time event at the same height never push each other. `excludePassed` drops
// a passed landmark from the stack entirely, rather than merely not drawing
// it, so it can't take up stacking room an upcoming unit further along
// would otherwise get: a right-side time event that has already become a
// popup (src/popups.ts) would otherwise still crowd the units above it even
// though nothing of it is ever drawn.
function placeSide(
  landmarks: Landmark[],
  heightM: number,
  pxPerM: number,
  stage: StageBox,
  metrics: LabelMetrics,
  excludePassed: boolean,
): PlacedLandmark[] {
  const placed: PlacedLandmark[] = [];
  const ordered = [...landmarks].sort((a, b) => a.meters - b.meters);
  // Each unit is pushed up clear of the one below by its own full height, not
  // by a fixed baseline distance: the unit being placed is the one that hangs
  // down toward its neighbor, so its height is what has to fit in the gap.
  const stackStep = metrics.heightPx + LABEL_STACK_GAP_PX;

  let previousLabelY = Infinity;

  for (const landmark of ordered) {
    const passed = heightM >= landmark.meters;
    if (excludePassed && passed) continue;

    const lineY = stage.ground - landmark.meters * pxPerM;
    if (lineY > stage.ground - GROUND_HIDE_PX) continue;

    // An icon sits centered on its own line unless a neighbor below has
    // pushed it up, so the leader runs straight into its middle.
    const labelY = Math.min(lineY, previousLabelY - stackStep);
    // The whole label unit — the icon, not just the dashed leader — has to
    // clear the stage's usable top, which is the bottom of the HUD's corner
    // block. A unit that would reach above it is dropped rather than drawn
    // under the HUD, whether it got there from its own height or from being
    // pushed up by the units stacked below it. Dropping leaves previousLabelY
    // where it was, so the chain closes over the gap.
    if (labelY - metrics.risePx < stage.top) continue;

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

// Per side, at most this many unpassed landmarks are ever placed as upcoming
// icons (docs/autopilot/2026-09-08-quiet-corner.md's "Upcoming"): a busy
// right side (lots of time events close together) should never look denser
// than the left, and nothing should jumble after a compaction regroups what
// counts as "nearest".
export const UPCOMING_PER_SIDE = 3;

// The next `count` unpassed landmarks on a side, nearest first: passed
// landmarks are never returned (a pin marks those instead — src/popups.ts),
// and among the unpassed the ones with the smallest meters — the soonest to
// be reached — survive, however many there were.
export function visibleUpcoming(placed: PlacedLandmark[], count: number): PlacedLandmark[] {
  return placed
    .filter((p) => !p.passed)
    .sort((a, b) => a.landmark.meters - b.landmark.meters)
    .slice(0, count);
}

export function placeLandmarks(
  landmarks: Landmark[],
  heightM: number,
  pxPerMeter: number,
  stage: StageBox,
  metrics: LabelMetrics = LABEL_METRICS,
): PlacedLandmarks {
  return {
    // Things (left) stay in the stacking chain after the stack passes them,
    // unlike time events: `excludePassed: false` means a passed thing is
    // still placed here (though visibleUpcoming below never draws it),
    // continuing to occupy its slot so units above it are positioned exactly
    // as if it were still there.
    left: placeSide(
      landmarks.filter((l) => l.kind === 'thing'),
      heightM,
      pxPerMeter,
      stage,
      metrics,
      false,
    ),
    right: placeSide(
      landmarks.filter((l) => l.kind === 'time'),
      heightM,
      pxPerMeter,
      stage,
      metrics,
      true,
    ),
  };
}
