import './style.css';
import { createAudio } from './audio';
import { createBeatCards } from './beats';
import { createEndScreen } from './end-screen';
import { createScrollInput, type ScrollKind } from './input';
import { createHud } from './hud';
import { createStartScreen } from './start-screen';
import { humFor, ticksPerSecond, SOUND_DEFAULT_ENABLED, SOUND_STORAGE_KEY } from './lib/audio-schedule';
import { beatsCrossed } from './lib/beats';
import { buildLandmarks } from './lib/landmarks';
import { placeLandmarks } from './lib/layout';
import { colorById } from './lib/lego-colors';
import {
  hasPersonalizationKeys,
  mergeParams,
  parsePersonalization,
  serialize,
  STORAGE_KEY,
  type Personalization,
} from './lib/personalize';
import { INITIAL_SCROLL, decayVelocity, pushScroll, yearsPerSecond, type ScrollState } from './lib/scroll-state';
import { heightM, initialSim, step } from './lib/sim';
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
// otherwise-idle frame (no active scroll, no zoom tween, nothing crossed)
// can skip the redraw. The rAF loop itself keeps running either way —
// cheap to keep alive, and simpler than pausing/resuming around every event
// source.
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

// The fragment (#name=Ada&age=8&home=8) never leaves the browser, so it
// never reaches a server log the way the query string does. Both can carry
// values at once (e.g. a share target appends its own query string on top
// of a hand-written fragment) — mergeParams keeps only the three recognized
// keys and lets the fragment win per field over the query.
const query = new URLSearchParams(location.search);
const fragment = new URLSearchParams(location.hash.slice(1));
const params = mergeParams(query, fragment);
const storedRaw = readStoredProfile();
const hasUrlParams = hasPersonalizationKeys(params);

let profile = parsePersonalization(params, storedRaw);
let landmarks = buildLandmarks(profile);

// URL params are applied and stored like any other source, but the page
// never writes the child's name (or anything else) back into the URL —
// "Copy link" (src/end-screen.ts) copies the bare page URL only.
if (hasUrlParams) {
  saveProfile(profile);
  try {
    // location.pathname carries neither a hash nor a query string, so this
    // strips both forms at once — the child's name never lingers in the URL
    // or history.
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
  // Restart.
  landmarks = buildLandmarks(profile);
  hud.setColor(profile.colorId);
  startScreen.close();
  needsRender = true;
});

const audio = createAudio();
let soundEnabled = readStoredSound();

const hud = createHud(app, {
  colorId: profile.colorId,
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
  onRestart: () => restart(),
  onColorSelect: (colorId) => {
    profile = { ...profile, colorId };
    saveProfile(profile);
    needsRender = true;
  },
});
hud.setSound(soundEnabled);

const beatCards = createBeatCards(app);
const endScreen = createEndScreen(app, () => resetForReplay());

let sim = initialSim();
let scroll: ScrollState = INITIAL_SCROLL;
let hasScrolledOnce = false;
let tickAccumulator = 0;

// The kind of input (wheel, touch, or keyboard) that produced this session's
// first scroll. First kind wins for the whole session. Exposed for slice 4's
// session analytics (an `input_kind` field); unused until then.
let firstInputKind: ScrollKind | null = null;

function nowSeconds(): number {
  return performance.now() / 1000;
}

// Ends the current analytics session. A no-op until slice 4 (session
// analytics) wires this to POST /api/sessions/:id/end.
function endSession(): void {}

// Shared by "Build it again" (end screen) and Restart (HUD): back to a
// fresh, unstarted sim, with the prompt and card queue reset to match.
function resetForReplay(): void {
  endScreen.hide();
  beatCards.clear();
  sim = initialSim();
  tickAccumulator = 0;
  hasScrolledOnce = false;
  hud.showPrompt();
  needsRender = true;
}

// The HUD's Restart button: ends the session, resets the build, and reopens
// the start screen with the current profile prefilled so the user can
// change it.
function restart(): void {
  endSession();
  resetForReplay();
  startScreen.open(profile);
}

// Creating (or resuming) the AudioContext must happen from an actual user
// gesture — browsers refuse otherwise — and a wheel event isn't reliably
// counted as one. armAudioOnce() is called both from the qualifying first
// scroll below and from the raw pointerdown/keydown listeners further down,
// so whichever kind of gesture the browser will accept ends up arming
// audio; the guard makes every call after the first a no-op.
let hasArmedAudio = false;
function armAudioOnce(): void {
  if (hasArmedAudio) return;
  hasArmedAudio = true;
  // Apply a stored on-preference at the first user gesture.
  if (soundEnabled) {
    audio.enable();
  }
}

createScrollInput(window, (deltaPx, kind) => {
  if (firstInputKind === null) firstInputKind = kind;
  scroll = pushScroll(scroll, deltaPx, nowSeconds());

  // A scroll can reach this listener while the start screen is still up (its
  // own padding, its label text are excluded, but a gesture can still land
  // just outside them) or after the sim is already done — neither is the
  // user's first real scroll on the stack.
  if (!hasScrolledOnce && !startScreen.isOpen() && !sim.done) {
    const rate = yearsPerSecond(scroll.velocity, sim.years);
    if (rate > 0) {
      hasScrolledOnce = true;
      hud.hidePrompt();
      armAudioOnce();
    }
  }
});

// A plain pointerdown or keydown is a valid Web Audio user gesture in every
// browser, unlike a wheel event — see armAudioOnce's comment. Skipped while
// a modal screen is up so filling in the start screen's form (or reopening
// it via Restart) doesn't arm sound before the user has actually engaged
// with the stack.
function armAudioFromGesture(): void {
  if (startScreen.isOpen() || sim.done) return;
  armAudioOnce();
}
window.addEventListener('pointerdown', armAudioFromGesture);
window.addEventListener('keydown', armAudioFromGesture);

// First visit: no URL params and nothing stored yet. Personalize before the
// build can begin; the frame loop below ignores scroll input while this is
// open. Escape is disabled here since there's no existing profile to fall
// back to.
if (!hasUrlParams && storedRaw === null) {
  startScreen.open(profile, { dismissible: false });
}

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const MAX_DPR = 2;
// Below this CSS width the stack and landmark icons switch to the narrow
// layout, matching the prototype's `W < 700` breakpoint.
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

  const before = sim;

  // Velocity keeps decaying every frame regardless of what's on screen, so
  // it doesn't build up silently behind a modal and surge once it closes.
  scroll = decayVelocity(scroll, timeMs / 1000);

  // Ignore the resulting rate while a modal screen (start or end) is up —
  // the sim itself already refuses to advance once done, but this also
  // keeps the idle-frame check below from thinking something is happening.
  const inputActive = !startScreen.isOpen() && !before.done;
  const rate = inputActive ? yearsPerSecond(scroll.velocity, before.years) : 0;
  sim = step(before, dtSeconds, rate, reducedMotionQuery.matches);

  // Both calls are safe no-ops before enable() has run — the AudioContext is
  // created lazily and enable() must be called from a user gesture.
  if (inputActive && !sim.done) {
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

  for (const beat of beatsCrossed(before.years, sim.years)) {
    beatCards.show(beat);
    audio.chime();
  }

  if (sim.done && !before.done) {
    beatCards.clear();
    endScreen.show(profile);
    audio.finish();
  }

  // Idle frame: no active scroll rate, no zoom tween running (in either the
  // previous or the new state), and years/done didn't change this step.
  // Redrawing would produce pixel-identical output, so skip it — the rAF
  // loop keeps going regardless, ready for the next input.
  const simAdvancing = sim.years !== before.years || sim.done !== before.done;
  const zoomActive = sim.zoom !== null || before.zoom !== null;

  if (needsRender || rate > 0 || simAdvancing || zoomActive) {
    const placed = placeLandmarks(landmarks, heightM(sim), sim.scaleM, stageBox(view));
    drawStage(ctx, view, sim, placed, ICONS, colorById(profile.colorId));
    hud.update(sim);
    needsRender = false;
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
