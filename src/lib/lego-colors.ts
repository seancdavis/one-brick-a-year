// The brick color picker's palette (src/color-picker.ts, wired on the start
// screen and in the HUD) and the shading math src/render/stage.ts uses to
// draw a brick's top edge, bottom edge, seam, and studs from one base color.
//
// Official LEGO color names; hex values approximate (Ryan Howerter's color
// chart / BrickLink).

export interface LegoColor {
  id: string;
  name: string;
  hex: string;
}

export const LEGO_COLORS: readonly LegoColor[] = [
  { id: 'bright-red', name: 'Bright Red', hex: '#C91A09' },
  { id: 'bright-blue', name: 'Bright Blue', hex: '#0055BF' },
  { id: 'bright-yellow', name: 'Bright Yellow', hex: '#F2CD37' },
  { id: 'dark-green', name: 'Dark Green', hex: '#237841' },
  { id: 'bright-orange', name: 'Bright Orange', hex: '#FE8A18' },
  { id: 'medium-azur', name: 'Medium Azur', hex: '#36AEBF' },
  { id: 'bright-purple', name: 'Bright Purple', hex: '#C870A0' },
  { id: 'bright-yellowish-green', name: 'Bright Yellowish Green', hex: '#BBE90B' },
  { id: 'white', name: 'White', hex: '#F4F4F4' },
  { id: 'black', name: 'Black', hex: '#1B2A34' },
  { id: 'dark-stone-grey', name: 'Dark Stone Grey', hex: '#6C6E68' },
  { id: 'reddish-brown', name: 'Reddish Brown', hex: '#582A12' },
];

export const DEFAULT_COLOR_ID = 'bright-red';

const DEFAULT_COLOR = LEGO_COLORS.find((c) => c.id === DEFAULT_COLOR_ID)!;

export function colorById(id: string): LegoColor {
  return LEGO_COLORS.find((c) => c.id === id) ?? DEFAULT_COLOR;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHexByte(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');
}

// amount in -1..1: negative mixes the color toward black, positive toward
// white. Used for a brick's lighter top edge and studs (positive) and its
// darker bottom edge and seam (negative).
export function shade(hex: string, amount: number): string {
  const t = Math.min(1, Math.max(-1, amount));
  const target = t < 0 ? 0 : 255;
  const mix = Math.abs(t);
  const [r, g, b] = hexToRgb(hex);
  const blend = (channel: number) => channel + (target - channel) * mix;
  return `#${toHexByte(blend(r))}${toHexByte(blend(g))}${toHexByte(blend(b))}`;
}
