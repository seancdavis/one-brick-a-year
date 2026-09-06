// The scrapbook: every fact the stack has reached this build, kept even after
// an undo drops the tag back off the tower (src/main.ts computes "collected"
// from the build's peak, never from the current, undo-able position). A paper
// tab in the HUD controls row ("my facts · N") opens a paper panel listing
// them newest first, each one a compact paper note in the same voice as an
// opened tag (src/tags.ts). DOM glue only — no state lives here beyond the
// last list src/main.ts handed in.

import { fmtYears } from './lib/format';
import { fillTokens, type Personalization } from './lib/personalize';
import type { Beat } from './lib/beats';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

// Mirrors src/tags.ts's yearsAgo: fmtYears says "1 years" for the birthday
// brick, which is right for a landmark label but wrong in a sentence.
function yearsAgo(years: number): string {
  return Math.round(years) === 1 ? '1 year ago' : `${fmtYears(years)} ago`;
}

export function createScrapbook(
  root: HTMLElement,
  opts: { profile: () => Personalization },
): { setCollected(events: readonly Beat[]): void; clear(): void } {
  const tab = el('button', 'hud-tab scrapbook-tab');
  tab.type = 'button';
  tab.setAttribute('aria-haspopup', 'dialog');
  tab.setAttribute('aria-expanded', 'false');

  const backdrop = el('div', 'scrapbook-backdrop');
  backdrop.hidden = true;
  const panel = el('div', 'scrapbook-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'my facts');

  const title = el('div', 'scrapbook-title');
  title.textContent = 'my facts';
  const list = el('div', 'scrapbook-list');
  const closeButton = el('button', 'scrapbook-close');
  closeButton.type = 'button';
  closeButton.textContent = 'close';

  panel.append(title, list, closeButton);
  backdrop.append(panel);
  root.append(tab, backdrop);

  let collected: readonly Beat[] = [];
  let returnFocus: HTMLElement | null = null;

  function paintTab(): void {
    const count = collected.length;
    tab.textContent = count === 0 ? 'my facts' : `my facts · ${count}`;
    tab.disabled = count === 0;
    tab.classList.toggle('hud-tab--disabled', count === 0);
  }

  // Newest first: the smallest atYears is the event the stack reached most
  // recently in real-world time.
  function paintList(): void {
    const ordered = [...collected].sort((a, b) => a.atYears - b.atYears);
    const profile = opts.profile();
    list.replaceChildren(
      ...ordered.map((beat) => {
        const note = el('div', 'scrapbook-note');
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
    returnFocus = tab;
    backdrop.hidden = false;
    tab.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKeydown);
    closeButton.focus();
  }

  function close(): void {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    tab.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    const target = returnFocus;
    returnFocus = null;
    if (target && target.isConnected) target.focus();
  }

  tab.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });

  paintTab();

  return {
    setCollected(events) {
      collected = events;
      paintTab();
    },
    clear() {
      close();
      collected = [];
      paintTab();
    },
  };
}
