// Canvas drawing for the stack, ground, scale bar, and landmark lines.
// Ports the prototype's `render()` function (docs/prototype/brick-stack.html)
// pixel-for-pixel. Reads state and draws; never mutates it.

import { BRICK_M } from '../lib/constants';
import { fmtMeters } from '../lib/format';
import type { PlacedLandmark, StageBox } from '../lib/layout';
import { heightM, type SimState } from '../lib/sim';

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

  // Landmark lines and labels.
  ctx.font = '12px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  for (const p of placed) {
    ctx.strokeStyle = p.passed ? 'rgba(42,36,32,.6)' : 'rgba(42,36,32,.22)';
    ctx.setLineDash([3, 4]);
    line(ctx, sx + sw + 10, Math.round(p.y) + 0.5, labelX, Math.round(p.y) + 0.5);
    ctx.setLineDash([]);
    ctx.fillStyle = p.passed ? INK : CAPTION;
    ctx.fillText(p.landmark.label, labelX, p.y + p.labelDy);
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
