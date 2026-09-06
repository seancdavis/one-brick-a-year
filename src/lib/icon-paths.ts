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

  // A rounded slab with the screen punched out.
  phone: 'M7,1H17A2,2 0 0 1 19,3V21A2,2 0 0 1 17,23H7A2,2 0 0 1 5,21V3A2,2 0 0 1 7,1ZM7,5H17V19H7Z',

  // A screen box with the picture punched out, on a stem and a foot.
  tv: 'M2,3H22V17H2ZM5,6H19V14H5ZM11,17H13V20H11ZM7,20H17V22H7Z',

  // A glass bulb over a screw base of two bands.
  bulb: 'M18.5,9A6.5,6.5 0 1 1 5.5,9A6.5,6.5 0 1 1 18.5,9ZM9,15.5H15V18.5H9ZM9.5,19.5H14.5V21.5H9.5Z',

  // A camera body with the lens punched out and the viewfinder bump on top.
  camera: 'M2,7H22V21H2ZM16,14A4,4 0 1 1 8,14A4,4 0 1 1 16,14ZM8,4H14V7H8Z',

  // Two hollow wheels under a triangular frame.
  bicycle:
    'M11,18A5,5 0 1 1 1,18A5,5 0 1 1 11,18ZM9,18A3,3 0 1 1 3,18A3,3 0 1 1 9,18Z' +
    'M23,18A5,5 0 1 1 13,18A5,5 0 1 1 23,18ZM21,18A3,3 0 1 1 15,18A3,3 0 1 1 21,18Z' +
    'M7,13L12,4L17,13Z',

  // An open book: two pages tilting away from a center gutter.
  book: 'M2,5L11,7V21L2,19ZM13,7L22,5V19L13,21Z',

  // A tire band with a hub floating in its hole.
  wheel:
    'M22,12A10,10 0 1 1 2,12A10,10 0 1 1 22,12ZM19,12A7,7 0 1 1 5,12A7,7 0 1 1 19,12Z' +
    'M15,12A3,3 0 1 1 9,12A3,3 0 1 1 15,12Z',

  // A battlemented wall with mortar lines cut into it.
  wall: 'M2,8H22V20H2ZM2,5H6V8H2ZM10,5H14V8H10ZM18,5H22V8H18ZM7,9H8V13H7ZM16,9H17V13H16ZM11,14H12V19H11Z',

  // A loaf: a domed top on a flat base.
  bread: 'M3,12A9,7 0 0 1 21,12V20H3Z',

  // A cat head: two pointed ears, a round chin, two eyes punched out.
  cat: 'M4,3L8,8H16L20,3V14A8,8 0 0 1 4,14ZM10,12A1,1 0 1 1 8,12A1,1 0 1 1 10,12ZM16,12A1,1 0 1 1 14,12A1,1 0 1 1 16,12Z',

  // A dog in side view: tail, body, two legs, head, muzzle, and an ear.
  dog: 'M1,10H14V17H1ZM1,5H3V10H1ZM3,17H5V21H3ZM10,17H12V21H10ZM14,7H20V13H14ZM20,9H23V12H20ZM14,4H17V7H14Z',

  // A mammoth: domed body on two legs, with a trunk and a tusk.
  mammoth: 'M4,16V11A6,5 0 0 1 16,11V16ZM5,16H8V21H5ZM12,16H15V21H12ZM16,8H21V15H16ZM18,15H20V21H18ZM21,12L23,17L21,16Z',

  // A conifer: a triangular canopy over a trunk.
  tree: 'M12,2L20,14H4ZM11,14H13V22H11Z',

  // A pyramid on a strip of desert, with the near edge cut as a seam.
  pyramid: 'M12,3L22,20H2ZM11.6,6H12.4V19H11.6ZM1,20H23V22H1Z',

  // A gull in flight: two wings meeting at a shallow body.
  bird: 'M2,13Q7,5 12,12Q17,5 22,13Q17,9 12,15Q7,9 2,13Z',

  // A fish in side view with a straight tail fin and an eye punched out.
  fish:
    'M22,12C22,16 17,19 12,19C8,19 5,17 4,15L1,19V5L4,9C5,7 8,5 12,5C17,5 22,8 22,12Z' +
    'M18,10A1.2,1.2 0 1 1 15.6,10A1.2,1.2 0 1 1 18,10Z',

  // A beetle: round shell with a wing seam, a head, and three pairs of legs.
  bug:
    'M19,15A7,7 0 1 1 5,15A7,7 0 1 1 19,15ZM11.6,9H12.4V21H11.6Z' +
    'M15,5A3,3 0 1 1 9,5A3,3 0 1 1 15,5Z' +
    'M1,10H5V11.5H1ZM1,14H5V15.5H1ZM1,18H5V19.5H1Z' +
    'M19,10H23V11.5H19ZM19,14H23V15.5H19ZM19,18H23V19.5H19Z',

  // Three bars crossed at sixty degrees. Only the center is covered by all
  // three, so it stays filled where any two alone would cancel to a hole.
  snowflake: 'M11,2H13V22H11ZM6.13,3.84L16.13,21.16L17.87,20.16L7.87,2.84ZM16.13,2.84L6.13,20.16L7.87,21.16L17.87,3.84Z',

  // A teardrop flame with a smaller flame cut out of its middle.
  flame:
    'M12,2C15,6 18,9 18,14A6,6 0 1 1 6,14C6,9 9,6 12,2Z' +
    'M12,10C13.5,12 15,13.5 15,15.5A3,3 0 1 1 9,15.5C9,13.5 10.5,12 12,10Z',

  // A whale: rounded body, notched fluke, and an eye punched out.
  whale:
    'M2,14C2,9 7,6 13,6C18,6 21,9 21,12L23,9V19L21,16C21,18 18,19 13,19C7,19 2,18 2,14Z' +
    'M7,11A1,1 0 1 1 5,11A1,1 0 1 1 7,11Z',

  // Four petals tangent to a center disc, on a stem with one leaf.
  flower:
    'M14.5,8A2.5,2.5 0 1 1 9.5,8A2.5,2.5 0 1 1 14.5,8Z' +
    'M14.5,3A2.5,2.5 0 1 1 9.5,3A2.5,2.5 0 1 1 14.5,3Z' +
    'M19.5,8A2.5,2.5 0 1 1 14.5,8A2.5,2.5 0 1 1 19.5,8Z' +
    'M14.5,13A2.5,2.5 0 1 1 9.5,13A2.5,2.5 0 1 1 14.5,13Z' +
    'M9.5,8A2.5,2.5 0 1 1 4.5,8A2.5,2.5 0 1 1 9.5,8Z' +
    'M11.3,15.5H12.7V22H11.3Z' +
    'M12.7,17.5C15,16 18,16.5 19.5,17C18.5,19.5 15,20 12.7,19.5Z',

  // Two ribbons of water, the lower one offset from the upper.
  wave:
    'M1,8C4,4 8,12 12,8C16,4 20,12 23,8V11C20,15 16,7 12,11C8,15 4,7 1,11Z' +
    'M1,15C4,11 8,19 12,15C16,11 20,19 23,15V18C20,22 16,14 12,18C8,22 4,14 1,18Z',

  // A pencil: eraser, shaft with a band cut out of it, and a sharpened point.
  pencil: 'M8,4H16V19H8ZM8,6H16V7H8ZM8,19L12,23L16,19ZM8,1H16V4H8Z',

  // A ball with two seams cut across it.
  ball: 'M22,12A10,10 0 1 1 2,12A10,10 0 1 1 22,12ZM11.5,2.2H12.5V21.8H11.5ZM2.2,11.5H21.8V12.5H2.2Z',

  // A crescent, the two tips tapering.
  banana: 'M3,5C3,14 9,21 20,21C21,21 22,20 22,19C12,19 6,13 6,5C5,4.5 4,4.5 3,5Z',

  // A bus: windows and a door punched out of the body, on two wheels.
  bus:
    'M2,4H22V17H2ZM4,6H9V10H4ZM11,6H16V10H11ZM18,6H21V10H18ZM18,12H21V16H18Z' +
    'M9,19.5A2.5,2.5 0 1 1 4,19.5A2.5,2.5 0 1 1 9,19.5Z' +
    'M20,19.5A2.5,2.5 0 1 1 15,19.5A2.5,2.5 0 1 1 20,19.5Z',
} as const;

export type IconId = keyof typeof ICON_PATHS;
export const ICON_IDS = Object.keys(ICON_PATHS) as readonly IconId[];
