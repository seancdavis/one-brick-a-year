// Popups and pins: the facts, hanging off the bricks they belong to. At most
// one popup is open per side — the latest time event on the right, the latest
// physical thing on the left — and everything older is collapsed to a small
// paper pin on its own brick that reopens on tap
// (docs/autopilot/2026-09-06-popups-and-menu.md's "Popups and pins"). This
// replaces round 4's tag layer: a popup is the same flipped-out paper note a
// tag was, the pin is what a tag becomes once the next one arrives.
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
import type { PaperColor } from './lib/landmarks';
import { boxesIntersect, type OccupiedBox } from './lib/layout';
import { fillTokens, type Personalization } from './lib/personalize';
import type { PinModel, PopupModel, PopupSide } from './lib/popups';
import { bricksFor } from './lib/sim';
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
  update(models: PopupSides, geometry: PopupGeometry): void;
  // The open popups' paper boxes, in stage coordinates — src/main.ts passes
  // these to drawStage, which skips any upcoming landmark label that would
  // land inside one (round 5's overlap rule).
  occupiedBoxes(): OccupiedBox[];
  clear(): void;
}

const POPUP_WIDTH_PX = 220;
const POPUP_WIDTH_NARROW_PX = 160;

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
  // — but it has to be measured again if the width changed (a resize across
  // the narrow breakpoint) or if the hand-lettered fonts hadn't loaded yet
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

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

// One element per group, so it survives from frame to frame exactly as long
// as its group does: on a compaction two keys vanish and the merged bundle's
// key appears, which is what makes the bundle show up in place. The side is
// part of the key so the two sides can never collide.
function keyOf(side: Side, model: { events: Beat[]; thing?: { id: string } }): string {
  const inner = model.events.length > 0 ? model.events.map((e) => e.id).join('|') : (model.thing?.id ?? '');
  return `${side}|${inner}`;
}

// Every fact (or thing) id a group stands for — what "has this ever been on
// the tower before?" is asked of, so a bundle newly formed by a compaction
// out of facts already on the tower doesn't read as an arrival.
function idsOf(model: { events: Beat[]; thing?: { id: string } }): string[] {
  if (model.events.length > 0) return model.events.map((e) => e.id);
  return model.thing ? [model.thing.id] : [];
}

// The id src/main.ts stores as this side's selection when a pin is tapped —
// the first event's id (a bundle reopens as its whole group) or the thing's.
function selectionIdOf(model: { events: Beat[]; thing?: { id: string } }): string | null {
  if (model.events.length > 0) return model.events[0].id;
  return model.thing?.id ?? null;
}

function iconOf(model: { events: Beat[]; thing?: { icon: IconId } }): IconId | null {
  if (model.events.length > 0) return model.events[0].icon;
  return model.thing?.icon ?? null;
}

function paperOf(model: { events: Beat[]; thing?: { paper: PaperColor } }): PaperColor {
  if (model.events.length > 0) return model.events[0].paper;
  return model.thing?.paper ?? 'navy';
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

export function createPopups(
  root: HTMLElement,
  opts: {
    onPop(): void;
    onNudge(): void;
    profile: () => Personalization;
    onSelect(side: Side, id: string): void;
  },
): Popups {
  const layer = el('div', 'popup-layer');
  root.append(layer);

  // The opened fact, centered: the same paper note, listing one fact for a
  // single popup and every fact in the brick for a bundle — the right side's
  // "bundle list". Marked data-scroll-ignore (src/input.ts) so a wheel or
  // drag over it scrolls the card's own content instead of building or
  // undoing the tower. Shares its backdrop/panel/close-tab/fact-note CSS with
  // the scrapbook (src/scrapbook.ts) under common .modal-* class names — see
  // src/style.css's comment there.
  const backdrop = el('div', 'modal-backdrop');
  backdrop.hidden = true;
  backdrop.setAttribute('data-scroll-ignore', '');
  const card = el('div', 'popup-card modal-panel');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', 'fact');
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
  // Every id currently on the tower, as of the last update: an open popup
  // holding an id that isn't in here has genuinely just been passed, which is
  // what earns the pop, the nudge, and the tower's flip — reopening a pin, or
  // a compaction rebuilding a bundle out of facts already up there, does not.
  let knownIds = new Set<string>();
  // Outgoing popups still playing their collapse, so clear() can take them
  // with it rather than leaving one mid-animation over a fresh build.
  const collapsing = new Set<HTMLElement>();
  // Sides whose pin was tapped since the last update. A popup opened by a tap
  // flips out of the tower just as an arriving one does; one that merely
  // changed group underneath us — a compaction folding facts into a bundle,
  // an undo dropping back to the previous fact — appears in place instead.
  const tapped = new Set<Side>();

  let returnFocus: HTMLElement | null = null;

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

  function openCard(events: Beat[], source: HTMLElement): void {
    const profile = opts.profile();
    cardFacts.replaceChildren(
      ...events.map((beat: Beat) => {
        const fact = el('div', 'modal-fact');
        const title = el('div', 'popup-card-title');
        title.textContent = beat.title;
        const line = el('div', 'popup-card-line');
        line.textContent = fillTokens(beat.line, profile);
        const years = el('div', 'popup-card-years');
        years.textContent = yearsAgo(beat.atYears);
        fact.append(title, line, years);
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

  // The open popup: title, one line, and a muted third line — "N years ago"
  // for a time event, the thing's own height and brick count for a physical
  // comparison, which is the context the left side exists to give.
  function createPopup(side: Side, model: PopupModel, animate: boolean): PopupRecord {
    const container = el('div', `popup hangs--${side}`);
    container.append(buildStub());

    const isBundle = model.events.length > 1;
    const paper = side === 'right' ? el('button', 'popup-paper') : el('div', 'popup-paper');
    const title = el('span', 'popup-title');
    const line = el('span', 'popup-line');
    const meta = el('span', 'popup-meta');
    paper.append(title, line, meta);

    if (model.events.length > 0) {
      // Ascending by years, so events[0] is the newest fact in this brick —
      // the one a bundle is named after.
      const newest = model.events[0];
      title.textContent = newest.title;
      line.textContent = isBundle ? `and ${model.events.length - 1} more` : fillTokens(newest.line, opts.profile());
      meta.textContent = yearsAgo(newest.atYears);
      if (isBundle) container.classList.add('popup--bundle');
      const button = paper as HTMLButtonElement;
      button.type = 'button';
      button.setAttribute(
        'aria-label',
        isBundle ? `${newest.title} and ${model.events.length - 1} more facts` : newest.title,
      );
      button.addEventListener('click', () => openCard(model.events, button));
    } else if (model.thing) {
      const thing = model.thing;
      title.textContent = thing.label;
      line.textContent = thing.funLine ?? thing.tallerThanPhrase;
      meta.textContent = `${fmtMeters(thing.meters)} · ${fmtInt(bricksFor(thing.years))} bricks`;
    }

    container.append(paper);
    if (animate) container.classList.add('popup--enter');
    layer.append(container);

    return {
      key: keyOf(side, model),
      side,
      el: container,
      model,
      heightPx: 0,
      measuredWidthPx: 0,
      measuredFontsReady: false,
      box: null,
    };
  }

  function buildStub(): HTMLElement {
    const stub = el('span', 'stub');
    stub.setAttribute('aria-hidden', 'true');
    stub.append(el('span', 'stub-out'), el('span', 'stub-elbow'), el('span', 'stub-in'));
    return stub;
  }

  // A pin: the same paper and drop as a popup, shrunk to a square holding the
  // landmark's icon — or, for a bundle, how many facts share the brick.
  function createPin(side: Side, model: PinModel): PinRecord {
    const container = el('div', `pin hangs--${side}`);
    container.append(buildStub());

    const paper = el('button', `pin-paper pin-paper--${paperOf(model)}`);
    paper.type = 'button';
    const icon = iconOf(model);
    if (model.count > 1) {
      const badge = el('span', 'pin-count');
      badge.textContent = String(model.count);
      paper.append(badge);
    } else if (icon) {
      paper.append(iconSvg(icon));
    }

    const name = model.events.length > 0 ? model.events[0].title : (model.thing?.label ?? 'fact');
    paper.setAttribute('aria-label', model.count > 1 ? `${name} and ${model.count - 1} more facts` : name);

    container.append(paper);
    layer.append(container);

    const record: PinRecord = { key: keyOf(side, model), side, el: container, model };
    paper.addEventListener('click', () => {
      const id = selectionIdOf(record.model);
      if (!id) return;
      tapped.add(side);
      opts.onSelect(side, id);
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
    update(models: PopupSides, geometry: PopupGeometry) {
      const widthPx = geometry.narrow ? POPUP_WIDTH_NARROW_PX : POPUP_WIDTH_PX;
      const reduced = prefersReducedMotion();
      const layerWidth = layer.clientWidth || window.innerWidth;

      // A pin hanging off a brick that has scrolled off the top of the
      // viewport is dropped rather than drawn where nobody can see it. The
      // open popup never is: it's the thing the page is currently saying, so
      // on a short viewport it clamps to the top edge and lets its connector
      // run off the screen to its true brick instead of disappearing.
      const anchorFor = (bricksFromGround: number) => geometry.groundY - bricksFromGround * geometry.courseHeightPx;
      const visible = (m: { bricksFromGround: number }) => anchorFor(m.bricksFromGround) >= 0;

      const nextIds = new Set<string>();
      const openedTitles: string[] = [];
      let arrived = false;

      // One open popup per side, and every other group a pin.
      for (const side of ['right', 'left'] as Side[]) {
        const sideModels = models[side];
        const wantOpen = sideModels.open;
        const wantKey = wantOpen ? keyOf(side, wantOpen) : null;
        const wantPins = sideModels.pins.filter(visible);
        for (const model of [...(wantOpen ? [wantOpen] : []), ...wantPins]) {
          for (const id of idsOf(model)) nextIds.add(id);
        }

        const current = open[side];
        if (current && current.key !== wantKey) {
          retire(current, wantPins.some((p) => keyOf(side, p) === current.key), reduced);
          open[side] = null;
        }

        if (wantOpen && wantKey) {
          const existing = open[side];
          if (existing) {
            // Same group, new frame: only its brick can have moved.
            existing.model = wantOpen;
          } else {
            const isArrival = idsOf(wantOpen).some((id) => !knownIds.has(id));
            const flip = (isArrival || tapped.has(side)) && !reduced;
            open[side] = createPopup(side, wantOpen, flip);
            openedTitles.push(wantOpen.events[0]?.title ?? wantOpen.thing?.label ?? '');
            arrived = arrived || isArrival;
          }
        }

        // Pins: reconcile against the map, keyed the same way, so a pin only
        // ever churns when its group really changes.
        const wantedPins = new Map(wantPins.map((p) => [keyOf(side, p), p] as const));
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

      // Coalesced to one of each per frame, however many popups changed:
      // arriving at a fact pops and nudges the tower, reopening a pin doesn't.
      if (arrived) {
        opts.onPop();
        if (!reduced) opts.onNudge();
      }
      if (openedTitles.length > 0) liveRegion.textContent = openedTitles.filter(Boolean).join(', ');

      knownIds = nextIds;
      tapped.clear();

      // Width first, then the height reads, then the positions: the rendered
      // height is what a popup's own box is measured from, and it has to be
      // at its final width before it can be measured.
      for (const side of ['right', 'left'] as Side[]) {
        const record = open[side];
        if (!record) continue;
        if (record.measuredWidthPx !== widthPx) record.el.style.width = `${widthPx}px`;
      }
      for (const side of ['right', 'left'] as Side[]) {
        const record = open[side];
        if (!record) continue;
        if (record.measuredWidthPx !== widthPx || record.measuredFontsReady !== fontsReady) {
          record.heightPx = record.el.offsetHeight;
          record.measuredWidthPx = widthPx;
          record.measuredFontsReady = fontsReady;
        }
      }

      // Right side: near edge STUB_GAP_PX right of the stack. Left side: the
      // mirror image, the paper's right edge that far left of it. Either can
      // be pulled back toward the tower when the viewport is too narrow to
      // fit the whole thing there; the stub keeps it connected to its true
      // brick regardless.
      const nearLeftFor = (side: Side, width: number) =>
        side === 'right'
          ? Math.max(VIEWPORT_MARGIN_PX, Math.min(geometry.stackRightX + STUB_GAP_PX, layerWidth - VIEWPORT_MARGIN_PX - width))
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
        if (!record) continue;

        const left = nearLeftFor(side, widthPx);
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
        setStub(record.el, towerEdgeX, stubWidthFor(side, towerEdgeX, widthPx), anchorY - top, record.heightPx);
        record.box = { side, x: left, y: top, w: widthPx, h: record.heightPx };
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
          record.el.hidden =
            box !== null && boxesIntersect({ x: left, y: top, w: PIN_SIZE_PX, h: PIN_SIZE_PX }, box);
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
      knownIds = new Set<string>();
      tapped.clear();
      liveRegion.textContent = '';
    },
  };
}
