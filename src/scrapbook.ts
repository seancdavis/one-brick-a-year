// The scrapbook: every fact the stack has reached this build, kept even after
// an undo drops the popup back off the tower (src/main.ts hands over each
// newly crossed beat, from its peakYears high-water mark, the moment it
// crosses — never re-derived from sim.years, which an undo can pull back
// down). src/menu.ts's "my facts · N" item opens a paper panel listing them
// newest first, each one a compact paper note in the same voice as an opened
// popup (src/popups.ts). This module owns only the panel now — no tab of its
// own — mounted at the app root, never inside the HUD's own fixed-position
// stacking context, which would otherwise trap it underneath the popup layer
// (see src/style.css's .modal-backdrop comment). DOM glue only — no state
// lives here beyond what's been added.

import { yearsAgo } from './lib/format';
import { fillTokens, type Personalization } from './lib/personalize';
import type { Beat } from './lib/beats';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function createScrapbook(
  root: HTMLElement,
  opts: { profile: () => Personalization },
): { add(events: readonly Beat[]): void; clear(): void; open(): void; count(): number } {
  // A tap or drag on the panel's own padding or list must not reach the
  // window scroll listener and be mistaken for a build/undo gesture
  // (src/input.ts's data-scroll-ignore). Shares its backdrop/panel/
  // close-tab/fact-note CSS with an opened popup's card (src/popups.ts) under
  // common .modal-* class names.
  const backdrop = el('div', 'modal-backdrop');
  backdrop.hidden = true;
  backdrop.setAttribute('data-scroll-ignore', '');
  const panel = el('div', 'scrapbook-panel modal-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'my facts');

  const title = el('div', 'scrapbook-title');
  title.textContent = 'my facts';
  const list = el('div', 'scrapbook-list');
  const closeButton = el('button', 'modal-close');
  closeButton.type = 'button';
  closeButton.textContent = 'close';

  panel.append(title, list, closeButton);
  backdrop.append(panel);
  root.append(backdrop);

  // Ascending by atYears, since every addition arrives that way already
  // (beatsCrossed(prevPeak, peak) hands over one increasing slice at a time)
  // — which is also newest-first order: the smallest atYears is the event
  // the stack reached most recently in real-world time.
  let collected: Beat[] = [];
  let returnFocus: HTMLElement | null = null;

  function paintList(): void {
    const profile = opts.profile();
    list.replaceChildren(
      ...collected.map((beat) => {
        const note = el('div', 'modal-fact');
        const noteTitle = el('div', 'scrapbook-note-title');
        noteTitle.textContent = beat.title;
        const noteLine = el('div', 'scrapbook-note-line');
        noteLine.textContent = fillTokens(beat.line, profile);
        const noteYears = el('div', 'scrapbook-note-years');
        noteYears.textContent = yearsAgo(beat.atYears);
        note.append(noteTitle, noteLine, noteYears);
        return note;
      }),
    );
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  }

  function open(): void {
    if (collected.length === 0) return;
    paintList();
    // Whoever had focus when this was called — src/menu.ts's "my facts" item
    // moves focus back to its own tab before calling this, so that's what
    // gets it back once this panel closes.
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    backdrop.hidden = false;
    document.addEventListener('keydown', onKeydown);
    closeButton.focus();
  }

  function close(): void {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    document.removeEventListener('keydown', onKeydown);
    const target = returnFocus;
    returnFocus = null;
    if (target && target.isConnected) target.focus();
  }

  closeButton.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });

  return {
    add(events) {
      if (events.length === 0) return;
      collected = collected.concat(events);
    },
    clear() {
      close();
      collected = [];
    },
    open,
    count() {
      return collected.length;
    },
  };
}
