// Canvas drawing for the stack, ground, and landmark lines. Reads state and
// draws; never mutates it.

import { BRICK_M } from '../lib/constants';
import { fmtYears } from '../lib/format';
import type { IconId } from '../lib/icon-paths';
import type { PlacedLandmark, PlacedLandmarks, StageBox } from '../lib/layout';
import { shade, type LegoColor } from '../lib/lego-colors';
import { bricksFor, type SimState } from '../lib/sim';
import { ICON_SIZE_PX } from './icons';

export interface StageView {
  widthCss: number;
  heightCss: number;
  dpr: number;
  narrow: boolean;
}

const SKY = '#f3efe6';
const INK = '#2a2420';
const CAPTION = '#7b736a';

// Below the ground line, where the stack sits.
const GROUND_MARGIN_PX = 56;
const TOP_MIN_PX = 150;
const TOP_FRACTION = 0.2;

// The stack is always centered (x = 50% of width); its width scales with
// the viewport between these bounds, and drops to a single fixed width on
// narrow screens.
const STACK_WIDTH_MIN_PX = 56;
const STACK_WIDTH_MAX_PX = 88;
const STACK_WIDTH_NARROW_PX = 40;

// Each side's label unit (icon + text) anchors at this fixed margin from
// the viewport edge, not at a fixed gap from the stack — see
// drawLandmarkLabels. Gap between the icon and its label text, in px.
const LABEL_MARGIN_PX = 24;
const ICON_LABEL_GAP_PX = 6;
// Icons draw smaller on narrow screens so the icon and the label both still
// fit beside the dashed line.
const ICON_SIZE_NARROW_PX = 20;
const FONT_PX = 12;
const FONT_NARROW_PX = 11;

// A label pushed less than this far from its own line reads as still
// pointing straight at it — no connector needed. Past this, draw a short
// vertical stroke from the line to the label so the eye can follow it.
const CONNECTOR_THRESHOLD_PX = 8;

// If a label unit's near edge (the icon's edge closest to the stack) would
// still land within this many px of the stack on one line, there isn't room
// for the dashed leader — drop the years onto a second line instead so the
// unit narrows and clears the stack edge.
const NEAR_STACK_MIN_GAP_PX = 8;

// Line height between a label's text and its second (years-only) line, when
// the unit doesn't fit on one line.
const SECOND_LINE_HEIGHT_PX = 12;

// Below this height per brick, individual courses stop reading as bricks —
// draw a solid textured column instead (see drawBrickTower).
const BRICK_COURSE_MIN_PX = 3;

// Shading amounts (see src/lib/lego-colors.ts's shade) for the brick look:
// a lighter top edge and studs, a darker bottom edge, seam, and column edge.
const EDGE_LIGHTEN = 0.35;
const EDGE_DARKEN = -0.35;
const SEAM_DARKEN = -0.22;
const STUD_LIGHTEN = 0.4;
const COLUMN_EDGE_DARKEN = -0.18;
const COLUMN_SEAM_DARKEN = -0.1;
const COLUMN_SEAM_SPACING_PX = 8;

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

// One side's landmark lines, icons, and labels. Each label unit (icon +
// text) anchors at the outer viewport margin instead of a fixed gap from
// the stack, so the longest label never runs off a narrow viewport's edge:
// left labels are left-aligned at LABEL_MARGIN_PX with their icon
// immediately to the right; right labels are right-aligned at
// width - LABEL_MARGIN_PX with their icon immediately to the left. Either
// way the icon ends up nearest the stack, and the dashed leader spans from
// the stack's edge on this side out to that icon. A vertical connector
// bridges the gap when stacking has pushed the label away from its true
// (lineY) height. If the unit would still land within NEAR_STACK_MIN_GAP_PX
// of the stack on one line, the years drop to a second line instead so the
// unit narrows.
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
  ctx.textAlign = isLeft ? 'left' : 'right';

  for (const p of placed) {
    const labelText = p.landmark.label;
    const yearsText = fmtYears(p.landmark.years);
    const oneLineText = `${labelText} · ${yearsText}`;

    const oneLineWidth = ctx.measureText(oneLineText).width;
    const oneLineNearEdgeX = isLeft
      ? textAnchorX + oneLineWidth + ICON_LABEL_GAP_PX + iconSize
      : textAnchorX - oneLineWidth - ICON_LABEL_GAP_PX - iconSize;
    const oneLineGap = isLeft ? stackEdgeX - oneLineNearEdgeX : oneLineNearEdgeX - stackEdgeX;
    const twoLine = oneLineGap < NEAR_STACK_MIN_GAP_PX;

    const textWidth = twoLine
      ? Math.max(ctx.measureText(labelText).width, ctx.measureText(yearsText).width)
      : oneLineWidth;

    const iconLeftX = isLeft
      ? textAnchorX + textWidth + ICON_LABEL_GAP_PX
      : textAnchorX - textWidth - ICON_LABEL_GAP_PX - iconSize;
    const nearEdgeX = isLeft ? iconLeftX + iconSize : iconLeftX;
    const iconCenterY = twoLine ? p.labelY + SECOND_LINE_HEIGHT_PX / 2 : p.labelY;

    const icon = icons[p.landmark.icon];
    ctx.save();
    ctx.globalAlpha = p.passed ? 1 : 0.45;
    ctx.fillStyle = INK;
    ctx.translate(iconLeftX, iconCenterY - iconSize / 2);
    ctx.scale(iconSize / 24, iconSize / 24);
    ctx.fill(icon, 'evenodd');
    ctx.restore();

    ctx.strokeStyle = p.passed ? 'rgba(42,36,32,.6)' : 'rgba(42,36,32,.22)';
    ctx.setLineDash([3, 4]);
    line(ctx, stackEdgeX, Math.round(p.lineY) + 0.5, nearEdgeX, Math.round(p.lineY) + 0.5);
    if (Math.abs(p.lineY - p.labelY) > CONNECTOR_THRESHOLD_PX) {
      line(ctx, nearEdgeX, Math.round(p.lineY) + 0.5, nearEdgeX, Math.round(p.labelY) + 0.5);
    }
    ctx.setLineDash([]);

    ctx.fillStyle = p.passed ? INK : CAPTION;
    if (twoLine) {
      ctx.fillText(labelText, textAnchorX, p.labelY);
      ctx.fillText(yearsText, textAnchorX, p.labelY + SECOND_LINE_HEIGHT_PX);
    } else {
      ctx.fillText(oneLineText, textAnchorX, p.labelY);
    }
  }
}

// A soft, wide shadow under the stack so it reads as sitting on the ground
// rather than floating on top of it.
function drawGroundShadow(ctx: CanvasRenderingContext2D, sx: number, sw: number, ground: number): void {
  const cx = sx + sw / 2;
  const rx = sw * 1.3;
  const ry = Math.max(5, sw * 0.16);
  const gradient = ctx.createRadialGradient(cx, ground, 0, cx, ground, rx);
  gradient.addColorStop(0, 'rgba(20,16,12,0.22)');
  gradient.addColorStop(0.7, 'rgba(20,16,12,0.08)');
  gradient.addColorStop(1, 'rgba(20,16,12,0)');
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, ground, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// The tower itself, in the chosen LEGO color. Each course draws as a 2×4
// side view — a lighter top edge, a darker bottom edge, and a seam at the
// midpoint to suggest two studs' width — with four studs on the topmost
// course only. Once a course is too short to read individually
// (< BRICK_COURSE_MIN_PX), it collapses to a solid textured column instead.
function drawBrickTower(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sw: number,
  y0: number,
  sh: number,
  ground: number,
  pxPerBrick: number,
  color: LegoColor,
): void {
  if (sh <= 0) return;

  ctx.fillStyle = color.hex;
  ctx.fillRect(sx, y0, sw, sh);

  if (pxPerBrick >= BRICK_COURSE_MIN_PX) {
    const topEdge = shade(color.hex, EDGE_LIGHTEN);
    const bottomEdge = shade(color.hex, EDGE_DARKEN);
    const seam = shade(color.hex, SEAM_DARKEN);
    const studColor = shade(color.hex, STUD_LIGHTEN);
    const midX = Math.round(sx + sw / 2) + 0.5;
    const rowCount = Math.max(1, Math.ceil(sh / pxPerBrick));

    for (let i = 0; i < rowCount; i++) {
      const rowBottom = ground - i * pxPerBrick;
      const rowTop = Math.max(y0, rowBottom - pxPerBrick);

      ctx.strokeStyle = bottomEdge;
      line(ctx, sx, Math.round(rowBottom) - 0.5, sx + sw, Math.round(rowBottom) - 0.5);

      ctx.strokeStyle = topEdge;
      line(ctx, sx, Math.round(rowTop) + 0.5, sx + sw, Math.round(rowTop) + 0.5);

      ctx.strokeStyle = seam;
      line(ctx, midX, rowTop, midX, rowBottom);

      if (i === rowCount - 1) {
        const studH = Math.min(pxPerBrick * 0.25, 6);
        const cellW = sw / 4;
        ctx.fillStyle = studColor;
        for (let s = 0; s < 4; s++) {
          const studW = cellW * 0.5;
          const studX = sx + s * cellW + (cellW - studW) / 2;
          ctx.beginPath();
          ctx.roundRect(studX, rowTop - studH, studW, studH, Math.min(2, studW / 2));
          ctx.fill();
        }
      }
    }
  } else {
    const edgeColor = shade(color.hex, COLUMN_EDGE_DARKEN);
    const edgeW = Math.max(3, sw * 0.12);
    ctx.fillStyle = edgeColor;
    ctx.fillRect(sx + sw - edgeW, y0, edgeW, sh);

    ctx.strokeStyle = shade(color.hex, COLUMN_SEAM_DARKEN);
    ctx.globalAlpha = 0.4;
    for (let yy = ground - COLUMN_SEAM_SPACING_PX; yy > y0; yy -= COLUMN_SEAM_SPACING_PX) {
      line(ctx, sx, Math.round(yy) + 0.5, sx + sw, Math.round(yy) + 0.5);
    }
    ctx.globalAlpha = 1;
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
  const { top, ground } = stageBox(view);
  const pxPerM = (ground - top) / sim.scaleM;
  const sw = narrow
    ? STACK_WIDTH_NARROW_PX
    : Math.max(STACK_WIDTH_MIN_PX, Math.min(STACK_WIDTH_MAX_PX, W * 0.06));
  const sx = Math.round(W / 2 - sw / 2);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);

  // Ground line.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  line(ctx, 0, ground + 0.5, W, ground + 0.5);

  // Landmark lines, icons, and labels: things (physical comparisons) on the
  // left, time events (history milestones) on the right, mirrored around the
  // centered stack.
  ctx.font = `${narrow ? FONT_NARROW_PX : FONT_PX}px "IBM Plex Mono", monospace`;
  ctx.textBaseline = 'alphabetic';
  const iconSize = narrow ? ICON_SIZE_NARROW_PX : ICON_SIZE_PX;
  drawLandmarkLabels(ctx, placed.left, 'left', sx, sx + sw, W, iconSize, icons);
  drawLandmarkLabels(ctx, placed.right, 'right', sx, sx + sw, W, iconSize, icons);

  // The stack: always a whole number of bricks (src/lib/sim.ts's
  // bricksFor), so the top course lines up cleanly instead of stopping mid-
  // brick.
  const bricks = bricksFor(sim.years);
  const h = bricks * BRICK_M;
  const sh = h * pxPerM;
  const y0 = ground - sh;
  const pxPerBrick = BRICK_M * pxPerM;

  if (sh > 0) drawGroundShadow(ctx, sx, sw, ground);
  drawBrickTower(ctx, sx, sw, y0, sh, ground, pxPerBrick, color);
}
