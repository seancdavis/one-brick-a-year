import './style.css';
import { createAudio } from './audio';
import { createBeatCards } from './beats';
import { createEndScreen } from './end-screen';
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

// Set whenever something the canvas or HUD draws might have changed, so an
// otherwise-idle frame (not held, no zoom tween, nothing crossed) can skip
// the redraw. The rAF loop itself keeps running either way — cheap to keep
// alive, and simpler than pausing/resuming around every event source.
let needsRender = true;

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
// "Copy link" (src/end-screen.ts) copies the bare page URL only.
if (hasUrlParams) {
  saveProfile(profile);
  try {
    // Strip the params from the address bar now that they're read and
    // saved, so the child's name never lingers in the URL or history.
    history.replaceState(null, '', location.pathname);
  } catch {
    // Some environments (e.g. a sandboxed iframe) block history mutation:
    // the params just stay in the visible URL in that case.
  }
}

const startScreen = createStartScreen(app, (nextProfile) => {
  profile = nextProfile;
  saveProfile(profile);
  // Rebuild landmarks only — the running sim (years, scale, zoom) is left
  // untouched, whether this came from the mandatory first-run screen or a
  // mid-build "Change".
  landmarks = buildLandmarks(profile);
  startScreen.close();
  needsRender = true;
});

const audio = createAudio();
let soundEnabled = readStoredSound();

// The click that flips this is itself the user gesture enable()/disable()
// need — sound is never started any other way from the toggle. The stored
// preference only seeds the toggle's starting look; the other path into
// audio.enable() is the first-hold arming fix below, which also runs from a
// user gesture (a pointerdown or keydown).
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
  onStartOver: () => resetForReplay(),
});
hud.setSound(soundEnabled);

const beatCards = createBeatCards(app);
const endScreen = createEndScreen(app, () => resetForReplay());

let sim = initialSim();
let held = false;
let hasHeldOnce = false;
let prevYears = sim.years;
let tickAccumulator = 0;
let wasDone = false;
let endScreenShown = false;

// Shared by "Build it again" (end screen) and "Start over" (HUD, usable
// mid-build too): back to a fresh, unstarted sim, with the prompt and card
// queue reset to match.
function resetForReplay(): void {
  endScreen.hide();
  endScreenShown = false;
  beatCards.clear();
  sim = initialSim();
  prevYears = sim.years;
  tickAccumulator = 0;
  wasDone = false;
  hasHeldOnce = false;
  hud.showPrompt();
  needsRender = true;
}

createHoldInput(window, (next) => {
  held = next;
  if (held && !hasHeldOnce) {
    hasHeldOnce = true;
    hud.hidePrompt();
    // Returning visitor with sound already on: this first hold is the user
    // gesture audio.enable() needs, so she hears sound without also having
    // to tap the toggle. The toggle's own click handler still does its own
    // enable()/disable() and keeps working exactly as before.
    if (soundEnabled) {
      audio.enable();
    }
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
  needsRender = true;
}

window.addEventListener('resize', resize);
resize();

let lastTimeMs: number | null = null;

function frame(timeMs: number): void {
  if (lastTimeMs === null) lastTimeMs = timeMs;
  const dtSeconds = (timeMs - lastTimeMs) / 1000;
  lastTimeMs = timeMs;

  // Ignore hold input while a modal screen (start or end) is up — the sim
  // itself already refuses to advance once done, but this also keeps the
  // idle-frame check below from thinking something is happening.
  const effectiveHeld = held && !startScreen.isOpen() && !endScreenShown;
  const before = sim;
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
    beatCards.clear();
    endScreenShown = true;
    endScreen.show(profile);
    audio.finish();
  }
  wasDone = sim.done;

  // Idle frame: nothing held, no zoom tween running (in either the previous
  // or the new state), and years/done didn't change this step. Redrawing
  // would produce pixel-identical output, so skip it — the rAF loop keeps
  // going regardless, ready for the next input.
  const simAdvancing = sim.years !== before.years || sim.done !== before.done;
  const zoomActive = sim.zoom !== null || before.zoom !== null;

  if (needsRender || effectiveHeld || simAdvancing || zoomActive) {
    const placed = placeLandmarks(landmarks, heightM(sim), sim.scaleM, stageBox(view));
    drawStage(ctx, view, sim, placed, ICONS);
    hud.update(sim);
    needsRender = false;
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
