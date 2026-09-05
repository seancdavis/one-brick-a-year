// The HUD: the big years-ago number, the scroll prompt, the footer strip
// (how tall / how long ago, with comparison copy plugged in from outside),
// the "next up" teaser, and controls (the sound toggle, "restart", and the
// compact color swatch row).
// Look and copy match docs/design/picture-book.dc.html. DOM glue only.

import { createColorPicker } from './color-picker';
import { fmtInt, fmtMeters } from './lib/format';
import { bricksFor, heightM, initialSim, type SimState } from './lib/sim';

const HUD_SWATCH_SIZE_PX = 18;

export function createHud(
  root: HTMLElement,
  opts: { colorId: string; onSoundToggle: () => void; onRestart: () => void; onColorSelect: (colorId: string) => void },
): {
  update(sim: SimState): void;
  setHasScrolled(hasScrolled: boolean): void;
  setSound(enabled: boolean): void;
  setColor(colorId: string): void;
  setComparisons(c: { tall: string; ago: string }): void;
  setNext(text: string | null): void;
} {
  const big = document.createElement('div');
  big.className = 'hud-big';
  const yearsEl = document.createElement('div');
  yearsEl.className = 'hud-years';
  const agoLabel = document.createElement('div');
  agoLabel.className = 'hud-ago';
  agoLabel.textContent = 'years ago!';
  big.append(yearsEl, agoLabel);

  const teaser = document.createElement('div');
  teaser.className = 'hud-teaser';
  teaser.hidden = true;
  const teaserLabel = document.createElement('div');
  teaserLabel.className = 'hud-teaser-label';
  teaserLabel.textContent = 'next up';
  const teaserValue = document.createElement('div');
  teaserValue.className = 'hud-teaser-value';
  teaser.append(teaserLabel, teaserValue);

  const controls = document.createElement('div');
  controls.className = 'hud-controls';

  const tabs = document.createElement('div');
  tabs.className = 'hud-tabs';

  const soundButton = document.createElement('button');
  soundButton.type = 'button';
  soundButton.className = 'hud-tab';
  soundButton.setAttribute('aria-pressed', 'false');
  soundButton.textContent = 'sound';
  soundButton.addEventListener('click', opts.onSoundToggle);

  const restartButton = document.createElement('button');
  restartButton.type = 'button';
  restartButton.className = 'hud-tab';
  restartButton.textContent = 'restart';
  restartButton.addEventListener('click', opts.onRestart);

  tabs.append(soundButton, restartButton);

  const colorPicker = createColorPicker(HUD_SWATCH_SIZE_PX, opts.colorId, opts.onColorSelect);
  colorPicker.el.classList.add('color-picker--compact');

  controls.append(tabs, colorPicker.el);

  // Below 700px, the teaser and controls share one right-aligned column
  // (see .hud-side in src/style.css) so the controls flow beneath the
  // teaser's actual rendered height instead of a guessed fixed offset.
  const side = document.createElement('div');
  side.className = 'hud-side';
  side.append(teaser, controls);

  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.textContent = 'Scroll to build. Scroll back to undo.';

  const footer = document.createElement('div');
  footer.className = 'hud-footer';

  const leftCell = document.createElement('div');
  leftCell.className = 'hud-footer-cell';
  const tallLabel = document.createElement('span');
  tallLabel.className = 'hud-footer-label';
  tallLabel.textContent = 'how tall?';
  const tallValue = document.createElement('span');
  tallValue.className = 'hud-footer-value';
  const tallComparison = document.createElement('span');
  tallComparison.className = 'hud-footer-comparison';
  tallComparison.textContent = '...';
  leftCell.append(tallLabel, tallValue, tallComparison);

  const rightCell = document.createElement('div');
  rightCell.className = 'hud-footer-cell';
  const agoComparison = document.createElement('span');
  agoComparison.className = 'hud-footer-comparison';
  agoComparison.textContent = '...';
  const agoValue = document.createElement('span');
  agoValue.className = 'hud-footer-value';
  const agoLabelEl = document.createElement('span');
  agoLabelEl.className = 'hud-footer-label';
  agoLabelEl.textContent = 'how long ago?';
  rightCell.append(agoComparison, agoValue, agoLabelEl);

  footer.append(leftCell, rightCell);

  root.append(big, side, footer, prompt);

  function paint(sim: SimState): void {
    const bricks = bricksFor(sim.years);
    yearsEl.textContent = fmtInt(bricks);
    tallValue.textContent = fmtMeters(heightM(sim));
    agoValue.textContent = `${fmtInt(bricks)} years`;
  }

  paint(initialSim());

  return {
    update: paint,
    // The prompt and the footer are two faces of the same "have we scrolled
    // yet" state, so one call toggles both: hasScrolled true hides the
    // prompt and shows the footer, false (a replay) puts them back.
    setHasScrolled(hasScrolled: boolean) {
      prompt.classList.toggle('off', hasScrolled);
      footer.classList.toggle('visible', hasScrolled);
    },
    setSound(enabled: boolean) {
      soundButton.setAttribute('aria-pressed', String(enabled));
      soundButton.textContent = enabled ? 'sound on' : 'sound';
    },
    setColor(colorId: string) {
      colorPicker.setSelected(colorId);
    },
    setComparisons(c: { tall: string; ago: string }) {
      tallComparison.textContent = c.tall;
      agoComparison.textContent = c.ago;
    },
    setNext(text: string | null) {
      teaser.hidden = text === null;
      teaserValue.textContent = text ?? '';
    },
  };
}
