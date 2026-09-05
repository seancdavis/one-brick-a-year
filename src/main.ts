import './style.css';
import { createAnalytics, deriveBrowserFamily, deriveDeviceKind } from './analytics';
import { createAudio } from './audio';
import { createBeatCards } from './beats';
import { createEndScreen } from './end-screen';
import { createScrollInput, type ScrollKind } from './input';
import { createHud } from './hud';
import { createStartScreen } from './start-screen';
import { humFor, ticksPerSecond, SOUND_DEFAULT_ENABLED, SOUND_STORAGE_KEY } from './lib/audio-schedule';
import { BEATS, beatsCrossed } from './lib/beats';
import { beforePhraseFor, tallerThan } from './lib/comparisons';
import { pxPerMeter } from './lib/compaction';
import { fmtYears } from './lib/format';
import { buildLandmarks, type Landmark } from './lib/landmarks';
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
import { applyScroll, heightM, initialSim, step } from './lib/sim';
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

// The "time" landmarks (src/lib/landmarks.ts), ascending by years-ago, for
// the HUD's "next up" teaser (src/hud.ts's setNext) — the first one not yet
// passed by sim.years.
function timeEventsFrom(list: Landmark[]): Landmark[] {
  return list.filter((l) => l.kind === 'time').sort((a, b) => a.years - b.years);
}

let profile = parsePersonalization(params, storedRaw);
let landmarks = buildLandmarks(profile);
let timeEvents = timeEventsFrom(landmarks);
// The most recently reported "next up" event's identity (id and years, since
// a profile rebuild can change a landmark's years — e.g. age — without
// changing its id), so setNext is only called when it actually changes.
let lastNextKey: string | null = null;

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
  timeEvents = timeEventsFrom(landmarks);
  lastNextKey = null; // force the teaser to recheck against the rebuilt list
  hud.setColor(profile.colorId);
  startScreen.close();
  needsRender = true;
});

const audio = createAudio();
let soundEnabled = readStoredSound();

const analytics = createAnalytics();

const hud = createHud(app, {
  colorId: profile.colorId,
  onSoundToggle: () => {
    soundEnabled = !soundEnabled;
    saveSound(soundEnabled);
    if (soundEnabled) {
      void audio.enable();
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

// Whether this device supports touch, for analytics' device-kind derivation
// (src/analytics.ts's deriveDeviceKind) — checked once, since it never
// changes over a session.
const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

let sim = initialSim();
// The build attempt's high-water mark, used for beat dedup: only ever
// rises, even while an undo pulls `sim.years` back down, so beats fire once
// each on the way past and are never replayed by a later undo-then-rebuild.
// Reset only on replay (resetForReplay()), so it spans every analytics
// session within one build attempt.
let peakYears = 0;
// The current analytics session's own high-water mark, used for
// `yearsReached` in that session's end() payload. Set to the sim's current
// years whenever a session starts (see createScrollInput below) and raised
// alongside peakYears while the session is active, so a session that starts
// after returning from a hidden page doesn't inherit an earlier session's
// peak.
let sessionPeakYears = 0;
let hasScrolledOnce = false;
let tickAccumulator = 0;

// Whether an analytics session is currently open, tracked independently of
// hasScrolledOnce (which only ever goes false->true once per build attempt,
// via resetForReplay()). This flag goes false every time a session ends —
// finish, Restart, or the page being hidden — so a qualifying scroll after
// any of those (including one that follows returning from a hidden page,
// with hasScrolledOnce already true) opens a fresh session.
let sessionActive = false;

// The kind of input (wheel, touch, or keyboard) that produced the current
// analytics session's first scroll. Feeds analytics.start()'s `inputKind`
// field; set fresh each time sessionActive flips from false to true, so a
// session that starts after a hide records the kind that resumed it, not a
// leftover from an earlier session in the same build attempt.
let firstInputKind: ScrollKind | null = null;

// Ends the current analytics session, recording how far the stack got and
// whether the build actually finished — a no-op if no session is active,
// so finish, Restart, and page-hide can all call this unconditionally.
// `preferBeacon` should be set only when the page itself is going away
// (pagehide, visibilitychange to hidden) — everywhere else a normal fetch
// is fine.
function endSession(finished: boolean, opts?: { preferBeacon?: boolean }): void {
  if (!sessionActive) return;
  sessionActive = false;
  analytics.end({ yearsReached: sessionPeakYears, finished }, opts);
}

// Shared by "Build it again" (end screen) and Restart (HUD): back to a
// fresh, unstarted sim, with the prompt and card queue reset to match. The
// analytics session itself is not ended here — "Build it again" only runs
// after finish, which already ended it (see the frame loop below), and
// Restart ends it itself before calling this. Clearing firstInputKind means
// the next session's first scroll gets its own input_kind, not a leftover
// from this one.
function resetForReplay(): void {
  endScreen.hide();
  beatCards.clear();
  sim = initialSim();
  peakYears = 0;
  tickAccumulator = 0;
  hasScrolledOnce = false;
  firstInputKind = null;
  hud.showPrompt();
  needsRender = true;
}

// The HUD's Restart button: ends the session (not finished, at whatever
// years it reached), resets the build, and reopens the start screen with
// the current profile prefilled so the user can change it.
function restart(): void {
  endSession(false);
  resetForReplay();
  startScreen.open(profile);
}

// A session can end without any further app interaction — the tab is
// closed or backgrounded mid-build. Both fire reliably across browsers
// (pagehide covers Safari/iOS, where visibilitychange alone is less
// dependable); endSession()'s sessionActive guard means whichever fires
// first wins and the other is a no-op. Coming back to a still-open build and
// scrolling again (see createScrollInput below) opens a new session, since
// this always clears sessionActive.
window.addEventListener('pagehide', () => endSession(false, { preferBeacon: true }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') endSession(false, { preferBeacon: true });
});

// Creating (or resuming) the AudioContext must happen from an actual user
// gesture — browsers refuse otherwise — and a wheel event isn't reliably
// counted as one. armAudioOnce() is called both from the qualifying first
// scroll below and from the raw pointerdown/keydown listeners further down,
// so whichever kind of gesture the browser will accept ends up arming
// audio. It latches only once enable() actually confirms the context is
// running: a rejected or otherwise unsuccessful attempt (e.g. a wheel event
// the browser didn't count as a gesture) leaves hasArmedAudio false, so the
// next pointerdown or keydown tries again.
let hasArmedAudio = false;
// A second armAudioOnce() within the same event (the scroll listener and
// the raw pointerdown/keydown listener can both fire for one gesture) just
// calls audio.enable() again — audio.ts's own pendingEnable dedupes that
// into the same in-flight attempt, so concurrency is the audio module's
// concern, not this one's.
function armAudioOnce(): void {
  if (hasArmedAudio || !soundEnabled) return;
  void audio.enable().then((ok) => {
    if (ok) hasArmedAudio = true;
  });
}

createScrollInput(window, (deltaPx, kind) => {
  // A scroll can reach this listener while the start screen is still up (its
  // own padding, its label text are excluded, but a gesture can still land
  // just outside them) or after the sim is already done — neither should
  // move the stack (applyScroll no-ops once done on its own, but the start
  // screen's gate has to happen here).
  if (startScreen.isOpen() || sim.done) return;

  sim = applyScroll(sim, deltaPx);
  needsRender = true;

  // Only a build scroll (negative page delta) qualifies for the prompt or
  // analytics: an undo scroll before anything has been built yet is
  // clamped to nothing visible, so it shouldn't read as engagement either.
  if (deltaPx >= 0) return;

  // The prompt and the first audio arm happen once per build attempt
  // (cleared by resetForReplay(), not by a page hide) — hiding the page
  // mid-build and coming back doesn't bring the prompt back.
  if (!hasScrolledOnce) {
    hasScrolledOnce = true;
    hud.hidePrompt();
    hud.showFooter();
    armAudioOnce();
  }

  // Analytics is a separate concern from the prompt: a session can end
  // (finish, Restart, or the page being hidden) independently of whether
  // this is the build attempt's first scroll, so this qualifying scroll
  // starts a fresh session whenever none is active, regardless of
  // hasScrolledOnce. firstInputKind now describes this new session's own
  // first scroll, not the build attempt's.
  if (!sessionActive) {
    sessionActive = true;
    firstInputKind = kind;
    sessionPeakYears = sim.years;
    analytics.start({
      ageYears: profile.ageYears,
      homeMeters: profile.homeMeters,
      colorId: profile.colorId,
      soundOn: soundEnabled,
      inputKind: firstInputKind,
      viewportW: view.widthCss,
      viewportH: view.heightCss,
      deviceKind: deriveDeviceKind(navigator.userAgent, view.widthCss, hasTouch),
      browserFamily: deriveBrowserFamily(navigator.userAgent),
    });
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
// build can begin; the scroll handler above ignores input while this is
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

// Canvas labels are set in Patrick Hand (src/render/stage.ts); if that font
// is still loading when the first frame paints, the browser falls back to
// the generic cursive stack for that draw. document.fonts.ready resolves
// once every requested font has finished loading (or failed), so this
// forces one more redraw right after, which is enough to pick up the real
// font even if it wasn't ready in time for the very first paint.
void document.fonts.ready.then(() => {
  needsRender = true;
});

let lastTimeMs: number | null = null;

function frame(timeMs: number): void {
  if (lastTimeMs === null) lastTimeMs = timeMs;
  const dtSeconds = (timeMs - lastTimeMs) / 1000;
  lastTimeMs = timeMs;

  const before = sim;
  sim = step(before, dtSeconds, reducedMotionQuery.matches);

  // The audio rate is derived from how much years actually moved this
  // frame, not from a tracked scroll speed — direction doesn't matter, so
  // undo ticks and hums too.
  const yearsDelta = Math.abs(sim.years - before.years);
  const rate = dtSeconds > 0 ? yearsDelta / dtSeconds : 0;

  // Both calls are safe no-ops before enable() has run — the AudioContext is
  // created lazily and enable() must be called from a user gesture.
  if (!sim.done) {
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

  // The peak only ever rises, even while an undo pulls sim.years back down,
  // so beats fire once each on the way past and are never replayed by a
  // later undo-then-rebuild.
  const prevPeak = peakYears;
  peakYears = Math.max(peakYears, sim.years);
  if (sessionActive) sessionPeakYears = Math.max(sessionPeakYears, sim.years);
  for (const beat of beatsCrossed(prevPeak, peakYears)) {
    beatCards.show(beat);
    audio.chime();
  }

  if (sim.done && !before.done) {
    beatCards.clear();
    endScreen.show(profile);
    audio.finish();
    endSession(true);
  }

  // The "next up" teaser: the first time landmark not yet passed. Cheap
  // enough to check every frame regardless of needsRender — it only calls
  // into the HUD when the identity (id + years) actually changes.
  const nextEvent = timeEvents.find((t) => t.years > sim.years) ?? null;
  const nextKey = nextEvent ? `${nextEvent.id}:${nextEvent.years}` : null;
  if (nextKey !== lastNextKey) {
    lastNextKey = nextKey;
    hud.setNext(nextEvent ? `${nextEvent.label} · ${fmtYears(nextEvent.years)}` : null);
  }

  // Idle frame: years/done didn't change this step, and no compaction
  // transition is running (in either the previous or the new state).
  // Redrawing would produce pixel-identical output, so skip it — the rAF
  // loop keeps going regardless, ready for the next input.
  const simAdvancing = sim.years !== before.years || sim.done !== before.done;
  const compactionActive = sim.compaction.transition !== null || before.compaction.transition !== null;

  if (needsRender || simAdvancing || compactionActive) {
    const placed = placeLandmarks(landmarks, heightM(sim), pxPerMeter(sim.compaction), stageBox(view));
    drawStage(ctx, view, sim, placed, ICONS, colorById(profile.colorId));
    hud.update(sim);
    hud.setComparisons({
      tall: tallerThan(heightM(sim), landmarks),
      ago: beforePhraseFor(sim.years, BEATS, profile.ageYears),
    });
    needsRender = false;
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
