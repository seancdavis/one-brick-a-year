// Which landmarks are in view, where their dashed lines land, and where
// their labels stack when neighbors crowd together. Two-sided: things stack
// on the left, time events on the right, each side independently, so a
// thing and a time event at the same height never push each other.

import type { Landmark } from './landmarks';

export interface StageBox {
  top: number;
  ground: number;
}

// The gap kept between the bottom of the HUD's corner block(s) and the stage's
// usable top (docs/autopilot/2026-09-06-popups-and-menu.md's "Labels next to
// their icons": "no canvas label is placed under the HUD").
export const STAGE_TOP_GAP_PX = 16;

// StageBox.top, measured from the real HUD rather than guessed as a fraction
// of the viewport: src/main.ts hands over the bottom (getBoundingClientRect)
// of every HUD corner block that could crowd the stage — the top-left number
// block, the top-right teaser-plus-menu group — and this returns the top
// clear of the deepest one, so on a narrow screen (where either block can end
// up the taller one) the larger of the two always wins without the caller
// having to special-case it. `minTop` is a floor (src/render/stage.ts's
// TOP_MIN_PX) so a stray zero-height measurement never collapses the stage.
export function stageTopFor(hudBottoms: readonly number[], minTop: number): number {
  const deepest = hudBottoms.reduce((max, bottom) => Math.max(max, bottom), 0);
  return Math.max(minTop, deepest + STAGE_TOP_GAP_PX);
}

// A rectangle in stage coordinates (CSS px, the same space the canvas draws
// in and the popup layer is positioned in) that something already occupies:
// src/popups.ts reports one per open popup, and src/render/stage.ts skips any
// upcoming landmark label that would land inside one. `side` says which side
// of the tower the popup hangs on, so a caller can find the popup's near edge
// (its left edge on the right side, its right edge on the left) without
// re-deriving it.
export interface OccupiedBox {
  side: 'left' | 'right';
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

// A label always starts this far above its own line...
const LABEL_LINE_OFFSET_PX = 6;

// ...but never closer to the label below it than that label unit's own height
// plus this much clear air, so two units never overlap however close their
// landmarks are.
export const LABEL_STACK_GAP_PX = 4;

// How far a label unit's box reaches above its baseline: the taller of the
// text's own ascent and half the icon (the icon is centered on the first
// line, so it never reaches higher than the text does at these sizes).
export const LABEL_RISE_PX = 20;
export const LABEL_RISE_NARROW_PX = 16;

// The whole height of one label unit — the icon and the one or two lines of
// text beside it, whichever is taller, plus a little pad — so stacking can
// reserve the room a unit will actually take rather than a guessed baseline
// distance. Both heights mirror src/render/stage.ts's ICON_PX / LABEL_FONT_PX
// / SECOND_LINE_HEIGHT_PX and their narrow counterparts, which is what a unit
// is really drawn at: the two must move together.
const LABEL_ONE_LINE_HEIGHT_PX = 44;
const LABEL_TWO_LINE_HEIGHT_PX = 52;
const LABEL_ONE_LINE_HEIGHT_NARROW_PX = 32;
const LABEL_TWO_LINE_HEIGHT_NARROW_PX = 42;

// What one side's label units cost vertically: how tall each is with its
// years on the first line and with them wrapped to a second, and how far each
// reaches above its own baseline. The rise is what StageBox.top is enforced
// against, so a label unit is never placed with any part of itself under the
// HUD's corner block.
export interface LabelMetrics {
  oneLineHeightPx: number;
  twoLineHeightPx: number;
  risePx: number;
}

export const LABEL_METRICS: LabelMetrics = {
  oneLineHeightPx: LABEL_ONE_LINE_HEIGHT_PX,
  twoLineHeightPx: LABEL_TWO_LINE_HEIGHT_PX,
  risePx: LABEL_RISE_PX,
};
export const LABEL_METRICS_NARROW: LabelMetrics = {
  oneLineHeightPx: LABEL_ONE_LINE_HEIGHT_NARROW_PX,
  twoLineHeightPx: LABEL_TWO_LINE_HEIGHT_NARROW_PX,
  risePx: LABEL_RISE_NARROW_PX,
};

// The room a unit has to be given. This module has no canvas to measure text
// with, so it can't tell ahead of render time which labels src/render/stage.ts
// will wrap; it reserves the taller of the two heights for every unit, and a
// label that turns out to fit on one line simply gets the spare air.
function unitHeight(metrics: LabelMetrics): number {
  return Math.max(metrics.oneLineHeightPx, metrics.twoLineHeightPx);
}

// A landmark whose line sits within this many px of the ground line reads as
// indistinguishable from the ground itself, so it's dropped instead of drawn
// crowded against it.
export const GROUND_HIDE_PX = 24;

// "Labels next to their icons" (docs/autopilot/2026-09-06-popups-and-menu.md):
// on both sides the icon sits this close to the stack edge — the dashed
// leader src/render/stage.ts draws spans exactly this gap, so it never reads
// as zero-length with the icon touching the tower.
export const LEADER_MIN_PX = 24;

// The gap between a label's icon and where its text starts.
export const ICON_LABEL_GAP_PX = 8;

// How far a label's text may run before the screen edge — the far boundary
// labelRoom's textMaxWidth is measured against.
export const LABEL_MARGIN_PX = 24;

// The room one side's landmark label has to work with, given where its icon
// sits: the icon is a fixed LEADER_MIN_PX out from the stack edge, the text
// starts ICON_LABEL_GAP_PX beyond the icon, and it has textMaxWidth of room
// from there out to the screen margin (LABEL_MARGIN_PX) to wrap into, which
// src/render/stage.ts wraps to at most two lines. Both `iconX` and `textX`
// are the box's near (leading) edge on that side — the edge closest to the
// stack — so a caller drawing left-aligned or right-aligned text can derive
// whichever anchor it needs. Nothing here changes with viewport width; only
// iconSize (and the label's own font size, chosen by the renderer) do.
export function labelRoom(
  side: 'left' | 'right',
  stackEdgeX: number,
  width: number,
  iconSize: number,
): { iconX: number; textX: number; textMaxWidth: number } {
  const isLeft = side === 'left';
  const iconX = isLeft ? stackEdgeX - LEADER_MIN_PX - iconSize : stackEdgeX + LEADER_MIN_PX;
  const textX = isLeft ? iconX - ICON_LABEL_GAP_PX : iconX + iconSize + ICON_LABEL_GAP_PX;
  const textMaxWidth = Math.max(0, isLeft ? textX - LABEL_MARGIN_PX : width - LABEL_MARGIN_PX - textX);

  return { iconX, textX, textMaxWidth };
}

// Places one side's landmarks independently: ascending meters is descending
// y, so the nearest landmarks sit low, near the ground, and the farthest sit
// high, near the top. Walking this order lets each label push up against the
// one just placed below it, so the stack builds bottom-to-top with no
// overlap — but only against labels on the *same* side, so a thing and a
// time event at the same height never push each other. `excludePassed` drops
// a passed landmark from the stack entirely, rather than merely not drawing
// it, so it can't take up stacking room an upcoming label further along
// would otherwise get: a right-side time event whose label has already
// become a popup (src/popups.ts) would otherwise still crowd the labels above
// it even though nothing of it is ever drawn.
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
  const stackStep = unitHeight(metrics) + LABEL_STACK_GAP_PX;

  let previousLabelY = Infinity;

  for (const landmark of ordered) {
    const passed = heightM >= landmark.meters;
    if (excludePassed && passed) continue;

    const lineY = stage.ground - landmark.meters * pxPerM;
    if (lineY > stage.ground - GROUND_HIDE_PX) continue;

    const labelY = Math.min(lineY - LABEL_LINE_OFFSET_PX, previousLabelY - stackStep);
    // The whole label unit — the icon and its text lines, not just the dashed
    // line — has to clear the stage's usable top, which is the bottom of the
    // HUD's corner block. A unit that would reach above it is dropped rather
    // than drawn under the HUD, whether it got there from its own height or
    // from being pushed up by the labels stacked below it. Dropping leaves
    // previousLabelY where it was, so the chain closes over the gap.
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

export function placeLandmarks(
  landmarks: Landmark[],
  heightM: number,
  pxPerMeter: number,
  stage: StageBox,
  metrics: LabelMetrics = LABEL_METRICS,
): PlacedLandmarks {
  return {
    // Things (left) stay in the stack after the stack passes them, unlike
    // time events: a passed thing's own label is no longer drawn (its popup
    // or pin has taken its place — src/render/stage.ts), but keeping it here
    // holds its place in the chain, so the upcoming labels above it don't
    // jump down the instant the stack passes it.
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
