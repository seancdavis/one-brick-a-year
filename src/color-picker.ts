// A row of LEGO color swatch buttons, shared by the start screen (28px
// squares) and the compact version in the HUD (18px squares). DOM glue
// only — the palette and validation live in src/lib/lego-colors.ts.

import { colorById, LEGO_COLORS } from './lib/lego-colors';

export function createColorPicker(
  sizePx: number,
  initialColorId: string,
  onSelect: (colorId: string) => void,
): { el: HTMLElement; setSelected(colorId: string): void } {
  const row = document.createElement('div');
  row.className = 'color-picker';
  row.style.setProperty('--swatch-size', `${sizePx}px`);
  // A tap or drag on the row's own padding must not be read as a scroll
  // gesture; the buttons themselves are already excluded by input.ts.
  row.setAttribute('data-scroll-ignore', '');

  const buttons = new Map<string, HTMLButtonElement>();

  for (const color of LEGO_COLORS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-swatch';
    button.style.backgroundColor = color.hex;
    button.setAttribute('aria-label', color.name);
    button.setAttribute('aria-pressed', String(color.id === initialColorId));
    button.addEventListener('click', () => {
      setSelected(color.id);
      onSelect(color.id);
    });
    buttons.set(color.id, button);
    row.append(button);
  }

  function setSelected(colorId: string): void {
    const resolvedId = colorById(colorId).id;
    for (const [id, button] of buttons) {
      button.setAttribute('aria-pressed', String(id === resolvedId));
    }
  }

  return { el: row, setSelected };
}
