// Popups and pins: the facts, hanging off the bricks they belong to. At most
// one popup is open per side — one time event on the right, one physical
// thing on the left — and everything older is collapsed to a small paper pin
// on its own brick that reopens on tap.
//
// HTML rather than canvas so a popup or pin can be tapped, focused, and
// animated with CSS; everything is positioned every rendered frame from the
// models src/lib/popups.ts assembles and the stage's own geometry
// (src/render/stage.ts's stageGeometry), so it moves with the stack and folds
// into bundles when it compacts. DOM glue only — the grouping math is pure
// and lives in src/lib/popups.ts.

import { fmtInt, fmtMeters, yearsAgo } from './lib/format';
import type { Beat } from './lib/beats';
import { ICON_PATHS, type IconId } from './lib/icon-paths';
import type { PaperColor, ThingLandmark } from './lib/landmarks';
import { boxesIntersect, type OccupiedBox } from './lib/layout';
import { fillTokens, type Personalization } from './lib/personalize';
import type { PinModel, PopupModel, PopupSide } from './lib/popups';
import type { StageGeometry } from './render/stage';

type Side = 'left' | 'right';

// The two sides' models, exactly as src/lib/popups.ts's popupsFor returns
// them — this layer never re-derives which popup is open, it only draws it.
export interface PopupSides {
  right: PopupSide;
  left: PopupSide;
}

// The stage numbers a popup needs. Same shape stageGeometry returns, so
// src/main.ts hands this layer exactly what the canvas just drew with.
export type PopupGeometry = StageGeometry;

export interface Popups {
  // `newIds` is every fact or thing the stack crossed upward this frame
  // (src/main.ts derives it from the frame's own before/after state). It is
  // the sole arrival signal: an open popup whose item is in it has genuinely
  // just been passed, which earns the flip, the pop, and the tower's nudge.
  // Reopening a pin, a compaction regrouping bricks, and an undo dropping
  // back to an earlier fact all leave it empty.
  update(models: PopupSides, geometry: PopupGeometry, newIds: ReadonlySet<string>): void;
  // The open popups' paper boxes, in stage coordinates — src/main.ts passes
  // these to drawStage, which skips any upcoming landmark label that would
  // land inside one.
  occupiedBoxes(): OccupiedBox[];
  clear(): void;
}

const POPUP_WIDTH_PX = 220;
const POPUP_WIDTH_NARROW_PX = 160;
// Below this a popup is too cramped to read, so the side gives up on one
// altogether and shows its open item as a pin instead — which is what keeps
// the two sides' popups off each other and off the tower on a narrow screen.
const POPUP_MIN_WIDTH_PX = 120;

// A 28 px paper square holding the landmark's icon at 20 px, or — for a
// bundle — a count badge in its place.
const PIN_SIZE_PX = 28;
const PIN_ICON_PX = 20;

// The popup's (or pin's) near edge sits this far out from the stack's edge;
// the dashed stub bridges the gap back to the tower.
const STUB_GAP_PX = 14;

// Minimum clear space between two stacked pins, and between a popup and the
// ground line — placeLandmarks' idea (src/lib/layout.ts), with the gap
// measured from the rendered height rather than a guessed line height.
const PIN_GAP_PX = 6;
const POPUP_GAP_PX = 8;

// The stub's first horizontal run, measured out from the tower edge, before
// it jogs vertically toward the paper — see the elbow-connector comment on
// .stub in src/style.css.
const STUB_ELBOW_OUT_PX = 6;

// Never let a popup or pin touch the viewport's edge.
const VIEWPORT_MARGIN_PX = 8;

// How long the outgoing popup takes to scale down into its pin. Must match
// the .popup--collapse transition in src/style.css.
const COLLAPSE_MS = 200;

const SVG_NS = 'http://www.w3.org/2000/svg';

interface PopupRecord {
  key: string;
  side: Side;
  el: HTMLDivElement;
  model: PopupModel;
  // Cached offsetHeight, plus what it was measured against: a popup's content
  // never changes once built, so it is measured once rather than every frame
  // — but it has to be measured again if the width changed (a resize, or a
  // side's room shrinking) or if the hand-lettered fonts hadn't loaded yet
  // when it was first built.
  heightPx: number;
  measuredWidthPx: number;
  measuredFontsReady: boolean;
  box: OccupiedBox | null;
}

interface PinRecord {
  key: string;
  side: Side;
  el: HTMLDivElement;
  model: PinModel;
}

// One paper note's worth of copy, shared by a popup and by a line of a bundle
// pin's list, so an event and a thing read the same way wherever they appear.
interface Note {
  title: string;
  line: string;
  meta: string;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

// The one item an open popup stands for: an event on the right, a thing on
// the left.
function popupId(model: PopupModel): string {
  return model.side === 'right' ? model.event.id : model.thing.id;
}

// One element per open item, so it survives from frame to frame exactly as
// long as that item stays open: a different fact opening replaces the
// element, which is what plays the collapse and the flip. The side is part of
// the key so the two sides can never collide.
function popupKey(side: Side, model: PopupModel): string {
  return `${side}|${popupId(model)}`;
}

// Every member of a pin's brick: its events (right) or its things (left),
// ascending, exactly as src/lib/popups.ts grouped them — widened to the one
// type both sides can be walked as.
function pinMembers(model: PinModel): (Beat | ThingLandmark)[] {
  return model.members;
}

// Every id a pin stands for, sorted. This is the pin's DOM key, so a
// compaction that changes which facts share a brick rebuilds the pin — an
// icon becoming a count badge, or back — while a pin whose membership is
// unchanged keeps its element and merely moves.
function pinKey(side: Side, model: PinModel): string {
  return `${side}|${pinMembers(model)
    .map((m) => m.id)
    .sort()
    .join('|')}`;
}

// A pin's representative: the most recently passed event, or the tallest
// thing — both lists arrive ascending, so both are the last entry, and a pin
// always has at least one. It is what a single pin wears as its icon and
// answers to by name.
function pinLead(model: PinModel): Beat | ThingLandmark {
  const members = pinMembers(model);
  return members[members.length - 1];
}

function paperOf(model: PinModel): PaperColor {
  return pinLead(model).paper;
}

function iconOf(model: PinModel): IconId {
  return pinLead(model).icon;
}

// A landmark icon as a flat, single-color silhouette, from the same 24×24
// path data the canvas draws with (src/lib/icon-paths.ts) — the pin is that
// icon in paper form, so the two can never drift apart.
function iconSvg(icon: IconId): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(PIN_ICON_PX));
  svg.setAttribute('height', String(PIN_ICON_PX));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[icon]);
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('fill-rule', 'evenodd');
  svg.append(path);
  return svg;
}

// The elbow connector back to the true brick, shared by popups and pins: the
// stub runs out from the tower's edge, jogs vertically to the paper's
// mid-line, and meets it. `towerEdgeX` is the tower edge measured from the
// paper's own left edge (so it doubles as the flip's hinge, however far the
// paper has been pushed), `stubW` the length of the gap between them.
function setStub(node: HTMLElement, towerEdgeX: number, stubW: number, anchorYRel: number, heightPx: number): void {
  const outW = Math.min(STUB_ELBOW_OUT_PX, stubW);
  const centerYRel = heightPx / 2;
  node.style.setProperty('--tower-edge-x', `${Math.round(towerEdgeX)}px`);
  node.style.setProperty('--stub-w', `${Math.round(stubW)}px`);
  node.style.setProperty('--stub-out-w', `${Math.round(outW)}px`);
  node.style.setProperty('--stub-anchor-y', `${Math.round(anchorYRel)}px`);
  node.style.setProperty('--stub-elbow-top', `${Math.round(Math.min(anchorYRel, centerYRel))}px`);
  node.style.setProperty('--stub-elbow-h', `${Math.round(Math.abs(anchorYRel - centerYRel))}px`);
}

// The open item, rendered as a pin instead: what a side falls back to when it
// has no room for a readable popup (see POPUP_MIN_WIDTH_PX).
function openAsPin(model: PopupModel): PinModel {
  return model.side === 'right'
    ? { side: 'right', bricksFromGround: model.bricksFromGround, members: [model.event] }
    : { side: 'left', bricksFromGround: model.bricksFromGround, members: [model.thing] };
}

export function createPopups(
  root: HTMLElement,
  opts: {
    onPop(): void;
    onNudge(): void;
    profile: () => Personalization;
    // A pin was tapped and that one fact is now what the side is reading.
    onSelect(side: Side, id: string): void;
    // A pin's card was opened over the side instead — a bundle's list, or a
    // lone fact where there is no room to read it as a popup. The card is the
    // reading now, so the side closes what it had open behind it and shows
    // every one of its facts as a pin until the stack passes something new.
    onOpenCard(side: Side): void;
  },
): Popups {
  const layer = el('div', 'popup-layer');
  root.append(layer);

  // A bundle pin's list, centered: every fact sharing that brick, on the same
  // paper notes. Marked data-scroll-ignore (src/input.ts) so a wheel or drag
  // over it scrolls the card's own content instead of building or undoing the
  // tower. Shares its backdrop/panel/close-tab/fact-note CSS with the
  // scrapbook (src/scrapbook.ts) under common .modal-* class names — see
  // src/style.css's comment there.
  const backdrop = el('div', 'modal-backdrop');
  backdrop.hidden = true;
  backdrop.setAttribute('data-scroll-ignore', '');
  const card = el('div', 'popup-card modal-panel');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', 'facts');
  const cardFacts = el('div', 'popup-card-facts');
  const cardClose = el('button', 'modal-close');
  cardClose.type = 'button';
  cardClose.textContent = 'close';
  card.append(cardFacts, cardClose);
  backdrop.append(card);
  root.append(backdrop);

  // Announces each newly opened popup's title, on either side, as it flips
  // out of the tower, without moving focus — see docs/principles.md's
  // accessibility section. Never visible; screen readers only.
  const liveRegion = el('div', 'sr-only');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('role', 'status');
  root.append(liveRegion);

  // Popup copy is set in Patrick Hand and Fredoka; one built before those
  // land measures at the fallback's height, so every popup is measured once
  // more after the fonts are ready.
  let fontsReady = false;
  void document.fonts.ready.then(() => {
    fontsReady = true;
  });

  const open: Record<Side, PopupRecord | null> = { left: null, right: null };
  const pins = new Map<string, PinRecord>();
  // Outgoing popups still playing their collapse, so clear() can take them
  // with it rather than leaving one mid-animation over a fresh build.
  const collapsing = new Set<HTMLElement>();
  // Sides whose pin was tapped since the last update. A popup opened by a tap
  // flips out of the tower just as an arriving one does; one that merely
  // changed underneath us — a compaction folding facts into a bundle, an undo
  // dropping back to the previous fact — appears in place instead.
  const tapped = new Set<Side>();
  // Whether each side currently has room for a readable popup at all, kept
  // fresh by update() below. A pin tap reads it to decide between opening the
  // fact as a popup and opening its card — the pin outlives the frame that
  // built it, so this has to be the live answer rather than one baked in at
  // build time.
  const roomForPopup: Record<Side, boolean> = { left: false, right: false };

  let returnFocus: HTMLElement | null = null;

  function eventNote(beat: Beat): Note {
    return { title: beat.title, line: fillTokens(beat.line, opts.profile()), meta: yearsAgo(beat.atYears) };
  }

  // A thing's own brick count is rounded, not floored: the stack passes a
  // thing the moment it is tall enough, so the honest count is the nearest
  // whole brick to its height (a 5.5 m giraffe is 573 bricks, not 572).
  function thingNote(thing: ThingLandmark): Note {
    return {
      title: thing.label,
      line: thing.funLine ?? thing.tallerThanPhrase,
      meta: `${fmtMeters(thing.meters)} · ${fmtInt(Math.round(thing.years))} bricks`,
    };
  }

  // A bundle pin's whole list, in the order its members are stacked.
  function pinNotes(model: PinModel): Note[] {
    return pinMembers(model).map((member) => ('title' in member ? eventNote(member) : thingNote(member)));
  }

  function popupNote(model: PopupModel): Note {
    return model.side === 'right' ? eventNote(model.event) : thingNote(model.thing);
  }

  function closeCard(): void {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    document.removeEventListener('keydown', onCardKeydown);
    const target = returnFocus;
    returnFocus = null;
    if (target && target.isConnected) target.focus();
  }

  function onCardKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeCard();
    }
  }

  function openCard(notes: Note[], source: HTMLElement): void {
    cardFacts.replaceChildren(
      ...notes.map((note) => {
        const fact = el('div', 'modal-fact');
        const title = el('div', 'popup-card-title');
        title.textContent = note.title;
        const line = el('div', 'popup-card-line');
        line.textContent = note.line;
        const meta = el('div', 'popup-card-years');
        meta.textContent = note.meta;
        fact.append(title, line, meta);
        return fact;
      }),
    );

    returnFocus = source;
    backdrop.hidden = false;
    document.addEventListener('keydown', onCardKeydown);
    cardClose.focus();
  }

  cardClose.addEventListener('click', closeCard);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeCard();
  });

  function buildStub(): HTMLElement {
    const stub = el('span', 'stub');
    stub.setAttribute('aria-hidden', 'true');
    stub.append(el('span', 'stub-out'), el('span', 'stub-elbow'), el('span', 'stub-in'));
    return stub;
  }

  // The open popup: one fact's title, its line, and a muted third line — "N
  // years ago" for a time event, the thing's own height and brick count for a
  // physical comparison, which is the context the left side exists to give.
  // Not interactive: it is already showing everything it has.
  function createPopup(side: Side, model: PopupModel, animate: boolean): PopupRecord {
    const container = el('div', `popup hangs--${side}`);
    container.append(buildStub());

    const paper = el('div', 'popup-paper');
    const note = popupNote(model);
    const title = el('span', 'popup-title');
    title.textContent = note.title;
    const line = el('span', 'popup-line');
    line.textContent = note.line;
    const meta = el('span', 'popup-meta');
    meta.textContent = note.meta;
    paper.append(title, line, meta);

    container.append(paper);
    if (animate) container.classList.add('popup--enter');
    layer.append(container);

    return {
      key: popupKey(side, model),
      side,
      el: container,
      model,
      heightPx: 0,
      measuredWidthPx: 0,
      measuredFontsReady: false,
      box: null,
    };
  }

  // A pin: the same paper and drop as a popup, shrunk to a square holding the
  // landmark's icon — or, for a bundle, how many facts share the brick.
  //
  // Tapping a single pin opens its popup — unless the side has no room for
  // one (see POPUP_MIN_WIDTH_PX), in which case the tap opens that one fact's
  // card instead, so a pin on a narrow side is never a dead end. Tapping a
  // bundle always opens its whole list in that one tap, room or no, since
  // there is no single fact to open.
  function createPin(side: Side, model: PinModel): PinRecord {
    const container = el('div', `pin hangs--${side}`);
    container.append(buildStub());

    const count = pinMembers(model).length;
    const paper = el('button', `pin-paper pin-paper--${paperOf(model)}`);
    paper.type = 'button';
    if (count > 1) {
      const badge = el('span', 'pin-count');
      badge.textContent = String(count);
      paper.append(badge);
    } else {
      paper.append(iconSvg(iconOf(model)));
    }

    const lead = pinLead(model);
    const label = 'title' in lead ? lead.title : lead.label;
    paper.setAttribute('aria-label', count > 1 ? `${label} and ${count - 1} more facts` : label);

    container.append(paper);
    layer.append(container);

    const record: PinRecord = { key: pinKey(side, model), side, el: container, model };
    paper.addEventListener('click', () => {
      const members = pinMembers(record.model);
      if (members.length > 1 || !roomForPopup[side]) {
        openCard(pinNotes(record.model), paper);
        opts.onOpenCard(side);
        return;
      }
      tapped.add(side);
      opts.onSelect(side, pinLead(record.model).id);
    });
    return record;
  }

  // The outgoing popup scales down toward its brick and hands over to the pin
  // that has taken its place. Only when it actually still has a pin to become:
  // an undo that drops the fact off the tower altogether takes it immediately.
  function retire(record: PopupRecord, becomesPin: boolean, reduced: boolean): void {
    if (!becomesPin || reduced) {
      record.el.remove();
      return;
    }
    const node = record.el;
    node.classList.remove('popup--enter');
    node.classList.add('popup--collapse');
    collapsing.add(node);
    window.setTimeout(() => {
      collapsing.delete(node);
      node.remove();
    }, COLLAPSE_MS);
  }

  function removeAllCollapsing(): void {
    for (const node of collapsing) node.remove();
    collapsing.clear();
  }

  return {
    update(models: PopupSides, geometry: PopupGeometry, newIds: ReadonlySet<string>) {
      const reduced = prefersReducedMotion();
      const layerWidth = layer.clientWidth || window.innerWidth;

      // How much clear room a side has between the stack's edge (plus the
      // connector gap) and the viewport margin. A popup never takes more than
      // this, so the two sides' popups can neither overlap each other nor sit
      // over the tower; a side with less than POPUP_MIN_WIDTH_PX of it shows
      // its open item as a pin instead. Phone widths are best-effort — 768 px
      // portrait comfortably fits both.
      const roomFor = (side: Side) =>
        side === 'right'
          ? layerWidth - VIEWPORT_MARGIN_PX - (geometry.stackRightX + STUB_GAP_PX)
          : geometry.stackLeftX - STUB_GAP_PX - VIEWPORT_MARGIN_PX;
      const preferredWidth = geometry.narrow ? POPUP_WIDTH_NARROW_PX : POPUP_WIDTH_PX;
      // null means "no popup on this side, however much it wants one".
      const widthFor = (side: Side): number | null => {
        const room = roomFor(side);
        return room < POPUP_MIN_WIDTH_PX ? null : Math.min(preferredWidth, room);
      };

      // A pin hanging off a brick that has scrolled off the top of the
      // viewport is dropped rather than drawn where nobody can see it. An open
      // popup never is: it's the thing the page is currently saying, so on a
      // short viewport it clamps to the top edge and lets its connector run
      // off the screen to its true brick instead of disappearing.
      const anchorFor = (bricksFromGround: number) => geometry.groundY - bricksFromGround * geometry.courseHeightPx;
      const visible = (m: { bricksFromGround: number }) => anchorFor(m.bricksFromGround) >= 0;

      const openedTitles: string[] = [];
      const widths: Record<Side, number | null> = { left: null, right: null };
      let arrived = false;

      // One open popup per side (room permitting), and every other brick a pin.
      for (const side of ['right', 'left'] as Side[]) {
        const sideModels = models[side];
        const width = sideModels.open ? widthFor(side) : null;
        widths[side] = width;
        // Asked whether or not anything is open, since it is what a pin tap on
        // this side will read next.
        roomForPopup[side] = widthFor(side) !== null;
        // Whether the fact this side is showing crossed the stack this frame:
        // asked of the model, not of the element, so it reads the same whether
        // the side renders a popup or falls back to a pin.
        const isArrival = sideModels.open !== null && newIds.has(popupId(sideModels.open));
        arrived = arrived || isArrival;

        const wantOpen = width === null ? null : sideModels.open;
        const wantKey = wantOpen ? popupKey(side, wantOpen) : null;
        const wantPins = [
          ...sideModels.pins,
          ...(sideModels.open && width === null ? [openAsPin(sideModels.open)] : []),
        ].filter(visible);

        const current = open[side];
        if (current && current.key !== wantKey) {
          // Only animate the collapse when the outgoing fact really does live
          // on as a member of one of this side's pins; an undo that drops it
          // off the tower altogether takes it immediately.
          const outgoingId = popupId(current.model);
          const becomesPin = wantPins.some((p) => pinMembers(p).some((m) => m.id === outgoingId));
          retire(current, becomesPin, reduced);
          open[side] = null;
        }

        if (wantOpen && wantKey) {
          const existing = open[side];
          if (existing) {
            // Same item, new frame: only its brick can have moved.
            existing.model = wantOpen;
          } else {
            open[side] = createPopup(side, wantOpen, (isArrival || tapped.has(side)) && !reduced);
            openedTitles.push(popupNote(wantOpen).title);
          }
        } else if (isArrival && sideModels.open) {
          // No room for a popup on this side, so the arrival shows as a pin —
          // still worth announcing, since it is what the page just said.
          openedTitles.push(popupNote(sideModels.open).title);
        }

        // Pins: reconcile against the map, keyed by membership, so a pin only
        // ever churns when the facts sharing its brick really change.
        const wantedPins = new Map(wantPins.map((p) => [pinKey(side, p), p] as const));
        for (const [key, record] of pins) {
          if (record.side !== side) continue;
          if (!wantedPins.has(key)) {
            record.el.remove();
            pins.delete(key);
          }
        }
        for (const [key, model] of wantedPins) {
          const existing = pins.get(key);
          if (existing) {
            existing.model = model;
          } else {
            pins.set(key, createPin(side, model));
          }
        }
      }

      // Coalesced to one of each per frame, however many sides changed:
      // arriving at a fact pops and nudges the tower, reopening a pin doesn't.
      if (arrived) {
        opts.onPop();
        if (!reduced) opts.onNudge();
      }
      if (openedTitles.length > 0) liveRegion.textContent = openedTitles.join(', ');

      tapped.clear();

      // Width first, then the height reads, then the positions: the rendered
      // height is what a popup's own box is measured from, and it has to be
      // at its final width before it can be measured.
      for (const side of ['right', 'left'] as Side[]) {
        const record = open[side];
        const width = widths[side];
        if (!record || width === null) continue;
        if (record.measuredWidthPx !== width) record.el.style.width = `${width}px`;
      }
      for (const side of ['right', 'left'] as Side[]) {
        const record = open[side];
        const width = widths[side];
        if (!record || width === null) continue;
        if (record.measuredWidthPx !== width || record.measuredFontsReady !== fontsReady) {
          record.heightPx = record.el.offsetHeight;
          record.measuredWidthPx = width;
          record.measuredFontsReady = fontsReady;
        }
      }

      // Right side: near edge STUB_GAP_PX right of the stack. Left side: the
      // mirror image, the paper's right edge that far left of it. Widths are
      // already capped to each side's room, so neither has to be pulled back
      // over the tower.
      const nearLeftFor = (side: Side, width: number) =>
        side === 'right'
          ? Math.max(
              VIEWPORT_MARGIN_PX,
              Math.min(geometry.stackRightX + STUB_GAP_PX, layerWidth - VIEWPORT_MARGIN_PX - width),
            )
          : Math.min(
              layerWidth - VIEWPORT_MARGIN_PX - width,
              Math.max(VIEWPORT_MARGIN_PX, geometry.stackLeftX - STUB_GAP_PX - width),
            );
      // Signed offset from the paper's own left edge back to the tower's near
      // edge — the flip's hinge, and half of the stub's geometry.
      const towerEdgeFor = (side: Side, left: number) =>
        (side === 'right' ? geometry.stackRightX : geometry.stackLeftX) - left;
      // The bare gap the stub has to bridge: out to the right of the paper on
      // the left side, out to its left on the right side, zero once a narrow
      // viewport has clamped the paper back over the tower.
      const stubWidthFor = (side: Side, towerEdgeX: number, width: number) =>
        side === 'right' ? Math.max(0, -towerEdgeX) : Math.max(0, towerEdgeX - width);

      for (const side of ['right', 'left'] as Side[]) {
        const record = open[side];
        const width = widths[side];
        if (!record || width === null) continue;

        const left = nearLeftFor(side, width);
        const anchorY = anchorFor(record.model.bricksFromGround);
        // Centered on its own brick, but never sunk into the hill, and never
        // pushed off the top: the one open popup per side is the thing the
        // page is currently saying, so it always stays readable.
        const top = Math.max(
          VIEWPORT_MARGIN_PX,
          Math.min(anchorY - record.heightPx / 2, geometry.groundY - POPUP_GAP_PX - record.heightPx),
        );
        const towerEdgeX = towerEdgeFor(side, left);

        record.el.style.left = `${Math.round(left)}px`;
        record.el.style.top = `${Math.round(top)}px`;
        setStub(record.el, towerEdgeX, stubWidthFor(side, towerEdgeX, width), anchorY - top, record.heightPx);
        record.box = { side, x: left, y: top, w: width, h: record.heightPx };
      }

      // Pins stack per side from the ground up, each pushing against the one
      // just placed below it — placeLandmarks' rule (src/lib/layout.ts) — so
      // two pins on neighboring bricks never overlap. Seeding the chain at
      // the ground line makes the ground itself the first thing to push
      // against, so a pin on brick 0 sits on it rather than half-buried.
      for (const side of ['right', 'left'] as Side[]) {
        const sidePins = [...pins.values()]
          .filter((p) => p.side === side)
          .sort((a, b) => a.model.bricksFromGround - b.model.bricksFromGround);
        const left = nearLeftFor(side, PIN_SIZE_PX);
        const towerEdgeX = towerEdgeFor(side, left);
        const stubW = stubWidthFor(side, towerEdgeX, PIN_SIZE_PX);
        const box = open[side]?.box ?? null;

        let previousTop = geometry.groundY + PIN_GAP_PX;
        for (const record of sidePins) {
          const anchorY = anchorFor(record.model.bricksFromGround);
          const top = Math.min(anchorY - PIN_SIZE_PX / 2, previousTop - PIN_GAP_PX - PIN_SIZE_PX);
          previousTop = top;

          record.el.style.left = `${Math.round(left)}px`;
          record.el.style.top = `${Math.round(top)}px`;
          setStub(record.el, towerEdgeX, stubW, anchorY - top, PIN_SIZE_PX);

          // A popup takes precedence over the pins in its own band: rather
          // than shoving them aside, it simply covers them until it closes.
          record.el.hidden = box !== null && boxesIntersect({ x: left, y: top, w: PIN_SIZE_PX, h: PIN_SIZE_PX }, box);
        }
      }
    },

    occupiedBoxes() {
      const boxes: OccupiedBox[] = [];
      for (const side of ['right', 'left'] as Side[]) {
        const box = open[side]?.box;
        if (box) boxes.push(box);
      }
      return boxes;
    },

    clear() {
      closeCard();
      removeAllCollapsing();
      for (const side of ['right', 'left'] as Side[]) {
        open[side]?.el.remove();
        open[side] = null;
      }
      for (const record of pins.values()) record.el.remove();
      pins.clear();
      tapped.clear();
      liveRegion.textContent = '';
    },
  };
}
