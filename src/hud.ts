// The HUD: a big years-ago counter, the "How tall" / "How long ago" side
// headings, the scroll prompt, and controls (the sound toggle, the compact
// color swatch row, and "Restart", which ends the session, resets the
// build, and reopens the start screen).
// Ports the prototype's HUD markup and copy (docs/prototype/brick-stack.html).
// DOM glue only.

import { createColorPicker } from './color-picker';
import { BRICK_M } from './lib/constants';
import { fmtInt, fmtMeters } from './lib/format';
import { bricksFor, initialSim, type SimState } from './lib/sim';

const HUD_SWATCH_SIZE_PX = 18;

export function createHud(
  root: HTMLElement,
  opts: { colorId: string; onSoundToggle: () => void; onRestart: () => void; onColorSelect: (colorId: string) => void },
): {
  update(sim: SimState): void;
  hidePrompt(): void;
  showPrompt(): void;
  setSound(enabled: boolean): void;
  setColor(colorId: string): void;
} {
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.setAttribute('aria-live', 'off');

  const years = document.createElement('div');
  years.className = 'big';

  const row = document.createElement('div');
  row.className = 'row';
  const bricks = document.createElement('b');
  row.append('years ago', document.createElement('br'), bricks, ' bricks');

  // Left side heading: how tall the stack is, with the live height readout
  // beneath it (moved out of the counter row above, which keeps only the
  // years and brick count).
  const heightHeading = document.createElement('div');
  heightHeading.className = 'side-heading';
  heightHeading.textContent = 'How tall';
  const heightValue = document.createElement('div');
  heightValue.className = 'side-value';

  const controls = document.createElement('div');
  controls.className = 'hud-controls';

  const colorPicker = createColorPicker(HUD_SWATCH_SIZE_PX, opts.colorId, opts.onColorSelect);
  colorPicker.el.classList.add('color-picker--compact');

  const soundButton = document.createElement('button');
  soundButton.type = 'button';
  soundButton.className = 'hud-button';
  soundButton.setAttribute('aria-pressed', 'false');
  soundButton.textContent = 'Sound off';
  soundButton.addEventListener('click', opts.onSoundToggle);

  const restartButton = document.createElement('button');
  restartButton.type = 'button';
  restartButton.className = 'hud-button';
  restartButton.textContent = 'Restart';
  restartButton.addEventListener('click', opts.onRestart);

  controls.append(soundButton, restartButton);

  hud.append(years, row, heightHeading, heightValue, colorPicker.el, controls);

  // Right side heading: how long ago the milestones on that side happened,
  // sitting above the milestone (time event) column.
  const sidePanel = document.createElement('div');
  sidePanel.className = 'side-panel side-panel--right';
  const lengthHeading = document.createElement('div');
  lengthHeading.className = 'side-heading';
  lengthHeading.textContent = 'How long ago';
  sidePanel.append(lengthHeading);

  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.append('Scroll to build. Scroll back to undo.', document.createElement('br'), 'Every brick is one year.');

  root.append(hud, sidePanel, prompt);

  function paint(sim: SimState): void {
    const wholeBricks = bricksFor(sim.years);
    years.textContent = fmtInt(wholeBricks);
    bricks.textContent = fmtInt(wholeBricks);
    heightValue.textContent = `${fmtMeters(wholeBricks * BRICK_M)} tall`;
  }

  paint(initialSim());

  return {
    update: paint,
    hidePrompt() {
      prompt.classList.add('off');
    },
    showPrompt() {
      prompt.classList.remove('off');
    },
    setSound(enabled: boolean) {
      soundButton.setAttribute('aria-pressed', String(enabled));
      soundButton.textContent = enabled ? 'Sound on' : 'Sound off';
    },
    setColor(colorId: string) {
      colorPicker.setSelected(colorId);
    },
  };
}
