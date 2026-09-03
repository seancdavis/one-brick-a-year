import './style.css';
import { createHoldInput } from './input';
import { fmtInt, fmtMeters } from './lib/format';
import { heightM, initialSim, step } from './lib/sim';

// Slice 2 placeholder: prints the sim's live years/height while held.
// Slice 3 replaces this with the real canvas renderer and HUD.
const app = document.querySelector<HTMLDivElement>('#app');

const readout = document.createElement('div');
readout.id = 'readout';
app?.append(readout);

let sim = initialSim();
let held = false;

createHoldInput(window, (next) => {
  held = next;
});

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function render(): void {
  readout.textContent = `${fmtInt(sim.years)} years · ${fmtMeters(heightM(sim))}`;
}

let lastTimeMs: number | null = null;

function frame(timeMs: number): void {
  if (lastTimeMs === null) lastTimeMs = timeMs;
  const dtSeconds = (timeMs - lastTimeMs) / 1000;
  lastTimeMs = timeMs;

  sim = step(sim, dtSeconds, held, reducedMotionQuery.matches);
  render();

  requestAnimationFrame(frame);
}

render();
requestAnimationFrame(frame);
