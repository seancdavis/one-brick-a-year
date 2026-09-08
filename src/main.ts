import './style.css';
import { createAnalytics, deriveBrowserFamily, deriveDeviceKind } from './analytics';
import { createAudio } from './audio';
import { createEndScreen } from './end-screen';
import { createScrollInput, type ScrollKind } from './input';
import { createHud } from './hud';
import { createMenu } from './menu';
import { createScrapbook } from './scrapbook';
import { createStartScreen } from './start-screen';
import { createPopups } from './popups';
import { humFor, ticksPerSecond, SOUND_DEFAULT_ENABLED, SOUND_STORAGE_KEY } from './lib/audio-schedule';
import { beatsCrossed, buildBeats } from './lib/beats';
import { beforePhraseFor, tallerThan } from './lib/comparisons';
import { pxPerMeter } from './lib/compaction';
import { buildLandmarks, type Landmark, type ThingLandmark } from './lib/landmarks';
import {
  LABEL_METRICS,
  LABEL_METRICS_NARROW,
  placeLandmarks,
  stageTopFor,
  UPCOMING_PER_SIDE,
  visibleUpcoming,
} from './lib/layout';
import { popupsFor, selectionAfterArrivals, type PopupSelection } from './lib/popups';
import { colorById } from './lib/lego-colors';
import {
  hasPersonalizationKeys,
  mergeParams,
  parsePersonalization,
  serialize,
  shouldScrubUrl,
  STORAGE_KEY,
  type Personalization,
} from './lib/personalize';
import { applyScroll, heightM, initialSim, step } from './lib/sim';
import {
  BAND_PROMPT_TOP_PX,
  drawStage,
  groundY,
  nudge,
  nudgeActive,
  stageGeometry,
  TOP_MIN_PX,
  type StageView,
} from './render/stage';
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
// otherwise-idle frame (no active scroll, no compaction transition, nothing
// crossed) can skip the redraw. The rAF loop itself keeps running either way —
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

// The fragment (#age=8&home=8) never leaves the browser, so it never reaches
// a server log the way the query string does. Both can carry values at once
// (e.g. a share target appends its own query string on top of a hand-written
// fragment) — mergeParams keeps only the recognized keys and lets the
// fragment win per field over the query.
const query = new URLSearchParams(location.search);
const fragment = new URLSearchParams(location.hash.slice(1));
const params = mergeParams(query, fragment);
const storedRaw = readStoredProfile();
// Whether the URL actually asked for personalization — gates saving the
// parsed profile and skipping the mandatory first-run start screen below.
const hasUrlParams = hasPersonalizationKeys(params);
// Whether the address bar needs cleaning up: broader than hasUrlParams,
// since a URL carrying only a `name` key (an older or hand-edited link) has
// nothing mergeParams keeps, but the name still has to be scrubbed from the
// address bar and history rather than left sitting there. Checked against
// the raw query and fragment, not `params`, since mergeParams has already
// dropped `name` by the time it builds `params`.
const needsUrlScrub = shouldScrubUrl(query, fragment);

// The "thing" landmarks, for src/lib/popups.ts's popupsFor (the left side).
function thingsFrom(list: Landmark[]): ThingLandmark[] {
  return list.filter((l): l is ThingLandmark => l.kind === 'thing');
}

let profile = parsePersonalization(params, storedRaw);
// The time events for this profile: only "your whole life" moves with the
// age, but everything downstream (landmarks, cards, the footer) reads the
// same list so there is one source of truth per profile.
let beats = buildBeats(profile);
let landmarks = buildLandmarks(profile);
let things = thingsFrom(landmarks);

// URL params are applied and stored like any other source, but the page
// never writes anything personal back into the URL — "Copy link"
// (src/end-screen.ts) copies the bare page URL only.
if (hasUrlParams) {
  saveProfile(profile);
}
if (needsUrlScrub) {
  try {
    // location.pathname carries neither a hash nor a query string, so this
    // strips both forms at once — nothing personal lingers in the URL or
    // history.
    history.replaceState(null, '', location.pathname);
  } catch {
    // Some environments (e.g. a sandboxed iframe) block history mutation:
    // the params just stay in the visible URL in that case.
  }
}

const startScreen = createStartScreen(app, (nextProfile) => {
  profile = nextProfile;
  saveProfile(profile);
  // Rebuilds profile-derived content (beats, landmarks, things) — the running
  // sim (years, compaction) is left untouched, whether this came from the
  // mandatory first-run screen or a Restart.
  beats = buildBeats(profile);
  landmarks = buildLandmarks(profile);
  things = thingsFrom(landmarks);
  // No explicit push to the menu: its color chips re-read profile.colorId
  // (src/menu.ts's `colorId` opt) the next time the panel opens.
  startScreen.close();
  needsRender = true;
});

const audio = createAudio();
let soundEnabled = readStoredSound();

const analytics = createAnalytics();

const hud = createHud(app);

// The scrapbook: every fact the build has reached, kept even after an undo
// drops its popup off the tower — fed from peakYears below, never from
// sim.years itself. Opened from the menu's "my facts" item (menu.onScrapbook
// below); its panel mounts at the app root, same as the popup layer's
// bundle-pin card, so neither is trapped under the HUD's own stacking
// context.
//
// Constructed before the menu because the menu reads its count. Ordering rule
// for this file, guarded by src/main.order.test.ts: anything a create… call's
// arguments name must already be constructed above it. A callback that only
// ever runs from a later user interaction would survive a forward reference,
// but a callback a constructor invokes while building would hit the temporal
// dead zone — so the whole file keeps to construction order rather than
// asking which kind each callback is.
const scrapbook = createScrapbook(app, { profile: () => profile });

// The compact menu holds sound, facts, restart, and color controls.
const menu = createMenu(hud.menuSlot, {
  onSound: () => {
    soundEnabled = !soundEnabled;
    saveSound(soundEnabled);
    if (soundEnabled) {
      void audio.enable();
    } else {
      audio.disable();
    }
    menu.setSound(soundEnabled);
  },
  onRestart: () => restart(),
  onScrapbook: () => scrapbook.open(),
  colorId: () => profile.colorId,
  onColorSelect: (colorId) => {
    profile = { ...profile, colorId };
    saveProfile(profile);
    needsRender = true;
  },
  soundOn: () => soundEnabled,
  factCount: () => scrapbook.count(),
});

// Which popup is open on each side. 'latest' — the default, and where a side
// returns whenever the stack passes something new on it — means "whatever was
// passed most recently"; an id means a pin was tapped and that fact is being
// read instead. src/lib/popups.ts's popupsFor turns this into one open item
// per side, with pins for everything else on it.
let selection: PopupSelection = { right: 'latest', left: 'latest' };

// A pin-tapped id the tower no longer holds — an undo can take the very fact
// a pin had opened back off it, leaving that side with a selection nothing
// matches. 'latest' always resolves, so it is never stale.
function isStaleSelection(chosen: PopupSelection['right'], hasOpen: boolean): boolean {
  return chosen !== 'latest' && !hasOpen;
}

// The facts themselves: a popup flips out of the tower for every time event
// (right) and every physical thing (left) the stack passes, pops once, and
// nudges the tower as it goes; the popup it replaces collapses to a pin.
const popups = createPopups(app, {
  onPop: () => audio.pop(),
  onNudge: () => {
    nudge();
    needsRender = true;
  },
  profile: () => profile,
  onSelect: (side, id) => {
    selection = { ...selection, [side]: id };
    needsRender = true;
  },
});

const endScreen = createEndScreen(app, () => resetForReplay());

// Whether this device supports touch, for analytics' device-kind derivation
// (src/analytics.ts's deriveDeviceKind) — checked once, since it never
// changes over a session.
const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

let sim = initialSim();
// The current analytics session's own high-water mark, used for
// `yearsReached` in that session's end() payload: only ever rises, even
// while an undo pulls `sim.years` back down. Set to the sim's current years
// whenever a session starts (see createScrollInput below), so a session that
// starts after returning from a hidden page doesn't inherit an earlier
// session's peak.
let sessionPeakYears = 0;
// The build's own high-water mark, independent of the analytics session:
// unlike sessionPeakYears it is never reset by a session ending (Restart
// aside). It feeds the scrapbook and nothing else — whenever it advances,
// beatsCrossed (src/lib/beats.ts) between the previous peak and the new one
// is every beat the build has newly reached for the first time, which is
// exactly what the scrapbook collects. An undo that pulls sim.years back down
// takes a fact's popup off the tower (src/popups.ts is fed from sim.years
// directly) without forgetting that the build once reached it, since
// peakYears itself never drops.
//
// What the popups key off is deliberately *not* this: an arrival is an upward
// crossing this frame (see the frame loop below), so re-passing a fact after
// an undo opens it again, high-water mark or no.
let peakYears = 0;
// Whether the start screen has closed and any scroll has reached the stack
// — build or undo — since the last replay: the prompt/footer swap responds
// to either direction, since an undo scroll before anything's built still
// reads as "I touched it," even though applyScroll clamps it to nothing
// visible.
let hasInteracted = false;
// Whether a build-direction (negative page delta) scroll has happened since
// the last replay: gates the one-time audio arm, which should read as a
// deliberate "start building" gesture rather than any touch of the stack.
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

// Shared by "Build it again" (end screen) and Restart (HUD): back to a fresh,
// unstarted sim, with the prompt, the popups, and the scrapbook reset to
// match — resetting peakYears to 0 is what makes the next build's facts flip
// out (and pop, and collect) again: the very next peak advance finds every
// beat newly crossed. The analytics session itself is not ended here —
// "Build it again" only runs after finish, which already ended it (see the
// frame loop below), and Restart ends it itself before calling this.
// Clearing firstInputKind means the next session's first scroll gets its own
// input_kind, not a leftover from this one.
function resetForReplay(): void {
  endScreen.hide();
  popups.clear();
  scrapbook.clear();
  sim = initialSim();
  peakYears = 0;
  selection = { right: 'latest', left: 'latest' };
  tickAccumulator = 0;
  hasInteracted = false;
  hasScrolledOnce = false;
  firstInputKind = null;
  hud.setHasScrolled(false);
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

  // Any scroll counts as interaction, even one in the undo direction that
  // applyScroll clamps to nothing visible before anything's been built —
  // the prompt and footer respond to the first touch either way. This
  // happens once per build attempt (cleared by resetForReplay(), not by a
  // page hide) — hiding the page mid-build and coming back doesn't bring
  // the prompt back.
  if (!hasInteracted) {
    hasInteracted = true;
    hud.setHasScrolled(true);
  }

  // Only a build scroll (negative page delta) qualifies for analytics or
  // arming audio: it's the deliberate "start building" gesture, where an
  // undo scroll before anything has been built yet has nothing to report.
  if (deltaPx >= 0) return;

  if (!hasScrolledOnce) {
    hasScrolledOnce = true;
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

let view: StageView = { widthCss: 0, heightCss: 0, dpr: 1, narrow: false, footerPx: 0 };

// The stage's usable top, clear of the HUD's big number block: TOP_MIN_PX is
// the floor stageTopFor never drops below, so a stray zero-height reading
// before the HUD has laid out can't collapse the stage.
let stageTop = TOP_MIN_PX;

// The two real HUD measurements the stage is built around: how far the number
// block reaches down (the stage's top) and how tall the footer strip renders
// (the ground line sits a whole ground band above it, so the prompt and the
// legend in that band are never covered). Both are re-taken on resize and
// again once the hand-lettered fonts land, since either can change a block's
// rendered height.
function measureHud(): void {
  stageTop = stageTopFor([hud.numberBlockBottom()], TOP_MIN_PX);
  view = { ...view, footerPx: hud.footerHeight() };
  hud.setPromptTop(groundY(view) + BAND_PROMPT_TOP_PX);
  needsRender = true;
}

function resize(): void {
  const widthCss = window.innerWidth;
  const heightCss = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

  view = { widthCss, heightCss, dpr, narrow: widthCss < NARROW_BREAKPOINT_PX, footerPx: view.footerPx };
  canvas.width = Math.round(widthCss * dpr);
  canvas.height = Math.round(heightCss * dpr);
  measureHud();
  needsRender = true;
}

window.addEventListener('resize', resize);
resize();

// Canvas text is set in Patrick Hand (src/render/stage.ts); if that font is
// still loading when the first frame paints, the browser falls back to the
// generic cursive stack for that draw. document.fonts.ready resolves once
// every requested font has finished loading (or failed), so this forces one
// more redraw right after — and re-measures the HUD, whose own blocks are set
// in the same typefaces and settle to their real heights only then.
void document.fonts.ready.then(() => {
  measureHud();
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

  // The session's peak only ever rises, even while an undo pulls sim.years
  // back down. Nothing else keys off it: the popups read sim.years itself, so
  // scrolling back really does take a fact off the tower and put its muted
  // label back.
  if (sessionActive) sessionPeakYears = Math.max(sessionPeakYears, sim.years);

  // The build's own peak, independent of any analytics session: whenever it
  // advances, beatsCrossed is every beat the build has newly reached — handed
  // to the scrapbook to collect right away. Scrolling back never un-collects a
  // beat, even though its popup leaves the tower, since peakYears itself
  // never drops.
  const prevPeakYears = peakYears;
  peakYears = Math.max(peakYears, sim.years);
  if (peakYears > prevPeakYears) scrapbook.add(beatsCrossed(prevPeakYears, peakYears, beats));

  // What arrived *this frame*, on each side: the events the stack crossed
  // upward between the previous frame's years and this one's, and the things
  // it grew past between the two heights. Derived from the frame's own
  // before/after state rather than from peakYears, so undoing below a fact and
  // building back up to it opens, pops, and nudges all over again — which is
  // what a child scrolling back and forth expects.
  const beforeHeightM = heightM(before);
  const nowHeightM = heightM(sim);
  const arrivedEvents = sim.years > before.years ? beatsCrossed(before.years, sim.years, beats) : [];
  const arrivedThings =
    nowHeightM > beforeHeightM ? things.filter((t) => t.meters > beforeHeightM && t.meters <= nowHeightM) : [];
  // The arrival ids src/popups.ts reads as "this is genuinely new", which is
  // what earns the flip, the pop, and the tower's nudge.
  const newIds = new Set<string>([...arrivedEvents.map((e) => e.id), ...arrivedThings.map((t) => t.id)]);

  // Something new arriving takes that side back to its latest fact, whatever
  // the reader had there — a pin they had tapped open.
  selection = selectionAfterArrivals(selection, {
    right: arrivedEvents.length > 0,
    left: arrivedThings.length > 0,
  });

  if (sim.done && !before.done) {
    endScreen.show(profile);
    audio.finish();
    endSession(true);
  }

  // Idle frame: years/done didn't change this step, and no compaction
  // transition is running (in either the previous or the new state).
  // Redrawing would produce pixel-identical output, so skip it — the rAF
  // loop keeps going regardless, ready for the next input.
  const simAdvancing = sim.years !== before.years || sim.done !== before.done;
  const compactionActive = sim.compaction.transition !== null || before.compaction.transition !== null;

  if (needsRender || simAdvancing || compactionActive || nudgeActive()) {
    // popupsFor (src/lib/popups.ts) splits each side into one open popup and
    // a pin for every other drawn brick, keyed by `selection`.
    const popupArgs = {
      beats,
      things,
      years: sim.years,
      heightM: nowHeightM,
      compaction: sim.compaction,
    };
    let models = popupsFor({ ...popupArgs, selection });
    // Falling back to the latest keeps a popup open on a side whose selected
    // fact has gone, rather than a bare column of pins.
    const staleRight = isStaleSelection(selection.right, models.right.open !== null);
    const staleLeft = isStaleSelection(selection.left, models.left.open !== null);
    if (staleRight || staleLeft) {
      selection = {
        right: staleRight ? 'latest' : selection.right,
        left: staleLeft ? 'latest' : selection.left,
      };
      models = popupsFor({ ...popupArgs, selection });
    }

    // The popups are laid out before the canvas draws, so their measured
    // boxes are available to the stage below: an open popup owns its band,
    // and any upcoming label that would land inside it gives way.
    popups.update(models, stageGeometry(view, sim), newIds);

    const placed = placeLandmarks(
      landmarks,
      nowHeightM,
      pxPerMeter(sim.compaction),
      // The ground line comes from the stage; the top is the real HUD
      // measurement (measureHud above), so no canvas icon is ever placed
      // under the HUD's number block.
      { top: stageTop, ground: groundY(view) },
      view.narrow ? LABEL_METRICS_NARROW : LABEL_METRICS,
    );
    // Only the nearest few unpassed landmarks per side are ever drawn as
    // upcoming icons; passed ones stay in the list, holding their place in
    // the stacking chain while their pin does the marking (src/popups.ts).
    drawStage(
      ctx,
      view,
      sim,
      {
        left: visibleUpcoming(placed.left, UPCOMING_PER_SIDE),
        right: visibleUpcoming(placed.right, UPCOMING_PER_SIDE),
      },
      ICONS,
      colorById(profile.colorId),
      popups.occupiedBoxes(),
    );
    hud.update(sim);
    hud.setComparisons({
      tall: tallerThan(nowHeightM, landmarks),
      ago: beforePhraseFor(sim.years, beats, profile.ageYears),
    });
    needsRender = false;
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
