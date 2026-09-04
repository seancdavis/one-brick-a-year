import './style.css';
import { createAudio } from './audio';
import { createBeatCards } from './beats';
import { createHoldInput } from './input';
import { createHud } from './hud';
import { createStartScreen } from './start-screen';
import { humFor, ticksPerSecond, SOUND_DEFAULT_ENABLED, SOUND_STORAGE_KEY } from './lib/audio-schedule';
import { beatsCrossed } from './lib/beats';
import { buildLandmarks } from './lib/landmarks';
import { placeLandmarks } from './lib/layout';
import { parsePersonalization, serialize, STORAGE_KEY, type Personalization } from './lib/personalize';
import { heightM, initialSim, rateFor, step } from './lib/sim';
import { drawStage, stageBox, type StageView } from './render/stage';
import { ICONS } from './render/icons';

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

function readStoredProfile(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveProfile(p: Personalization): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(p));
  } catch {
    // Private browsing / disabled storage: personalization just won't
    // persist across visits. Nothing else depends on this succeeding.
  }
}

function readStoredSound(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY);
    return raw === null ? SOUND_DEFAULT_ENABLED : raw === 'true';
  } catch {
    return SOUND_DEFAULT_ENABLED;
  }
}

function saveSound(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
  } catch {
    // Private browsing / disabled storage: the sound preference just won't
    // persist across visits.
  }
}

const urlParams = new URLSearchParams(location.search);
const storedRaw = readStoredProfile();
const hasUrlParams = urlParams.has('name') || urlParams.has('age') || urlParams.has('home');

let profile = parsePersonalization(urlParams, storedRaw);
let landmarks = buildLandmarks(profile);

// URL params are applied and stored like any other source, but the page
// never writes the child's name (or anything else) back into the URL —
// "Copy link" (end screen, slice 8) copies the bare page URL only.
if (hasUrlParams) {
  saveProfile(profile);
}

const startScreen = createStartScreen(app, (nextProfile) => {
  profile = nextProfile;
  saveProfile(profile);
  // Rebuild landmarks only — the running sim (years, scale, zoom) is left
  // untouched, whether this came from the mandatory first-run screen or a
  // mid-build "Change".
  landmarks = buildLandmarks(profile);
  startScreen.close();
});

const audio = createAudio();
let soundEnabled = readStoredSound();

// The click that flips this is itself the user gesture enable()/disable()
// need — sound is never started any other way. The stored preference only
// seeds the toggle's starting look; audio.enable() is never called on load.
const hud = createHud(app, {
  onChange: () => startScreen.open(profile),
  onSoundToggle: () => {
    soundEnabled = !soundEnabled;
    saveSound(soundEnabled);
    if (soundEnabled) {
      audio.enable();
    } else {
      audio.disable();
    }
    hud.setSound(soundEnabled);
  },
});
hud.setSound(soundEnabled);

const beatCards = createBeatCards(app);

let sim = initialSim();
let held = false;
let hasHeldOnce = false;
let prevYears = sim.years;
let tickAccumulator = 0;
let wasDone = false;

createHoldInput(window, (next) => {
  held = next;
  if (held && !hasHeldOnce) {
    hasHeldOnce = true;
    hud.hidePrompt();
  }
});

// First visit: no URL params and nothing stored yet. Personalize before the
// build can begin; the frame loop below ignores holds while this is open.
// Escape is disabled here since there's no existing profile to fall back to.
if (!hasUrlParams && storedRaw === null) {
  startScreen.open(profile, { dismissible: false });
}

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

  const effectiveHeld = held && !startScreen.isOpen();
  sim = step(sim, dtSeconds, effectiveHeld, reducedMotionQuery.matches);

  // Ticks and hum track the current pace; both calls are safe no-ops
  // whenever sound is off (audio.enable() was never called this session).
  const rate = rateFor(sim.heldSeconds);
  if (effectiveHeld && !sim.done) {
    tickAccumulator += ticksPerSecond(rate) * dtSeconds;
    while (tickAccumulator >= 1) {
      audio.tick();
      tickAccumulator -= 1;
    }
    const hum = humFor(rate);
    audio.hum(hum.gain, hum.hz);
  } else {
    audio.hum(0, humFor(rate).hz);
  }

  for (const beat of beatsCrossed(prevYears, sim.years)) {
    beatCards.show(beat);
    audio.chime();
  }
  prevYears = sim.years;

  if (sim.done && !wasDone) {
    audio.finish();
  }
  wasDone = sim.done;

  const placed = placeLandmarks(landmarks, heightM(sim), sim.scaleM, stageBox(view));
  drawStage(ctx, view, sim, placed, ICONS);
  hud.update(sim);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
