// Canvas drawing for the picture-book scene: paper ground, sun, hills, the
// brick tower, landmarks as cut-paper shapes, and the compaction legend.
// Reads state and draws; never mutates it. Colors, sizes, and the "paper
// drop" technique (a flat offset copy in a warm shadow tint, never a blur)
// come from docs/design/picture-book.dc.html and are pinned as constants
// below, not hard-coded inline, so they can be spotted and reused.

import { courseHeightPx, renderCourses, renderUnit, unitLabel } from '../lib/compaction';
import { fmtYears } from '../lib/format';
import type { IconId } from '../lib/icon-paths';
import { PAPER_COLORS } from '../lib/landmarks';
import type { PlacedLandmark, PlacedLandmarks, StageBox } from '../lib/layout';
import { shade, type LegoColor } from '../lib/lego-colors';
import { bricksFor, type SimState } from '../lib/sim';

export interface StageView {
  widthCss: number;
  heightCss: number;
  dpr: number;
  narrow: boolean;
}

// Design tokens (docs/autopilot/2026-09-05-picture-book.md's "Design
// tokens" section, matched against docs/design/picture-book.dc.html).
const PAPER = '#f6ecd9';
const NAVY = '#24395c';
const MUTED = '#8a7d6a';
const MUTED_ICON = '#c9c3b8';
// The cut-paper drop: every shape that "sits" on the paper draws twice —
// once offset PAPER_DROP_PX down in this warm, flat tint, then again at its
// real position in its real color. Never a blur.
const PAPER_SHADOW = 'rgba(90,61,30,0.2)';
const PAPER_DROP_PX = 3;
const FONT_STACK = `'Patrick Hand', 'Comic Sans MS', 'Chalkboard SE', cursive`;

// Below the ground line, where the stack sits. The ground is the crest of
// the upper paper hill (see drawPaperHill) — 90px leaves room for both
// hills to read as hills rather than a sliver.
const GROUND_MARGIN_PX = 90;
const TOP_MIN_PX = 150;
const TOP_FRACTION = 0.2;

// Sun, top-right: a flat mustard circle with the paper drop. Position is
// expressed the way the artboard's CSS box is (right/top margins to the
// box, not the center), so SUN_RIGHT_PX/SUN_TOP_PX describe the box, and
// the circle's center is derived from that plus the radius.
const SUN_RADIUS_PX = 38;
const SUN_RIGHT_PX = 90;
const SUN_TOP_PX = 60;
const SUN_COLOR = '#f0c85a';

// Ground: two overlapping paper hills, drawn as half-ellipses (a flat
// bottom edge below the visible canvas, an elliptical crest on top). The
// upper hill's crest sits exactly at the ground line so the stack reads as
// standing on it; the lower, wider hill sits behind and below, drawn on
// top so only the upper hill's crest band shows above it — the two-tone
// "layered hills" look the artboard uses.
const HILL_UPPER_COLOR = '#3f9e92';
const HILL_LOWER_COLOR = '#25756b';
const HILL_UPPER_RY_PX = 120;
const HILL_LOWER_RY_PX = 100;
const HILL_UPPER_RX_RATIO = 0.58;
const HILL_LOWER_RX_RATIO = 0.64;
const HILL_LOWER_OFFSET_PX = 40;

// The tower: BRICK_PX-tall courses (squished per compaction's visualUnit),
// shaded with lego-colors.ts's `shade` rather than a translucent overlay —
// amounts below mirror the artboard's inset box-shadow opacities.
const BRICK_WIDTH_PX = 84;
const BRICK_WIDTH_NARROW_PX = 60;
const BRICK_BOTTOM_INSET_PX = 4;
const BRICK_TOP_INSET_PX = 3;
const BRICK_BOTTOM_DARKEN = -0.18;
const BRICK_TOP_LIGHTEN = 0.25;
const STUD_WIDTH_PX = 12;
const STUD_HEIGHT_PX = 9;
const STUD_BOTTOM_INSET_PX = 2;
const STUD_LIGHTEN = 0.3;
const STUD_BOTTOM_DARKEN = -0.15;

// Landmark cut-paper icons and labels. Each label unit (icon + text)
// anchors at the outer viewport margin instead of a fixed gap from the
// stack (see drawLandmarkLabels), matching the layout kept from before this
// slice.
const ICON_PX = 36;
const ICON_PX_NARROW = 28;
const LABEL_FONT_PX = 20;
const LABEL_FONT_NARROW_PX = 16;
const LABEL_MARGIN_PX = 24;
const ICON_LABEL_GAP_PX = 8;
const CONNECTOR_THRESHOLD_PX = 8;
const SECOND_LINE_HEIGHT_PX = 16;
const LEADER_WIDTH_PX = 2;
const PASSED_LABEL_COLOR = NAVY;
const UPCOMING_LABEL_COLOR = MUTED;
const UPCOMING_ICON_ALPHA = 0.6;

// Legend beside the tower's base: what one drawn brick is worth right now.
// On narrow canvases there's no room beside the tower, so it moves under
// the HUD's big number instead (src/hud.ts's .hud-big, left: 44px) —
// centered within a box roughly as wide as that number reads at its
// narrow font size.
const LEGEND_FONT_PX = 16;
const LEGEND_COLOR = MUTED;
const LEGEND_GAP_PX = 12;
const LEGEND_BASELINE_OFFSET_PX = 8;
const LEGEND_NARROW_LEFT_PX = 44;
const LEGEND_NARROW_WIDTH_PX = 200;
const LEGEND_NARROW_TOP_PX = 150;

// Fiber texture: a cached offscreen canvas of low-alpha speckle noise,
// regenerated only when the CSS viewport size changes (never per frame).
const NOISE_MIN_ALPHA = 0.03;
const NOISE_MAX_ALPHA = 0.05;

let noiseCanvas: HTMLCanvasElement | null = null;
let noiseW = 0;
let noiseH = 0;

function ensureNoiseCanvas(widthCss: number, heightCss: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round(widthCss));
  const h = Math.max(1, Math.round(heightCss));
  if (noiseCanvas && noiseW === w && noiseH === h) return noiseCanvas;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const nctx = canvas.getContext('2d');
  if (nctx) {
    const image = nctx.createImageData(w, h);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      const alpha = NOISE_MIN_ALPHA + Math.random() * (NOISE_MAX_ALPHA - NOISE_MIN_ALPHA);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = Math.round(alpha * 255);
    }
    nctx.putImageData(image, 0, 0);
  }

  noiseCanvas = canvas;
  noiseW = w;
  noiseH = h;
  return canvas;
}

export function stageBox(view: StageView): StageBox {
  return {
    top: Math.max(TOP_MIN_PX, view.heightCss * TOP_FRACTION),
    ground: view.heightCss - GROUND_MARGIN_PX,
  };
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawPaperCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = PAPER_SHADOW;
  ctx.beginPath();
  ctx.arc(cx, cy + PAPER_DROP_PX, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// A hill is the top half of an ellipse (a dome) with a flat bottom edge
// below the visible canvas — traced by walking the ellipse boundary from
// its leftmost point, through the top (the crest), to its rightmost point,
// then closing straight back across the bottom.
function tracePaperHill(ctx: CanvasRenderingContext2D, cx: number, crestY: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, crestY + ry, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
}

function drawPaperHill(ctx: CanvasRenderingContext2D, cx: number, crestY: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = PAPER_SHADOW;
  tracePaperHill(ctx, cx, crestY + PAPER_DROP_PX, rx, ry);
  ctx.fill();

  ctx.fillStyle = color;
  tracePaperHill(ctx, cx, crestY, rx, ry);
  ctx.fill();
}

// A landmark icon (or anything else authored in icon-paths.ts's 24×24 box)
// drawn as a flat, filled cut-paper silhouette with the paper drop.
function drawPaperIcon(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  x: number,
  y: number,
  size: number,
  fillStyle: string,
  alpha: number,
): void {
  const scale = size / 24;

  ctx.save();
  ctx.fillStyle = PAPER_SHADOW;
  ctx.translate(x, y + PAPER_DROP_PX);
  ctx.scale(scale, scale);
  ctx.fill(path, 'evenodd');
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fillStyle;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fill(path, 'evenodd');
  ctx.restore();
}

// Shortens text with a trailing ellipsis until it fits maxWidth, measured
// with the canvas's current font. Assumes text alone doesn't already fit
// (callers check that first).
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const ELLIPSIS = '…';
  let end = text.length;
  while (end > 0 && ctx.measureText(text.slice(0, end).trimEnd() + ELLIPSIS).width > maxWidth) {
    end--;
  }
  return end > 0 ? text.slice(0, end).trimEnd() + ELLIPSIS : ELLIPSIS;
}

// One side's landmark lines, icons, and labels. Each side gets a fixed,
// explicit text width — from the outer viewport margin to where the icon
// column sits (iconSize plus a gap short of the stack edge) — so the
// longest label can never run off a narrow viewport's edge or crowd the
// stack: left labels are left-aligned at LABEL_MARGIN_PX, right labels
// right-aligned at width - LABEL_MARGIN_PX, and the icon column (and the
// dashed leader reaching it from the stack) sits at the same x for every
// landmark on that side. A label that fits `${label} · ${years}` within
// that width draws on one line; otherwise the years drop to their own
// second line, and if the label alone still doesn't fit, it's ellipsized
// (years never are). A vertical connector bridges the gap when stacking has
// pushed the label away from its true (lineY) height.
function drawLandmarkLabels(
  ctx: CanvasRenderingContext2D,
  placed: PlacedLandmark[],
  side: 'left' | 'right',
  stackLeft: number,
  stackRight: number,
  width: number,
  iconSize: number,
  icons: Record<IconId, Path2D>,
): void {
  const isLeft = side === 'left';
  const stackEdgeX = isLeft ? stackLeft : stackRight;
  const textAnchorX = isLeft ? LABEL_MARGIN_PX : width - LABEL_MARGIN_PX;
  const sideRoomPx = isLeft ? stackLeft - LABEL_MARGIN_PX : width - LABEL_MARGIN_PX - stackRight;
  const availableWidth = Math.max(0, sideRoomPx - ICON_LABEL_GAP_PX - iconSize);
  const iconLeftX = isLeft
    ? textAnchorX + availableWidth + ICON_LABEL_GAP_PX
    : textAnchorX - availableWidth - ICON_LABEL_GAP_PX - iconSize;
  const nearEdgeX = isLeft ? iconLeftX + iconSize : iconLeftX;
  ctx.textAlign = isLeft ? 'left' : 'right';

  for (const p of placed) {
    const labelText = p.landmark.label;
    const yearsText = fmtYears(p.landmark.years);
    const oneLineText = `${labelText} · ${yearsText}`;
    const twoLine = ctx.measureText(oneLineText).width > availableWidth;
    const line1 = twoLine
      ? ctx.measureText(labelText).width <= availableWidth
        ? labelText
        : ellipsize(ctx, labelText, availableWidth)
      : oneLineText;
    const iconCenterY = twoLine ? p.labelY + SECOND_LINE_HEIGHT_PX / 2 : p.labelY;

    const labelColor = p.passed ? PASSED_LABEL_COLOR : UPCOMING_LABEL_COLOR;
    const iconColor = p.passed ? PAPER_COLORS[p.landmark.paper] : MUTED_ICON;
    const iconAlpha = p.passed ? 1 : UPCOMING_ICON_ALPHA;

    const icon = icons[p.landmark.icon];
    drawPaperIcon(ctx, icon, iconLeftX, iconCenterY - iconSize / 2, iconSize, iconColor, iconAlpha);

    ctx.strokeStyle = labelColor;
    ctx.lineWidth = LEADER_WIDTH_PX;
    ctx.setLineDash([5, 4]);
    line(ctx, stackEdgeX, Math.round(p.lineY) + 0.5, nearEdgeX, Math.round(p.lineY) + 0.5);
    if (Math.abs(p.lineY - p.labelY) > CONNECTOR_THRESHOLD_PX) {
      line(ctx, nearEdgeX, Math.round(p.lineY) + 0.5, nearEdgeX, Math.round(p.labelY) + 0.5);
    }
    ctx.setLineDash([]);

    ctx.fillStyle = labelColor;
    ctx.fillText(line1, textAnchorX, p.labelY);
    if (twoLine) {
      ctx.fillText(yearsText, textAnchorX, p.labelY + SECOND_LINE_HEIGHT_PX);
    }
  }
}

// The tower: always a whole number of drawn bricks (src/lib/compaction.ts's
// drawnBricks), each pxPerBrick tall at rest (BRICK_PX) or squished
// mid-transition. Every course gets a lighter top inset and a darker bottom
// inset (clamped so they never overlap on a heavily squished course); the
// top course alone gets four studs, and the whole stack gets one paper drop
// rather than per-course shadows.
function drawBrickTower(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sw: number,
  ground: number,
  drawn: number,
  pxPerBrick: number,
  color: LegoColor,
): void {
  if (drawn <= 0) return;

  const sh = drawn * pxPerBrick;
  const y0 = ground - sh;

  ctx.fillStyle = PAPER_SHADOW;
  ctx.fillRect(sx, y0 + PAPER_DROP_PX, sw, sh);

  ctx.fillStyle = color.hex;
  ctx.fillRect(sx, y0, sw, sh);

  const topEdge = shade(color.hex, BRICK_TOP_LIGHTEN);
  const bottomEdge = shade(color.hex, BRICK_BOTTOM_DARKEN);

  for (let i = 0; i < drawn; i++) {
    const rowBottom = ground - i * pxPerBrick;
    const rowTop = rowBottom - pxPerBrick;

    const bottomInsetH = Math.min(BRICK_BOTTOM_INSET_PX, pxPerBrick);
    ctx.fillStyle = bottomEdge;
    ctx.fillRect(sx, rowBottom - bottomInsetH, sw, bottomInsetH);

    const topInsetH = Math.max(0, Math.min(BRICK_TOP_INSET_PX, pxPerBrick - bottomInsetH));
    if (topInsetH > 0) {
      ctx.fillStyle = topEdge;
      ctx.fillRect(sx, rowTop, sw, topInsetH);
    }
  }

  const studColor = shade(color.hex, STUD_LIGHTEN);
  const studBottomEdge = shade(color.hex, STUD_BOTTOM_DARKEN);
  const cellW = sw / 4;
  const studTop = y0 - STUD_HEIGHT_PX;
  for (let s = 0; s < 4; s++) {
    const studX = sx + s * cellW + (cellW - STUD_WIDTH_PX) / 2;
    ctx.fillStyle = studColor;
    ctx.fillRect(studX, studTop, STUD_WIDTH_PX, STUD_HEIGHT_PX);
    ctx.fillStyle = studBottomEdge;
    ctx.fillRect(studX, studTop + STUD_HEIGHT_PX - STUD_BOTTOM_INSET_PX, STUD_WIDTH_PX, STUD_BOTTOM_INSET_PX);
  }
}

export function drawStage(
  ctx: CanvasRenderingContext2D,
  view: StageView,
  sim: SimState,
  placed: PlacedLandmarks,
  icons: Record<IconId, Path2D>,
  color: LegoColor,
): void {
  const { widthCss: W, heightCss: H, dpr, narrow } = view;
  const { ground } = stageBox(view);
  const sw = narrow ? BRICK_WIDTH_NARROW_PX : BRICK_WIDTH_PX;
  const sx = Math.round(W / 2 - sw / 2);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Paper ground fill and its fiber texture.
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(ensureNoiseCanvas(W, H), 0, 0, W, H);

  // Sun, top-right.
  drawPaperCircle(ctx, W - SUN_RIGHT_PX - SUN_RADIUS_PX, SUN_TOP_PX + SUN_RADIUS_PX, SUN_RADIUS_PX, SUN_COLOR);

  // Ground: the upper hill's crest is the ground line the stack stands on;
  // the lower, wider hill sits behind and below it, painted on top so most
  // of the canvas reads as its darker fill with the upper hill showing only
  // as a crest band.
  drawPaperHill(ctx, W / 2, ground, W * HILL_UPPER_RX_RATIO, HILL_UPPER_RY_PX, HILL_UPPER_COLOR);
  drawPaperHill(ctx, W / 2, ground + HILL_LOWER_OFFSET_PX, W * HILL_LOWER_RX_RATIO, HILL_LOWER_RY_PX, HILL_LOWER_COLOR);

  // Landmark lines, icons, and labels: things (physical comparisons) on the
  // left, time events (history milestones) on the right, mirrored around
  // the centered stack.
  ctx.font = `${narrow ? LABEL_FONT_NARROW_PX : LABEL_FONT_PX}px ${FONT_STACK}`;
  ctx.textBaseline = 'alphabetic';
  const iconSize = narrow ? ICON_PX_NARROW : ICON_PX;
  drawLandmarkLabels(ctx, placed.left, 'left', sx, sx + sw, W, iconSize, icons);
  drawLandmarkLabels(ctx, placed.right, 'right', sx, sx + sw, W, iconSize, icons);

  // The stack: always the whole, visible courses renderCourses says to draw
  // (never zero while bricks > 0, never a single course growing to fill the
  // whole stage), each courseHeightPx tall — see src/lib/compaction.ts.
  const bricks = bricksFor(sim.years);
  const drawn = renderCourses(bricks, sim.compaction);
  const pxPerBrick = courseHeightPx(sim.compaction);
  drawBrickTower(ctx, sx, sw, ground, drawn, pxPerBrick, color);

  // Legend: what one drawn brick is worth right now — describes the bricks
  // renderUnit says are actually on screen, so it disappears the instant an
  // expansion to unit 1 starts and appears only once a compaction to 10 has
  // finished (unlike sim.compaction.unit, renderUnit already reflects a
  // transition in flight).
  const legendUnit = renderUnit(sim.compaction);
  if (legendUnit > 1) {
    ctx.font = `${LEGEND_FONT_PX}px ${FONT_STACK}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = LEGEND_COLOR;
    if (narrow) {
      ctx.textAlign = 'center';
      ctx.fillText(unitLabel(legendUnit), LEGEND_NARROW_LEFT_PX + LEGEND_NARROW_WIDTH_PX / 2, LEGEND_NARROW_TOP_PX);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(unitLabel(legendUnit), sx + sw + LEGEND_GAP_PX, ground - LEGEND_BASELINE_OFFSET_PX);
    }
  }
}
