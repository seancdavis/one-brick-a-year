// The compact menu: one paper tab in the HUD's top-right corner, under the
// "next up" teaser, that opens a small paper panel holding everything that
// used to be its own row of controls — sound, "my facts", restart, and the
// color chips (docs/autopilot/2026-09-06-popups-and-menu.md's "Compact
// menu"). DOM glue only; the color palette itself lives in
// src/lib/lego-colors.ts and is drawn by the shared src/color-picker.ts.

import { createColorPicker } from './color-picker';

const MENU_SWATCH_SIZE_PX = 18;

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

// The tab's own glyph: three horizontal strokes in a 16px box, drawn as
// strokes (not a filled cut-paper shape) so it reads at a glance as "more"
// rather than borrowing a landmark icon's look.
function menuGlyph(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'menu-glyph');
  for (const y of [3, 8, 13]) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', '1');
    line.setAttribute('y1', String(y));
    line.setAttribute('x2', '15');
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    svg.append(line);
  }
  return svg;
}

export function createMenu(
  root: HTMLElement,
  opts: {
    onSound(): void;
    onRestart(): void;
    onScrapbook(): void;
    colorId: () => string;
    onColorSelect: (colorId: string) => void;
    soundOn: () => boolean;
    // Read only when the panel opens, never while the menu is being built:
    // src/main.ts's scrapbook is what answers it, and nothing here may reach
    // for a collaborator before every module has been constructed.
    factCount: () => number;
  },
): { setSound(on: boolean): void; close(): void } {
  const wrap = el('div', 'menu');

  const tab = el('button', 'menu-tab');
  tab.type = 'button';
  tab.setAttribute('aria-haspopup', 'true');
  tab.setAttribute('aria-expanded', 'false');
  tab.append(menuGlyph());
  const tabLabel = el('span', 'menu-tab-label');
  tabLabel.textContent = 'menu';
  tab.append(tabLabel);

  const panel = el('div', 'menu-panel');
  panel.hidden = true;
  // A tap or drag on the panel's own padding must not be read as a scroll
  // gesture (src/input.ts's data-scroll-ignore) — the buttons inside are
  // already excluded on their own.
  panel.setAttribute('data-scroll-ignore', '');

  const soundButton = el('button', 'menu-item');
  soundButton.type = 'button';
  soundButton.setAttribute('aria-pressed', 'false');

  const factsButton = el('button', 'menu-item');
  factsButton.type = 'button';

  const restartButton = el('button', 'menu-item');
  restartButton.type = 'button';
  restartButton.textContent = 'restart';

  const colorPicker = createColorPicker(MENU_SWATCH_SIZE_PX, opts.colorId(), (colorId) => {
    opts.onColorSelect(colorId);
  });
  colorPicker.el.classList.add('color-picker--compact');

  panel.append(soundButton, factsButton, restartButton, colorPicker.el);
  wrap.append(tab, panel);
  root.append(wrap);

  let soundOn = opts.soundOn();

  function paintSound(): void {
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.textContent = soundOn ? 'sound on' : 'sound off';
  }

  // The count is asked for at open time rather than mirrored here: the panel
  // is the only place it shows, so there is nothing to keep in sync between
  // opens and no second copy of the scrapbook's own tally.
  function paintFacts(): void {
    const count = opts.factCount();
    factsButton.textContent = `my facts · ${count}`;
    factsButton.disabled = count === 0;
    factsButton.classList.toggle('menu-item--disabled', count === 0);
  }

  paintSound();

  function onDocPointerDown(event: PointerEvent): void {
    if (wrap.contains(event.target as Node)) return;
    close();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  }

  function open(): void {
    if (!panel.hidden) return;
    // Re-sync to whatever changed while the panel was closed — a Restart trip
    // through the start screen can change the color, and the build can have
    // collected more facts, without this menu ever hearing about it directly.
    // The panel's own position is CSS's job (.menu-panel in src/style.css
    // hangs it off the .menu container), so nothing is measured here.
    colorPicker.setSelected(opts.colorId());
    paintFacts();
    panel.hidden = false;
    tab.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onKeydown);
    soundButton.focus();
  }

  function close(): void {
    if (panel.hidden) return;
    panel.hidden = true;
    tab.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDocPointerDown);
    document.removeEventListener('keydown', onKeydown);
    tab.focus();
  }

  tab.addEventListener('click', () => {
    if (panel.hidden) open();
    else close();
  });

  soundButton.addEventListener('click', () => {
    opts.onSound();
  });

  // Closed before the scrapbook opens (not after) so focus lands in the
  // scrapbook's own panel rather than being yanked back to this tab.
  factsButton.addEventListener('click', () => {
    close();
    opts.onScrapbook();
  });

  restartButton.addEventListener('click', () => {
    close();
    opts.onRestart();
  });

  return {
    setSound(on: boolean) {
      soundOn = on;
      paintSound();
    },
    close,
  };
}
