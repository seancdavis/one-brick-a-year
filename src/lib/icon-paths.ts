// Raw SVG path data for each landmark icon, hand-authored in a 24×24 box.
// This is the single source of truth for the icon catalog: IconId and
// ICON_IDS are both derived from these keys, so adding or removing an icon
// only ever means editing this object.
//
// Kept in src/lib/ (not src/render/) because the canvas path type Vitest's
// Node environment lacks isn't available here: this file stays pure so it
// can be unit tested, and src/render/icons.ts wraps these strings for canvas.
//
// Every path is a flat, single-color silhouette. Where a shape cuts a hole
// (a window, a knob, a notch), the hole subpath is fully contained inside
// (or shares only a boundary edge with) an outer subpath, and the whole
// icon is filled with the 'evenodd' rule in src/render/icons.ts — that
// combination is what makes the hole read as empty space.

export const ICON_PATHS = {
  // A small stack of three 2×4 bricks, studs on the top brick only.
  bricks:
    'M4,1H6.5V3H4ZM8,1H10.5V3H8ZM12,1H14.5V3H12ZM16,1H18.5V3H16Z' +
    'M4,3H20V7H4ZM4,8H20V12H4ZM4,13H20V17H4Z',

  // A ruler bar with four tick notches cut into the top edge.
  ruler: 'M2,9H22V15H2ZM6,9H7V12H6ZM10,9H11V12H10ZM14,9H15V12H14ZM18,9H19V12H18Z',

  // A tall rounded-top door with a knob hole punched out.
  door: 'M5,22V6A4,4 0 0 1 9,2H15A4,4 0 0 1 19,6V22ZM16.3,13A1.3,1.3 0 1 1 13.7,13A1.3,1.3 0 1 1 16.3,13Z',

  // A house silhouette (base + roof) with a doorway notch open to the ground.
  home: 'M4,22V12L12,4L20,12V22ZM10,22V16H14V22Z',

  // A rolled scroll: a body with tangent rolls at each end.
  scroll: 'M8,6H16V18H8ZM15,3A3,3 0 1 1 9,3A3,3 0 1 1 15,3ZM15,21A3,3 0 1 1 9,21A3,3 0 1 1 15,21Z',

  // A simplified Statue of Liberty: pedestal, robe, head, raised arm, torch.
  statue:
    'M7,20H17V22H7Z' +
    'M8,20L10,12H14L16,20Z' +
    'M14,10A2,2 0 1 1 10,10A2,2 0 1 1 14,10Z' +
    'M14,12L15,11L19,4L17,6Z' +
    'M20.5,3A1,1 0 1 1 18.5,3A1,1 0 1 1 20.5,3Z',

  // A tapering tower with an open leg arch at the base, like the Eiffel Tower.
  tower: 'M5,22L19,22L12.6,2L11.4,2ZM9,22L15,22L12,14Z',

  // A stepped, tapering skyscraper silhouette.
  skyscraper: 'M4,22L20,22L20,16L17,16L17,10L14,10L14,2L10,2L10,10L7,10L7,16L4,16Z',

  // A simple person: a head circle over a shouldered body.
  person: 'M15,8A3,3 0 1 1 9,8A3,3 0 1 1 15,8ZM7,22L17,22L16,12L8,12Z',

  // A twin-peak mountain range, the taller peak standing for Everest.
  mountain: 'M2,20L9,6L13,13L17,4L22,20Z',

  // A side-view airplane: nose, fuselage, tail fin, tail point, and a wing.
  plane: 'M23,12L15,9.5L12,9.5L12,2L9.5,9.5L2,10.5L9.5,12.5L12,18L14,12.5Z',

  // A rocket with fins and a porthole window hole.
  rocket: 'M12,2L15,10L15,18L19,22L15,20L9,20L5,22L9,18L9,10ZM13.5,12A1.5,1.5 0 1 1 10.5,12A1.5,1.5 0 1 1 13.5,12Z',

  // A body with two solar panels, for the space station.
  station: 'M9,10H15V14H9ZM2,9H8V15H2ZM16,9H22V15H16Z',

  // A jagged irregular rock.
  asteroid: 'M12,3L17,5L20,9L19,15L21,18L16,21L10,21L5,18L3,13L6,7Z',

  // A long-necked sauropod, side view, with two simple legs.
  dinosaur: 'M2,11L3,8L6,6L10,3.5L15,3L20,5L23,7.5L19,9L16,9L16,14L14,14L14,9L10,9L9,14L7,14L7,9L4,10Z',

  // A segmented oval, three notches cut across the body.
  trilobite: 'M21,12A9,6 0 1 1 3,12A9,6 0 1 1 21,12ZM5,8.7H19V9.3H5ZM4,11.7H20V12.3H4ZM5,14.7H19V15.3H5Z',

  // A circle with two continent-shaped holes cut out.
  earth: 'M22,12A10,10 0 1 1 2,12A10,10 0 1 1 22,12ZM6,6L10,5L11,8L9,10L6,9ZM15,14L18,15L19,18L16,19L14,17Z',

  // Three disjoint circles of different sizes.
  bubbles: 'M11,15A4,4 0 1 1 3,15A4,4 0 1 1 11,15ZM21,10A5,5 0 1 1 11,10A5,5 0 1 1 21,10ZM21,19A3,3 0 1 1 15,19A3,3 0 1 1 21,19Z',

  // A circle with a smaller concentric hole, for the nucleus.
  cell: 'M22,12A10,10 0 1 1 2,12A10,10 0 1 1 22,12ZM16,12A4,4 0 1 1 8,12A4,4 0 1 1 16,12Z',

  // A ball fully inside the hole of a thin ring band around it.
  ring:
    'M16,13A4,4 0 1 1 8,13A4,4 0 1 1 16,13Z' +
    'M20.5,13A8.5,5.5 0 1 1 3.5,13A8.5,5.5 0 1 1 20.5,13Z' +
    'M19,13A7,4.8 0 1 1 5,13A7,4.8 0 1 1 19,13Z',
} as const;

export type IconId = keyof typeof ICON_PATHS;
export const ICON_IDS = Object.keys(ICON_PATHS) as readonly IconId[];
