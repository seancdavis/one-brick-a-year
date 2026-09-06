import { buildBeats, timeLabel } from './beats';
import { BRICK_M } from './constants';
import type { IconId } from './icon-paths';
import type { Personalization } from './personalize';

// The picture-book palette a landmark's cut-paper icon is drawn in (see
// src/render/stage.ts, which maps each name to its resolved CSS token):
// things (kind 'thing') are navy or leaf, time events (kind 'time') are
// mustard or coral. Neighbors on the same side (adjacent once sorted by
// meters, same order src/lib/layout.ts stacks them in) use different colors
// so the two flavors of each kind visibly alternate — which is why the
// tables below are authored in ascending order with the color alternating
// down the list.
export type PaperColor = 'navy' | 'leaf' | 'mustard' | 'coral';

// A landmark is either a physical "thing" (drawn on the left, compared by
// height) or a "time" event (drawn on the right, compared by how long ago)
// — see src/lib/layout.ts, which sorts on this to build the two-sided
// layout. Only a "thing" carries tallerThanPhrase — src/lib/comparisons.ts's
// tallerThan plugs the tallest passed thing's phrase into the footer's "how
// tall?" comparison; a "time" event has no height to compare, so it has none.
interface LandmarkBase {
  id: string;
  meters: number;
  years: number;
  label: string;
  icon: IconId;
  paper: PaperColor;
}

// How a thing is compared to the stack. A 'tall' thing is measured against
// the stack standing up; a 'flat' one only makes sense laid on its side (a
// river, a trail, a marathon), and its phrase says so — every 'flat' phrase
// begins "laid flat,".
export type Orientation = 'tall' | 'flat';

export interface ThingLandmark extends LandmarkBase {
  kind: 'thing';
  orientation: Orientation;
  // Footer copy for "how tall?" once the stack has passed this thing, e.g.
  // "taller than a door!" — every phrase ends in "!" for the exclamation the
  // picture-book copy uses throughout.
  tallerThanPhrase: string;
}

export interface TimeLandmark extends LandmarkBase {
  kind: 'time';
}

export type Landmark = ThingLandmark | TimeLandmark;

// Each landmark is authored in whichever unit is natural for it — a known
// height in meters, or a known age in years — and the other field is
// derived from BRICK_M exactly once, here.
function fromYears(years: number): { years: number; meters: number } {
  return { years, meters: years * BRICK_M };
}

function fromMeters(meters: number): { meters: number; years: number } {
  return { meters, years: meters / BRICK_M };
}

// The physical comparisons, ascending by height. Every row keeps a one-line
// source comment; facts are checked, never invented. Regenerate the skeleton
// from docs/content/candidate-heights.md with
// `node scripts/candidates-to-data.mjs`.
function buildThings(profile: Personalization): ThingLandmark[] {
  return [
    {
      // LEGO Group standard brick: 9.6 mm tall excluding studs.
      id: 'brick',
      label: 'one LEGO brick',
      icon: 'bricks',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than one brick!',
      ...fromMeters(0.0096),
    },
    {
      // A standard LEGO minifigure, about 4 cm without its hat.
      id: 'minifigure',
      label: 'a LEGO minifigure',
      icon: 'person',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a minifigure!',
      ...fromMeters(0.04),
    },
    {
      // A standard wax crayon, about 9 cm.
      id: 'crayon',
      label: 'a crayon',
      icon: 'pencil',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a crayon!',
      ...fromMeters(0.09),
    },
    {
      // A typical eating banana, about 18 cm.
      id: 'banana',
      label: 'a banana',
      icon: 'banana',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a banana!',
      ...fromMeters(0.18),
    },
    {
      // A new, unsharpened pencil, about 19 cm.
      id: 'pencil',
      label: 'a pencil',
      icon: 'pencil',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a pencil!',
      ...fromMeters(0.19),
    },
    {
      // A regulation basketball, about 24 cm across.
      id: 'basketball',
      label: 'a basketball',
      icon: 'ball',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a basketball!',
      ...fromMeters(0.24),
    },
    {
      // A house cat at the shoulder, about 25 cm.
      id: 'cat',
      label: 'a cat',
      icon: 'cat',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a cat!',
      ...fromMeters(0.25),
    },
    {
      // Everyday reference object, approximate: a standard 30 cm school ruler.
      id: 'ruler',
      label: 'a school ruler',
      icon: 'ruler',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a school ruler!',
      ...fromMeters(0.3),
    },
    {
      // A Labrador at the shoulder, about 57 cm.
      id: 'dog',
      label: 'a big dog',
      icon: 'dog',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a big dog!',
      ...fromMeters(0.57),
    },
    {
      // An average adult, about 1.75 m.
      id: 'grown-up',
      label: 'a grown-up',
      icon: 'person',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a grown-up!',
      ...fromMeters(1.75),
    },
    {
      // Everyday reference object, approximate: standard interior door height about 2.03 m (80 in).
      id: 'door',
      label: 'a door',
      icon: 'door',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a door!',
      ...fromMeters(2.0),
    },
    {
      // A typical 8 ft ceiling, about 2.4 m.
      id: 'ceiling',
      label: 'a ceiling',
      icon: 'home',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the ceiling!',
      ...fromMeters(2.4),
    },
    {
      // A basketball hoop, 10 ft (3.05 m).
      id: 'hoop',
      label: 'a basketball hoop',
      icon: 'ball',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a basketball hoop!',
      ...fromMeters(3.0),
    },
    {
      // A tall giraffe, about 5.5 m.
      id: 'giraffe',
      label: 'a giraffe',
      icon: 'dinosaur',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a giraffe!',
      ...fromMeters(5.5),
    },
    {
      // Everyday reference object, approximate: rules of thumb, one story
      // about 4 m, two stories about 8 m, a ten-story apartment building
      // about 30 m.
      id: 'home',
      label: 'your home',
      icon: 'home',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than your home!',
      ...fromMeters(profile.homeMeters),
    },
    {
      // A full-size school bus, about 12 m long.
      id: 'school-bus',
      label: 'a school bus',
      icon: 'bus',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'as long as a school bus!',
      ...fromMeters(12),
    },
    {
      // Brachiosaurus with its head up, about 13 m.
      id: 'brachiosaurus',
      label: 'a Brachiosaurus',
      icon: 'dinosaur',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than a Brachiosaurus!',
      ...fromMeters(13),
    },
    {
      // A blue whale, about 30 m long.
      id: 'blue-whale',
      label: 'a blue whale',
      icon: 'whale',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'as long as a blue whale!',
      ...fromMeters(30),
    },
    {
      // The Statue of Liberty without her pedestal, 46 m (US NPS).
      id: 'liberty-statue',
      label: 'Liberty without her base',
      icon: 'statue',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the statue alone!',
      ...fromMeters(46),
    },
    {
      // The Leaning Tower of Pisa, about 56 m on its high side.
      id: 'pisa',
      label: 'the Leaning Tower of Pisa',
      icon: 'tower',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the Leaning Tower!',
      ...fromMeters(56),
    },
    {
      // General Sherman, the biggest tree by volume, about 84 m.
      id: 'general-sherman',
      label: 'the biggest tree',
      icon: 'tree',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the biggest tree!',
      ...fromMeters(84),
    },
    {
      // 93 m ground to torch (US National Park Service).
      id: 'liberty',
      label: 'the Statue of Liberty',
      icon: 'statue',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the Statue of Liberty!',
      ...fromMeters(93),
    },
    {
      // Elizabeth Tower ("Big Ben"), 96 m.
      id: 'big-ben',
      label: 'Big Ben',
      icon: 'tower',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than Big Ben!',
      ...fromMeters(96),
    },
    {
      // Hyperion, the tallest known tree, 116 m; its location is secret.
      id: 'hyperion',
      label: 'the tallest tree',
      icon: 'tree',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the tallest tree!',
      ...fromMeters(116),
    },
    {
      // The Great Pyramid of Giza, 139 m today (146 m when new).
      id: 'great-pyramid',
      label: 'the Great Pyramid',
      icon: 'pyramid',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the Great Pyramid!',
      ...fromMeters(139),
    },
    {
      // The Space Needle, Seattle, 184 m.
      id: 'space-needle',
      label: 'the Space Needle',
      icon: 'rocket',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the Space Needle!',
      ...fromMeters(184),
    },
    {
      // 330 m including antennas (SETE, 2022).
      id: 'eiffel',
      label: 'the Eiffel Tower',
      icon: 'tower',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the Eiffel Tower!',
      ...fromMeters(330),
    },
    {
      // The Empire State Building, 443 m to the tip.
      id: 'empire-state',
      label: 'the Empire State Building',
      icon: 'skyscraper',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the Empire State Building!',
      ...fromMeters(443),
    },
    {
      // 828 m (Council on Tall Buildings and Urban Habitat).
      id: 'burj',
      label: 'the tallest building on Earth',
      icon: 'tower',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the tallest building on Earth!',
      ...fromMeters(828),
    },
    {
      // Angel Falls, Venezuela, 979 m — the tallest waterfall.
      id: 'angel-falls',
      label: 'the tallest waterfall',
      icon: 'wave',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the tallest waterfall!',
      ...fromMeters(979),
    },
    {
      // The Grand Canyon, about 1,857 m rim to river.
      id: 'grand-canyon-deep',
      label: 'the Grand Canyon',
      icon: 'mountain',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'as tall as the Grand Canyon is deep!',
      ...fromMeters(1857),
    },
    {
      // Mount Fuji, 3,776 m.
      id: 'fuji',
      label: 'Mount Fuji',
      icon: 'mountain',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than Mount Fuji!',
      ...fromMeters(3776),
    },
    {
      // Denali, 6,190 m — the tallest mountain in North America.
      id: 'denali',
      label: 'Denali',
      icon: 'mountain',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'taller than the tallest mountain in North America!',
      ...fromMeters(6190),
    },
    {
      // 8,848.86 m (China-Nepal joint survey, 2020).
      id: 'everest',
      label: 'Mount Everest',
      icon: 'mountain',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'taller than Mount Everest!',
      ...fromMeters(8849),
    },
    {
      // Challenger Deep, about 10,935 m below the surface.
      id: 'deepest-ocean',
      label: 'the deepest ocean',
      icon: 'wave',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'as tall as the ocean is deep!',
      ...fromMeters(10935),
    },
    {
      // Typical commercial cruise altitude 33,000 to 42,000 ft (FAA Pilot's
      // Handbook of Aeronautical Knowledge).
      id: 'planes',
      label: 'where airplanes fly',
      icon: 'plane',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'higher than airplanes fly!',
      ...fromMeters(11000),
    },
    {
      // A Ruppell's vulture struck by an airliner at about 11.3 km; rounded
      // to 12 km as the highest recorded bird flight.
      id: 'highest-bird',
      label: 'the highest a bird has flown',
      icon: 'bird',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'higher than any bird has flown!',
      ...fromMeters(12000),
    },
    {
      // The ozone layer, 15 to 35 km up; 20 km is where it is thickest.
      id: 'ozone',
      label: 'the ozone layer',
      icon: 'earth',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'higher than the ozone layer!',
      ...fromMeters(20000),
    },
    {
      // Baumgartner's 39 km jump, 2012 (Eustace reached 41 km in 2014).
      id: 'balloon-jump',
      label: 'the highest balloon jump',
      icon: 'bubbles',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'higher than anyone has jumped from!',
      ...fromMeters(39000),
    },
    {
      // A marathon, 42.195 km.
      id: 'marathon',
      label: 'a marathon',
      icon: 'person',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'flat',
      tallerThanPhrase: 'laid flat, as long as a marathon!',
      ...fromMeters(42200),
    },
    {
      // Meteors burn up 75 to 100 km up.
      id: 'meteors',
      label: 'where meteors burn up',
      icon: 'flame',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'higher than shooting stars!',
      ...fromMeters(80000),
    },
    {
      // Noctilucent clouds, about 85 km up — the highest clouds there are.
      id: 'highest-clouds',
      label: 'the highest clouds',
      icon: 'bubbles',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'higher than the highest clouds!',
      ...fromMeters(85000),
    },
    {
      // Karman line, 100 km (FAI).
      id: 'space',
      label: 'space begins',
      icon: 'rocket',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'past the edge of space!',
      ...fromMeters(100000),
    },
    {
      // ISS orbit about 400 to 420 km (NASA).
      id: 'iss',
      label: 'the space station',
      icon: 'station',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'tall',
      tallerThanPhrase: 'higher than the space station!',
      ...fromMeters(400000),
    },
    {
      // Most satellites sit in low Earth orbit; the Starlink shells are at
      // about 550 km.
      id: 'satellites',
      label: 'most satellites',
      icon: 'ring',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'higher than most satellites!',
      ...fromMeters(550000),
    },
    {
      // The Great Barrier Reef, about 2,300 km long.
      id: 'barrier-reef',
      label: 'the Great Barrier Reef',
      icon: 'wave',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'flat',
      tallerThanPhrase: 'laid flat, as long as the Great Barrier Reef!',
      ...fromMeters(2300000),
    },
    {
      // The Moon's diameter, 3,474 km (NASA).
      id: 'moon-wide',
      label: 'the Moon, side to side',
      icon: 'earth',
      kind: 'thing',
      paper: 'navy',
      orientation: 'flat',
      tallerThanPhrase: 'laid flat, as wide as the Moon!',
      ...fromMeters(3474000),
    },
    {
      // The Appalachian Trail, about 3,500 km; walking it takes six months.
      id: 'appalachian',
      label: 'the Appalachian Trail',
      icon: 'mountain',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'flat',
      tallerThanPhrase: 'laid flat, as long as the Appalachian Trail!',
      ...fromMeters(3500000),
    },
    {
      // The Mississippi, about 3,730 km.
      id: 'mississippi',
      label: 'the Mississippi River',
      icon: 'wave',
      kind: 'thing',
      paper: 'navy',
      orientation: 'flat',
      tallerThanPhrase: 'laid flat, as long as the Mississippi River!',
      ...fromMeters(3730000),
    },
    {
      // The Amazon, about 6,400 km; one fifth of all river water on Earth.
      id: 'amazon',
      label: 'the Amazon River',
      icon: 'tree',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'flat',
      tallerThanPhrase: 'laid flat, as long as the Amazon!',
      ...fromMeters(6400000),
    },
    {
      // The Nile, about 6,650 km.
      id: 'nile',
      label: 'the Nile',
      icon: 'wave',
      kind: 'thing',
      paper: 'navy',
      orientation: 'flat',
      tallerThanPhrase: 'laid flat, as long as the Nile!',
      ...fromMeters(6650000),
    },
    {
      // The main Ming wall, about 8,850 km (all the walls together, 21,196 km).
      id: 'great-wall-flat',
      label: 'the Great Wall of China',
      icon: 'wall',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'flat',
      tallerThanPhrase: 'laid flat, as long as the Great Wall of China!',
      ...fromMeters(8850000),
    },
    {
      // Mean diameter 12,742 km (NASA).
      id: 'earth-wide',
      label: 'as wide as the whole Earth',
      icon: 'earth',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'as tall as the Earth is wide!',
      ...fromMeters(12742000),
    },
    {
      // Pole to pole, about 20,000 km — half the way around.
      id: 'pole-to-pole',
      label: 'from the North Pole to the South Pole',
      icon: 'snowflake',
      kind: 'thing',
      paper: 'leaf',
      orientation: 'flat',
      tallerThanPhrase: 'laid flat, it would reach from pole to pole!',
      ...fromMeters(20000000),
    },
    {
      // Equatorial circumference 40,075 km (WGS84).
      id: 'around',
      label: 'all the way around the Earth',
      icon: 'ring',
      kind: 'thing',
      paper: 'navy',
      orientation: 'tall',
      tallerThanPhrase: 'longer than the way around the Earth!',
      ...fromMeters(40075000),
    },
  ];
}

// The right-side landmarks are the time events, derived from BEATS so an
// event is authored exactly once (src/lib/beats.ts). The label is the beat's
// title in the picture-book's lowercase voice; icon and paper come straight
// from the beat.
function timeLandmarks(profile: Personalization): TimeLandmark[] {
  return buildBeats(profile).map((beat) => ({
    id: beat.id,
    label: timeLabel(beat.title),
    icon: beat.icon,
    kind: 'time',
    paper: beat.paper,
    ...fromYears(beat.atYears),
  }));
}

export function buildLandmarks(profile: Personalization): Landmark[] {
  const landmarks: Landmark[] = [...buildThings(profile), ...timeLandmarks(profile)];
  return landmarks.sort((a, b) => a.meters - b.meters);
}
