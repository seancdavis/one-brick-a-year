// Canvas drawing for the stack, ground, scale bar, and landmark lines.
// Ports the prototype's `render()` function (docs/prototype/brick-stack.html)
// pixel-for-pixel. Reads state and draws; never mutates it.

import { BRICK_M } from '../lib/constants';
import { fmtMeters, fmtYears } from '../lib/format';
import type { IconId } from '../lib/icon-paths';
import type { PlacedLandmark, StageBox } from '../lib/layout';
import { heightM, type SimState } from '../lib/sim';
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
const RED = '#d5281b';

// Below the ground line, where the HUD's scale bar and stack sit.
const GROUND_MARGIN_PX = 56;
const TOP_MIN_PX = 150;
const TOP_FRACTION = 0.2;

// Gap between a landmark's icon and its label text, and between the dashed
// line and the icon, both in px.
const ICON_LABEL_GAP_PX = 6;
const ICON_LINE_GAP_PX = 6;
// Icons draw smaller on narrow screens so the icon and the label both still
// fit beside the dashed line.
const ICON_SIZE_NARROW_PX = 20;

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

export function drawStage(
  ctx: CanvasRenderingContext2D,
  view: StageView,
  sim: SimState,
  placed: PlacedLandmark[],
  icons: Record<IconId, Path2D>,
): void {
  const { widthCss: W, heightCss: H, dpr, narrow } = view;
  const { top, ground } = stageBox(view);
  const pxPerM = (ground - top) / sim.scaleM;
  const sw = narrow ? 34 : Math.max(40, Math.min(72, W * 0.055));
  const sx = narrow ? Math.round(W * 0.12) : Math.round(W * 0.3);
  const labelX = W - 24;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);

  // Ground line.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  line(ctx, 0, ground + 0.5, W, ground + 0.5);

  // Scale bar on the left: how tall this screen is right now. Desktop only.
  if (!narrow) {
    const bx = Math.round(W * 0.3) - 40;
    ctx.strokeStyle = 'rgba(42,36,32,.5)';
    line(ctx, bx + 0.5, ground, bx + 0.5, top);
    line(ctx, bx - 4, top + 0.5, bx + 4, top + 0.5);
    line(ctx, bx - 4, ground + 0.5, bx + 4, ground + 0.5);
    ctx.save();
    ctx.translate(bx - 10, (ground + top) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = CAPTION;
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`THIS SCREEN IS ${fmtMeters(sim.scaleM).toUpperCase()} TALL`, 0, 0);
    ctx.restore();
  }

  // Landmark lines, icons, and labels.
  ctx.font = '12px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  for (const p of placed) {
    const label = `${p.landmark.label} · ${fmtYears(p.landmark.years)}`;
    const baselineY = p.y + p.labelDy;

    const iconSize = narrow ? ICON_SIZE_NARROW_PX : ICON_SIZE_PX;
    const textWidth = ctx.measureText(label).width;
    const iconLeftX = labelX - textWidth - ICON_LABEL_GAP_PX - iconSize;
    const lineEndX = iconLeftX - ICON_LINE_GAP_PX;

    const icon = icons[p.landmark.icon];
    ctx.save();
    ctx.globalAlpha = p.passed ? 1 : 0.45;
    ctx.fillStyle = INK;
    ctx.translate(iconLeftX, baselineY - iconSize / 2);
    ctx.scale(iconSize / 24, iconSize / 24);
    ctx.fill(icon, 'evenodd');
    ctx.restore();

    ctx.strokeStyle = p.passed ? 'rgba(42,36,32,.6)' : 'rgba(42,36,32,.22)';
    ctx.setLineDash([3, 4]);
    line(ctx, sx + sw + 10, Math.round(p.y) + 0.5, lineEndX, Math.round(p.y) + 0.5);
    ctx.setLineDash([]);

    ctx.fillStyle = p.passed ? INK : CAPTION;
    ctx.fillText(label, labelX, baselineY);
  }

  // The stack.
  const h = heightM(sim);
  const sh = h * pxPerM;
  const y0 = ground - sh;
  ctx.fillStyle = RED;
  ctx.fillRect(sx, y0, sw, sh);

  const pxPerBrick = BRICK_M * pxPerM;
  if (pxPerBrick >= 3 && sh > 0) {
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    for (let yy = ground - pxPerBrick; yy > y0 - 1; yy -= pxPerBrick) {
      line(ctx, sx, Math.round(yy) + 0.5, sx + sw, Math.round(yy) + 0.5);
    }
    const bw = sw / 4;
    const stud = Math.min(pxPerBrick * 0.2, 6);
    for (let s = 0; s < 4; s++) {
      ctx.fillRect(sx + s * bw + bw * 0.25, y0 - stud, bw * 0.5, stud);
    }
  } else if (sh > 0) {
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.fillRect(sx + sw - Math.max(3, sw * 0.12), y0, Math.max(3, sw * 0.12), sh);
  }
}
