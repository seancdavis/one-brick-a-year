import './style.css';
import { createHoldInput } from './input';
import { createHud } from './hud';
import { buildLandmarks } from './lib/landmarks';
import { placeLandmarks } from './lib/layout';
import { heightM, initialSim, step } from './lib/sim';
import { drawStage, stageBox, type StageView } from './render/stage';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('missing #app root element');

const canvas = document.createElement('canvas');
app.append(canvas);

function getContext2D(el: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = el.getContext('2d');
  if (!context) throw new Error('2d canvas context unavailable');
  return context;
}

const ctx = getContext2D(canvas);

const hud = createHud(app);

// Slice 6 replaces this with the real profile from the start screen and URL params.
const landmarks = buildLandmarks({ name: 'you', ageYears: 8, homeMeters: 8 });

let sim = initialSim();
let held = false;
let hasHeldOnce = false;

createHoldInput(window, (next) => {
  held = next;
  if (held && !hasHeldOnce) {
    hasHeldOnce = true;
    hud.hidePrompt();
  }
});

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const MAX_DPR = 2;
// Below this CSS width the stack and scale bar switch to the narrow layout,
// matching the prototype's `W < 700` breakpoint.
const NARROW_BREAKPOINT_PX = 700;

let view: StageView = { widthCss: 0, heightCss: 0, dpr: 1, narrow: false };

function resize(): void {
  const widthCss = window.innerWidth;
  const heightCss = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

  view = { widthCss, heightCss, dpr, narrow: widthCss < NARROW_BREAKPOINT_PX };
  canvas.width = Math.round(widthCss * dpr);
  canvas.height = Math.round(heightCss * dpr);
}

window.addEventListener('resize', resize);
resize();

let lastTimeMs: number | null = null;

function frame(timeMs: number): void {
  if (lastTimeMs === null) lastTimeMs = timeMs;
  const dtSeconds = (timeMs - lastTimeMs) / 1000;
  lastTimeMs = timeMs;

  sim = step(sim, dtSeconds, held, reducedMotionQuery.matches);

  const placed = placeLandmarks(landmarks, heightM(sim), sim.scaleM, stageBox(view));
  drawStage(ctx, view, sim, placed);
  hud.update(sim);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
