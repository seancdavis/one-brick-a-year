// Canvas drawing for the picture-book scene: paper ground, sun, hills, the
// brick tower, landmarks as cut-paper shapes, and the compaction legend.
// Reads state and draws; never mutates it. Colors and the hand-lettered
// typeface are resolved once per resize from src/style.css's custom
// properties (see Tokens/ensureTokens below) — that file is the single
// source of truth for them. Sizes and the "paper drop" technique (a flat
// offset copy in a warm shadow tint, never a blur) come from
// docs/design/picture-book.dc.html and are pinned as constants below.

import { courseHeightPx, effectiveRenderUnit, renderCourses, unitLabel } from '../lib/compaction';
import { fmtYears } from '../lib/format';
import type { IconId } from '../lib/icon-paths';
import {
  boxesIntersect,
  labelRoom,
  type OccupiedBox,
  type PlacedLandmark,
  type PlacedLandmarks,
  type StageBox,
} from '../lib/layout';
import { shade, type LegoColor } from '../lib/lego-colors';
import { bricksFor, type SimState } from '../lib/sim';

export interface StageView {
  widthCss: number;
  heightCss: number;
  dpr: number;
  narrow: boolean;
}

// The picture-book palette and typefaces, resolved from src/style.css's
// custom properties.
// Only the colors the canvas itself paints with: a landmark's own paper color
// (navy, leaf, mustard, coral) is worn by its pin, which is HTML — see
// src/style.css's .pin-paper--* rules — so it isn't resolved here.
interface Tokens {
  paper: string;
  mustard: string;
  muted: string;
  mutedIcon: string;
  shadow: string;
  hill: string;
  hillDeep: string;
  fonts: { hand: string };
}

function readTokens(): Tokens {
  const root = getComputedStyle(document.documentElement);
  const token = (name: string) => root.getPropertyValue(name).trim();
  return {
    paper: token('--paper'),
    mustard: token('--mustard'),
    muted: token('--muted'),
    mutedIcon: token('--muted-icon'),
    shadow: token('--paper-shadow'),
    hill: token('--hill'),
    hillDeep: token('--hill-deep'),
    fonts: { hand: token('--font-hand') },
  };
}

// Cached like ensureNoiseCanvas below: re-read only when the CSS viewport
// size changes, not on every frame.
let tokensCache: Tokens | null = null;
let tokensW = 0;
let tokensH = 0;

function ensureTokens(widthCss: number, heightCss: number): Tokens {
  if (tokensCache && tokensW === widthCss && tokensH === heightCss) return tokensCache;
  tokensCache = readTokens();
  tokensW = widthCss;
  tokensH = heightCss;
  return tokensCache;
}

const PAPER_DROP_PX = 3;

// Below the ground line, where the stack sits. The ground is the crest of
// the upper paper hill (see drawPaperHill) — 90px leaves room for both
// hills to read as hills rather than a sliver.
const GROUND_MARGIN_PX = 90;
// The floor for the stage's usable top: src/main.ts's real HUD measurement
// (src/lib/layout.ts's stageTopFor) never pushes it below this, even if a
// stray zero-height reading came back before the HUD had laid out.
export const TOP_MIN_PX = 150;
const TOP_FRACTION = 0.2;

// Sun, top-right: a flat mustard circle with the paper drop. Position is
// expressed the way the artboard's CSS box is (right/top margins to the
// box, not the center), so SUN_RIGHT_PX/SUN_TOP_PX describe the box, and
// the circle's center is derived from that plus the radius.
const SUN_RADIUS_PX = 38;
const SUN_RIGHT_PX = 90;
const SUN_TOP_PX = 60;

// Ground: two overlapping paper hills, drawn as half-ellipses (a flat
// bottom edge below the visible canvas, an elliptical crest on top). The
// upper hill's crest sits exactly at the ground line so the stack reads as
// standing on it; the lower, wider hill sits behind and below, drawn on
// top so only the upper hill's crest band shows above it — the two-tone
// "layered hills" look the artboard uses. Colors come from tokens.hill /
// tokens.hillDeep (src/style.css's --hill / --hill-deep).
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
const STUD_CORNER_RADIUS_PX = 3;
const STUD_LIGHTEN = 0.3;
const STUD_BOTTOM_DARKEN = -0.15;

// Landmark cut-paper icons and labels — see drawLandmarkLabels for how
// these lay out a side.
const ICON_PX = 36;
const ICON_PX_NARROW = 20;
const LABEL_FONT_PX = 20;
const LABEL_FONT_NARROW_PX = 16;
const CONNECTOR_THRESHOLD_PX = 8;
const SECOND_LINE_HEIGHT_PX = 16;
const LEADER_WIDTH_PX = 2;
// Where a label's icon and text sit relative to the stack is pure math and
// lives in src/lib/layout.ts's labelRoom (round 5's "labels next to their
// icons"); this module only draws what it returns.

// Legend beside the tower's base: what one drawn brick is worth right now.
// On narrow canvases there's no room beside the tower, so instead it's
// centered horizontally on the tower, just below the ground line on the
// hill, in the paper color for contrast against the hill's teal, and
// wrapped to at most two lines so it stays within the viewport.
const LEGEND_FONT_PX = 16;
const LEGEND_GAP_PX = 12;
const LEGEND_BASELINE_OFFSET_PX = 8;
const LEGEND_NARROW_GROUND_GAP_PX = 28;
const LEGEND_NARROW_LINE_HEIGHT_PX = 20;
const LEGEND_NARROW_SIDE_MARGIN_PX = 24;

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

// `top` here is a viewport-fraction fallback; src/main.ts overrides it with
// the real HUD measurement (src/lib/layout.ts's stageTopFor) before handing
// a StageBox to placeLandmarks — every other caller only ever reads `ground`
// off this.
export function stageBox(view: StageView): StageBox {
  return {
    top: Math.max(TOP_MIN_PX, view.heightCss * TOP_FRACTION),
    ground: view.heightCss - GROUND_MARGIN_PX,
  };
}

// Where the tower stands: a fixed width, centered. drawStage and
// stageGeometry both read it from here, so the canvas and the HTML tag layer
// over it can never disagree about where the stack's edges are.
function stackBox(view: StageView): { sx: number; sw: number } {
  const sw = view.narrow ? BRICK_WIDTH_NARROW_PX : BRICK_WIDTH_PX;
  return { sx: Math.round(view.widthCss / 2 - sw / 2), sw };
}

// The handful of numbers src/popups.ts needs to hang popups and pins off the
// drawn tower: where each of its edges is (the right side's popups hang off
// one, the left side's off the other), where the ground line is, and how tall
// one drawn course is right now (BRICK_PX at rest, squished mid-compaction —
// see src/lib/compaction.ts). Exported so those numbers come from one place
// rather than being re-derived in src/main.ts.
export interface StageGeometry {
  stackLeftX: number;
  stackRightX: number;
  groundY: number;
  courseHeightPx: number;
  narrow: boolean;
}

export function stageGeometry(view: StageView, sim: SimState): StageGeometry {
  const { sx, sw } = stackBox(view);
  return {
    stackLeftX: sx,
    stackRightX: sx + sw,
    groundY: stageBox(view).ground,
    courseHeightPx: courseHeightPx(bricksFor(sim.years), sim.compaction),
    narrow: view.narrow,
  };
}

// The tower nudge: a popup flipping out of a brick gives the whole drawn
// stack a short scale about its base, so the fact reads as having come out of
// the tower rather than appearing beside it. State lives here (rather than in
// the sim) because it is pure presentation — src/main.ts calls nudge() when a
// popup pops and keeps rendering while nudgeActive() is true.
const NUDGE_MS = 120;
const NUDGE_SCALE = 1.02;

let nudgeStartMs: number | null = null;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function nudge(): void {
  if (prefersReducedMotion()) return;
  nudgeStartMs = performance.now();
}

// Only checks that a nudge is pending, not whether it has actually expired —
// nudgeScale() below is what detects real expiry, clears nudgeStartMs, and
// returns the resting scale of 1. Keeping this loose guarantees the render
// loop calls nudgeScale() at least once after expiry (since nudgeActive()
// still reads true from the *previous* frame's timestamp until that call
// clears it), so the tower's very last nudged frame always redraws at scale
// 1 rather than getting stuck slightly off-scale if nothing else happens to
// trigger a redraw right when the nudge's animation would have finished.
export function nudgeActive(): boolean {
  return nudgeStartMs !== null;
}

// 1 at both ends, NUDGE_SCALE at the midpoint: the stack swells and settles
// back within NUDGE_MS, so nothing is left permanently off-scale.
function nudgeScale(): number {
  if (nudgeStartMs === null) return 1;
  const p = (performance.now() - nudgeStartMs) / NUDGE_MS;
  if (p >= 1 || p < 0) {
    nudgeStartMs = null;
    return 1;
  }
  return 1 + (NUDGE_SCALE - 1) * Math.sin(p * Math.PI);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawPaperCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, shadow: string): void {
  ctx.fillStyle = shadow;
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

function drawPaperHill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  crestY: number,
  rx: number,
  ry: number,
  color: string,
  shadow: string,
): void {
  ctx.fillStyle = shadow;
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
  shadow: string,
): void {
  const scale = size / 24;

  ctx.save();
  ctx.fillStyle = shadow;
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

// Greedily wraps text onto a second line once it no longer fits maxWidth,
// measured with the canvas's current font — used for the narrow legend,
// which sits centered over the hill rather than in a fixed side column and
// so needs to wrap instead of ellipsizing. Only ever splits into two lines:
// the legend copy is short enough that a second word boundary always
// exists once the first line is full.
function wrapToTwoLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];

  const words = text.split(' ');
  let line1 = words[0];
  let split = 1;
  for (; split < words.length; split++) {
    const candidate = `${line1} ${words[split]}`;
    if (ctx.measureText(candidate).width > maxWidth) break;
    line1 = candidate;
  }
  const line2 = words.slice(split).join(' ');
  return line2 ? [line1, line2] : [line1];
}

// One side's landmark lines, icons, and labels: the label unit sits right
// beside its icon near the tower — icon then text on the right, text then
// icon on the left — with the icon LEADER_MIN_PX out from the stack edge (the
// dashed leader spans exactly that gap) and the text immediately beside it,
// wrapped within the room labelRoom leaves before the screen margin
// (src/lib/layout.ts, round 5's "labels next to their icons"). A label that
// fits `${label} · ${years}` within that room draws on one line; otherwise
// the years drop to their own second line, and if the label alone still
// doesn't fit, it's ellipsized (years never are). A vertical connector
// bridges the gap when stacking has pushed the label away from its true
// (lineY) height.
//
// A landmark the stack has already passed draws nothing here: its popup or
// pin (src/popups.ts) has taken the label's place, hanging off the very brick
// for its year. And an upcoming label whose own box would land inside an open
// popup gives way to it — only its leader draws, out to the popup's near
// edge, so the landmark is still visibly tied to its height on the tower.
function drawLandmarkLabels(
  ctx: CanvasRenderingContext2D,
  placed: PlacedLandmark[],
  side: 'left' | 'right',
  stackLeft: number,
  stackRight: number,
  width: number,
  iconSize: number,
  fontPx: number,
  narrow: boolean,
  icons: Record<IconId, Path2D>,
  tokens: Tokens,
  occupied: OccupiedBox[],
): void {
  const isLeft = side === 'left';
  const stackEdgeX = isLeft ? stackLeft : stackRight;
  const { iconX, textX, textMaxWidth } = labelRoom(side, stackEdgeX, width, iconSize, narrow);
  // The edge of the label unit nearest the stack — where the dashed leader
  // from the tower lands, and where a displaced label's connector runs.
  const nearEdgeX = isLeft ? iconX + iconSize : iconX;
  ctx.textAlign = isLeft ? 'right' : 'left';

  for (const p of placed) {
    if (p.passed) continue;

    const labelText = p.landmark.label;
    const yearsText = fmtYears(p.landmark.years);
    const oneLineText = `${labelText} · ${yearsText}`;
    const twoLine = ctx.measureText(oneLineText).width > textMaxWidth;
    const line1 = twoLine
      ? ctx.measureText(labelText).width <= textMaxWidth
        ? labelText
        : ellipsize(ctx, labelText, textMaxWidth)
      : oneLineText;
    const iconCenterY = twoLine ? p.labelY + SECOND_LINE_HEIGHT_PX / 2 : p.labelY;

    // The whole unit's box — icon plus however much of the text actually
    // rendered — measured against the open popups before anything is drawn.
    const textW = Math.max(ctx.measureText(line1).width, twoLine ? ctx.measureText(yearsText).width : 0);
    const boxX = isLeft ? textX - textW : iconX;
    const boxRight = isLeft ? iconX + iconSize : textX + textW;
    const boxTop = Math.min(iconCenterY - iconSize / 2, p.labelY - fontPx);
    const lastBaselineY = twoLine ? p.labelY + SECOND_LINE_HEIGHT_PX : p.labelY;
    const boxBottom = Math.max(iconCenterY + iconSize / 2, lastBaselineY + fontPx / 4);
    const box = { x: boxX, y: boxTop, w: boxRight - boxX, h: boxBottom - boxTop };
    const covering = occupied.find((o) => boxesIntersect(box, o));

    const labelColor = tokens.muted;
    ctx.strokeStyle = labelColor;
    ctx.lineWidth = LEADER_WIDTH_PX;
    ctx.setLineDash([5, 4]);

    if (covering) {
      // The popup wins the space; the leader still runs from the stack out to
      // whichever of the popup's edges faces the tower.
      const popupEdgeX = covering.side === 'left' ? covering.x + covering.w : covering.x;
      line(ctx, stackEdgeX, Math.round(p.lineY) + 0.5, popupEdgeX, Math.round(p.lineY) + 0.5);
      ctx.setLineDash([]);
      continue;
    }

    line(ctx, stackEdgeX, Math.round(p.lineY) + 0.5, nearEdgeX, Math.round(p.lineY) + 0.5);
    if (Math.abs(p.lineY - p.labelY) > CONNECTOR_THRESHOLD_PX) {
      line(ctx, nearEdgeX, Math.round(p.lineY) + 0.5, nearEdgeX, Math.round(p.labelY) + 0.5);
    }
    ctx.setLineDash([]);

    // Full opacity — an upcoming icon reads as muted purely from its flat
    // --muted-icon color, not from being faded out.
    drawPaperIcon(ctx, icons[p.landmark.icon], iconX, iconCenterY - iconSize / 2, iconSize, tokens.mutedIcon, 1, tokens.shadow);

    ctx.fillStyle = labelColor;
    ctx.fillText(line1, textX, p.labelY);
    if (twoLine) {
      ctx.fillText(yearsText, textX, p.labelY + SECOND_LINE_HEIGHT_PX);
    }
  }
}

// A stud's outline: rounded top-left and top-right corners (it's a rounded
// LEGO nub), square bottom so it sits flush on the brick below.
function traceStudTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.min(radius, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

// The tower: `drawn` whole courses, each pxPerBrick tall (BRICK_PX at rest,
// squished or grown mid-transition — see src/lib/compaction.ts's
// renderCourses/courseHeightPx). Every course gets a lighter top inset and a
// darker bottom inset, clamped so they never overlap on a heavily squished
// course; the top course alone gets four studs, and the whole stack gets one
// paper drop rather than per-course shadows.
function drawBrickTower(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sw: number,
  ground: number,
  drawn: number,
  pxPerBrick: number,
  color: LegoColor,
  shadow: string,
): void {
  if (drawn <= 0) return;

  const sh = drawn * pxPerBrick;
  const y0 = ground - sh;

  ctx.fillStyle = shadow;
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
    traceStudTop(ctx, studX, studTop, STUD_WIDTH_PX, STUD_HEIGHT_PX, STUD_CORNER_RADIUS_PX);
    ctx.fill();
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
  // The open popups' boxes (src/popups.ts's occupiedBoxes), in the same CSS
  // pixel space this draws in: an upcoming label that would land inside one
  // gives way to it — see drawLandmarkLabels.
  occupied: OccupiedBox[],
): void {
  const { widthCss: W, heightCss: H, dpr, narrow } = view;
  const { ground } = stageBox(view);
  const { sx, sw } = stackBox(view);
  const tokens = ensureTokens(W, H);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = tokens.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(ensureNoiseCanvas(W, H), 0, 0, W, H);

  drawPaperCircle(ctx, W - SUN_RIGHT_PX - SUN_RADIUS_PX, SUN_TOP_PX + SUN_RADIUS_PX, SUN_RADIUS_PX, tokens.mustard, tokens.shadow);

  drawPaperHill(ctx, W / 2, ground, W * HILL_UPPER_RX_RATIO, HILL_UPPER_RY_PX, tokens.hill, tokens.shadow);
  drawPaperHill(
    ctx,
    W / 2,
    ground + HILL_LOWER_OFFSET_PX,
    W * HILL_LOWER_RX_RATIO,
    HILL_LOWER_RY_PX,
    tokens.hillDeep,
    tokens.shadow,
  );

  // Landmark lines, icons, and labels: things (physical comparisons) on the
  // left, time events (history milestones) on the right, mirrored around the
  // centered stack. Only the ones still ahead of the stack are drawn — every
  // landmark it has passed is a popup or a pin by now (src/popups.ts), on the
  // very brick for its year.
  const fontPx = narrow ? LABEL_FONT_NARROW_PX : LABEL_FONT_PX;
  ctx.font = `${fontPx}px ${tokens.fonts.hand}`;
  ctx.textBaseline = 'alphabetic';
  const iconSize = narrow ? ICON_PX_NARROW : ICON_PX;
  drawLandmarkLabels(ctx, placed.left, 'left', sx, sx + sw, W, iconSize, fontPx, narrow, icons, tokens, occupied);
  drawLandmarkLabels(ctx, placed.right, 'right', sx, sx + sw, W, iconSize, fontPx, narrow, icons, tokens, occupied);

  // The stack: always the whole, visible courses renderCourses says to draw
  // (never zero while bricks > 0, never a single course growing to fill the
  // whole stage), each courseHeightPx tall — see src/lib/compaction.ts.
  const bricks = bricksFor(sim.years);
  const drawn = renderCourses(bricks, sim.compaction);
  const pxPerBrick = courseHeightPx(bricks, sim.compaction);
  // The nudge scales the whole drawn stack about its base — the point where
  // it meets the ground — so it swells in place rather than lifting off.
  const scale = nudgeScale();
  if (scale === 1) {
    drawBrickTower(ctx, sx, sw, ground, drawn, pxPerBrick, color, tokens.shadow);
  } else {
    const cx = sx + sw / 2;
    ctx.save();
    ctx.translate(cx, ground);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -ground);
    drawBrickTower(ctx, sx, sw, ground, drawn, pxPerBrick, color, tokens.shadow);
    ctx.restore();
  }

  // Legend: what one drawn brick is worth right now — describes the bricks
  // effectiveRenderUnit says are actually on screen (the same unit
  // renderCourses/courseHeightPx just drew with, so this can't diverge from
  // the tower), so it disappears the instant an expansion to unit 1 starts
  // and appears only once a compaction to 10 has finished.
  const legendUnit = effectiveRenderUnit(sim.compaction, bricks);
  if (legendUnit > 1) {
    ctx.font = `${LEGEND_FONT_PX}px ${tokens.fonts.hand}`;
    ctx.textBaseline = 'alphabetic';
    if (narrow) {
      ctx.textAlign = 'center';
      ctx.fillStyle = tokens.paper;
      const maxWidth = W - LEGEND_NARROW_SIDE_MARGIN_PX * 2;
      const lines = wrapToTwoLines(ctx, unitLabel(legendUnit), maxWidth);
      const firstBaselineY = ground + LEGEND_NARROW_GROUND_GAP_PX;
      lines.forEach((lineText, i) => {
        ctx.fillText(lineText, W / 2, firstBaselineY + i * LEGEND_NARROW_LINE_HEIGHT_PX);
      });
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = tokens.muted;
      ctx.fillText(unitLabel(legendUnit), sx + sw + LEGEND_GAP_PX, ground - LEGEND_BASELINE_OFFSET_PX);
    }
  }
}
