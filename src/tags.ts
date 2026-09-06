// Paper tags: the facts, hanging off the bricks they belong to. When the
// stack passes a time event its muted canvas label goes away
// (src/render/stage.ts) and a tag flips out of the tower here, with a soft
// pop and a nudge. Tags are HTML rather than canvas so they can be tapped,
// focused, and animated with CSS; they are positioned every rendered frame
// from the models in src/lib/tags.ts and the stage's own geometry
// (src/render/stage.ts's stageGeometry), so they move with the stack and fold
// into bundles when it compacts. DOM glue only — the grouping math is pure
// and lives in src/lib/tags.ts.

import { fmtYears } from './lib/format';
import { fillTokens, type Personalization } from './lib/personalize';
import type { Beat } from './lib/beats';
import type { TagModel } from './lib/tags';
import type { StageGeometry } from './render/stage';

// The stage numbers a tag needs. Same shape stageGeometry returns, so
// src/main.ts hands the tag layer exactly what the canvas just drew with.
export type TagGeometry = StageGeometry;

// A tag's own box, once it has been placed. src/main.ts reads these on narrow
// viewports, where a tag clamped back over the tower can crowd the left
// side's labels: the left labels give way (see occupiedBands below).
export interface TagBand {
  top: number;
  bottom: number;
}

export interface Tags {
  update(models: TagModel[], geometry: TagGeometry): void;
  occupiedBands(): TagBand[];
  clear(): void;
}

const TAG_WIDTH_PX = 220;
const TAG_WIDTH_NARROW_PX = 160;

// The tag's left edge sits this far right of the stack's edge; the dashed
// stub bridges the gap back to the tower.
const STUB_GAP_PX = 14;

// Minimum clear space between two stacked tags — placeLandmarks' idea
// (src/lib/layout.ts), with the gap measured from the rendered tag height
// rather than a guessed line height.
const TAG_GAP_PX = 8;

// Never let a tag touch the viewport's edge.
const VIEWPORT_MARGIN_PX = 8;

interface TagRecord {
  el: HTMLDivElement;
  paper: HTMLButtonElement;
  title: HTMLSpanElement;
  line: HTMLSpanElement;
  years: HTMLSpanElement;
  model: TagModel;
  // Cached offsetHeight, plus what it was measured against: a tag's content
  // never changes once built, so it is measured once rather than every frame
  // — but it has to be measured again if the width changed (a resize across
  // the narrow breakpoint) or if the hand-lettered fonts hadn't loaded yet
  // when it was first built.
  heightPx: number;
  measuredWidthPx: number;
  measuredFontsReady: boolean;
  band: TagBand | null;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// fmtYears says "1 years" for the birthday brick, which is right for a
// landmark label ("... · 1 years") but wrong in a sentence.
function yearsAgo(years: number): string {
  return Math.round(years) === 1 ? '1 year ago' : `${fmtYears(years)} ago`;
}

// One tag per group of events, so an element survives from frame to frame
// exactly as long as its group does: on a compaction two tags' keys vanish
// and the merged bundle's key appears, which is what makes the bundle show up
// in place, with no second pop.
function keyOf(model: TagModel): string {
  return model.events.map((e) => e.id).join('|');
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function createTags(
  root: HTMLElement,
  opts: { onPop(): void; onNudge(): void; profile: () => Personalization },
): Tags {
  const layer = el('div', 'tag-layer');
  root.append(layer);

  // The opened fact, centered: the same paper note, listing one fact for a
  // single tag and every fact in the brick for a bundle.
  const backdrop = el('div', 'tag-card-backdrop');
  backdrop.hidden = true;
  const card = el('div', 'tag-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', 'fact');
  const cardFacts = el('div', 'tag-card-facts');
  const cardClose = el('button', 'tag-card-close');
  cardClose.type = 'button';
  cardClose.textContent = 'close';
  card.append(cardFacts, cardClose);
  backdrop.append(card);
  root.append(backdrop);

  // Tag copy is set in Patrick Hand and Fredoka; a tag built before those
  // land measures at the fallback's height, so every tag is measured once
  // more after the fonts are ready.
  let fontsReady = false;
  void document.fonts.ready.then(() => {
    fontsReady = true;
  });

  const records = new Map<string, TagRecord>();
  // Every event that has ever had a tag in this build. Scrolling back below
  // an event drops its tag; scrolling forward again brings it back without a
  // second pop, because its id is still in here. Restart empties it.
  const seen = new Set<string>();
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

  function openCard(model: TagModel, source: HTMLElement): void {
    const profile = opts.profile();
    cardFacts.replaceChildren(
      ...model.events.map((beat: Beat) => {
        const fact = el('div', 'tag-fact');
        const title = el('div', 'tag-card-title');
        title.textContent = beat.title;
        const line = el('div', 'tag-card-line');
        line.textContent = fillTokens(beat.line, profile);
        const years = el('div', 'tag-card-years');
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

  function fillTag(record: TagRecord, model: TagModel): void {
    const profile = opts.profile();
    // Ascending by years, so events[0] is the newest thing in this brick —
    // the one a bundle is named after.
    const newest = model.events[0];
    record.title.textContent = newest.title;
    record.line.textContent =
      model.kind === 'bundle' ? `and ${model.events.length - 1} more` : fillTokens(newest.line, profile);
    record.years.textContent = yearsAgo(newest.atYears);
    record.paper.setAttribute(
      'aria-label',
      model.kind === 'bundle' ? `${newest.title} and ${model.events.length - 1} more facts` : newest.title,
    );
  }

  function createRecord(model: TagModel, animate: boolean): TagRecord {
    const container = el('div', 'tag');
    const stub = el('span', 'tag-stub');
    stub.setAttribute('aria-hidden', 'true');

    const paper = el('button', 'tag-paper');
    paper.type = 'button';
    const title = el('span', 'tag-title');
    const line = el('span', 'tag-line');
    const years = el('span', 'tag-years');
    paper.append(title, line, years);
    container.append(stub, paper);
    if (animate) container.classList.add('tag--enter');
    if (model.kind === 'bundle') container.classList.add('tag--bundle');

    const record: TagRecord = {
      el: container,
      paper,
      title,
      line,
      years,
      model,
      heightPx: 0,
      measuredWidthPx: 0,
      measuredFontsReady: false,
      band: null,
    };
    paper.addEventListener('click', () => openCard(record.model, paper));
    fillTag(record, model);
    layer.append(container);
    return record;
  }

  return {
    update(models: TagModel[], geometry: TagGeometry) {
      const widthPx = geometry.narrow ? TAG_WIDTH_NARROW_PX : TAG_WIDTH_PX;
      const reduced = prefersReducedMotion();

      // Tags off the top of the viewport are dropped rather than drawn where
      // nobody can see them; their events still count as seen below, so
      // coming back down doesn't set off a burst of pops.
      const anchorFor = (model: TagModel) => geometry.groundY - model.bricksFromGround * geometry.courseHeightPx;
      const visible = models.filter((m) => anchorFor(m) >= 0);
      const wanted = new Map(visible.map((m) => [keyOf(m), m] as const));

      // A tag whose event is no longer passed (or whose group has merged or
      // split) goes immediately, with no animation.
      for (const [key, record] of records) {
        if (!wanted.has(key)) {
          record.el.remove();
          records.delete(key);
        }
      }

      // One pop and one nudge per frame at most, however many tags arrived:
      // a fast scroll through the dense first century crosses several events
      // in a single step, and a burst of pops reads as noise.
      let popped = false;
      for (const [key, model] of wanted) {
        const existing = records.get(key);
        if (existing) {
          existing.model = model;
          continue;
        }
        const isNew = model.events.some((e) => !seen.has(e.id));
        records.set(key, createRecord(model, isNew && !reduced));
        if (isNew && !popped) {
          popped = true;
          opts.onPop();
          if (!reduced) opts.onNudge();
        }
      }

      // Every event with a model this frame counts as seen, visible or not.
      for (const model of models) {
        for (const event of model.events) seen.add(event.id);
      }

      // Width first, then one batch of height reads, then the positions: the
      // rendered height is what the stacking gap is measured from, and a tag
      // has to be at its final width before it can be measured.
      const placed: TagRecord[] = [];
      for (const key of wanted.keys()) {
        const record = records.get(key);
        if (!record) continue;
        if (record.measuredWidthPx !== widthPx) record.el.style.width = `${widthPx}px`;
        placed.push(record);
      }
      for (const record of placed) {
        if (record.measuredWidthPx !== widthPx || record.measuredFontsReady !== fontsReady) {
          record.heightPx = record.el.offsetHeight;
          record.measuredWidthPx = widthPx;
          record.measuredFontsReady = fontsReady;
        }
      }

      // Left edge 14px right of the stack, pulled back in when the viewport
      // is too narrow to fit the whole tag there.
      const layerWidth = layer.clientWidth || window.innerWidth;
      const left = Math.max(
        VIEWPORT_MARGIN_PX,
        Math.min(geometry.stackRightX + STUB_GAP_PX, layerWidth - VIEWPORT_MARGIN_PX - widthPx),
      );
      const stubWidth = Math.max(0, left - geometry.stackRightX);

      // Only a tag that had to be clamped back over the tower can reach the
      // left side's labels; one sitting clear of the stack never does, so it
      // reports no band and the left labels stay put.
      const crowdsLeft = left < geometry.stackRightX;

      // Ascending bricks is descending y, so walking from the ground up lets
      // each tag push against the one just placed below it — placeLandmarks'
      // rule (src/lib/layout.ts), with the gap taken from the measured
      // heights.
      placed.sort((a, b) => a.model.bricksFromGround - b.model.bricksFromGround);
      // Seeding the chain at the ground line makes the ground itself the
      // first thing to push against, so a tag hanging off brick 0 (every
      // event older than one drawn brick, once the tower has compacted) sits
      // on the ground rather than half-buried in the hill.
      let previousTop = geometry.groundY + TAG_GAP_PX;
      for (const record of placed) {
        const anchorY = anchorFor(record.model);
        const top = Math.min(anchorY - record.heightPx / 2, previousTop - TAG_GAP_PX - record.heightPx);
        previousTop = top;

        record.el.style.left = `${Math.round(left)}px`;
        record.el.style.top = `${Math.round(top)}px`;
        record.el.style.setProperty('--stub-w', `${Math.round(stubWidth)}px`);
        record.band = crowdsLeft ? { top, bottom: top + record.heightPx } : null;
      }
    },

    occupiedBands() {
      const bands: TagBand[] = [];
      for (const record of records.values()) {
        if (record.band) bands.push(record.band);
      }
      return bands;
    },

    clear() {
      closeCard();
      for (const record of records.values()) record.el.remove();
      records.clear();
      seen.clear();
    },
  };
}
